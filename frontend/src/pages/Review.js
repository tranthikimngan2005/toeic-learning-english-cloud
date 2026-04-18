import { useEffect, useMemo, useState } from 'react';
import { reviewApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { IMG_HERO } from '../assets/images';
import './Review.css';

const GRADES = [
  { key: 'again', label: 'Again', sub: '< 1 ngày', color: '#ff5a5a' },
  { key: 'hard', label: 'Hard', sub: '~3 ngày', color: '#ff8c42' },
  { key: 'good', label: 'Good', sub: '~6 ngày', color: '#2196b0' },
  { key: 'easy', label: 'Easy', sub: '~15 ngày', color: '#4ecb8d' },
];

const normalize = (value) => String(value ?? '').trim().toLowerCase();

export default function Review() {
  const toast = useToast();

  const [reviewType, setReviewType] = useState('');
  const [loading, setLoading] = useState(false);

  const [mistakes, setMistakes] = useState([]);
  const [srsCards, setSrsCards] = useState([]);

  const [index, setIndex] = useState(0);
  const [grading, setGrading] = useState(false);

  const [userAnswer, setUserAnswer] = useState('');
  const [checked, setChecked] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState('');

  const activeQueue = reviewType === 'mistakes' ? mistakes : srsCards;
  const queueItem = activeQueue[index];

  const markReviewFinished = () => {
    const stamp = String(Date.now());
    localStorage.setItem('pengwin_last_review_completed_at', stamp);
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('pengwin:review-finished'));
    }
  };

  const question = useMemo(() => {
    if (!queueItem) return null;
    if (reviewType === 'mistakes') return queueItem.question;
    return queueItem.question;
  }, [queueItem, reviewType]);

  const isMcq = Array.isArray(question?.options) && question.options.length > 0;

  const isCorrect = normalize(userAnswer) === normalize(question?.correct_answer);
  const queueDone = reviewType && index >= activeQueue.length;

  useEffect(() => {
    setIndex(0);
    setUserAnswer('');
    setChecked(false);
    setSelectedGrade('');
  }, [reviewType]);

  const loadRecentMistakes = async () => {
    setLoading(true);
    try {
      const data = await reviewApi.mistakes();
      setMistakes(Array.isArray(data) ? data : []);
      setReviewType('mistakes');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const loadDailySrs = async () => {
    setLoading(true);
    try {
      const data = await reviewApi.srs();
      setSrsCards(Array.isArray(data) ? data : []);
      setReviewType('srs');
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setLoading(false);
    }
  };

  const resetPerItemState = () => {
    setUserAnswer('');
    setChecked(false);
    setSelectedGrade('');
  };

  const handleNextQuestion = () => {
    if (index + 1 >= activeQueue.length) {
      markReviewFinished();
    }
    setIndex((value) => value + 1);
    resetPerItemState();
  };

  const handleChangeReviewType = () => {
    setReviewType('');
    setMistakes([]);
    setSrsCards([]);
    setIndex(0);
    resetPerItemState();
  };

  const handleGrade = async (grade) => {
    if (!queueItem || reviewType !== 'srs' || grading) return;
    setGrading(true);
    try {
      await reviewApi.submit(queueItem.id, grade);
      setSelectedGrade(grade);
      toast('Đã cập nhật lịch ôn tập.', 'success');
      handleNextQuestion();
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setGrading(false);
    }
  };

  if (!reviewType) {
    return (
      <div className="fade-up review-entry">
        <div className="page-header">
          <h1 className="page-title">🔁 Review</h1>
          <p className="page-sub">Chọn đúng loại ôn tập để học có trọng tâm và hiệu quả.</p>
        </div>

        <div className="review-type-grid">
          <button className="card review-type-card" onClick={loadRecentMistakes} disabled={loading}>
            <h2>Review Recent Mistakes</h2>
            <p>Ôn tập câu sai gần đây</p>
          </button>

          <button className="card review-type-card" onClick={loadDailySrs} disabled={loading}>
            <h2>Daily SRS Review</h2>
            <p>Ôn tập định kỳ</p>
          </button>
        </div>

        {loading ? <div className="loading-page"><div className="spinner spinner-lg" /></div> : null}
      </div>
    );
  }

  if (loading) {
    return <div className="loading-page"><div className="spinner spinner-lg" /></div>;
  }

  if (queueDone || activeQueue.length === 0) {
    return (
      <div className="fade-up review-entry">
        <div className="card review-caught-up">
          <img src={IMG_HERO} alt="Pengwin cheering" className="review-cheer-img" />
          <h2>All caught up!</h2>
          <p>Bạn đã hoàn thành hàng đợi ôn tập hiện tại. Tiếp tục phát huy nhé.</p>
          <div className="review-caught-up-actions">
            <button className="btn btn-secondary" onClick={handleChangeReviewType}>Chọn loại ôn tập khác</button>
            <a href="/dashboard" className="btn btn-primary">Về Dashboard</a>
          </div>
        </div>
      </div>
    );
  }

  if (reviewType === 'mistakes') {
    return (
      <div className="fade-up review-mode-wrap">
        <div className="review-queue-header">
          <span className="badge badge-orange">Ôn tập câu sai gần đây</span>
          <span className="badge badge-gray">{index + 1} / {activeQueue.length}</span>
        </div>

        <div className="card review-main-card">
          <p className="review-question">{question?.content}</p>

          {isMcq ? (
            <div className="review-options">
              {(question.options || []).map((option, optionIndex) => (
                <button
                  key={optionIndex}
                  className={`choice ${normalize(userAnswer) === normalize(option) ? 'selected' : ''}`}
                  onClick={() => setUserAnswer(option)}
                  disabled={checked}
                >
                  <span className="choice-letter">{String.fromCharCode(65 + optionIndex)}</span>
                  {option}
                </button>
              ))}
            </div>
          ) : (
            <textarea
              className="form-textarea"
              rows={3}
              value={userAnswer}
              placeholder="Nhập câu trả lời của bạn..."
              onChange={(event) => setUserAnswer(event.target.value)}
              disabled={checked}
            />
          )}

          {!checked ? (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setUserAnswer((prev) => String(prev ?? '').trim());
                setChecked(true);
              }}
              disabled={!normalize(userAnswer)}
            >
              Check Answer
            </button>
          ) : (
            <>
              <div className={`review-diff-block ${isCorrect ? 'correct' : 'wrong'}`}>
                <div className="review-diff-label">Câu trả lời của bạn:</div>
                <div className="review-diff-text">{userAnswer || 'Không có dữ liệu'}</div>
              </div>
              <div className="review-diff-block wrong">
                <div className="review-diff-label">Câu trả lời trước đó (sai):</div>
                <div className="review-diff-text">{queueItem?.user_answer || 'Không có dữ liệu'}</div>
              </div>
              <div className="review-diff-block correct">
                <div className="review-diff-label">Đáp án đúng:</div>
                <div className="review-diff-text">{question?.correct_answer}</div>
              </div>
              {question?.explanation ? (
                <div className="review-explanation">Giải thích: {question.explanation}</div>
              ) : null}
            </>
          )}
        </div>

        <div className="review-actions-row">
          <button className="btn btn-primary" onClick={handleNextQuestion} disabled={!checked}>Next</button>
          <button className="btn btn-ghost" onClick={handleChangeReviewType}>Đổi loại ôn tập</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fade-up review-mode-wrap">
      <div className="review-queue-header">
        <span className="badge badge-blue">Ôn tập định kỳ SRS</span>
        <span className="badge badge-gray">{index + 1} / {activeQueue.length}</span>
      </div>

      <div className="card review-main-card">
        <p className="review-question">{question?.content}</p>

        {isMcq ? (
          <div className="review-options">
            {(question.options || []).map((option, optionIndex) => (
              <button
                key={optionIndex}
                className={`choice ${normalize(userAnswer) === normalize(option) ? 'selected' : ''}`}
                onClick={() => setUserAnswer(option)}
                disabled={checked}
              >
                <span className="choice-letter">{String.fromCharCode(65 + optionIndex)}</span>
                {option}
              </button>
            ))}
          </div>
        ) : (
          <textarea
            className="form-textarea"
            rows={3}
            value={userAnswer}
            placeholder="Nhập câu trả lời của bạn..."
            onChange={(event) => setUserAnswer(event.target.value)}
            disabled={checked}
          />
        )}

        {!checked ? (
          <button
            className="btn btn-secondary"
            onClick={() => {
              setUserAnswer((prev) => String(prev ?? '').trim());
              setChecked(true);
            }}
            disabled={!normalize(userAnswer)}
          >
            Check Answer
          </button>
        ) : (
          <>
            <div className={`review-diff-block ${isCorrect ? 'correct' : 'wrong'}`}>
              <div className="review-diff-label">Câu trả lời của bạn:</div>
              <div className="review-diff-text">{userAnswer}</div>
            </div>
            {!isCorrect ? (
              <div className="review-diff-block correct">
                <div className="review-diff-label">Đáp án đúng:</div>
                <div className="review-diff-text">{question?.correct_answer}</div>
              </div>
            ) : null}
            {question?.explanation ? (
              <div className="review-explanation">Giải thích: {question.explanation}</div>
            ) : null}

            <div className="review-grade-area">
              <p className="review-grade-title">Đánh giá độ nhớ để lên lịch ôn tiếp:</p>
              <div className="grade-btns">
                {GRADES.map((grade) => (
                  <button
                    key={grade.key}
                    className={`grade-btn ${selectedGrade === grade.key ? 'active' : ''}`}
                    style={{ '--gc': grade.color }}
                    onClick={() => handleGrade(grade.key)}
                    disabled={grading}
                  >
                    <span className="grade-label">{grade.label}</span>
                    <span className="grade-sub">{grade.sub}</span>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div className="review-actions-row">
        <button className="btn btn-primary" onClick={handleNextQuestion} disabled={!checked || grading}>Next</button>
        <button className="btn btn-ghost" onClick={handleChangeReviewType}>Đổi loại ôn tập</button>
      </div>
    </div>
  );
}
