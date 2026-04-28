// 문제 추가/수정 폼
import { useState, useEffect } from 'react';
import { apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';
import { useImageModal } from '../../App';

export default function QuestionForm({ question, meta, onSaved, onCancel }) {
  const toast = useToast();
  const openImage = useImageModal();
  const isEdit = !!question;
  const [loading, setLoading] = useState(false);
  const [showImagePreview, setShowImagePreview] = useState(false);

  const [form, setForm] = useState({
    question_number: '',
    body: '',
    choice1: '', choice2: '', choice3: '', choice4: '',
    answer: '1',
    explanation: '',
    image_url: '',
    category_id: '',
    exam_id: '',
    subject_id: '',
  });

  useEffect(() => {
    if (question) {
      const choices = typeof question.choices === 'string' ? JSON.parse(question.choices) : (question.choices || []);
      const getChoiceText = (c) => (typeof c === 'object' && c) ? (c.text || '') : (c || '');
      setForm({
        question_number: question.question_number || '',
        body: question.body || '',
        choice1: getChoiceText(choices[0]),
        choice2: getChoiceText(choices[1]),
        choice3: getChoiceText(choices[2]),
        choice4: getChoiceText(choices[3]),
        answer: String(question.answer || '1'),
        explanation: question.explanation || '',
        image_url: question.image_url || '',
        category_id: question.category_id || '',
        exam_id: question.exam_id || '',
        subject_id: question.subject_id || '',
      });
    }
  }, [question]);

  const update = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.body.trim()) { toast('문제 본문을 입력하세요.', 'warn'); return; }
    setLoading(true);
    try {
      const payload = {
        action: isEdit ? 'update' : 'create',
        ...(isEdit && { id: question.id }),
        question_number: form.question_number ? Number(form.question_number) : undefined,
        body: form.body.trim(),
        choices: [form.choice1, form.choice2, form.choice3, form.choice4].filter(Boolean),
        answer: Number(form.answer),
        explanation: form.explanation || undefined,
        image_url: form.image_url || null,
        exam_id: form.exam_id ? Number(form.exam_id) : undefined,
        subject_id: form.subject_id ? Number(form.subject_id) : undefined,
      };
      await apiPost('/api/questions', payload);
      onSaved();
    } catch (err) {
      toast('저장 실패: ' + err.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const filteredExams = form.category_id
    ? (meta.exams || []).filter(e => e.category_id == form.category_id)
    : (meta.exams || []);
  const filteredSubjects = form.category_id
    ? (meta.subjects || []).filter(s => s.category_id == form.category_id)
    : (meta.subjects || []);

  const inputClass = "w-full px-3 py-2.5 rounded-xl border border-border bg-input-bg text-text text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all";
  const labelClass = "block text-xs font-semibold text-text-secondary mb-1";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelClass}>문제 번호</label>
          <input type="number" value={form.question_number} onChange={e => update('question_number', e.target.value)} placeholder="자동" className={inputClass} />
        </div>
        <div>
          <label className={labelClass}>정답</label>
          <select value={form.answer} onChange={e => update('answer', e.target.value)} className={inputClass}>
            {[1,2,3,4].map(n => <option key={n} value={n}>{'①②③④'[n-1]} {n}번</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelClass}>문제 본문</label>
        <textarea value={form.body} onChange={e => update('body', e.target.value)} rows={4} placeholder="문제 본문을 입력하세요"
          autoCapitalize="none" autoCorrect="off" spellCheck="false" className={inputClass + ' resize-y'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(n => (
          <div key={n}>
            <label className={labelClass}>선택지 {'①②③④'[n-1]}</label>
            <input value={form[`choice${n}`]} onChange={e => update(`choice${n}`, e.target.value)} placeholder={`${n}번 선택지`}
              autoCapitalize="none" autoCorrect="off" spellCheck="false" className={inputClass} />
          </div>
        ))}
      </div>

      <div>
        <label className={labelClass}>해설 (선택)</label>
        <textarea value={form.explanation} onChange={e => update('explanation', e.target.value)} rows={3} placeholder="해설을 입력하세요 (선택)"
          autoCapitalize="none" autoCorrect="off" spellCheck="false" className={inputClass + ' resize-y'} />
      </div>

      {/* 원본 이미지 URL + 미리보기 */}
      <div>
        <label className={labelClass}>원본 이미지</label>
        <div className="flex gap-2">
          <input value={form.image_url} onChange={e => update('image_url', e.target.value)}
            placeholder="이미지 URL (예: /q001.png 또는 https://...)"
            autoCapitalize="none" autoCorrect="off" spellCheck="false" className={inputClass + ' flex-1'} />
          {form.image_url && (
            <button type="button" onClick={() => update('image_url', '')}
              className="px-2 rounded-xl border border-border text-danger text-xs font-semibold hover:bg-red-50 transition-colors flex-shrink-0"
              aria-label="이미지 삭제">
              삭제
            </button>
          )}
        </div>
        {form.image_url && (
          <div className="mt-2">
            <button type="button" onClick={() => setShowImagePreview(p => !p)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all bg-badge-bg text-text-secondary hover:text-primary hover:bg-primary-light">
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              {showImagePreview ? '미리보기 숨기기' : '미리보기'}
            </button>
            {showImagePreview && (() => {
              const imgUrl = form.image_url;
              return (
                <div className="mt-2 rounded-xl overflow-hidden border border-border cursor-pointer fade-in"
                  onClick={() => openImage(imgUrl)}>
                  <img src={imgUrl} alt="문제 이미지 미리보기"
                    className="w-full max-h-60 object-contain bg-badge-bg hover:opacity-90 transition-opacity"
                    onError={e => { e.target.style.display = 'none'; }}
                    loading="lazy" />
                </div>
              );
            })()}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div>
          <label className={labelClass}>카테고리</label>
          <select value={form.category_id} onChange={e => { update('category_id', e.target.value); update('exam_id', ''); update('subject_id', ''); }} className={inputClass}>
            <option value="">선택 안함</option>
            {(meta.categories || []).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>시험</label>
          <select value={form.exam_id} onChange={e => update('exam_id', e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {filteredExams.map(e => <option key={e.id} value={e.id}>{e.title}</option>)}
          </select>
        </div>
        <div>
          <label className={labelClass}>과목</label>
          <select value={form.subject_id} onChange={e => update('subject_id', e.target.value)} className={inputClass}>
            <option value="">선택 안함</option>
            {filteredSubjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <button type="button" onClick={onCancel}
          className="px-4 py-2.5 rounded-xl border border-border text-text-secondary text-sm font-semibold hover:bg-card-bg-hover transition-colors">
          취소
        </button>
        <button type="submit" disabled={loading}
          className="px-6 py-2.5 rounded-xl bg-primary text-white text-sm font-bold hover:bg-primary-hover transition-colors disabled:opacity-50">
          {loading ? '저장 중...' : (isEdit ? '수정' : '추가')}
        </button>
      </div>
    </form>
  );
}
