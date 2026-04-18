import { useEffect, useState } from 'react';
import { userApi } from '../api/client';
import { IMG_VOCAB } from '../assets/images';
import './Progress.css';

const LEVELS = ['A1','A2','B1','B2','C1','C2'];
const SKILL_META = {
  reading:   { img:IMG_VOCAB,   color:'#2196b0' },
};

function LevelBar({ p }) {
  const m    = SKILL_META[p.skill];
  const lvIdx= LEVELS.indexOf(p.current_level);
  const pct  = p.questions_done===0 ? 0 : Math.min(100, Math.round(p.questions_correct/Math.max(p.questions_done,1)*100));

  return (
    <div className="prog-card card">
      <div className="prog-header">
        <img src={m.img} className="prog-img" alt={p.skill} />
        <div style={{flex:1}}>
          <div className="prog-skill">{p.skill.charAt(0).toUpperCase()+p.skill.slice(1)}</div>
          <div className="prog-sublevel" style={{color:m.color}}>
            {p.current_level}{lvIdx<5?` → ${LEVELS[lvIdx+1]}`:' · MAX!'}
          </div>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontFamily:'var(--font-head)',fontSize:28,color:'var(--navy)',lineHeight:1}}>{pct}%</div>
          <div style={{fontSize:12,color:'var(--text3)',fontWeight:600}}>accuracy</div>
        </div>
      </div>

      {/* CEFR track */}
      <div className="cefr-track">
        <div className="cefr-line" />
        {LEVELS.map((l,i)=>(
          <div key={l} className={`cefr-node ${i<lvIdx?'past':i===lvIdx?'current':'future'}`}
            style={{'--nc':m.color}}>
            <div className="cefr-dot" />
            <div className="cefr-label">{l}</div>
          </div>
        ))}
      </div>

      <div className="prog-stats">
        {[
          {v:p.questions_done,   k:'Questions done'},
          {v:p.questions_correct,k:'Correct',c:m.color},
          {v:Math.max(0,50-p.questions_done),k:'Remaining'},
        ].map(s=>(
          <div key={s.k} className="prog-stat">
            <span className="prog-stat-val" style={s.c?{color:s.c}:{}}>{s.v}</span>
            <span className="prog-stat-key">{s.k}</span>
          </div>
        ))}
      </div>
      <div className="progress-wrap" style={{marginTop:12}}>
        <div className="progress-fill" style={{width:`${Math.min(100,p.questions_done/50*100)}%`, background:m.color}} />
      </div>
      <div style={{display:'flex',justifyContent:'space-between',fontSize:12,color:'var(--text3)',marginTop:5,fontWeight:600}}>
        <span>0 questions</span><span>50 questions · need ≥75% correct</span>
      </div>
    </div>
  );
}

export default function Progress() {
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  useEffect(() => {
    userApi.progress()
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/></div>;
  const readingOnly = profiles.filter((profile) => profile.skill === 'reading');

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1 className="page-title">📈 Reading Progress</h1>
        <p className="page-sub">Theo dõi lộ trình CEFR cho kỹ năng TOEIC Reading.</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        {readingOnly.map(p=><LevelBar key={p.skill} p={p} />)}
      </div>
    </div>
  );
}
