import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { analyticsApi, questionApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { IMG_VOCAB, IMG_PROGRESS, IMG_HERO } from '../assets/images';
import QuestionCard from '../components/QuestionCard';
import './Practice.css';

const SKILL_IMGS = { reading: IMG_VOCAB };
const TOEIC_PARTS = [
  { value: 5, label: 'Part 5', sub: 'Incomplete Sentences' },
  { value: 6, label: 'Part 6', sub: 'Text Completion' },
  { value: 7, label: 'Part 7', sub: 'Reading Comprehension' },
];

const normalizeAnswer = (v) => String(v ?? '').trim().toLowerCase();
const letterToIndex = { A: 0, B: 1, C: 2, D: 3 };

function resolveCorrectAnswer(question, rawAnswer) {
  const ans = String(rawAnswer ?? '').trim();
  const idx = letterToIndex[ans.toUpperCase()];
  if (Number.isInteger(idx) && Array.isArray(question?.options) && question.options[idx] != null) {
    return question.options[idx];
  }
  return ans;
}

function parseQuestionNumber(question, fallback) {
  const direct = Number(question?.question_number);
  if (Number.isInteger(direct) && direct > 0) return direct;

  const text = String(question?.question_text || question?.content || '');
  const bracketMatch = text.match(/\((\d+)\)/);
  if (bracketMatch) return Number(bracketMatch[1]);

  const leadingMatch = text.match(/^\s*(\d+)\s*[.)-]?\s*/);
  if (leadingMatch) return Number(leadingMatch[1]);

  return fallback + 1;
}

function buildPassageGroups(items) {
  const grouped = new Map();

  items.forEach((item, idx) => {
    const normalizedPassage = String(item?.passage || '').trim();
    const key =
      item?.passage_id ||
      item?.passage_group_id ||
      item?.question_group_id ||
      (normalizedPassage ? `passage:${normalizedPassage}` : `single:${item?.id || idx}`);

    if (!grouped.has(key)) {
      grouped.set(key, []);
    }
    grouped.get(key).push(item);
  });

  return Array.from(grouped.entries())
    .map(([key, questions]) => {
      const sorted = questions
        .slice()
        .sort((a, b) => parseQuestionNumber(a, 0) - parseQuestionNumber(b, 0) || Number(a?.id || 0) - Number(b?.id || 0))
        .map((question, qIndex) => ({
          ...question,
          _groupKey: String(key),
          _questionKey: question?.id ? `id-${question.id}` : `${key}-${qIndex}`,
          _questionNo: parseQuestionNumber(question, qIndex),
        }));

      return {
        key: String(key),
        passage: sorted.find((q) => q?.passage)?.passage || '',
        part: Number(sorted[0]?.part || 0),
        questions: sorted,
      };
    })
    .sort((a, b) => (a.questions[0]?._questionNo || 0) - (b.questions[0]?._questionNo || 0));
}

export default function Practice() {
  const [params] = useSearchParams();
  const toast = useToast();

  const [step, setStep] = useState('config');
  const [skill] = useState('reading');
  const [readingPart, setReadingPart] = useState(Number(params.get('part')) || 5);
  const [count, setCount] = useState(10);

  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answer, setAnswer] = useState('');
  const [result, setResult] = useState(null);

  const [groups, setGroups] = useState([]);
  const [groupIdx, setGroupIdx] = useState(0);
  const [groupAnswers, setGroupAnswers] = useState({});
  const [groupResults, setGroupResults] = useState({});
  const [checkedGroupKeys, setCheckedGroupKeys] = useState({});

  const [score, setScore] = useState({ correct: 0, total: 0 });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const questionListRef = useRef(null);
  const questionNodeRefs = useRef({});
  const analyticsUploadedRef = useRef(false);

  const markPracticeFinished = useCallback(() => {
    const stamp = String(Date.now());
    localStorage.setItem('pengwin_last_practice_completed_at', stamp);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pengwin:practice-finished'));
    }
  }, []);

  useEffect(() => {
    if (![5, 6, 7].includes(Number(readingPart))) {
      setReadingPart(5);
    }
  }, [readingPart]);

  const isGroupMode = Number(readingPart) === 6 || Number(readingPart) === 7;

  const currentGroup = groups[groupIdx] || null;
  const currentGroupQuestions = currentGroup?.questions || [];
  const activeMetaQuestion = isGroupMode ? currentGroupQuestions[0] : questions[currentIndex];

  useEffect(() => {
    if (step !== 'done' || analyticsUploadedRef.current) return;
    analyticsUploadedRef.current = true;

    const payload = {
      exported_at: new Date().toISOString(),
      reading_part: Number(readingPart),
      mode: isGroupMode ? 'passage' : 'single',
      score,
      total_questions: isGroupMode
        ? groups.reduce((acc, g) => acc + (Array.isArray(g?.questions) ? g.questions.length : 0), 0)
        : questions.length,
    };

    analyticsApi.upload(payload).catch(() => {
      analyticsUploadedRef.current = false;
    });
  }, [step, score, readingPart, isGroupMode, groups, questions.length]);

  const allGroupAnswered = useMemo(() => {
    if (!isGroupMode || !currentGroupQuestions.length) return false;
    return currentGroupQuestions.every((q) => normalizeAnswer(groupAnswers[q._questionKey]).length > 0);
  }, [isGroupMode, currentGroupQuestions, groupAnswers]);

  const currentGroupChecked = Boolean(currentGroup && checkedGroupKeys[currentGroup.key]);

  const groupCompletion = useMemo(() => {
    if (!isGroupMode || !groups.length) return { current: 0, total: 0 };
    return { current: groupIdx + 1, total: groups.length };
  }, [isGroupMode, groupIdx, groups.length]);

  const startSession = useCallback(async () => {
    setLoading(true);
    try {
      const data = await questionApi.startPractice(skill, count, readingPart);

      setScore({ correct: 0, total: 0 });
      setResult(null);
      setAnswer('');
      setCurrentIndex(0);
      analyticsUploadedRef.current = false;

      if (Number(readingPart) === 6 || Number(readingPart) === 7) {
        const apiPassages = Array.isArray(data?.passages) ? data.passages : [];
        const groupedFromApi = apiPassages.map((passageObject, passageIndex) => {
          const questionsInPassage = Array.isArray(passageObject?.questions) ? passageObject.questions : [];
          const sorted = questionsInPassage
            .slice()
            .sort((a, b) => parseQuestionNumber(a, 0) - parseQuestionNumber(b, 0) || Number(a?.id || 0) - Number(b?.id || 0))
            .map((question, qIndex) => ({
              ...question,
              _groupKey: String(passageObject?.passage_id || `passage-${passageIndex}`),
              _questionKey: question?.id ? `id-${question.id}` : `passage-${passageIndex}-${qIndex}`,
              _questionNo: parseQuestionNumber(question, qIndex),
            }));

          return {
            key: String(passageObject?.passage_id || `passage-${passageIndex}`),
            passage: String(passageObject?.passage || ''),
            part: Number(passageObject?.part || readingPart),
            questions: sorted,
          };
        }).filter((group) => group.questions.length > 0);

        const legacyQuestions = Array.isArray(data?.questions) ? data.questions : [];
        const grouped = groupedFromApi.length ? groupedFromApi : buildPassageGroups(legacyQuestions);

        if (!grouped.length) {
          toast('No grouped passages found for this part.', 'error');
          return;
        }

        setGroups(grouped);
        setGroupIdx(0);
        setGroupAnswers({});
        setGroupResults({});
        setCheckedGroupKeys({});
        setQuestions([]);
      } else {
        const randomQuestions = await questionApi.random(readingPart);
        const pickedQuestions = (Array.isArray(randomQuestions) ? randomQuestions : []).filter(
          (q) => Number(q?.part) === Number(readingPart)
        );
        if (!pickedQuestions.length) {
          toast('No questions available for this selection.', 'error');
          return;
        }
        setQuestions(pickedQuestions);
        setGroups([]);
      }

      setStep('playing');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setLoading(false);
    }
  }, [skill, count, readingPart, toast]);

  const persistReadingPartProgress = useCallback((part, isCorrect) => {
    const key = 'pengwin_reading_part_progress';
    const current = JSON.parse(localStorage.getItem(key) || '{}');
    const partKey = `part${Number(part)}`;
    const prev = current[partKey] || { done: 0, correct: 0 };
    current[partKey] = {
      done: prev.done + 1,
      correct: prev.correct + (isCorrect ? 1 : 0),
    };
    localStorage.setItem(key, JSON.stringify(current));
  }, []);

  const handleSingleSubmit = async () => {
    if (!answer.trim()) {
      toast('Please select or enter an answer.', 'error');
      return;
    }

    const currentQ = questions[currentIndex];
    if (!currentQ) return;

    setSubmitting(true);
    try {
      if (currentQ.id) {
        const res = await questionApi.submitAnswer(currentQ.id, answer);
        const normalizedCorrect = resolveCorrectAnswer(currentQ, res.correct_answer);
        const normalizedRes = {
          ...res,
          correct_answer: normalizedCorrect,
          is_correct: normalizeAnswer(answer) === normalizeAnswer(normalizedCorrect),
        };

        setResult(normalizedRes);
        setScore((s) => ({
          correct: s.correct + (normalizedRes.is_correct ? 1 : 0),
          total: s.total + 1,
        }));
        if (currentQ.skill === 'reading' && [5, 6, 7].includes(Number(currentQ.part))) {
          persistReadingPartProgress(currentQ.part, normalizedRes.is_correct);
        }
      } else {
        const correctAnswer = resolveCorrectAnswer(currentQ, currentQ.correct_answer);
        const isCorrect = normalizeAnswer(answer) === normalizeAnswer(correctAnswer);
        const localResult = {
          is_correct: isCorrect,
          correct_answer: correctAnswer,
          explanation: currentQ.explanation || null,
          ai_feedback: null,
          xp_gained: isCorrect ? 10 : 2,
        };
        setResult(localResult);
        setScore((s) => ({ correct: s.correct + (isCorrect ? 1 : 0), total: s.total + 1 }));
      }
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSingleNext = () => {
    if (currentIndex + 1 >= questions.length) {
      markPracticeFinished();
      setStep('done');
      return;
    }
    setCurrentIndex((i) => i + 1);
    setAnswer('');
    setResult(null);
  };

  const handleGroupAnswerChange = (questionKey, value) => {
    if (!currentGroup || currentGroupChecked) return;
    setGroupAnswers((prev) => ({ ...prev, [questionKey]: value }));
  };

  const handleCheckGroup = () => {
    if (!currentGroup) return;
    if (currentGroupChecked) return;

    if (!allGroupAnswered) {
      toast('Please answer all questions in this passage before checking.', 'error');
      return;
    }

    const resultByQuestion = {};
    let correctCount = 0;

    currentGroupQuestions.forEach((question) => {
      const selected = groupAnswers[question._questionKey] || '';
      const correctAnswer = resolveCorrectAnswer(question, question.correct_answer);
      const isCorrect = normalizeAnswer(selected) === normalizeAnswer(correctAnswer);

      resultByQuestion[question._questionKey] = {
        is_correct: isCorrect,
        correct_answer: correctAnswer,
        explanation: question.explanation || null,
      };

      if (isCorrect) correctCount += 1;
      persistReadingPartProgress(question.part, isCorrect);
    });

    setGroupResults((prev) => ({ ...prev, [currentGroup.key]: resultByQuestion }));
    setCheckedGroupKeys((prev) => ({ ...prev, [currentGroup.key]: true }));
    setScore((prev) => ({
      correct: prev.correct + correctCount,
      total: prev.total + currentGroupQuestions.length,
    }));
  };

  const handleNextGroup = () => {
    if (!groups.length) return;
    if (groupIdx + 1 >= groups.length) {
      markPracticeFinished();
      setStep('done');
      return;
    }
    setGroupIdx((i) => i + 1);
    requestAnimationFrame(() => {
      if (questionListRef.current) questionListRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    });
  };

  const scrollToQuestion = (questionNo) => {
    const target = currentGroupQuestions.find((q) => Number(q._questionNo) === Number(questionNo));
    if (!target) return;

    const node = questionNodeRefs.current[target._questionKey];
    const container = questionListRef.current;
    if (!node || !container) return;

    const offset = Math.max(node.offsetTop - container.offsetTop - 10, 0);
    container.scrollTo({ top: offset, behavior: 'smooth' });
  };

  const renderPassageWithInteractiveBlanks = (passageText) => {
    const text = String(passageText || '');
    if (!text) return null;

    const regex = /\((\d+)\)/g;
    const nodes = [];
    let cursor = 0;
    let match;

    while ((match = regex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = regex.lastIndex;
      const blankNo = Number(match[1]);
      const hasQuestion = currentGroupQuestions.some((q) => Number(q._questionNo) === blankNo);

      if (matchStart > cursor) {
        nodes.push(
          <span key={`txt-${cursor}`}>{text.slice(cursor, matchStart)}</span>
        );
      }

      if (hasQuestion) {
        nodes.push(
          <button
            type="button"
            key={`blank-${matchStart}`}
            className="passage-blank"
            onClick={() => scrollToQuestion(blankNo)}
            title={`Go to Question ${blankNo}`}
          >
            ({blankNo})
          </button>
        );
      } else {
        nodes.push(
          <span key={`blank-static-${matchStart}`} className="passage-blank static">
            ({blankNo})
          </span>
        );
      }

      cursor = matchEnd;
    }

    if (cursor < text.length) {
      nodes.push(<span key={`txt-end-${cursor}`}>{text.slice(cursor)}</span>);
    }

    return <>{nodes}</>;
  };

  if (step === 'config') {
    return (
      <div className="fade-up practice-config">
        <div className="page-header">
          <h1 className="page-title">▶ Practice</h1>
          <p className="page-sub">Choose TOEIC Reading part and question count to begin</p>
        </div>
        <div className="card" style={{ padding: 28 }}>
          <div className="form-group" style={{ marginBottom: 22 }}>
            <label className="form-label">TOEIC Reading Part</label>
            <div className="part-picker">
              {TOEIC_PARTS.map((p) => (
                <button
                  key={p.value}
                  className={`skill-pick-btn part-pick-btn ${readingPart === p.value ? 'active' : ''}`}
                  onClick={() => setReadingPart(p.value)}
                >
                  <img src={IMG_VOCAB} alt={p.label} />
                  <span>{p.label}</span>
                  <small className="part-pick-sub">{p.sub}</small>
                </button>
              ))}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 28 }}>
            <label className="form-label">
              Question count: <strong style={{ color: 'var(--ocean)', fontSize: 15 }}>{count}</strong>
            </label>
            <input
              type="range"
              min={5}
              max={30}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
              style={{ width: '100%', accentColor: 'var(--ocean)', marginTop: 8 }}
            />
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontSize: 12,
                color: 'var(--text3)',
                marginTop: 4,
                fontWeight: 600,
              }}
            >
              <span>5</span>
              <span>30</span>
            </div>
          </div>
          <button className="btn btn-primary btn-lg" style={{ width: '100%' }} onClick={startSession} disabled={loading}>
            {loading ? (
              <>
                <span className="spinner" />Loading...
              </>
            ) : (
              `▶ Start ${count} questions · Part ${readingPart}`
            )}
          </button>
        </div>
      </div>
    );
  }

  if (step === 'done') {
    return (
      <div className="fade-up practice-done">
        <div className="done-card card">
          <img className="done-mascot" src={score.correct / score.total >= 0.7 ? IMG_PROGRESS : IMG_HERO} alt="" />
          <h2 className="done-title">
            {score.correct === score.total ? 'Perfect!' : score.correct / score.total >= 0.7 ? 'Great job!' : 'Keep going!'}
          </h2>
          <div className="done-score">
            <span className="done-num accent">{score.correct}</span>
            <span className="done-slash">/</span>
            <span className="done-num">{score.total}</span>
          </div>
          <div className="done-pct">{Math.round((score.correct / Math.max(score.total, 1)) * 100)}% correct</div>
          <p className="done-msg">
            {score.correct === score.total
              ? 'Excellent! You got everything right!'
              : score.correct / Math.max(score.total, 1) >= 0.7
              ? 'Nice work! Keep reviewing!'
              : 'Check the Review section to study more!'}
          </p>
          <div className="done-actions">
            <button className="btn btn-primary" onClick={startSession}>▶ Làm thêm</button>
            <button className="btn btn-secondary" onClick={() => setStep('config')}>⚙ Change Part</button>
          </div>
        </div>
      </div>
    );
  }

  const singleQuestion = questions[currentIndex];
  const singleQuestionText = singleQuestion?.question_text || singleQuestion?.content || '';
  const singleType = singleQuestion?.q_type || ((singleQuestion?.options && singleQuestion.options.length) ? 'mcq' : null);

  return (
    <div className="fade-up">
      <div className="practice-header">
        <div className="practice-meta">
          <span className="badge badge-blue" style={{ textTransform: 'capitalize' }}>{activeMetaQuestion?.skill}</span>
          <span className="badge badge-purple">{activeMetaQuestion?.level}</span>
          {activeMetaQuestion?.part && <span className="badge badge-yellow">Part {activeMetaQuestion.part}</span>}
          <span className="badge badge-gray">
            {isGroupMode ? `${groupCompletion.current} / ${groupCompletion.total} passages` : singleType?.replace('_', ' ')}
          </span>
        </div>
        <div className="practice-progress">
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 700 }}>
            {isGroupMode ? `${groupCompletion.current} / ${groupCompletion.total}` : `${currentIndex + 1} / ${questions.length}`}
          </span>
          <div className="progress-wrap" style={{ width: 120 }}>
            <div
              className="progress-fill"
              style={{
                width: `${isGroupMode
                  ? (groupCompletion.current / Math.max(groupCompletion.total, 1)) * 100
                  : ((currentIndex + 1) / Math.max(questions.length, 1)) * 100
                }%`,
              }}
            />
          </div>
          <span style={{ fontSize: 13, color: 'var(--mint2)', fontWeight: 800 }}>✓ {score.correct}</span>
        </div>
      </div>

      <div className="step-dots">
        {(isGroupMode ? groups : questions).map((_, i) => (
          <div
            key={i}
            className={`step-dot ${i < (isGroupMode ? groupIdx : currentIndex) ? 'done' : i === (isGroupMode ? groupIdx : currentIndex) ? 'current' : ''}`}
          />
        ))}
      </div>

      {isGroupMode ? (
        <div className="practice-reading-layout">
          <div className="passage-card card">
            <div className="passage-title">Passage</div>
            <div className="passage-content">
              {renderPassageWithInteractiveBlanks(currentGroup?.passage)}
            </div>
          </div>

          <div className="question-card card">
            <img className="question-bg-img" src={SKILL_IMGS[activeMetaQuestion?.skill] || IMG_VOCAB} alt="" />
            <div className="question-list-title">Questions in this passage</div>
            <div className="question-list-mini">
              {currentGroupQuestions.map((question) => {
                const qResult = groupResults[currentGroup?.key]?.[question._questionKey];
                const isAnswered = normalizeAnswer(groupAnswers[question._questionKey]).length > 0;
                return (
                  <button
                    key={question._questionKey}
                    type="button"
                    className={`mini-q-btn ${isAnswered ? 'answered' : ''} ${
                      currentGroupChecked && qResult?.is_correct ? 'correct' : ''
                    } ${currentGroupChecked && qResult && !qResult.is_correct ? 'wrong' : ''}`}
                    onClick={() => scrollToQuestion(question._questionNo)}
                  >
                    Q{question._questionNo}
                  </button>
                );
              })}
            </div>

            <div className="match-hint" style={{ marginBottom: 12 }}>
              For Part 6, click blanks like (1), (2), (3) in the passage to jump to the question.
            </div>

            <div className="question-scroll" ref={questionListRef}>
              {currentGroupQuestions.map((question) => (
                <div
                  key={question._questionKey}
                  className="group-question-block"
                  ref={(el) => {
                    questionNodeRefs.current[question._questionKey] = el;
                  }}
                >
                  <QuestionCard
                    question={question}
                    questionNo={question._questionNo}
                    selectedAnswer={groupAnswers[question._questionKey] || ''}
                    onSelectAnswer={(value) => handleGroupAnswerChange(question._questionKey, value)}
                    showFeedback={currentGroupChecked}
                    result={groupResults[currentGroup?.key]?.[question._questionKey]}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="question-card card">
          <img className="question-bg-img" src={SKILL_IMGS[singleQuestion?.skill] || IMG_VOCAB} alt="" />

          {singleQuestion?.passage ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={{ whiteSpace: 'pre-line', lineHeight: 1.6, fontSize: 14, color: 'var(--text2)' }}>{singleQuestion.passage}</div>
              <div>
                <p className="q-text">{singleQuestionText}</p>

                {singleType === 'mcq' && !result && (
                  <div className="choices">
                    {(singleQuestion.options || []).map((opt, i) => (
                      <button key={i} className={`choice ${answer === opt ? 'selected' : ''}`} onClick={() => setAnswer(opt)}>
                        <span className="choice-letter">{String.fromCharCode(65 + i)}</span>{opt}
                      </button>
                    ))}
                  </div>
                )}
                {singleType === 'mcq' && result && (
                  <div className="choices">
                    {(singleQuestion.options || []).map((opt, i) => (
                      <div
                        key={i}
                        className={`choice static ${opt === result.correct_answer ? 'correct' : ''}${opt === answer && !result.is_correct ? ' wrong' : ''}`}
                      >
                        <span className="choice-letter">{String.fromCharCode(65 + i)}</span>{opt}
                      </div>
                    ))}
                  </div>
                )}
                {(singleType === 'fill_blank' || singleType === 'writing' || singleType === 'speaking') && (
                  <textarea
                    className="form-textarea"
                    placeholder={singleType === 'fill_blank' ? 'Enter your answer...' : 'Write your answer...'}
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    disabled={!!result}
                    rows={singleType === 'writing' ? 5 : 2}
                  />
                )}
              </div>
            </div>
          ) : (
            <>
              <p className="q-text">{singleQuestionText}</p>

              {singleType === 'mcq' && !result && (
                <div className="choices">
                  {(singleQuestion.options || []).map((opt, i) => (
                    <button key={i} className={`choice ${answer === opt ? 'selected' : ''}`} onClick={() => setAnswer(opt)}>
                      <span className="choice-letter">{String.fromCharCode(65 + i)}</span>{opt}
                    </button>
                  ))}
                </div>
              )}
              {singleType === 'mcq' && result && (
                <div className="choices">
                  {(singleQuestion.options || []).map((opt, i) => (
                    <div
                      key={i}
                      className={`choice static ${opt === result.correct_answer ? 'correct' : ''}${opt === answer && !result.is_correct ? ' wrong' : ''}`}
                    >
                      <span className="choice-letter">{String.fromCharCode(65 + i)}</span>{opt}
                    </div>
                  ))}
                </div>
              )}
              {(singleType === 'fill_blank' || singleType === 'writing' || singleType === 'speaking') && (
                <textarea
                  className="form-textarea"
                  placeholder={singleType === 'fill_blank' ? 'Enter your answer...' : 'Write your answer...'}
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  disabled={!!result}
                  rows={singleType === 'writing' ? 5 : 2}
                />
              )}
            </>
          )}

          {result && (
            <div className={`feedback ${result.is_correct ? 'correct-fb' : 'wrong-fb'}`}>
              <div className="feedback-icon">{result.is_correct ? '✅' : '❌'}</div>
              <div>
                <div className="feedback-title">{result.is_correct ? `Correct! +${result.xp_gained} XP` : 'Incorrect'}</div>
                {!result.is_correct && <div className="feedback-answer">Answer: <strong>{result.correct_answer}</strong></div>}
                {result.explanation && <div className="feedback-explain">{result.explanation}</div>}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="practice-actions">
        {isGroupMode ? (
          !currentGroupChecked ? (
            <button className="btn btn-primary" onClick={handleCheckGroup} disabled={submitting || !allGroupAnswered}>
              Check Answer
            </button>
          ) : (
            <button className="btn btn-primary" onClick={handleNextGroup}>
              {groupIdx + 1 >= groups.length ? 'View results →' : 'Next passage →'}
            </button>
          )
        ) : !result ? (
          <button className="btn btn-primary" onClick={handleSingleSubmit} disabled={submitting || !answer.trim()}>
            {submitting ? (
              <>
                <span className="spinner" />Grading...
              </>
            ) : (
              'Submit'
            )}
          </button>
        ) : (
          <button className="btn btn-primary" onClick={handleSingleNext}>
            {currentIndex + 1 >= questions.length ? 'Quiz Complete' : 'Next question →'}
          </button>
        )}

        <button className="btn btn-ghost" onClick={() => setStep('config')}>Stop</button>
      </div>
    </div>
  );
}
