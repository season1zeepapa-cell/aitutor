// SSE 스트리밍 공통 훅 — Gemini/OpenAI/Claude 통합
import { useState, useRef, useCallback } from 'react';
// 토큰은 HttpOnly 쿠키로 자동 전송 (credentials: 'include')

// 프로바이더별 엔드포인트
const ENDPOINTS = {
  gemini: '/api/gemini',
  openai: '/api/openai',
  claude: '/api/claude',
};

export default function useSSE() {
  const [content, setContent] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState(null);
  const abortRef = useRef(null);

  const startStream = useCallback(async ({ provider, model, prompt, systemPrompt, temperature, maxTokens, thinkingBudget, thinkingLevel, reasoningEffort, imageBase64, mimeType }) => {
    const endpoint = ENDPOINTS[provider];
    if (!endpoint) throw new Error(`알 수 없는 프로바이더: ${provider}`);

    setContent('');
    setError(null);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    // API가 기대하는 필드명: text, model, temperature, maxTokens, stream
    const body = {
      text: prompt,
      model,
      temperature: temperature ?? 0.3,
      maxTokens: maxTokens || 2048,
      stream: true,
    };
    // 이미지 포함
    if (imageBase64) {
      body.imageBase64 = imageBase64;
      body.mimeType = mimeType || 'image/png';
    }
    // Gemini 전용 옵션
    if (provider === 'gemini') {
      if (thinkingBudget !== undefined) body.thinkingBudget = thinkingBudget;
      if (thinkingLevel) body.thinkingLevel = thinkingLevel;
    }
    // OpenAI o-시리즈 전용
    if (provider === 'openai' && reasoningEffort) {
      body.reasoningEffort = reasoningEffort;
    }

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'text/event-stream',
        },
        credentials: 'include',
        body: JSON.stringify(body),
        signal: abortRef.current.signal,
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `API 에러 (${res.status})`);
      }

      // SSE 스트리밍 파싱
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulated = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = line.slice(6);
            if (data === '[DONE]') continue;
            try {
              const parsed = JSON.parse(data);
              // SSE 에러 감지
              if (parsed.error) {
                setError(parsed.error);
                continue;
              }
              const text = parsed.t || parsed.text || parsed.content || parsed.delta || '';
              if (text) {
                accumulated += text;
                setContent(accumulated);
              }
            } catch {
              if (data && data !== '[DONE]') {
                accumulated += data;
                setContent(accumulated);
              }
            }
          }
        }
      }

      return accumulated;
    } catch (err) {
      if (err.name === 'AbortError') return '';
      setError(err.message);

      // 스트리밍 실패 → 일반 모드 폴백
      try {
        const fallbackRes = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ ...body, stream: false }),
        });
        if (!fallbackRes.ok) {
          const errData = await fallbackRes.json().catch(() => ({}));
          throw new Error(errData.error || `폴백 에러 (${fallbackRes.status})`);
        }
        const fallbackData = await fallbackRes.json();
        const fallbackText = fallbackData.answer || fallbackData.text || fallbackData.content || '';
        if (fallbackText) {
          setContent(fallbackText);
          setError(null);
          return fallbackText;
        }
      } catch (fallbackErr) {
        setError(`요청 실패: ${err.message}`);
      }
      return '';
    } finally {
      setIsStreaming(false);
    }
  }, []);

  const stopStream = useCallback(() => {
    if (abortRef.current) abortRef.current.abort();
    setIsStreaming(false);
  }, []);

  const reset = useCallback(() => {
    setContent('');
    setError(null);
    setIsStreaming(false);
  }, []);

  return { content, isStreaming, error, startStream, stopStream, reset };
}
