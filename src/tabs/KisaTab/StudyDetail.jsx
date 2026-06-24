// KISA 챕터 상세 학습 — /kisa/study/:chapterCode
// 구성:
//   1. 챕터 정의
//   2. 원인 + 영향
//   3. 대응 원칙 목록
//   4. 실제 코드 예시들 (언어/난이도별, 취약 vs 안전 비교)
//   5. 참조 문서
//   6. [이 챕터 드릴 시작] 버튼
import { useState, useEffect, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { apiGet } from '../../lib/api';
import CodeBlock from '../../components/CodeBlock';
import libData from '../../data/kisa-library.json';
import QuestionLibraryModal from '../../components/QuestionLibraryModal';
import { setCurrentChapter } from '../../lib/currentChapter';

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
  const [openExamples, setOpenExamples] = useState(() => new Set([0])); // 예제 아코디언 (첫 예제 펼침)
  const [open2026, setOpen2026] = useState(() => new Set([0])); // 2026 교재 코드예시 아코디언
  const [showLibrary, setShowLibrary] = useState(false); // 관련 지식 라이브러리 모달
  const toggleExample = (i) =>
    setOpenExamples((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  const toggle2026 = (i) =>
    setOpen2026((prev) => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });

  // 2026 교재 코드예시 — src/data/kisa-library.json 의 kisec2026 자료원에서 chapter_code 매칭
  const kisec2026Ex = useMemo(() => {
    const it = libData.sources.find((s) => s.id === 'kisec2026')?.items.find((i) => i.id === chapterCode);
    return it?.codeExamples || []; // [{ lang, vulnerable, safe, note }]
  }, [chapterCode]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const result = await apiGet(`/api/kisa-study?action=detail&code=${chapterCode}`);
        setData(result);
        setOpenExamples(new Set([0]));
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [chapterCode]);

  // 현재 학습 중인 챕터를 전역 공유 → 우측 하단 플로팅 '자료 라이브러리'가 이 주제 키워드로 조회
  useEffect(() => {
    setCurrentChapter(chapterCode || null);
    return () => setCurrentChapter(null);
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
        {/* 관련 지식 라이브러리 빠른 조회 (보조) */}
        <button
          onClick={() => setShowLibrary(true)}
          className="mt-2 text-[11px] px-2 py-1 rounded-lg border border-primary/40 text-primary bg-card-bg hover:bg-primary/10 transition-colors"
          title="이 챕터와 관련된 지식 자료 보기"
        >
          📚 관련 지식 보기
        </button>
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

      {/* 5. 코드 예시 — 취약 vs 안전 (아코디언: 예제별 접기/펼치기) */}
      {code_examples.length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <h3 className="text-sm font-bold mb-2">
            💻 실제 코드 예시 <span className="text-[10px] text-text-secondary font-normal">({code_examples.length})</span>
          </h3>
          <div className="space-y-2">
            {code_examples.map((ex, exIdx) => {
              const open = openExamples.has(exIdx);
              return (
                <div key={exIdx} className="rounded-lg border border-border overflow-hidden">
                  {/* 아코디언 헤더 — 클릭 시 접기/펼치기 */}
                  <button
                    onClick={() => toggleExample(exIdx)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <span className="text-primary/60 text-xs">{open ? '▾' : '▸'}</span>
                    <span className="flex-1 text-xs font-semibold">{ex.language} · {ex.difficulty}</span>
                    <span className="text-[10px] text-text-secondary">{open ? '접기' : '펼치기'}</span>
                  </button>
                  {open && (
                    <div className="p-3 space-y-3">
                      {/* 취약 코드 */}
                      <div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="text-xs font-bold text-red-600 dark:text-red-400">❌ 취약한 코드</span>
                          {ex.vulnerable_lines?.length > 0 && (
                            <span className="text-[10px] text-text-secondary">· 라인 {ex.vulnerable_lines.join(', ')}</span>
                          )}
                        </div>
                        <CodeBlock code={ex.vulnerable_code} language={ex.language} citedLines={ex.vulnerable_lines || []} />
                        {ex.rationale && (
                          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                            <span className="font-bold text-red-700 dark:text-red-400">왜 취약한가: </span>
                            {ex.rationale}
                          </p>
                        )}
                      </div>

                      {/* 안전 코드 */}
                      <div>
                        <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">✅ 안전한 코드</div>
                        <CodeBlock code={ex.safe_code} language={ex.language} />
                        {ex.fix_description && (
                          <p className="mt-2 text-xs text-text-secondary leading-relaxed">
                            <span className="font-bold text-green-700 dark:text-green-400">수정 포인트: </span>
                            {ex.fix_description}
                          </p>
                        )}
                      </div>

                      {/* 키워드 요약 */}
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-border">
                        {ex.rationale_keywords?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-text-secondary">근거 키워드: </span>
                            {ex.rationale_keywords.map((kw, i) => (
                              <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 mr-1 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">{kw}</span>
                            ))}
                          </div>
                        )}
                        {ex.fix_keywords?.length > 0 && (
                          <div>
                            <span className="text-[10px] font-bold text-text-secondary">수정 키워드: </span>
                            {ex.fix_keywords.map((kw, i) => (
                              <span key={i} className="inline-block text-[10px] px-1.5 py-0.5 mr-1 rounded bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">{kw}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 5.1. 2026 교재 코드예시 — 라이브러리(kisec2026) 직참조, diagnosis4 와 별도 */}
      {kisec2026Ex.length > 0 && (
        <div className="rounded-xl bg-card-bg border border-border p-3">
          <h3 className="text-sm font-bold mb-1">
            📘 2026 교재 코드예시 <span className="text-[10px] text-text-secondary font-normal">({kisec2026Ex.length})</span>
          </h3>
          <p className="text-[11px] text-text-secondary mb-2 leading-relaxed">KISEC 2026 기본과정 교재의 언어·기법별 취약/안전 코드.</p>
          <div className="space-y-2">
            {kisec2026Ex.map((ex, exIdx) => {
              const open = open2026.has(exIdx);
              const lang = (ex.lang || '').toLowerCase().split(/[ (]/)[0] || 'java';
              return (
                <div key={exIdx} className="rounded-lg border border-border overflow-hidden">
                  <button
                    onClick={() => toggle2026(exIdx)}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left bg-neutral-50 dark:bg-neutral-800/50 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
                  >
                    <span className="text-primary/60 text-xs">{open ? '▾' : '▸'}</span>
                    <span className="flex-1 text-xs font-semibold">{ex.lang || '코드'}</span>
                    <span className="text-[10px] text-text-secondary">{open ? '접기' : '펼치기'}</span>
                  </button>
                  {open && (
                    <div className="p-3 space-y-3">
                      {ex.vulnerable && (
                        <div>
                          <div className="text-xs font-bold text-red-600 dark:text-red-400 mb-1">❌ 취약한 코드</div>
                          <CodeBlock code={ex.vulnerable} language={lang} />
                        </div>
                      )}
                      {ex.safe && (
                        <div>
                          <div className="text-xs font-bold text-green-600 dark:text-green-400 mb-1">✅ 안전한 코드</div>
                          <CodeBlock code={ex.safe} language={lang} />
                        </div>
                      )}
                      {ex.note && (
                        <p className="text-xs text-text-secondary leading-relaxed pt-1 border-t border-border">
                          <span className="font-bold text-text">설명: </span>{ex.note}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

      {code_examples.length === 0 && kisec2026Ex.length === 0 && mcq_count === 0 && blank_count === 0 && (
        <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 text-xs text-amber-700 dark:text-amber-300">
          ℹ️ 이 챕터는 아직 문항이 등록되지 않았습니다. 학습 자료만 참고하세요.
        </div>
      )}

      {/* 관련 지식 라이브러리 모달 */}
      {showLibrary && (
        <QuestionLibraryModal
          chapterCode={chapter.chapter_code}
          onClose={() => setShowLibrary(false)}
        />
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
