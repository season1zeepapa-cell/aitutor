// SSE 스트리밍 공통 훅 — Gemini/OpenAI/Claude 통합
import { useState, useRef, useCallback } from 'react';
import { getAuthToken } from '../lib/api';

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

  const startStream = useCallback(async ({ provider, model, prompt, systemPrompt, temperature, maxTokens }) => {
    const endpoint = ENDPOINTS[provider];
    if (!endpoint) throw new Error(`알 수 없는 프로바이더: ${provider}`);

    setContent('');
    setError(null);
    setIsStreaming(true);
    abortRef.current = new AbortController();

    const token = getAuthToken();
    const body = {
      model,
      prompt,
      system: systemPrompt || '',
      temperature: temperature ?? 0.5,
      max_tokens: maxTokens || 4096,
      stream: true,
    };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'Accept': 'text/event-stream',
        },
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
              // 각 프로바이더별 텍스트 추출
              const text = parsed.text || parsed.content || parsed.delta || '';
              if (text) {
                accumulated += text;
                setContent(accumulated);
              }
            } catch {
              // JSON이 아닌 일반 텍스트
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
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({ ...body, stream: false }),
        });
        const fallbackData = await fallbackRes.json();
        const fallbackText = fallbackData.text || fallbackData.content || '';
        if (fallbackText) {
          setContent(fallbackText);
          setError(null);
          return fallbackText;
        }
      } catch (fallbackErr) {
        setError(`스트리밍 및 일반 모드 모두 실패: ${fallbackErr.message}`);
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
