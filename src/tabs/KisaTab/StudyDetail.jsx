// KISA 챕터 상세 학습 — /kisa/study/:chapterCode
// 구성:
//   1. 챕터 정의
//   2. 원인 + 영향
//   3. 대응 원칙 목록
//   4. 실제 코드 예시들 (언어/난이도별, 취약 vs 안전 비교)
//   5. 참조 문서
//   6. [이 챕터 드릴 시작] 버튼
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import CodeBlock from '../../components/CodeBlock';

// REBUILD16 R5 — 가급적 src/tracks/kisa.js 를 사용하도록 마이그레이션 권고.
// 이 파일은 study chapter 의 카테고리 키가 약간 다를 수 있어 호환성 유지 차원에서 유지.
const CATEGORY_LABEL = {
  input_validation: '입력데이터 검증 및 표현',
  security_feature: '보안기능',
  time_state: '시간 및 상태',
  error_handling: '에러처리',
  code_error: '코드오류',
  encapsulation: '캡슐화',
  api_abuse: 'API 오용',
  session_control: '세션통제',
};

export default function StudyDetail() {
  const { chapterCode } = useParams();
  const navigate = useNavigate();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedExample, setSelectedExample] = useState(0);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await apiGet(`/api/kisa-study?action=detail&code=${chapterCode}`);
        setData(result);
        setSelectedExample(0);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterCode]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 p-4 text-sm">
        <p className="font-bold text-red-700 dark:text-red-300 mb-2">{error || '챕터를 찾을 수 없습니다'}</p>
        <button onClick={() => navigate('/kisa/study')} className="px-3 py-1.5 rounded-lg border border-border text-xs">
          목록으로
        </button>
      </div>
    );
  }

  const { chapter, code_examples, mcq_count, blank_count = 0, diagnosis_count, related_forward = [], related_reverse = [] } = data;
  const currentExample = code_examples[selectedExample];

  return (
    <div className="space-y-3">
      {/* 상단 네비 */}
      <div className="flex items-center gap-2 text-xs">
        <button
          onClick={() => navigate('/kisa/study')}
          className="text-text-secondary hover:text-text"
        >
          ← 학습 목록
        </button>
      </div>

      {/* 1. 헤더 */}
      <div className="rounded-xl bg-primary-light border border-primary/20 p-4">
        <div className="flex flex-wrap items-center gap-1 mb-2">
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary text-white">
            {chapter.stage === 'design' ? '📐 설계' : '🔧 구현'}
          </span>
          <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-primary-light text-primary">
            {CATEGORY_LABEL[chapter.category]}
          </span>
          <span className="text-[10px] font-mono text-text-secondary ml-auto">
            {chapter.chapter_code}
          </span>
        </div>
        <h1 className="text-base font-bold text-primary">{chapter.title}</h1>
      </div>

      {/* 2. 정의 */}
      <Section title="📝 정의" emoji="">
        <p className="text-sm leading-relaxed">{chapter.definition}</p>
      </Section>

      {/* 3. 원인 + 영향 */}
      {(chapter.cause || chapter.impact) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {chapter.cause && (
            <Section title="⚡ 원인" compact>
              <p className="text-xs leading-relaxed text-text-secondary">{chapter.cause}</p>
            </Section>
          )}
          {chapter.impact && (
            <Section title="💥 영향" compact variant="danger">
              <p className="text-xs leading-relaxed text-text-secondary">{chapter.impact}</p>
            </Section>
          )}
        </div>
      )}

      {/* 4. 대응 원칙 */}
      {chapter.countermeasures && chapter.countermeasures.length > 0 && (
        <Section title="🛡️ 대응 원칙" variant="success">
          <ul className="space-y-1.5">
            {chapter.countermeasures.map((m, i) => (
              <li key={i} className="flex gap-2 text-sm">
                <span className="text-green-600 dark:text-green-400 font-bold">{i + 1}.</span>
                <span className="flex-1">{m}</span>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {/* 5. 코드 예시 — 취약 vs 안전 */}
      {code_examples.length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-sm font-bold">💻 실제 코드 예시</h3>
            {code_examples.length > 1 && (
              <div className="flex gap-1">
                {code_examples.map((ex, i) => (
                  <button
                    key={i}
                    onClick={() => setSelectedExample(i)}
                    className={`text-[10px] px-2 py-1 rounded-md ${
                      i === selectedExample
                        ? 'bg-primary text-white'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-text-secondary'
                    }`}
                  >
                    {ex.language} · {ex.difficulty}
                  </button>
                ))}
              </div>
            )}
          </div>

          {currentExample && (
            <div className="space-y-3">
              {/* 취약 코드 */}
              <div>
                <div className="flex items-center gap-1 mb-1">
                  <span className="text-xs font-bold text-red-600 dark:text-red-400">❌ 취약한 코드</span>
                  {currentExample.vulnerable_lines?.length > 0 && (
                    <span className="text-[10px] text-text-secondary">
                      · 라인 {currentExample.vulnerable_lines.join(', ')}
                    </span>
                  )}
                </div>
                <CodeBlock
                  code={currentExample.vulnerable_code}
                  language={currentExample.language}
                  citedLines={currentExample.vulnerable_lines || []}
                />
                {currentExample.rationale && (
                  <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                    <span className="font-bold text-red-700 dark:text-red-400">왜 취약한가: </span>
                    {currentExample.rationale}
                  </p>
                )}
              </div>

              {/* 안전 코드 */}
              <div>
                <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">✅ 안전한 코드</div>
                <CodeBlock
                  code={currentExample.safe_code}
                  language={currentExample.language}
                />
                {currentExample.fix_description && (
                  <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                    <span className="font-bold text-green-700 dark:text-green-400">수정 포인트: </span>
                    {currentExample.fix_description}
                  </p>
                )}
              </div>

              {/* 키워드 요약 */}
              <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                {currentExample.rationale_keywords?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-text-secondary">근거 키워드: </span>
                    {currentExample.rationale_keywords.map((kw, i) => (
                      <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 mr-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
                {currentExample.fix_keywords?.length > 0 && (
                  <div>
                    <span className="text-[10px] font-bold text-text-secondary">수정 키워드: </span>
                    {currentExample.fix_keywords.map((kw, i) => (
                      <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 mr-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
                        {kw}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 5.5. 연관 챕터 (설계↔구현 매핑) */}
      {(related_forward.length > 0 || related_reverse.length > 0) && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3">
          <h3 className="text-sm font-bold mb-2 flex items-center gap-1">
            🔗 <span>연관 챕터</span>
            <span className="text-[10px] text-text-secondary font-normal">(KISA 공식 가이드 §3-1.4 기준)</span>
          </h3>
          <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">
            {chapter.stage === 'design'
              ? '이 설계 기준이 적절히 적용되지 않으면 아래 구현단계 보안약점이 발생할 수 있습니다.'
              : '이 구현단계 보안약점은 아래 설계단계 기준이 부실할 때 발생합니다.'}
          </p>

          {related_forward.length > 0 && (
            <div className="mb-2">
              <div className="text-[10px] font-bold text-text-secondary mb-1">
                {chapter.stage === 'design' ? '→ 관련 구현단계 약점' : '→ 관련 설계 기준'}
              </div>
              <div className="flex flex-wrap gap-1">
                {related_forward.map(r => (
                  <button
                    key={r.chapter_code}
                    onClick={() => navigate(`/kisa/study/${r.chapter_code}`)}
                    className="text-[11px] px-2 py-1 rounded-lg bg-card-bg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  >
                    <span className="font-mono text-amber-700 dark:text-amber-300 mr-1">{r.chapter_code}</span>
                    <span className="font-medium">{r.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {related_reverse.length > 0 && (
            <div>
              <div className="text-[10px] font-bold text-text-secondary mb-1">
                {chapter.stage === 'implementation' ? '← 이 약점의 설계 기준 (원인 근원)' : '← 이 기준의 역참조'}
              </div>
              <div className="flex flex-wrap gap-1">
                {related_reverse.map(r => (
                  <button
                    key={r.chapter_code}
                    onClick={() => navigate(`/kisa/study/${r.chapter_code}`)}
                    className="text-[11px] px-2 py-1 rounded-lg bg-card-bg border border-amber-300 dark:border-amber-700 hover:bg-amber-100 dark:hover:bg-amber-900/40 transition-colors"
                  >
                    <span className="font-mono text-amber-700 dark:text-amber-300 mr-1">{r.chapter_code}</span>
                    <span className="font-medium">{r.title}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 6. 참조 문서 */}
      {chapter.reference_docs?.length > 0 && (
        <Section title="📚 참조 자료" compact>
          <ul className="space-y-0.5">
            {chapter.reference_docs.map((d, i) => (
              <li key={i} className="text-xs text-text-secondary">• {d}</li>
            ))}
          </ul>
        </Section>
      )}

      {/* 7. 드릴 시작 버튼 — 이 챕터의 문제 유형별 전부 노출 */}
      {(diagnosis_count > 0 || mcq_count > 0 || blank_count > 0) && (
        <div className="rounded-xl bg-primary-light/50 border border-primary/30 p-3">
          <h3 className="text-sm font-bold mb-2">🎯 문제로 학습 확인</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {mcq_count > 0 && (
              <button
                onClick={() => navigate(`/kisa/drill?type=mcq&chapter_code=${chapter.chapter_code}`)}
                className="py-3 px-2 rounded-xl bg-card-bg border border-primary/40 text-primary font-bold text-sm hover:bg-primary-light active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>📖</span>
                  <span>이론(MCQ)</span>
                </div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  객관식 {mcq_count}문제
                </div>
              </button>
            )}
            {blank_count > 0 && (
              <button
                onClick={() => navigate(`/kisa/drill?type=blank&chapter_code=${chapter.chapter_code}`)}
                className="py-3 px-2 rounded-xl bg-card-bg border border-pink-400/50 text-pink-600 dark:text-pink-400 font-bold text-sm hover:bg-pink-50 dark:hover:bg-pink-900/20 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>✍️</span>
                  <span>단답형</span>
                </div>
                <div className="text-[10px] font-normal opacity-80 mt-0.5">
                  빈칸 {blank_count}문제
                </div>
              </button>
            )}
            {diagnosis_count > 0 && (
              <button
                onClick={() => navigate(`/kisa/drill?type=diagnosis4&chapter_code=${chapter.chapter_code}`)}
                className="py-3 px-2 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 active:scale-[0.98] transition-all"
              >
                <div className="flex items-center justify-center gap-1.5">
                  <span>🧪</span>
                  <span>실기(진단)</span>
                </div>
                <div className="text-[10px] font-normal opacity-90 mt-0.5">
                  서술식 {diagnosis_count}문제
                </div>
              </button>
            )}
          </div>
          <p className="mt-2 text-[10px] text-text-secondary">
            이 챕터({chapter.chapter_code}) 문제만 출제됩니다
          </p>
        </div>
      )}

      {code_examples.length === 0 && mcq_count === 0 && blank_count === 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300">
          ℹ️ 이 챕터는 아직 문항이 등록되지 않았습니다. 학습 자료만 참고하세요.
        </div>
      )}
    </div>
  );
}

function Section({ title, children, compact, variant }) {
  const variantClass = {
    danger: 'border-red-200 dark:border-red-900/50',
    success: 'border-green-200 dark:border-green-900/50',
    default: 'border-border',
  }[variant || 'default'];

  return (
    <div className={`rounded-xl bg-card-bg border ${variantClass} ${compact ? 'p-3' : 'p-3'}`}>
      <h3 className="text-sm font-bold mb-2">{title}</h3>
      {children}
    </div>
  );
}
