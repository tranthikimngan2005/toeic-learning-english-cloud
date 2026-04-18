import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { IMG_HERO, IMG_STREAK } from '../assets/images';
import './Layout.css';

function NavItem({ to, icon, label, end, badge }) {
  return (
    <NavLink to={to} end={end}
      className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}>
      <span className="nav-icon">{icon}</span>
      <span className="nav-label">{label}</span>
      {badge > 0 && <span className="nav-badge">{badge}</span>}
    </NavLink>
  );
}

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="app-layout">
      <aside className="sidebar">
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="logo-mascot">
            <img src={IMG_HERO} alt="Pengwin" />
          </div>
          <span className="logo-text">Pen<span>win</span></span>
        </div>

        {/* User */}
        <div className="sidebar-user">
          <div className="avatar">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" />
            ) : (
              user?.username?.[0]?.toUpperCase()
            )}
          </div>
          <div style={{ overflow:'hidden' }}>
            <div className="user-name">{user?.username}</div>
            <span className="user-role-badge">{user?.role}</span>
          </div>
        </div>

        {/* Navigation */}
        <nav style={{ flex:1 }}>
          {user?.role === 'student' && <>
            <div className="nav-section">Learner</div>
            <NavItem to="/dashboard" end icon="🏠" label="Dashboard" />
            <NavItem to="/practice"     icon="▶" label="Practice" />
            <NavItem to="/flashcards"   icon="🗂️" label="Flashcards" />
            <NavItem to="/review"       icon="🔁" label="Review" />
            <NavItem to="/progress"     icon="📈" label="Progress" />
            <NavItem to="/chat"         icon="💬" label="AI Chat" />
            <NavItem to="/profile"      icon="🐧" label="Profile" />
          </>}

          {user?.role === 'creator' && <>
            <div className="nav-section">Creator</div>
            <NavItem to="/creator/lessons"   icon="📚" label="Content Hub" />
          </>}

          {user?.role === 'admin' && <>
            <div className="nav-section">Admin</div>
            <NavItem to="/admin"         icon="🛡️" label="Dashboard" />
            <NavItem to="/admin/users"   icon="👥" label="Users" />
          </>}
        </nav>

        {/* Streak widget (student only) */}
        {user?.role === 'student' && (
          <div className="streak-widget">
            <img className="streak-mascot" src={IMG_STREAK} alt="streak" />
            <div>
              <div className="streak-num">🔥 Streak</div>
              <div className="streak-label">Keep going!</div>
            </div>
          </div>
        )}

        <div className="sidebar-bottom">
          <button className="sidebar-logout"
            onClick={() => { logout(); navigate('/login'); }}>
            ⎋ <span>Logout</span>
          </button>
        </div>
      </aside>

      <main className="main-content">
        {children}
      </main>
    </div>
  );
}
