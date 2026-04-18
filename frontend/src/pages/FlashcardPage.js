import { useEffect, useState } from 'react';
import { Briefcase, Coffee, Cpu, MapPin, TrendingUp } from 'lucide-react';
import { flashcardApi, reviewApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { IMG_VOCAB } from '../assets/images';
import MatchingGame from '../components/MatchingGame';
import './FlashcardPage.css';

const GRADES = [
  { key: 'again', label: 'Again', sub: '1d', tone: 'grade-again' },
  { key: 'hard', label: 'Hard', sub: '3d', tone: 'grade-hard' },
  { key: 'good', label: 'Good', sub: '7d', tone: 'grade-good' },
  { key: 'easy', label: 'Easy', sub: '14d', tone: 'grade-easy' },
];

const MODE_LABELS = { study: 'Study', match: 'Matching' };

const TOPICS = [
  {
    key: 'office',
    title: 'Office',
    subtitle: 'Môi trường công sở',
    icon: Briefcase,
    iconTone: 'tone-blue',
    keywords: ['office', 'workplace', 'meeting', 'email', 'company'],
  },
  {
    key: 'business',
    title: 'Business',
    subtitle: 'Kinh doanh và thương mại',
    icon: TrendingUp,
    iconTone: 'tone-mint',
    keywords: ['business', 'finance', 'market', 'sales', 'contract'],
  },
  {
    key: 'travel',
    title: 'Travel',
    subtitle: 'Du lịch và di chuyển',
    icon: MapPin,
    iconTone: 'tone-coral',
    keywords: ['travel', 'airport', 'hotel', 'trip', 'ticket'],
  },
  {
    key: 'technology',
    title: 'Technology',
    subtitle: 'Công nghệ và kỹ thuật số',
    icon: Cpu,
    iconTone: 'tone-lilac',
    keywords: ['technology', 'tech', 'software', 'digital', 'computer'],
  },
  {
    key: 'daily-life',
    title: 'Daily Life',
    subtitle: 'Tình huống hằng ngày',
    icon: Coffee,
    iconTone: 'tone-amber',
    keywords: ['daily', 'life', 'family', 'shopping', 'home'],
  },
];

function formatDueDate(value) {
  if (!value) return 'Review now';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Review now';
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: 'short' });
}

function playPronunciation(word) {
  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  const utterance = new SpeechSynthesisUtterance(word);
  utterance.lang = 'en-US';
  utterance.rate = 0.92;
  utterance.pitch = 1.05;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utterance);
}

function parseExample(card) {
  return {
    en: card?.example_en || '',
    vi: card?.example_vi || '',
  };
}

function usageNote(card) {
  const category = card?.category ? card.category : 'tổng quát';
  const difficulty = card?.difficulty ? card.difficulty : 'cốt lõi';
  return `Thuộc chủ đề ${category}, mức độ ${difficulty}.`; 
}

function topicMatchesCard(topic, card) {
  const keywordText = [
    card?.category,
    card?.word,
    card?.meaning_vi,
    card?.example_en,
    card?.example_vi,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  return topic.keywords.some((keyword) => keywordText.includes(String(keyword).toLowerCase()));
}

function shuffle(items) {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function sameQuestionSet(first, second) {
  if (!Array.isArray(first) || !Array.isArray(second)) return false;
  if (first.length !== second.length) return false;
  const a = first.map((card) => card.question_id).sort((x, y) => x - y);
  const b = second.map((card) => card.question_id).sort((x, y) => x - y);
  return a.every((value, index) => value === b[index]);
}

function pickDifferentLocalSet(pool, previousSet, targetSize = 8) {
  const previousIds = new Set((previousSet || []).map((card) => card.question_id));
  const preferred = shuffle(pool.filter((card) => !previousIds.has(card.question_id))).slice(0, targetSize);
  if (preferred.length >= Math.min(targetSize, pool.length)) return preferred;
  return shuffle(pool).slice(0, targetSize);
}

export default function FlashcardPage() {
  const toast = useToast();
  const [mode, setMode] = useState('study');
  const [allCards, setAllCards] = useState([]);
  const [selectedTopicKey, setSelectedTopicKey] = useState('');
  const [studyDeck, setStudyDeck] = useState([]);
  const [studyTotal, setStudyTotal] = useState(0);
  const [matchCards, setMatchCards] = useState([]);
  const [matchResetCounter, setMatchResetCounter] = useState(0);
  const [loading, setLoading] = useState(true);
  const [flipped, setFlipped] = useState(false);
  const [grading, setGrading] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadFlashcards() {
      setLoading(true);
      try {
        if (mode === 'study') {
          const data = await flashcardApi.list();
          if (cancelled) return;
          setAllCards(Array.isArray(data) ? data : []);
          setSelectedTopicKey('');
          setStudyDeck([]);
          setStudyTotal(0);
          setFlipped(false);
        } else {
          const data = await flashcardApi.list({ limit: 8, shuffle: true });
          if (cancelled) return;
          const fetched = Array.isArray(data) ? data : [];
          setMatchCards(fetched);
          setMatchResetCounter((value) => value + 1);
        }
      } catch (error) {
        if (!cancelled) toast(error.message, 'error');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadFlashcards();
    return () => { cancelled = true; };
  }, [mode, toast]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;
    // Prevent previous-round utterances from carrying over when card/round changes.
    window.speechSynthesis.cancel();
  }, [studyDeck[0]?.word, mode, matchResetCounter]);

  const currentCard = studyDeck[0];
  const examples = parseExample(currentCard);

  const selectedTopic = TOPICS.find((topic) => topic.key === selectedTopicKey);
  const studyMastered = allCards.filter((card) => Number(card.repetitions || 0) >= 3).length;

  const startTopicSession = (topic) => {
    const topicCards = allCards.filter((card) => topicMatchesCard(topic, card));
    if (!topicCards.length) {
      toast('Chưa có thẻ cho chủ đề này. Vui lòng chọn chủ đề khác.', 'error');
      return;
    }

    setSelectedTopicKey(topic.key);
    setStudyDeck(shuffle(topicCards));
    setStudyTotal(topicCards.length);
    setFlipped(false);
  };

  const backToTopics = () => {
    setSelectedTopicKey('');
    setStudyDeck([]);
    setStudyTotal(0);
    setFlipped(false);
  };

  const submitGrade = async (result) => {
    if (!currentCard || grading) return;
    setGrading(true);
    try {
      await reviewApi.submit(currentCard.card_id, result);
      setStudyDeck((previousDeck) => previousDeck.slice(1));
      setFlipped(false);
    } catch (error) {
      toast(error.message, 'error');
    } finally {
      setGrading(false);
    }
  };

  const handleReplayMatch = async () => {
    const previousRound = matchCards;

    // Clear matched/selected UI instantly by remounting and clearing current cards.
    setMatchResetCounter((value) => value + 1);
    setMatchCards([]);
    setLoading(true);

    try {
      let fetched = [];
      const primary = await flashcardApi.list({ limit: 8, shuffle: true });
      fetched = Array.isArray(primary) ? primary : [];

      if (fetched.length > 0 && sameQuestionSet(fetched, previousRound)) {
        const pool = await flashcardApi.list({ shuffle: true, limit: 24 });
        const localPool = Array.isArray(pool) ? pool : [];
        fetched = pickDifferentLocalSet(localPool, previousRound, 8);
      }

      setMatchCards(fetched);
    } catch (error) {
      toast(error.message, 'error');
      // Fallback: at least reshuffle local data to avoid same visual round.
      setMatchCards(pickDifferentLocalSet(previousRound, previousRound, 8));
    } finally {
      setLoading(false);
    }
  };

  const renderTopicSelection = () => (
    <div className="flashcard-study-wrap">
      <div className="flashcard-header card card-soft study-header">
        <div>
          <div className="eyebrow">Study</div>
          <h2 className="page-title">Topic Selection</h2>
          <p className="page-sub">Chọn chủ đề để bắt đầu phiên học flashcard theo đúng ngữ cảnh.</p>
        </div>
        <div className="flashcard-stats">
          <span className="badge badge-blue">Tổng thẻ {allCards.length}</span>
          <span className="badge badge-purple">Đã thuộc {studyMastered}</span>
        </div>
      </div>

      <div className="topic-grid">
        {TOPICS.map((topic) => {
          const Icon = topic.icon;
          const topicCount = allCards.filter((card) => topicMatchesCard(topic, card)).length;
          return (
            <article key={topic.key} className="card topic-card">
              <div className={`topic-icon-wrap ${topic.iconTone}`}>
                <Icon className="topic-icon" size={26} strokeWidth={2.1} />
              </div>
              <h3>{topic.title}</h3>
              <p>{topic.subtitle}</p>
              <div className="topic-card-footer">
                <span className="badge badge-gray">{topicCount} thẻ</span>
                <button className="btn btn-primary" onClick={() => startTopicSession(topic)} disabled={!topicCount}>
                  Start
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );

  const renderStudy = () => {
    if (!selectedTopicKey) {
      return renderTopicSelection();
    }

    if (!studyDeck.length) {
      return (
        <div className="card flashcard-empty card-soft">
          <img src={IMG_VOCAB} alt="flashcards" className="flashcard-empty-illustration" />
          <h2>Hoàn thành chủ đề {selectedTopic?.title || ''}</h2>
          <p>Bạn đã ôn xong bộ thẻ của chủ đề này. Hãy chọn chủ đề khác để tiếp tục.</p>
          <button className="btn btn-primary" onClick={backToTopics}>Back to topics</button>
        </div>
      );
    }

    return (
      <div className="flashcard-study-wrap">
        <div className="flashcard-header card card-soft study-header">
          <div>
            <div className="eyebrow">Study Session</div>
            <h2 className="page-title">Topic: {selectedTopic?.title || 'General'}</h2>
            <p className="page-sub">Chạm vào thẻ để lật 3D mượt và ghi nhớ theo lịch SRS.</p>
          </div>
          <div className="flashcard-stats">
            <span className="badge badge-blue">{studyTotal - studyDeck.length + 1} / {studyTotal}</span>
            <span className="badge badge-purple">Mastered {studyMastered}</span>
            <span className="badge badge-green">{currentCard?.category || 'Tổng quát'}</span>
          </div>
        </div>

        <div className="study-session-toolbar">
          <button className="btn btn-secondary" onClick={backToTopics}>Back to topics</button>
        </div>

        <div className="flashcard-board">
          <div className="flashcard-scene" onClick={() => setFlipped((value) => !value)}>
            <div className={`flashcard-card-3d ${flipped ? 'is-flipped' : ''}`}>
              <div className="flashcard-side flashcard-front card card-hero">
                <div className="flashcard-word">{currentCard?.word}</div>
                <div className="flashcard-ipa">{currentCard?.ipa || '/wɜːd/'}</div>
                <button
                  className="flashcard-speaker"
                  onClick={(event) => {
                    event.stopPropagation();
                    // Always pronounce the current front-side word.
                    playPronunciation(currentCard?.word || '');
                  }}
                >
                  Play Audio
                </button>
                <div className="flashcard-hint">Nhấn để lật thẻ</div>
              </div>

              <div className="flashcard-side flashcard-back card card-hero">
                <div className="flashcard-label">Nghĩa tiếng Việt</div>
                <div className="flashcard-meaning">{currentCard?.meaning_vi}</div>
                <div className="flashcard-meta-line">Ghi chú sử dụng: {usageNote(currentCard)}</div>
                <div className="flashcard-meta-line">Lần ôn tiếp theo: {formatDueDate(currentCard?.due_date)}</div>
                <div className="flashcard-example-block">
                  <strong>Example:</strong>
                  <p>{examples.en}</p>
                  {examples.vi ? <p className="example-vi">{examples.vi}</p> : null}
                </div>
              </div>
            </div>
          </div>

          <div className="flashcard-actions">
            {GRADES.map((grade) => (
              <button
                key={grade.key}
                className={`btn ${grade.tone}`}
                onClick={() => submitGrade(grade.key)}
                disabled={!flipped || grading}
              >
                {grading ? 'Saving...' : `${grade.label} • ${grade.sub}`}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fade-up flashcard-page">
      <div className="flashcard-topbar card card-soft">
        <div>
          <div className="eyebrow">Pengwin Vocabulary Lab</div>
          <h1 className="page-title">Flashcards</h1>
          <p className="page-sub">Professional one-card study mode with optional matching game.</p>
        </div>
        <img src={IMG_VOCAB} alt="Pengwin Vocabulary" className="flashcard-top-mascot" />
        <div className="flashcard-mode-switch">
          <button className={`mode-pill ${mode === 'study' ? 'active' : ''}`} onClick={() => setMode('study')}>{MODE_LABELS.study}</button>
          <button className={`mode-pill ${mode === 'match' ? 'active' : ''}`} onClick={() => setMode('match')}>{MODE_LABELS.match}</button>
        </div>
      </div>

      {loading ? (
        <div className="loading-page"><div className="spinner spinner-lg"/></div>
      ) : mode === 'study' ? renderStudy() : (
        <MatchingGame
          key={`match-round-${matchResetCounter}`}
          cards={matchCards}
          onBackToStudy={() => setMode('study')}
          onReplay={handleReplayMatch}
        />
      )}
    </div>
  );
}