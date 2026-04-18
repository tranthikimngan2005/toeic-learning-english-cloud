import { useEffect, useMemo, useState } from 'react';
import { IMG_HERO } from '../assets/images';

function shuffle(items) {
  const next = [...items];
  for (let index = next.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [next[index], next[swapIndex]] = [next[swapIndex], next[index]];
  }
  return next;
}

function formatTimer(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export default function MatchingGame({ cards, onBackToStudy, onReplay }) {
  const [gameId, setGameId] = useState(0);
  const [selectedTiles, setSelectedTiles] = useState([]);
  const [matchedPairIds, setMatchedPairIds] = useState([]);
  const [clearingTileIds, setClearingTileIds] = useState([]);
  const [failedTileIds, setFailedTileIds] = useState([]);
  const [score, setScore] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [roundSeed, setRoundSeed] = useState(0);

  useEffect(() => {
    setSelectedTiles([]);
    setMatchedPairIds([]);
    setClearingTileIds([]);
    setFailedTileIds([]);
    setScore(0);
    setElapsed(0);
    setRoundSeed((value) => value + 1);
  }, [cards, gameId]);

  const done = cards.length > 0 && matchedPairIds.length === cards.length;

  useEffect(() => {
    if (!cards.length || done) return undefined;
    const timer = setInterval(() => {
      setElapsed((value) => value + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [cards.length, done]);

  const wordTiles = useMemo(() => {
    const source = cards.map((card) => ({
      id: `${card.question_id}-word`,
      pairId: card.question_id,
      kind: 'word',
      label: card.word,
      hint: card.ipa || card.category || 'Flashcard',
    }));
    return shuffle(source);
  }, [cards, roundSeed]);

  const meaningTiles = useMemo(() => {
    const source = cards.map((card) => ({
      id: `${card.question_id}-meaning`,
      pairId: card.question_id,
      kind: 'meaning',
      label: card.meaning_vi,
      hint: card.difficulty || 'SRS',
    }));
    return shuffle(source);
  }, [cards, roundSeed]);

  const allTiles = useMemo(() => [...wordTiles, ...meaningTiles], [wordTiles, meaningTiles]);

  const handlePlayAgain = async () => {
    setGameId((value) => value + 1);
    setSelectedTiles([]);
    setMatchedPairIds([]);
    setClearingTileIds([]);
    setFailedTileIds([]);
    setScore(0);
    setElapsed(0);
    if (onReplay) {
      await onReplay();
    }
  };

  const handleTileSelect = (tile) => {
    if (done) return;
    if (matchedPairIds.includes(tile.pairId)) return;
    if (clearingTileIds.includes(tile.id)) return;
    if (failedTileIds.includes(tile.id)) return;
    if (selectedTiles.some((selected) => selected.id === tile.id)) return;

    if (selectedTiles.length === 0) {
      setSelectedTiles([tile]);
      return;
    }

    const [first] = selectedTiles;
    const second = tile;
    const pair = [first, second];
    setSelectedTiles(pair);

    const isMatch = first.pairId === second.pairId && first.kind !== second.kind;
    if (isMatch) {
      const ids = pair.map((item) => item.id);
      setClearingTileIds(ids);
      setScore((value) => value + 1);
      setTimeout(() => {
        setMatchedPairIds((value) => [...value, first.pairId]);
        setSelectedTiles([]);
        setClearingTileIds([]);
      }, 280);
      return;
    }

    const failedIds = pair.map((item) => item.id);
    setFailedTileIds(failedIds);
    setTimeout(() => {
      setFailedTileIds([]);
      setSelectedTiles([]);
    }, 460);
  };

  return (
    <>
      <div className="flashcard-header card card-soft match-header-clean">
        <div>
          <div className="eyebrow">Matching</div>
          <h2 className="page-title">TOEIC Vocabulary Pairing</h2>
          <p className="page-sub">Match English words with Vietnamese meanings.</p>
        </div>
        <div className="flashcard-stats">
          <span className="badge badge-blue">Score {score}</span>
          <span className="badge badge-purple">Timer {formatTimer(elapsed)}</span>
        </div>
      </div>

      <div className="flashcard-match-toolbar">
        <div className="match-intro">Word cards are blue, meaning cards are orange.</div>
        <button className="btn btn-primary" onClick={onBackToStudy}>Back to study</button>
      </div>

      {done ? (
        <div className="card match-complete match-victory">
          <div className="confetti" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, index) => (
              <span key={index} className={`confetti-dot dot-${index % 7}`} />
            ))}
          </div>
          <img src={IMG_HERO} alt="Penguin celebration" className="match-victory-mascot" />
          <h3>Excellent!</h3>
          <p>All pairs cleared in {formatTimer(elapsed)}. Bạn làm rất tốt!</p>
          <button className="btn btn-primary" onClick={handlePlayAgain}>Play again</button>
        </div>
      ) : (
        <div className="match-board">
          <div className="match-lane">
            <div className="match-lane-title">Words</div>
            <div className="match-lane-grid">
              {wordTiles.map((tile) => {
                const isSelected = selectedTiles.some((selected) => selected.id === tile.id);
                const isFailed = failedTileIds.includes(tile.id);
                const isClearing = clearingTileIds.includes(tile.id);
                const isMatched = matchedPairIds.includes(tile.pairId);
                return (
                  <button
                    key={tile.id}
                    className={`match-tile word-tile ${isSelected ? 'selected' : ''} ${isFailed ? 'fail' : ''} ${isClearing ? 'matched-pop' : ''} ${isMatched ? 'matched' : ''}`}
                    onClick={() => handleTileSelect(tile)}
                    disabled={isMatched}
                  >
                    <span className="match-kind">Word</span>
                    <span className="match-label">{tile.label}</span>
                    <span className="match-hint">{tile.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="match-lane">
            <div className="match-lane-title">Meanings</div>
            <div className="match-lane-grid">
              {meaningTiles.map((tile) => {
                const isSelected = selectedTiles.some((selected) => selected.id === tile.id);
                const isFailed = failedTileIds.includes(tile.id);
                const isClearing = clearingTileIds.includes(tile.id);
                const isMatched = matchedPairIds.includes(tile.pairId);
                return (
                  <button
                    key={tile.id}
                    className={`match-tile meaning-tile ${isSelected ? 'selected' : ''} ${isFailed ? 'fail' : ''} ${isClearing ? 'matched-pop' : ''} ${isMatched ? 'matched' : ''}`}
                    onClick={() => handleTileSelect(tile)}
                    disabled={isMatched}
                  >
                    <span className="match-kind">Meaning</span>
                    <span className="match-label">{tile.label}</span>
                    <span className="match-hint">{tile.hint}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {!done && allTiles.length === 0 ? (
        <div className="card match-complete">
          <h3>No cards available</h3>
          <p>Please seed more flashcards and try matching again.</p>
        </div>
      ) : null}
    </>
  );
}
