import { useEffect, useRef, useState } from 'react';
import { userApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IMG_STREAK, IMG_PROGRESS } from '../assets/images';
import './Profile.css';

export default function Profile() {
  const { user, setAvatar, clearAvatar } = useAuth();
  const toast = useToast();
  const fileRef = useRef(null);
  const [dash,    setDash]    = useState(null);
  const [loading, setLoading] = useState(true);

  const onPickAvatar = () => fileRef.current?.click();

  const onAvatarFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast('Please choose an image file', 'error');
      e.target.value = '';
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast('Avatar must be smaller than 2MB', 'error');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setAvatar(reader.result);
      toast('Avatar updated!');
      e.target.value = '';
    };
    reader.onerror = () => {
      toast('Cannot read this file', 'error');
      e.target.value = '';
    };
    reader.readAsDataURL(file);
  };
  useEffect(() => {
    userApi.dashboard()
      .then(setDash)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/></div>;
  const streak   = dash?.streak;

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1 className="page-title">🐧 Profile</h1>
      </div>
      <div className="profile-hero card">
        <div className="profile-avatar-block">
          <div className="profile-avatar-lg">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" />
            ) : (
              user?.username?.[0]?.toUpperCase()
            )}
          </div>
          <div className="profile-avatar-actions">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={onAvatarFileChange}
              style={{ display: 'none' }}
            />
            <button className="btn btn-secondary btn-sm" onClick={onPickAvatar}>Change avatar</button>
            {user?.avatar && (
              <button className="btn btn-ghost btn-sm" onClick={() => { clearAvatar(); toast('Avatar removed'); }}>
                Remove
              </button>
            )}
          </div>
        </div>
        <div className="profile-info">
          <h2 className="profile-name">{user?.username}</h2>
          <p className="profile-email">{user?.email||'—'}</p>
          <div style={{display:'flex',gap:8,marginTop:8}}>
            <span className={`badge badge-${user?.role==='admin'?'yellow':user?.role==='creator'?'blue':'green'}`}>{user?.role}</span>
          </div>
        </div>
        <div className="profile-streak">
          <img src={IMG_STREAK} alt="streak" className="profile-streak-img" />
          <div>
            <div style={{fontFamily:'var(--font-head)',fontSize:32,color:'#ff6b35',lineHeight:1}}>{streak?.current_streak??0}</div>
            <div style={{fontSize:11,fontWeight:800,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em'}}>Current streak</div>
            {streak?.longest_streak>0 && <div style={{fontSize:11,color:'var(--text3)',fontWeight:600,marginTop:4}}>Best: {streak.longest_streak}d</div>}
          </div>
        </div>
      </div>

      <div className="grid-3" style={{marginBottom:24}}>
        <div className="stat-card">
          <img className="stat-card-img" src={IMG_PROGRESS} alt="" style={{animation:'float 3s ease-in-out infinite'}} />
          <div><div className="stat-label">Total questions done</div><div className="stat-value">{dash?.total_questions_done??0}</div></div>
        </div>
        <div className="stat-card">
          <img className="stat-card-img" src={IMG_PROGRESS} alt="" style={{animation:'float 3.3s ease-in-out infinite'}} />
          <div><div className="stat-label">Review cards today</div><div className="stat-value warning">{dash?.due_reviews??0}</div></div>
        </div>
        <div className="stat-card">
          <img className="stat-card-img" src={IMG_STREAK} alt="" style={{animation:'float 2.8s ease-in-out infinite'}} />
          <div><div className="stat-label">Longest streak</div><div className="stat-value accent">{streak?.longest_streak??0}</div></div>
        </div>
      </div>

    </div>
  );
}
