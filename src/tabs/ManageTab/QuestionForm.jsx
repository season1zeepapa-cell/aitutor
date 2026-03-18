// 문제 추가/수정 폼
import { useState, useEffect } from 'react';
import { apiPost } from '../../lib/api';
import { useToast } from '../../components/ui/Toast';

export default function QuestionForm({ question, meta, onSaved, onCancel }) {
  const toast = useToast();
  const isEdit = !!question;
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    question_number: '',
    body: '',
    choice1: '', choice2: '', choice3: '', choice4: '',
    answer: '1',
    explanation: '',
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
        <textarea value={form.body} onChange={e => update('body', e.target.value)} rows={4} placeholder="문제 본문을 입력하세요" className={inputClass + ' resize-y'} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        {[1,2,3,4].map(n => (
          <div key={n}>
            <label className={labelClass}>선택지 {'①②③④'[n-1]}</label>
            <input value={form[`choice${n}`]} onChange={e => update(`choice${n}`, e.target.value)} placeholder={`${n}번 선택지`} className={inputClass} />
          </div>
        ))}
      </div>

      <div>
        <label className={labelClass}>해설 (선택)</label>
        <textarea value={form.explanation} onChange={e => update('explanation', e.target.value)} rows={3} placeholder="해설을 입력하세요 (선택)" className={inputClass + ' resize-y'} />
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
