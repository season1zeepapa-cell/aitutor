// 문제 풀이 중 "관련 지식 라이브러리" 조회 모달
// - 문제의 chapter_code에 해당하는 library 항목을 찾아 요약/상세/취약·안전 코드/키워드를 표시
// - 코드 렌더는 LibraryFab의 CodeSection을 재사용 (중복 구현 금지)
// - 바텀시트 스타일(기존 LibraryFab 드로어와 동일 톤)
import libData from '../data/kisa-library.json';
import { CodeSection } from './LibraryFab';

export default function QuestionLibraryModal({ chapterCode, onClose }) {
  // library 자료원에서 id === chapterCode 인 항목 검색
  const item = chapterCode
    ? libData.sources
        .flatMap((s) => s.items)
        .find((it) => it.source === 'library' && it.id === chapterCode)
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-h-[85vh] bg-card-bg rounded-t-2xl flex flex-col shadow-2xl">
        {/* 드래그 핸들 (바텀시트) */}
        <div className="flex justify-center pt-2 pb-1 shrink-0">
          <div className="w-10 h-1 rounded-full bg-border" />
        </div>

        {/* 헤더 */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <h2 className="font-bold text-sm flex-1">
            📚 관련 지식
            {item && <span className="ml-1 text-primary/50 font-mono font-normal">{item.id}</span>}
          </h2>
          <button
            onClick={onClose}
            className="w-7 h-7 flex items-center justify-center rounded-full hover:bg-primary/10"
            aria-label="닫기"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* 본문 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 safe-pb text-xs space-y-3 text-current/80">
          {!item ? (
            <p className="text-sm text-primary/50 text-center py-10">
              이 문제와 연관된 지식 자료가 없습니다.
            </p>
          ) : (
            <>
              {/* 제목 + 분류 */}
              <div>
                <h3 className="text-sm font-bold text-primary leading-snug">{item.title}</h3>
                {item.category && (
                  <div className="mt-1 text-[11px] text-primary/60">
                    분류 · {item.category}
                    {item.cwe ? ` · ${item.cwe}` : ''}
                  </div>
                )}
              </div>

              {/* 요약 */}
              {item.summary && (
                <p className="leading-relaxed whitespace-pre-line">{item.summary}</p>
              )}

              {/* 상세 */}
              {(item.detail || []).map((d, i) => (
                <div key={i}>
                  <span className="font-semibold text-primary/80">{d.label}</span>
                  <p className="leading-relaxed whitespace-pre-line mt-0.5">{d.text}</p>
                </div>
              ))}

              {/* 취약/안전 코드 (LibraryFab CodeSection 재사용) */}
              <CodeSection item={item} />

              {/* 키워드 */}
              {(item.keywords || []).length > 0 && (
                <div className="flex flex-wrap gap-1 pt-1">
                  {item.keywords.map((k) => (
                    <span
                      key={k}
                      className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary/70"
                    >
                      #{k}
                    </span>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
