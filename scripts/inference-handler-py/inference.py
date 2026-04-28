"""ONNX Runtime 추론 엔진 (REBUILD21 v2)
transformers 의 Auto-class 매핑 우회 — config.json 직접 파싱 + tokenizer 만 사용.

이유: Qwen3_5ForConditionalGeneration / Gemma4ForConditionalGeneration 가
transformers main 에도 architecture mapping 미등록. 우리는 ONNX session 직접 호출하므로
architecture 매핑 불필요 — config 의 raw 필드만 있으면 충분.
"""
import os
import json
import time
import numpy as np
import onnxruntime as ort
from transformers import PreTrainedTokenizerFast


class GenerativeInferenceEngine:
    def __init__(self, model_dir: str, model_key: str):
        self.model_dir = model_dir
        self.model_key = model_key

        # config.json 직접 파싱 (Auto-class 우회)
        with open(os.path.join(model_dir, 'config.json'), 'r', encoding='utf-8') as f:
            self.config = json.load(f)

        mt = (self.config.get('model_type') or '').lower()
        if 'gemma' in mt:
            self.family = 'gemma4'
        elif 'qwen' in mt:
            self.family = 'qwen3.5'
        else:
            raise ValueError(f'알 수 없는 model_type: {mt}')

        # 텍스트 설정 — text_config 안에 또는 root 에
        text_cfg = self.config.get('text_config') or self.config
        self.num_key_value_heads = text_cfg.get('num_key_value_heads')
        self.head_dim = text_cfg.get('head_dim')
        self.num_hidden_layers = text_cfg.get('num_hidden_layers')
        self.eos_token_id = text_cfg.get('eos_token_id', 2)

        # Gemma 3n 특수 EOS (모델 카드 명시)
        if self.family == 'gemma4':
            self.eos_token_id = 106

        # Tokenizer — AutoTokenizer 우회 (TokenizersBackend 매핑 없으므로 PreTrainedTokenizerFast 직접 사용)
        # tokenizer.json + tokenizer_config.json 의 chat_template / special tokens 만 활용
        tok_cfg = {}
        tcfg_path = os.path.join(model_dir, 'tokenizer_config.json')
        if os.path.exists(tcfg_path):
            with open(tcfg_path, 'r', encoding='utf-8') as f:
                tok_cfg = json.load(f)
        # added_tokens_decoder → 사전 등록된 special tokens
        added = tok_cfg.get('added_tokens_decoder', {})
        special_tokens = []
        for token_id, token_info in added.items():
            if isinstance(token_info, dict) and token_info.get('special'):
                content = token_info.get('content')
                if content:
                    special_tokens.append(content)

        def _tok(name):
            v = tok_cfg.get(name)
            if isinstance(v, dict):
                return v.get('content')
            return v

        self.tokenizer = PreTrainedTokenizerFast(
            tokenizer_file=os.path.join(model_dir, 'tokenizer.json'),
            chat_template=tok_cfg.get('chat_template'),
            eos_token=_tok('eos_token') or '<|endoftext|>',
            bos_token=_tok('bos_token'),
            pad_token=_tok('pad_token'),
            unk_token=_tok('unk_token'),
            additional_special_tokens=special_tokens or tok_cfg.get('additional_special_tokens', []),
            clean_up_tokenization_spaces=tok_cfg.get('clean_up_tokenization_spaces', False),
        )

        # ORT 옵션
        self._opts = ort.SessionOptions()
        self._opts.intra_op_num_threads = max(1, (os.cpu_count() or 4))
        self._opts.graph_optimization_level = ort.GraphOptimizationLevel.ORT_ENABLE_ALL

        self._onnx_dir = os.path.join(model_dir, 'onnx')
        self.embed_session = None
        self.decoder_session = None

        print(f'[engine] init OK family={self.family} layers={self.num_hidden_layers} '
              f'kv_heads={self.num_key_value_heads} head_dim={self.head_dim} eos={self.eos_token_id}')

    def _load_sessions(self):
        if self.embed_session is not None:
            return
        t0 = time.time()
        self.embed_session = ort.InferenceSession(
            os.path.join(self._onnx_dir, 'embed_tokens_q4f16.onnx'),
            self._opts, providers=['CPUExecutionProvider'])
        self.decoder_session = ort.InferenceSession(
            os.path.join(self._onnx_dir, 'decoder_model_merged_q4f16.onnx'),
            self._opts, providers=['CPUExecutionProvider'])
        print(f'[engine] sessions loaded ({int((time.time()-t0)*1000)}ms)')

    def build_messages(self, question: dict) -> list:
        circles = ['①', '②', '③', '④', '⑤']
        choices = (question.get('choices') or [])
        choices_text = '\n'.join([f"{circles[i]} {c}" for i, c in enumerate(choices)])
        answer_idx = (question.get('answer') or 1) - 1
        answer_label = circles[answer_idx] if 0 <= answer_idx < len(circles) else '①'

        return [
            {'role': 'user', 'content': (
                f"자격증 시험 강사로서 한국어로 정답 해설.\n"
                f"「법령명」 인용. 보기별 한 줄 설명.\n\n"
                f"[문제]\n{question.get('body', '')}\n\n"
                f"[보기]\n{choices_text}\n\n"
                f"[정답] {answer_label}\n\n"
                f"각 보기가 왜 맞고 틀린지 한 줄씩 설명해주세요."
            )}
        ]

    def generate(self, question: dict, max_new_tokens: int = 512, temperature: float = 0.3):
        """제너레이터 — 토큰 단위 yield. Thinking 모드 항상 OFF (사용자 정책 2026-04-28)"""
        self._load_sessions()

        messages = self.build_messages(question)
        # Thinking OFF — Qwen3 의 enable_thinking=False / Gemma 의 추론 모드 비활성
        # PreTrainedTokenizerFast.apply_chat_template 가 미지원 인자는 무시 (안전)
        try:
            prompt = self.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
                enable_thinking=False,    # Qwen 3.x 계열
                thinking=False,           # 일부 chat_template 의 다른 변수명
            )
        except TypeError:
            # 일부 chat_template 가 추가 인자 거부 시
            prompt = self.tokenizer.apply_chat_template(
                messages, tokenize=False, add_generation_prompt=True,
            )
        if isinstance(prompt, list):
            prompt = self.tokenizer.decode(prompt, skip_special_tokens=False)

        inputs = self.tokenizer(prompt, return_tensors='np', add_special_tokens=False)
        input_ids = inputs['input_ids'].astype(np.int64)
        attention_mask = inputs.get('attention_mask', np.ones_like(input_ids)).astype(np.int64)
        position_ids = (np.cumsum(attention_mask, axis=-1) - 1).astype(np.int64)

        # KV 캐시 초기화 — Gemma 4 hybrid attention 은 layer 별 head_dim 다름
        # ONNX session 의 input metadata 에서 직접 dim 추출
        batch_size = input_ids.shape[0]
        past_key_values = {}
        for input_meta in self.decoder_session.get_inputs():
            if input_meta.name.startswith('past_key_values'):
                shape = list(input_meta.shape)
                # shape: [batch, kv_heads, past_seq, head_dim]
                # 동적 dim (string symbolic) 처리
                resolved = []
                for i, s in enumerate(shape):
                    if isinstance(s, int):
                        resolved.append(s)
                    elif i == 0:
                        resolved.append(batch_size)
                    elif i == 2:
                        resolved.append(0)        # past_sequence_length 첫 호출
                    else:
                        resolved.append(s)        # symbolic 그대로 — 안 됐을 시 fallback
                # symbolic 잔존 시 config 기반 보정
                resolved = [batch_size if not isinstance(x, int) and 'batch' in str(x).lower() else x for x in resolved]
                resolved = [self.num_key_value_heads if not isinstance(x, int) and 'kv' in str(x).lower() else x for x in resolved]
                resolved = [self.head_dim if not isinstance(x, int) else x for x in resolved]
                past_key_values[input_meta.name] = np.zeros(resolved, dtype=np.float16)

        for step in range(max_new_tokens):
            # embed
            embed_outputs = self.embed_session.run(None, {'input_ids': input_ids})
            inputs_embeds = embed_outputs[0]
            per_layer_inputs = embed_outputs[1] if len(embed_outputs) > 1 else None

            # decoder — Gemma 4 는 attention_mask, num_logits_to_keep 추가 요구
            decoder_inputs = {
                'inputs_embeds': inputs_embeds,
                'attention_mask': attention_mask,
                'position_ids': position_ids,
                'num_logits_to_keep': np.array(1, dtype=np.int64),
                **past_key_values,
            }
            if per_layer_inputs is not None:
                decoder_inputs['per_layer_inputs'] = per_layer_inputs

            decoder_outputs = self.decoder_session.run(None, decoder_inputs)
            logits = decoder_outputs[0]

            # KV 캐시 업데이트
            for j, key in enumerate(past_key_values.keys()):
                past_key_values[key] = decoder_outputs[j + 1]

            # 다음 토큰 (greedy 단순화)
            next_token = logits[:, -1, :].argmax(axis=-1, keepdims=True).astype(np.int64)

            if (next_token == self.eos_token_id).all():
                break

            try:
                token_str = self.tokenizer.decode(next_token[0], skip_special_tokens=True)
                if token_str:
                    yield token_str
            except Exception:
                pass

            input_ids = next_token
            position_ids = position_ids[:, -1:] + 1
            # attention_mask 도 매 step 길이 1 증가
            attention_mask = np.concatenate([attention_mask, np.ones((batch_size, 1), dtype=np.int64)], axis=1)
