import { useEffect, useState, useCallback, useMemo } from 'react';
import { flashcardApi, questionApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import './Creator.css';

const PART_OPTIONS = [6, 7];
const SCORE_LEVELS = [300, 500, 750, 900];
const ANSWER_KEYS = ['A', 'B', 'C', 'D'];
const FLASHCARD_CATEGORIES = ['Office', 'Travel', 'Business', 'Meetings', 'Finance', 'Email', 'HR', 'Logistics', 'General'];

const emptyPassageQuestion = () => ({
  id: null,
  content: '',
  options: ['', '', '', ''],
  correct_answer: 'A',
  explanation: '',
});

const createPassageForm = () => ({
  groupKey: null,
  part: 6,
  level: 500,
  passage: '',
  tags: '',
  questions: [emptyPassageQuestion(), emptyPassageQuestion(), emptyPassageQuestion()],
});

const createFlashcardForm = () => ({
  id: null,
  word: '',
  ipa: '',
  meaning_vi: '',
  example_en: '',
  example_vi: '',
  category: 'Office',
});

function buildPassageGroups(questions) {
  const groupMap = new Map();
  questions
    .filter((q) => Number(q.part) === 6 || Number(q.part) === 7)
    .forEach((q) => {
      const key = `${q.part}::${(q.passage || '').trim()}`;
      const current = groupMap.get(key) || {
        key,
        part: q.part,
        level: q.level,
        passage: q.passage || '',
        tags: q.tags || '',
        created_at: q.created_at,
        questions: [],
      };
      current.questions.push({
        id: q.id,
        content: q.content,
        options: (q.options || ['', '', '', '']).slice(0, 4),
        correct_answer: q.correct_answer || 'A',
        explanation: q.explanation || '',
      });
      if (q.created_at && q.created_at < current.created_at) {
        current.created_at = q.created_at;
      }
      groupMap.set(key, current);
    });

  return Array.from(groupMap.values())
    .map((group) => ({
      ...group,
      questions: group.questions.sort((a, b) => a.id - b.id),
    }))
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export default function CreatorLessons() {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState('passages');

  const [rawQuestions, setRawQuestions] = useState([]);
  const [loadingPassages, setLoadingPassages] = useState(true);
  const [savingPassage, setSavingPassage] = useState(false);
  const [showPassageForm, setShowPassageForm] = useState(false);
  const [passageForm, setPassageForm] = useState(createPassageForm());
  const [originalQuestionIds, setOriginalQuestionIds] = useState([]);

  const [flashcards, setFlashcards] = useState([]);
  const [loadingFlashcards, setLoadingFlashcards] = useState(true);
  const [savingFlashcard, setSavingFlashcard] = useState(false);
  const [showFlashcardForm, setShowFlashcardForm] = useState(false);
  const [flashcardForm, setFlashcardForm] = useState(createFlashcardForm());

  const loadPassages = useCallback(async () => {
    setLoadingPassages(true);
    try {
      const rows = await questionApi.list({ skill: 'reading' });
      setRawQuestions(rows);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoadingPassages(false);
    }
  }, [toast]);

  const loadFlashcards = useCallback(async () => {
    setLoadingFlashcards(true);
    try {
      const rows = await flashcardApi.manageList();
      setFlashcards(rows);
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoadingFlashcards(false);
    }
  }, [toast]);

  useEffect(() => {
    loadPassages();
    loadFlashcards();
  }, [loadPassages, loadFlashcards]);

  const passageGroups = useMemo(() => buildPassageGroups(rawQuestions), [rawQuestions]);

  const openNewPassage = () => {
    setPassageForm(createPassageForm());
    setOriginalQuestionIds([]);
    setShowPassageForm(true);
  };

  const openEditPassage = (group) => {
    setPassageForm({
      groupKey: group.key,
      part: Number(group.part),
      level: Number(group.level),
      passage: group.passage,
      tags: group.tags || '',
      questions: group.questions.map((q) => ({
        id: q.id,
        content: q.content,
        options: (q.options || ['', '', '', '']).slice(0, 4),
        correct_answer: q.correct_answer || 'A',
        explanation: q.explanation || '',
      })),
    });
    setOriginalQuestionIds(group.questions.map((q) => q.id));
    setShowPassageForm(true);
  };

  const addPassageQuestion = () => {
    setPassageForm((prev) => {
      if (prev.questions.length >= 4) return prev;
      return { ...prev, questions: [...prev.questions, emptyPassageQuestion()] };
    });
  };

  const removePassageQuestion = (index) => {
    setPassageForm((prev) => {
      if (prev.questions.length <= 3) return prev;
      return { ...prev, questions: prev.questions.filter((_, i) => i !== index) };
    });
  };

  const updatePassageQuestion = (index, key, value) => {
    setPassageForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => (i === index ? { ...q, [key]: value } : q)),
    }));
  };

  const updatePassageOption = (qIndex, optIndex, value) => {
    setPassageForm((prev) => ({
      ...prev,
      questions: prev.questions.map((q, i) => {
        if (i !== qIndex) return q;
        const options = [...q.options];
        options[optIndex] = value;
        return { ...q, options };
      }),
    }));
  };

  const validatePassageForm = () => {
    if (!passageForm.passage.trim()) {
      toast('Vui lòng nhập đoạn văn cho Part 6/7.', 'error');
      return false;
    }
    if (passageForm.questions.length < 3 || passageForm.questions.length > 4) {
      toast('Mỗi passage cần từ 3 đến 4 câu hỏi.', 'error');
      return false;
    }
    const invalidQuestion = passageForm.questions.some((q) => {
      const hasPrompt = q.content.trim().length > 0;
      const fullOptions = q.options.every((opt) => opt.trim().length > 0);
      const validAnswer = ANSWER_KEYS.includes(q.correct_answer);
      return !hasPrompt || !fullOptions || !validAnswer;
    });
    if (invalidQuestion) {
      toast('Mỗi câu hỏi cần đủ nội dung, 4 lựa chọn A/B/C/D và đáp án đúng.', 'error');
      return false;
    }
    return true;
  };

  const savePassageGroup = async () => {
    if (!validatePassageForm()) return;

    setSavingPassage(true);
    try {
      const payloadBase = {
        skill: 'reading',
        part: Number(passageForm.part),
        level: Number(passageForm.level),
        q_type: 'mcq',
        passage: passageForm.passage.trim(),
        tags: (passageForm.tags || '').trim() || null,
      };

      const keptIds = [];
      for (const item of passageForm.questions) {
        const payload = {
          ...payloadBase,
          content: item.content.trim(),
          options: item.options.map((opt) => opt.trim()),
          correct_answer: item.correct_answer,
          explanation: item.explanation.trim() || 'Giải thích sẽ được cập nhật sau.',
          ai_prompt: null,
          audio_url: null,
          lesson_id: null,
        };

        if (item.id) {
          await questionApi.update(item.id, payload);
          keptIds.push(item.id);
        } else {
          const created = await questionApi.create(payload);
          keptIds.push(created.id);
        }
      }

      const removeIds = originalQuestionIds.filter((id) => !keptIds.includes(id));
      for (const id of removeIds) {
        await questionApi.delete(id);
      }

      toast(passageForm.groupKey ? 'Đã cập nhật nhóm passage thành công.' : 'Đã tạo nhóm passage thành công.');
      setShowPassageForm(false);
      await loadPassages();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingPassage(false);
    }
  };

  const deletePassageGroup = async (group) => {
    if (!window.confirm('Bạn muốn xóa toàn bộ nhóm passage này?')) return;
    try {
      await Promise.all(group.questions.map((q) => questionApi.delete(q.id)));
      toast('Đã xóa nhóm passage.');
      loadPassages();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const openNewFlashcard = () => {
    setFlashcardForm(createFlashcardForm());
    setShowFlashcardForm(true);
  };

  const openEditFlashcard = (item) => {
    setFlashcardForm({
      id: item.id,
      word: item.word || '',
      ipa: item.ipa || '',
      meaning_vi: item.meaning_vi || '',
      example_en: item.example_en || '',
      example_vi: item.example_vi || '',
      category: item.category ? item.category.replace(/(^\w|[- ]\w)/g, (s) => s.toUpperCase()) : 'General',
    });
    setShowFlashcardForm(true);
  };

  const saveFlashcard = async () => {
    if (!flashcardForm.word.trim() || !flashcardForm.meaning_vi.trim()) {
      toast('Từ vựng và nghĩa tiếng Việt là bắt buộc.', 'error');
      return;
    }
    setSavingFlashcard(true);
    try {
      const payload = {
        word: flashcardForm.word.trim(),
        ipa: flashcardForm.ipa.trim() || null,
        meaning_vi: flashcardForm.meaning_vi.trim(),
        example_en: flashcardForm.example_en.trim() || null,
        example_vi: flashcardForm.example_vi.trim() || null,
        category: flashcardForm.category,
      };
      if (flashcardForm.id) {
        await flashcardApi.update(flashcardForm.id, payload);
        toast('Đã cập nhật flashcard.');
      } else {
        await flashcardApi.create(payload);
        toast('Đã tạo flashcard mới.');
      }
      setShowFlashcardForm(false);
      loadFlashcards();
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSavingFlashcard(false);
    }
  };

  const deleteFlashcard = async (id) => {
    if (!window.confirm('Bạn có chắc muốn xóa flashcard này?')) return;
    try {
      await flashcardApi.delete(id);
      toast('Đã xóa flashcard.');
      loadFlashcards();
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <div className="fade-up creator-hub">
      <div className="page-header creator-header">
        <div>
          <h1 className="page-title">Creator Content Hub</h1>
          <p className="page-sub">Quản lý Part 6/7 và ngân hàng flashcard theo chuẩn Penwin học thuật</p>
        </div>
        <div className="creator-tab-group" role="tablist" aria-label="Creator dashboard tabs">
          <button
            className={`creator-tab-btn ${activeTab === 'passages' ? 'active' : ''}`}
            onClick={() => setActiveTab('passages')}
          >
            Passage Part 6/7
          </button>
          <button
            className={`creator-tab-btn ${activeTab === 'flashcards' ? 'active' : ''}`}
            onClick={() => setActiveTab('flashcards')}
          >
            Flashcard Manager
          </button>
        </div>
      </div>

      {activeTab === 'passages' && (
        <div className="creator-panel card">
          <div className="creator-panel-header">
            <div>
              <h2>Nhóm Passage - Câu hỏi TOEIC Part 6/7</h2>
              <p>Mỗi passage gồm 3-4 câu hỏi A/B/C/D liên kết trực tiếp với nhau trong cơ sở dữ liệu.</p>
            </div>
            <button className="btn btn-primary" onClick={openNewPassage}>+ Tạo nhóm passage</button>
          </div>

          {loadingPassages ? (
            <div className="loading-page" style={{ height: 180 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <div className="data-table-wrap creator-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Passage</th>
                    <th>Part</th>
                    <th>Mức điểm</th>
                    <th>Số câu</th>
                    <th>Grammar Tags</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {passageGroups.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="creator-empty-row">Chưa có nhóm passage nào. Hãy tạo nhóm đầu tiên.</td>
                    </tr>
                  ) : passageGroups.map((group) => (
                    <tr key={group.key}>
                      <td className="td-content">
                        {(group.passage || '').slice(0, 110)}
                        {(group.passage || '').length > 110 ? '...' : ''}
                      </td>
                      <td><span className="badge badge-blue">Part {group.part}</span></td>
                      <td><span className="badge badge-purple">{group.level}</span></td>
                      <td><span className="badge badge-green">{group.questions.length} câu</span></td>
                      <td>{group.tags || 'N/A'}</td>
                      <td>
                        <div className="creator-actions-inline">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditPassage(group)}>Sửa</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deletePassageGroup(group)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {activeTab === 'flashcards' && (
        <div className="creator-panel card">
          <div className="creator-panel-header">
            <div>
              <h2>Flashcard Manager</h2>
              <p>Quản lý từ vựng với Word, IPA, Meaning, ví dụ song ngữ và Category.</p>
            </div>
            <button className="btn btn-primary" onClick={openNewFlashcard}>+ Tạo flashcard</button>
          </div>

          {loadingFlashcards ? (
            <div className="loading-page" style={{ height: 180 }}><div className="spinner spinner-lg" /></div>
          ) : (
            <div className="data-table-wrap creator-table">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Word</th>
                    <th>IPA</th>
                    <th>Meaning (Vi)</th>
                    <th>Example (En/Vi)</th>
                    <th>Category</th>
                    <th>Hành động</th>
                  </tr>
                </thead>
                <tbody>
                  {flashcards.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="creator-empty-row">Chưa có flashcard nào trong hệ thống.</td>
                    </tr>
                  ) : flashcards.map((item) => (
                    <tr key={item.id}>
                      <td style={{ fontWeight: 700, color: 'var(--text)' }}>{item.word}</td>
                      <td>{item.ipa || '-'}</td>
                      <td>{item.meaning_vi}</td>
                      <td className="td-content">{item.example_en || '-'}{item.example_vi ? ` / ${item.example_vi}` : ''}</td>
                      <td><span className="badge badge-orange" style={{ textTransform: 'capitalize' }}>{item.category || 'general'}</span></td>
                      <td>
                        <div className="creator-actions-inline">
                          <button className="btn btn-ghost btn-sm" onClick={() => openEditFlashcard(item)}>Sửa</button>
                          <button className="btn btn-danger btn-sm" onClick={() => deleteFlashcard(item.id)}>Xóa</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {showPassageForm && (
        <div className="modal-overlay" onClick={() => setShowPassageForm(false)}>
          <div className="modal-box creator-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{passageForm.groupKey ? 'Cập nhật nhóm passage' : 'Tạo nhóm passage mới'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowPassageForm(false)}>x</button>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ gap: 10, marginBottom: 14 }}>
                <div className="form-group">
                  <label className="form-label">Part</label>
                  <select
                    className="form-select"
                    value={passageForm.part}
                    onChange={(e) => setPassageForm((prev) => ({ ...prev, part: Number(e.target.value) }))}
                  >
                    {PART_OPTIONS.map((part) => <option key={part} value={part}>Part {part}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Mức điểm TOEIC</label>
                  <select
                    className="form-select"
                    value={passageForm.level}
                    onChange={(e) => setPassageForm((prev) => ({ ...prev, level: Number(e.target.value) }))}
                  >
                    {SCORE_LEVELS.map((score) => <option key={score} value={score}>{score}</option>)}
                  </select>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 14 }}>
                <label className="form-label">Passage</label>
                <textarea
                  className="form-textarea"
                  rows={5}
                  value={passageForm.passage}
                  onChange={(e) => setPassageForm((prev) => ({ ...prev, passage: e.target.value }))}
                  placeholder="Nhập đoạn văn gốc cho nhóm câu hỏi Part 6/7..."
                />
              </div>

              <div className="form-group" style={{ marginBottom: 16 }}>
                <label className="form-label">Grammar Tags (phân tách bởi dấu phẩy)</label>
                <input
                  className="form-input"
                  value={passageForm.tags}
                  onChange={(e) => setPassageForm((prev) => ({ ...prev, tags: e.target.value }))}
                  placeholder="Verb Tenses, Prepositions"
                />
              </div>

              <div className="creator-question-list">
                {passageForm.questions.map((q, index) => (
                  <div className="creator-question-item" key={`${q.id || 'new'}-${index}`}>
                    <div className="creator-question-head">
                      <h4>Câu hỏi {index + 1}</h4>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => removePassageQuestion(index)}
                        disabled={passageForm.questions.length <= 3}
                      >
                        Bỏ câu
                      </button>
                    </div>

                    <div className="form-group" style={{ marginBottom: 10 }}>
                      <label className="form-label">Nội dung câu hỏi</label>
                      <textarea
                        className="form-textarea"
                        rows={2}
                        value={q.content}
                        onChange={(e) => updatePassageQuestion(index, 'content', e.target.value)}
                        placeholder="Nhập nội dung câu hỏi..."
                      />
                    </div>

                    <div className="grid-2" style={{ gap: 10 }}>
                      {q.options.map((opt, optIndex) => (
                        <div className="form-group" key={optIndex}>
                          <label className="form-label">Lựa chọn {ANSWER_KEYS[optIndex]}</label>
                          <input
                            className="form-input"
                            value={opt}
                            onChange={(e) => updatePassageOption(index, optIndex, e.target.value)}
                            placeholder={`Đáp án ${ANSWER_KEYS[optIndex]}`}
                          />
                        </div>
                      ))}
                    </div>

                    <div className="grid-2" style={{ gap: 10, marginTop: 10 }}>
                      <div className="form-group">
                        <label className="form-label">Đáp án đúng</label>
                        <select
                          className="form-select"
                          value={q.correct_answer}
                          onChange={(e) => updatePassageQuestion(index, 'correct_answer', e.target.value)}
                        >
                          {ANSWER_KEYS.map((key) => <option key={key}>{key}</option>)}
                        </select>
                      </div>
                      <div className="form-group">
                        <label className="form-label">Giải thích</label>
                        <input
                          className="form-input"
                          value={q.explanation}
                          onChange={(e) => updatePassageQuestion(index, 'explanation', e.target.value)}
                          placeholder="Giải thích ngắn gọn cho đáp án"
                        />
                      </div>
                    </div>
                  </div>
                ))}

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={addPassageQuestion}
                  disabled={passageForm.questions.length >= 4}
                >
                  + Thêm câu hỏi (tối đa 4)
                </button>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowPassageForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={savePassageGroup} disabled={savingPassage}>
                {savingPassage ? <><span className="spinner" />Đang lưu...</> : 'Lưu nhóm passage'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showFlashcardForm && (
        <div className="modal-overlay" onClick={() => setShowFlashcardForm(false)}>
          <div className="modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{flashcardForm.id ? 'Cập nhật flashcard' : 'Tạo flashcard mới'}</h3>
              <button className="btn btn-ghost btn-icon" onClick={() => setShowFlashcardForm(false)}>x</button>
            </div>
            <div className="modal-body">
              <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">Word</label>
                  <input
                    className="form-input"
                    value={flashcardForm.word}
                    onChange={(e) => setFlashcardForm((prev) => ({ ...prev, word: e.target.value }))}
                    placeholder="acquisition"
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">IPA</label>
                  <input
                    className="form-input"
                    value={flashcardForm.ipa}
                    onChange={(e) => setFlashcardForm((prev) => ({ ...prev, ipa: e.target.value }))}
                    placeholder="/ˌæk.wɪˈzɪʃ.ən/"
                  />
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: 10 }}>
                <label className="form-label">Meaning (Vi)</label>
                <input
                  className="form-input"
                  value={flashcardForm.meaning_vi}
                  onChange={(e) => setFlashcardForm((prev) => ({ ...prev, meaning_vi: e.target.value }))}
                  placeholder="sự tiếp nhận, sự thu nhận"
                />
              </div>

              <div className="grid-2" style={{ gap: 10, marginBottom: 10 }}>
                <div className="form-group">
                  <label className="form-label">Example (En)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={flashcardForm.example_en}
                    onChange={(e) => setFlashcardForm((prev) => ({ ...prev, example_en: e.target.value }))}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Example (Vi)</label>
                  <textarea
                    className="form-textarea"
                    rows={2}
                    value={flashcardForm.example_vi}
                    onChange={(e) => setFlashcardForm((prev) => ({ ...prev, example_vi: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Category</label>
                <select
                  className="form-select"
                  value={flashcardForm.category}
                  onChange={(e) => setFlashcardForm((prev) => ({ ...prev, category: e.target.value }))}
                >
                  {FLASHCARD_CATEGORIES.map((item) => <option key={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={() => setShowFlashcardForm(false)}>Hủy</button>
              <button className="btn btn-primary" onClick={saveFlashcard} disabled={savingFlashcard}>
                {savingFlashcard ? <><span className="spinner" />Đang lưu...</> : 'Lưu flashcard'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
