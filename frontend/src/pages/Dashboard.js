import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { questionApi, userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { IMG_HERO } from '../assets/images';
import './Dashboard.css';

const TOEIC_READING_SECTIONS = {
  5: {
    title: 'Sentence Completion',
    subtitle: 'Grammar and vocabulary precision in single-sentence context.',
    target: 20,
    cta: 'Master 20 Sentence Completion questions today',
    badge: 'Part 5',
  },
  6: {
    title: 'Text Completion',
    subtitle: 'Cohesion, transitions, and sentence insertion in mini-passages.',
    target: 8,
    cta: 'Complete 2 Text Completion passages today',
    badge: 'Part 6',
  },
  7: {
    title: 'Reading Comprehension',
    subtitle: 'Skim-scan strategy, inference, and detail extraction in long texts.',
    target: 10,
    cta: 'Solve 2 Reading Comprehension passages today',
    badge: 'Part 7',
  },
};

function getReadingPartProgress() {
  const raw = JSON.parse(localStorage.getItem('pengwin_reading_part_progress') || '{}');
  return [5, 6, 7].map((part) => {
    const key = `part${part}`;
    const done = Number(raw?.[key]?.done || 0);
    const correct = Number(raw?.[key]?.correct || 0);
    const pct = done === 0 ? 0 : Math.round((correct / done) * 100);
    return { part, done, correct, pct };
  });
}

function ToeicSectionCard({ partProgress, sectionMeta, onClick }) {
  const pct = partProgress.done === 0 ? 0 : partProgress.pct;
  return (
    <div className="toeic-card" onClick={onClick}>
      <div className="toeic-card-top">
        <span className="badge badge-blue">{sectionMeta.badge}</span>
        <span className="badge badge-gray">{partProgress.done}/{sectionMeta.target}</span>
      </div>
      <h3 className="toeic-card-title">{sectionMeta.title}</h3>
      <p className="toeic-card-subtitle">{sectionMeta.subtitle}</p>
      <div className="progress-wrap" style={{ marginTop: 12 }}>
        <div className="progress-fill" style={{ width: `${pct}%` }} />
      </div>
      <div className="toeic-card-metrics">
        <span>{partProgress.done} attempts</span>
        <span>{partProgress.correct} correct</span>
        <span>{pct}% accuracy</span>
      </div>
      <p className="toeic-card-cta">{sectionMeta.cta}</p>
    </div>
  );
}

export default function Dashboard() {
  const { user }  = useAuth();
  const location = useLocation();
  const navigate  = useNavigate();
  const [data, setData]     = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncStamp, setSyncStamp] = useState(() => {
    const practiceStamp = Number(localStorage.getItem('pengwin_last_practice_completed_at') || 0);
    const reviewStamp = Number(localStorage.getItem('pengwin_last_review_completed_at') || 0);
    return String(Math.max(practiceStamp, reviewStamp));
  });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      userApi.dashboard(),
      questionApi.recommendations().catch(() => []),
    ])
      .then(([dashboard, recs]) => {
        setData(dashboard);
        setRecommendations(Array.isArray(recs) ? recs : []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [syncStamp]);

  useEffect(() => {
    const syncFromStorage = () => {
      const practiceStamp = Number(localStorage.getItem('pengwin_last_practice_completed_at') || 0);
      const reviewStamp = Number(localStorage.getItem('pengwin_last_review_completed_at') || 0);
      setSyncStamp(String(Math.max(practiceStamp, reviewStamp)));
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('focus', syncFromStorage);
    window.addEventListener('pageshow', syncFromStorage);
    window.addEventListener('popstate', syncFromStorage);
    window.addEventListener('pengwin:practice-finished', syncFromStorage);
    window.addEventListener('pengwin:review-finished', syncFromStorage);

    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('focus', syncFromStorage);
      window.removeEventListener('pageshow', syncFromStorage);
      window.removeEventListener('popstate', syncFromStorage);
      window.removeEventListener('pengwin:practice-finished', syncFromStorage);
      window.removeEventListener('pengwin:review-finished', syncFromStorage);
    };
  }, []);

  useEffect(() => {
    if (location.pathname !== '/dashboard') return;
    const practiceStamp = Number(localStorage.getItem('pengwin_last_practice_completed_at') || 0);
    const reviewStamp = Number(localStorage.getItem('pengwin_last_review_completed_at') || 0);
    setSyncStamp(String(Math.max(practiceStamp, reviewStamp, Date.now())));
  }, [location.pathname, location.key]);

  const hour = new Date().getHours();
  const greet = hour<12 ? 'Good morning' : hour<18 ? 'Good afternoon' : 'Good evening';

  const readingPartProgress = getReadingPartProgress();
  const part5 = readingPartProgress.find((item) => item.part === 5) || { done: 0, correct: 0, pct: 0 };
  const part6 = readingPartProgress.find((item) => item.part === 6) || { done: 0, correct: 0, pct: 0 };
  const part7 = readingPartProgress.find((item) => item.part === 7) || { done: 0, correct: 0, pct: 0 };
  const recPart5Count = recommendations.filter((item) => Number(item?.question?.part) === 5).length;
  const recPart6Count = recommendations.filter((item) => Number(item?.question?.part) === 6).length;
  const recPart7Count = recommendations.filter((item) => Number(item?.question?.part) === 7).length;
  const hasPart5Recommendation = recPart5Count > 0;
  const flashcardDue = Number(data?.due_reviews ?? 0);

  const tasks = [
    {
      done: part5.done >= TOEIC_READING_SECTIONS[5].target,
      label: hasPart5Recommendation
        ? 'Gợi ý lộ trình: Bạn cần tập trung ôn tập Part 5 để cải thiện ngữ pháp.'
        : TOEIC_READING_SECTIONS[5].cta,
      progress: `${part5.done}/${TOEIC_READING_SECTIONS[5].target}`,
      note: `${recPart5Count} mục gợi ý`,
      isRecommendation: hasPart5Recommendation,
    },
    {
      done: part6.done >= TOEIC_READING_SECTIONS[6].target,
      label: TOEIC_READING_SECTIONS[6].cta,
      progress: `${part6.done}/${TOEIC_READING_SECTIONS[6].target}`,
      note: `${recPart6Count} mục gợi ý`,
    },
    {
      done: part7.done >= TOEIC_READING_SECTIONS[7].target,
      label: TOEIC_READING_SECTIONS[7].cta,
      progress: `${part7.done}/${TOEIC_READING_SECTIONS[7].target}`,
      note: `${recPart7Count} mục gợi ý`,
    },
    {
      done: flashcardDue === 0,
      label: flashcardDue > 20
        ? 'Review 20 priority flashcards'
        : `Review all ${flashcardDue} due flashcards today`,
      progress: `${flashcardDue} pending`,
      isFlashcardAlert: flashcardDue > 20,
      note: flashcardDue > 20 ? 'Ưu tiên ôn theo chu kỳ Spaced Repetition' : null,
    },
  ];
  const pendingTasks = tasks.filter((task) => !task.done);
  const showRecommendationBox = recommendations.length > 0;
  const recommendationAdvice = recommendations.slice(0, 3).map((item, idx) => {
    const question = item?.question;
    const tag = String(question?.tags || '').trim();
    const part = Number(question?.part || 0);
    const label = tag || (part ? `Part ${part}` : 'Reading');
    return `${idx + 1}. ${label}`;
  });

  if (loading) return (
    <div className="loading-page">
      <img className="penguin-cutout" src={IMG_HERO} style={{width:80,animation:'float 3s ease-in-out infinite'}} alt="" />
      <span>Loading...</span>
    </div>
  );

  return (
    <div className="fade-up">
      {/* Hero banner */}
      <div className="hero-banner">
        <img className="hero-mascot" src={IMG_HERO} alt="Pengwin" />
        <div className="hero-body">
          <div className="hero-greeting">{greet}, <span>{user?.username}</span>! 👋</div>
          <div className="hero-sub">
            {data?.streak?.current_streak > 0
              ? `🔥 Streak ${data.streak.current_streak} days — great work!`
              : 'Start your first lesson today!'}
          </div>
          <div className="hero-stats">
            {[
              { n:data?.streak?.current_streak??0, l:'Streak' },
              { n:data?.total_questions_done??0,   l:'Questions done' },
              { n:data?.due_reviews??0,            l:'Review cards' },
            ].map(s=>(
              <div key={s.l} className="hero-stat">
                <div className="hero-stat-num">{s.n}</div>
                <div className="hero-stat-label">{s.l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="section-title">Academic TOEIC Reading Sections</div>
      <div className="toeic-grid" style={{ marginBottom: 26 }}>
        <ToeicSectionCard
          partProgress={part5}
          sectionMeta={TOEIC_READING_SECTIONS[5]}
          onClick={() => navigate('/practice?part=5')}
        />
        <ToeicSectionCard
          partProgress={part6}
          sectionMeta={TOEIC_READING_SECTIONS[6]}
          onClick={() => navigate('/practice?part=6')}
        />
        <ToeicSectionCard
          partProgress={part7}
          sectionMeta={TOEIC_READING_SECTIONS[7]}
          onClick={() => navigate('/practice?part=7')}
        />
      </div>

      <div className="section-title">Today&apos;s Academic Tasks</div>
      {showRecommendationBox ? (
        <div className="dashboard-recommend-box" role="status">
          <div className="dashboard-recommend-head">
            <span className="badge badge-orange">Recommendation</span>
            <span className="dashboard-recommend-count">{recommendations.length} mục cần ôn</span>
          </div>
          <p className="dashboard-recommend-text">
            Độ chính xác gần đây đang thấp ở một số điểm ngữ pháp. Hãy ưu tiên ôn tập các mục sau:
          </p>
          <div className="dashboard-recommend-tags">{recommendationAdvice.join(' • ')}</div>
        </div>
      ) : null}
      <div className="tasks-card">
        {pendingTasks.length === 0 ? (
          <div className="task-item">
            <div className="task-check done">✓</div>
            <span className="task-label">All priority tasks are completed for today.</span>
          </div>
        ) : pendingTasks.map((t, i) => (
          <div key={i} className={`task-item ${t.isFlashcardAlert ? 'task-item-alert' : ''} ${t.isRecommendation ? 'task-item-recommend' : ''}`}>
            <div className={`task-check ${t.done?'done':'todo'}`}>{t.done?'✓':'○'}</div>
            <span className="task-label">{t.label}</span>
            {t.note ? <span className="task-note">{t.note}</span> : null}
            <span className={`badge ${t.done ? 'badge-green' : 'badge-orange'} task-badge-right`}>{t.progress}</span>
          </div>
        ))}
      </div>

      <div className="dashboard-actions">
        <button className="btn btn-primary" onClick={() => navigate('/practice')}>
          Continue TOEIC Reading Practice
        </button>
        <button className="btn btn-secondary" onClick={() => navigate('/flashcards')}>
          Open Flashcard Lab
        </button>
      </div>
    </div>
  );
}
