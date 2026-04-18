import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IMG_HERO } from '../assets/images';
import './Auth.css';

const STARS = [
  { top:'8%', left:'10%', delay:'0s' },
  { top:'15%', right:'12%', delay:'0.5s' },
  { top:'70%', left:'6%',  delay:'1s' },
  { top:'80%', right:'8%', delay:'1.5s' },
  { top:'45%', left:'90%', delay:'0.8s' },
];

const DEMO_ACCOUNTS = [
  { label:'Student', email:'an@pengwin.com',      pw:'student123', cls:'badge-green' },
  { label:'Creator', email:'creator@pengwin.com', pw:'creator123', cls:'badge-blue' },
  { label:'Admin',   email:'admin@pengwin.com',   pw:'admin123',   cls:'badge-yellow' },
];

export default function Login() {
  const [form,    setForm]    = useState({ email:'', password:'' });
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const [autoTesting, setAutoTesting] = useState('');
  const { login } = useAuth();
  const toast      = useToast();
  const navigate   = useNavigate();

  const validate = () => {
    const e = {};
    if (!form.email)    e.email    = 'Please enter your email or username';
    if (!form.password) e.password = 'Please enter your password';
    return e;
  };

  const isServerOfflineError = (msg = '') => {
    const text = String(msg).toLowerCase();
    return (
      text.includes('timeout') ||
      text.includes('failed to fetch') ||
      text.includes('networkerror') ||
      text.includes('network error') ||
      text.includes('fetch failed')
    );
  };

  const handleLogin = async (email, password) => {
    setLoading(true);
    try {
      const data = await authApi.login(email, password);
      login(data.access_token, { id:data.user_id, username:data.username, role:data.role });
      toast('Welcome back! 🐧');
      navigate('/dashboard');
    } catch(err) {
      if (isServerOfflineError(err?.message)) {
        toast("Pengwin can't find the server, Ngân ơi!", 'error');
      } else {
        toast(err.message, 'error');
      }
    } finally { setLoading(false); }
  };

  const handleSubmit = async ev => {
    ev.preventDefault();
    const e = validate();
    if (Object.keys(e).length) { setErrors(e); return; }
    await handleLogin(form.email, form.password);
  };

  const handleDemoLogin = async (account) => {
    if (loading) return;
    setForm({ email: account.email, password: account.pw });
    setErrors({});
    setAutoTesting(account.label);
    try {
      await handleLogin(account.email, account.pw);
    } finally {
      setAutoTesting('');
    }
  };

  const set = k => ev => { setForm(f=>({...f,[k]:ev.target.value})); setErrors(e=>({...e,[k]:''})); };

  return (
    <div className="auth-page">
      <div className="auth-cloud auth-cloud-1" />
      <div className="auth-cloud auth-cloud-2" />
      <div className="auth-cloud auth-cloud-3" />
      <div className="auth-stars">
        {STARS.map((s,i) => <span key={i} className="auth-star" style={{top:s.top,left:s.left,right:s.right,animationDelay:s.delay}}>✨</span>)}
      </div>

      <div style={{ position:'relative', zIndex:1 }}>
        <div className="auth-mascot-wrap">
          <img className="auth-mascot" src={IMG_HERO} alt="Pengwin" />
        </div>
        <div className="auth-card">
          <div className="auth-logo">
            <span className="logo-text">Pengwin</span>
          </div>
          <h2 className="auth-title">Welcome back!</h2>
          <p className="auth-sub">Log in to continue your English learning journey 🎓</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email hoặc Username</label>
              <input className={`form-input ${errors.email?'error':''}`}
                type="text" placeholder="you@email.com"
                value={form.email} onChange={set('email')} />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className={`form-input ${errors.password?'error':''}`}
                type="password" placeholder="••••••••"
                value={form.password} onChange={set('password')} />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
              {loading ? <><span className="spinner"/>{autoTesting ? 'Auto-Testing...' : 'Signing in...'}</> : '🐧 Log in'}
            </button>
          </form>

          <div className="auth-demo">
            <div className="auth-demo-title">🎮 Demo accounts</div>
            <div className="demo-accounts">
              {DEMO_ACCOUNTS.map(a => (
                <button key={a.label} type="button" className="demo-btn"
                  onClick={() => handleDemoLogin(a)} disabled={loading}>
                  <span className={`badge ${a.cls}`}>{a.label}</span>
                  <span>{a.email}</span>
                  {autoTesting===a.label && <span style={{marginLeft:'auto',display:'inline-flex',alignItems:'center',gap:6}}><span className="spinner" style={{width:14,height:14,borderWidth:2}}/>Loading</span>}
                </button>
              ))}
            </div>
          </div>

          <p className="auth-switch">
            Don&apos;t have an account? <Link to="/register">Sign up now →</Link>
          </p>
        </div>
      </div>
    </div>
  );
}

