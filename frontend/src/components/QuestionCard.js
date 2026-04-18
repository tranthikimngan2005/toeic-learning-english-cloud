import React from 'react';

const normalizeAnswer = (v) => String(v ?? '').trim().toLowerCase();

export default function QuestionCard({
  question,
  questionNo,
  selectedAnswer,
  onSelectAnswer,
  showFeedback,
  result,
}) {
  if (!question) return null;

  const qType = question?.q_type || (Array.isArray(question?.options) && question.options.length ? 'mcq' : null);
  const questionText = question?.question_text || question?.content || '';

  return (
    <div>
      <div className="question-list-title">Question {questionNo}</div>
      <p className="q-text" style={{ marginBottom: 14 }}>{questionText}</p>

      {qType === 'mcq' && !showFeedback && (
        <div className="choices">
          {(question.options || []).map((opt, i) => (
            <button
              key={i}
              className={`choice ${selectedAnswer === opt ? 'selected' : ''}`}
              onClick={() => onSelectAnswer(opt)}
            >
              <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
              {opt}
            </button>
          ))}
        </div>
      )}

      {qType === 'mcq' && showFeedback && (
        <div className="choices">
          {(question.options || []).map((opt, i) => (
            <div
              key={i}
              className={`choice static ${opt === result?.correct_answer ? 'correct' : ''}${
                opt === selectedAnswer && !result?.is_correct ? ' wrong' : ''
              }`}
            >
              <span className="choice-letter">{String.fromCharCode(65 + i)}</span>
              {opt}
            </div>
          ))}
        </div>
      )}

      {(qType === 'fill_blank' || qType === 'writing' || qType === 'speaking') && (
        <textarea
          className="form-textarea"
          placeholder={qType === 'fill_blank' ? 'Enter your answer...' : 'Write your answer...'}
          value={selectedAnswer || ''}
          onChange={(e) => onSelectAnswer(e.target.value)}
          disabled={showFeedback}
          rows={qType === 'writing' ? 5 : 2}
        />
      )}

      {showFeedback && result && (
        <div className={`feedback ${result.is_correct ? 'correct-fb' : 'wrong-fb'}`}>
          <div className="feedback-icon">{result.is_correct ? '✅' : '❌'}</div>
          <div>
            <div className="feedback-title">{result.is_correct ? 'Correct' : 'Incorrect'}</div>
            {!result.is_correct && (
              <div className="feedback-answer">
                Answer: <strong>{result.correct_answer}</strong>
              </div>
            )}
            {result.explanation && <div className="feedback-explain">{result.explanation}</div>}
          </div>
        </div>
      )}

      {!showFeedback && (
        <div className="match-hint" style={{ marginTop: 10 }}>
          {normalizeAnswer(selectedAnswer) ? 'Answered' : 'Please choose an answer.'}
        </div>
      )}
    </div>
  );
}
