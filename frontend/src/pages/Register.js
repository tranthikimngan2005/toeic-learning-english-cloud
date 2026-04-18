import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { authApi } from '../api/client';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { IMG_PROGRESS } from '../assets/images';
import './Auth.css';

export default function Register() {
  const [form,    setForm]    = useState({username:'',email:'',password:'',confirm:''});
  const [errors,  setErrors]  = useState({});
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const toast      = useToast();
  const navigate   = useNavigate();

  const validate = () => {
    const e = {};
    if(!form.username||form.username.length<3) e.username='Username must be at least 3 characters';
    if(!form.email||!form.email.includes('@')) e.email='Invalid email address';
    if(!form.password||form.password.length<6) e.password='Password must be at least 6 characters';
    if(form.password!==form.confirm)           e.confirm='Passwords do not match';
    return e;
  };

  const handleSubmit = async ev => {
    ev.preventDefault();
    const e = validate();
    if(Object.keys(e).length){setErrors(e);return;}
    setLoading(true);
    try {
      const data = await authApi.register({username:form.username,email:form.email,password:form.password});
      login(data.access_token,{id:data.user_id,username:data.username,role:data.role});
      toast('Account created successfully! Welcome 🎉');
      navigate('/dashboard');
    } catch(err){ toast(err.message,'error'); }
    finally { setLoading(false); }
  };

  const set = k => e => { setForm(f=>({...f,[k]:e.target.value})); setErrors(er=>({...er,[k]:''})); };

  return (
    <div className="auth-page">
      <div className="auth-cloud auth-cloud-1" />
      <div className="auth-cloud auth-cloud-2" />

      <div style={{position:'relative',zIndex:1}}>
        <div className="auth-mascot-wrap">
          <img className="auth-mascot" src={IMG_PROGRESS} alt="Pengwin" />
        </div>
        <div className="auth-card">
          <div className="auth-logo">
            <span className="logo-text">Pen<span>win</span></span>
          </div>
          <h2 className="auth-title">Create a new account</h2>
          <p className="auth-sub">Start your English learning journey with Pengwin! 🚀</p>

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Username</label>
              <input className={`form-input ${errors.username?'error':''}`}
                type="text" placeholder="your_username"
                value={form.username} onChange={set('username')} />
              {errors.username && <span className="form-error">{errors.username}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className={`form-input ${errors.email?'error':''}`}
                type="email" placeholder="you@email.com"
                value={form.email} onChange={set('email')} />
              {errors.email && <span className="form-error">{errors.email}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className={`form-input ${errors.password?'error':''}`}
                type="password" placeholder="Tối thiểu 6 ký tự"
                value={form.password} onChange={set('password')} />
              {errors.password && <span className="form-error">{errors.password}</span>}
            </div>
            <div className="form-group">
              <label className="form-label">Confirm Password</label>
              <input className={`form-input ${errors.confirm?'error':''}`}
                type="password" placeholder="Re-enter password"
                value={form.confirm} onChange={set('confirm')} />
              {errors.confirm && <span className="form-error">{errors.confirm}</span>}
            </div>
            <button type="submit" className="btn btn-primary btn-lg" style={{width:'100%'}} disabled={loading}>
              {loading ? <><span className="spinner"/>Creating...</> : '🎓 Create account'}
            </button>
          </form>

          <p className="auth-switch">
            Already have an account? <Link to="/login">← Log in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
