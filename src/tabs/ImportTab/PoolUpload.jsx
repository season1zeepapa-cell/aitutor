// PoolUpload.jsx — 웹에서 PDF/이미지 업로드 → Gemini Vision 문제 추출 → DB 등록
// 방안 3: 소량 문제 등록용 UI. 기존 ImportTab(DocStore 연동)과 독립 동작
import { useState, useRef } from 'react';
import { apiPost, apiGet } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

const CIRCLE = ['①', '②', '③', '④', '⑤'];

export default function PoolUpload() {
  const toast = useToast();
  const fileRef = useRef(null);

  // 상태
  const [file, setFile] = useState(null);         // 선택된 파일
  const [preview, setPreview] = useState(null);    // 파일 미리보기 URL
  const [extracting, setExtracting] = useState(false);
  const [questions, setQuestions] = useState([]);   // 추출된 문제 목록
  const [visualCount, setVisualCount] = useState(0);

  // 등록 설정
  const [categories, setCategories] = useState([]);
  const [exams, setExams] = useState([]);
  const [categoryId, setCategoryId] = useState('');
  const [examId, setExamId] = useState('');
  const [newExamTitle, setNewExamTitle] = useState('');
  const [registering, setRegistering] = useState(false);
  const [result, setResult] = useState(null);

  // 카테고리/시험 목록 로드
  const loadMeta = async () => {
    try {
      const data = await apiGet('/api/categories');
      setCategories(data.categories || []);
    } catch { /* 무시 */ }
  };

  // 카테고리 변경 시 시험 목록 로드
  const handleCategoryChange = async (catId) => {
    setCategoryId(catId);
    setExamId('');
    if (!catId) { setExams([]); return; }
    try {
      const data = await apiPost('/api/questions', { action: 'meta' });
      setExams((data.exams || []).filter(e => e.category_id == catId));
    } catch { setExams([]); }
  };

  // ── 파일 선택 ──
  const handleFileSelect = (e) => {
    const f = e.target.files[0];
    if (!f) return;

    // 파일 형식 확인
    const allowed = ['application/pdf', 'image/png', 'image/jpeg', 'image/gif'];
    if (!allowed.includes(f.type)) {
      toast.error('PDF, PNG, JPG 파일만 지원합니다.');
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      toast.error('파일 크기가 20MB를 초과합니다.');
      return;
    }

    setFile(f);
    setQuestions([]);
    setResult(null);

    // 이미지 미리보기
    if (f.type.startsWith('image/')) {
      setPreview(URL.createObjectURL(f));
    } else {
      setPreview(null);
    }

    // 메타 데이터 로드
    loadMeta();
  };

  // ── 문제 추출 (Gemini Vision) ──
  const handleExtract = async () => {
    if (!file) return;
    setExtracting(true);
    setQuestions([]);
    setResult(null);

    try {
      // 파일을 base64로 변환
      const base64 = await fileToBase64(file);

      const data = await apiPost('/api/pool-upload', {
        action: 'extract',
        file_data: base64,
        file_name: file.name,
        mime_type: file.type,
      });

      if (data.success) {
        setQuestions(data.questions);
        setVisualCount(data.visual_count || 0);
        toast.success(`${data.questions.length}개 문제 추출 완료 (표/그림: ${data.visual_count}개)`);
      } else {
        toast.error(data.error || '추출 실패');
      }
    } catch (err) {
      toast.error('문제 추출 실패: ' + (err.message || '네트워크 오류'));
    } finally {
      setExtracting(false);
    }
  };

  // ── DB 등록 ──
  const handleRegister = async () => {
    if (questions.length === 0) return;
    if (!categoryId) { toast.error('카테고리를 선택해주세요.'); return; }
    if (!examId && !newExamTitle.trim()) { toast.error('시험을 선택하거나 새 시험명을 입력해주세요.'); return; }

    setRegistering(true);
    try {
      const data = await apiPost('/api/pool-upload', {
        action: 'register',
        exam_id: examId ? parseInt(examId) : null,
        exam_title: !examId ? newExamTitle.trim() : null,
        category_id: parseInt(categoryId),
        questions,
      });

      if (data.success) {
        setResult(data);
        toast.success(`${data.inserted}개 등록 완료 (건너뜀: ${data.skipped}개)`);
      } else {
        toast.error(data.error || '등록 실패');
      }
    } catch (err) {
      toast.error('등록 실패: ' + (err.message || '네트워크 오류'));
    } finally {
      setRegistering(false);
    }
  };

  // ── 초기화 ──
  const handleReset = () => {
    setFile(null);
    setPreview(null);
    setQuestions([]);
    setResult(null);
    setVisualCount(0);
    if (fileRef.current) fileRef.current.value = '';
  };

  return (
    <div className="space-y-4">
      {/* 파일 업로드 영역 */}
      <div className="card p-4">
        <h3 className="font-bold text-base mb-3">📄 파일에서 문제 추출</h3>
        <p className="text-xs text-muted mb-3">
          PDF 또는 이미지(PNG/JPG) 파일을 업로드하면 Gemini Vision AI가 문제를 자동 추출합니다.
          표·그림이 포함된 문제도 인식됩니다.
        </p>

        <div className="flex items-center gap-2">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
            className="text-sm file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0
              file:text-sm file:font-medium file:bg-primary file:text-white
              file:cursor-pointer hover:file:opacity-90"
          />
          {file && (
            <button onClick={handleReset}
              className="text-xs px-2 py-1 rounded bg-gray-200 dark:bg-gray-700 hover:opacity-80">
              초기화
            </button>
          )}
        </div>

        {/* 이미지 미리보기 */}
        {preview && (
          <div className="mt-3">
            <img src={preview} alt="미리보기" className="max-h-48 rounded-lg border" />
          </div>
        )}

        {/* 추출 버튼 */}
        {file && questions.length === 0 && !result && (
          <button
            onClick={handleExtract}
            disabled={extracting}
            className="mt-3 w-full py-2.5 rounded-xl font-bold text-white
              bg-primary hover:opacity-90 disabled:opacity-50 transition-all">
            {extracting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                AI가 문제를 추출하고 있습니다...
              </span>
            ) : '🔍 문제 추출 시작'}
          </button>
        )}
      </div>

      {/* 추출 결과 미리보기 */}
      {questions.length > 0 && !result && (
        <>
          <div className="card p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-base">
                📝 추출된 문제 ({questions.length}개)
              </h3>
              {visualCount > 0 && (
                <span className="text-xs px-2 py-1 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                  📊 표/그림 {visualCount}개
                </span>
              )}
            </div>

            <div className="space-y-3 max-h-96 overflow-y-auto">
              {questions.map((q, i) => (
                <div key={i} className="p-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 border text-sm">
                  <div className="flex items-start gap-2">
                    <span className="font-bold text-primary shrink-0">Q{q.original_number}</span>
                    <div className="flex-1 min-w-0">
                      <p className="whitespace-pre-wrap break-words">{q.body?.substring(0, 150)}{q.body?.length > 150 ? '...' : ''}</p>
                      {q.has_table && (
                        <span className="inline-block mt-1 text-xs px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                          📊 표 포함
                        </span>
                      )}
                      {q.has_image && (
                        <span className="inline-block mt-1 ml-1 text-xs px-1.5 py-0.5 rounded bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
                          🖼️ 그림 포함
                        </span>
                      )}
                      {q.needs_visual && (
                        <span className="inline-block mt-1 ml-1 text-xs px-1.5 py-0.5 rounded bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300">
                          ⚠️ 시각자료 필수
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 pl-6 space-y-0.5">
                    {(q.choices || []).map((c, j) => (
                      <p key={j} className="text-xs text-muted">
                        {CIRCLE[j]} {typeof c === 'object' ? c.text : c}
                      </p>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 등록 설정 */}
          <div className="card p-4">
            <h3 className="font-bold text-base mb-3">💾 DB 등록 설정</h3>

            <div className="space-y-3">
              <div>
                <label className="text-sm font-medium block mb-1">카테고리 *</label>
                <select
                  value={categoryId}
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm">
                  <option value="">선택하세요</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm font-medium block mb-1">기존 시험에 추가</label>
                <select
                  value={examId}
                  onChange={(e) => { setExamId(e.target.value); setNewExamTitle(''); }}
                  className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm">
                  <option value="">새 시험 생성</option>
                  {exams.map(e => (
                    <option key={e.id} value={e.id}>{e.title}</option>
                  ))}
                </select>
              </div>

              {!examId && (
                <div>
                  <label className="text-sm font-medium block mb-1">새 시험 제목 *</label>
                  <input
                    type="text"
                    value={newExamTitle}
                    onChange={(e) => setNewExamTitle(e.target.value)}
                    placeholder="예: 2026년 정기 2회"
                    className="w-full px-3 py-2 rounded-lg border bg-white dark:bg-gray-800 text-sm"
                  />
                </div>
              )}

              <button
                onClick={handleRegister}
                disabled={registering}
                className="w-full py-2.5 rounded-xl font-bold text-white
                  bg-green-600 hover:bg-green-700 disabled:opacity-50 transition-all">
                {registering ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    등록 중...
                  </span>
                ) : `💾 ${questions.length}개 문제 DB 등록`}
              </button>
            </div>
          </div>
        </>
      )}

      {/* 등록 결과 */}
      {result && (
        <div className="card p-4">
          <h3 className="font-bold text-base mb-2 text-green-600">✅ 등록 완료</h3>
          <div className="text-sm space-y-1">
            <p>시험 ID: <span className="font-mono">{result.exam_id}</span></p>
            <p>등록: <span className="font-bold text-green-600">{result.inserted}개</span></p>
            {result.skipped > 0 && (
              <p>건너뜀 (중복): <span className="text-yellow-600">{result.skipped}개</span></p>
            )}
          </div>
          <div className="mt-3 flex gap-2">
            <button onClick={handleReset}
              className="flex-1 py-2 rounded-lg bg-primary text-white text-sm font-medium hover:opacity-90">
              다른 파일 업로드
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── 파일 → base64 변환 유틸 ──
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // data:image/png;base64,xxxx → base64 부분만 추출
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
