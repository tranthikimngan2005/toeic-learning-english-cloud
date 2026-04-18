import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { userApi } from '../api/client';
import { IMG_VOCAB, IMG_LISTEN, IMG_GRAMMAR, IMG_CHAT } from '../assets/images';
import './Skills.css';

const SKILL_META = {
  reading:   { img:IMG_VOCAB,   color:'#2196b0', desc:'Read texts, news articles, and academic materials' },
  listening: { img:IMG_LISTEN,  color:'#ff8c42', desc:'Understand conversations, lectures, and podcasts' },
  writing:   { img:IMG_GRAMMAR, color:'#9b6ff5', desc:'Write structured paragraphs, emails, and essays' },
  speaking:  { img:IMG_CHAT,    color:'#4ecb8d', desc:'Pronunciation, conversation, and expressing ideas' },
};

export default function Skills() {
  const navigate = useNavigate();
  const [profiles, setProfiles] = useState([]);
  const [loading,  setLoading]  = useState(true);
  useEffect(() => {
    userApi.progress()
      .then(setProfiles)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/></div>;

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1 className="page-title">⭐ Choose a skill</h1>
        <p className="page-sub">Click a skill to start practicing</p>
      </div>
      <div style={{display:'flex',flexDirection:'column',gap:12,marginBottom:24}}>
        {profiles.map(p=>{
          const m   = SKILL_META[p.skill];
          const pct = p.questions_done===0?0:Math.round(p.questions_correct/Math.max(p.questions_done,1)*100);
          return (
            <div key={p.skill} className="skill-full-card card" style={{'--sc':m.color}}
              onClick={()=>navigate(`/practice?skill=${p.skill}`)}>
              <img className="sfc-img" src={m.img} alt={p.skill} />
              <div className="sfc-body">
                <div className="sfc-name">{p.skill.charAt(0).toUpperCase()+p.skill.slice(1)}</div>
                <div className="sfc-desc">{m.desc}</div>
              </div>
              <div className="sfc-right">
                <div className="sfc-level" style={{color:m.color}}>{p.current_level}</div>
                <div className="progress-wrap" style={{width:90,marginTop:6}}>
                  <div className="progress-fill" style={{width:`${pct}%`,background:m.color}} />
                </div>
                <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:4,textAlign:'right'}}>{pct}%</div>
              </div>
              <span className="sfc-arrow">→</span>
            </div>
          );
        })}
      </div>
      <div style={{display:'flex',gap:12}}>
        <button className="btn btn-primary" onClick={()=>navigate('/practice')}>▶ Mixed practice</button>
        <button className="btn btn-yellow"  onClick={()=>navigate('/review')}>🔁 Review today</button>
      </div>
    </div>
  );
}
