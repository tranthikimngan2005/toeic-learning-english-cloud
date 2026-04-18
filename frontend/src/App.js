import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';

import Layout       from './components/Layout';
import Login        from './pages/Login';
import Register     from './pages/Register';
import Dashboard    from './pages/Dashboard';
import Skills       from './pages/Skills';
import Practice     from './pages/Practice';
import Flashcards   from './pages/FlashcardPage';
import Review       from './pages/Review';
import Progress     from './pages/Progress';
import Chat         from './pages/Chat';
import Profile      from './pages/Profile';
import CreatorLessons   from './pages/CreatorLessons';
import AdminDashboard   from './pages/AdminDashboard';
import AdminUsers       from './pages/AdminUsers';

function roleHome(role) {
  if (role === 'admin') return '/admin';
  if (role === 'creator') return '/creator/lessons';
  return '/dashboard';
}

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/><span>Loading...</span></div>;
  if (!user)   return <Navigate to="/login" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to={roleHome(user.role)} replace />;
  return <Layout>{children}</Layout>;
}

function PublicRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/><span>Loading...</span></div>;
  if (user)    return <Navigate to={roleHome(user.role)} replace />;
  return children;
}

function RoleHomeRedirect() {
  const { user, loading } = useAuth();
  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/><span>Loading...</span></div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Navigate to={roleHome(user.role)} replace />;
}

function AppRoutes() {
  return (
    <Routes>
      {/* Public */}
      <Route path="/login"    element={<PublicRoute><Login /></PublicRoute>} />
      <Route path="/register" element={<PublicRoute><Register /></PublicRoute>} />

      {/* Student only */}
      <Route path="/dashboard" element={<ProtectedRoute roles={['student']}><Dashboard /></ProtectedRoute>} />
      <Route path="/skills"    element={<ProtectedRoute roles={['student']}><Skills /></ProtectedRoute>} />
      <Route path="/practice"  element={<ProtectedRoute roles={['student']}><Practice /></ProtectedRoute>} />
      <Route path="/flashcards"  element={<ProtectedRoute roles={['student']}><Flashcards /></ProtectedRoute>} />
      <Route path="/review"    element={<ProtectedRoute roles={['student']}><Review /></ProtectedRoute>} />
      <Route path="/progress"  element={<ProtectedRoute roles={['student']}><Progress /></ProtectedRoute>} />
      <Route path="/chat"      element={<ProtectedRoute roles={['student']}><Chat /></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute roles={['student']}><Profile /></ProtectedRoute>} />

      {/* Creator only */}
      <Route path="/creator/questions" element={
        <ProtectedRoute roles={['creator']}><Navigate to="/creator/lessons" replace /></ProtectedRoute>
      }/>
      <Route path="/creator/lessons" element={
        <ProtectedRoute roles={['creator']}><CreatorLessons /></ProtectedRoute>
      }/>

      {/* Admin only */}
      <Route path="/admin" element={
        <ProtectedRoute roles={['admin']}><AdminDashboard /></ProtectedRoute>
      }/>
      <Route path="/admin/users" element={
        <ProtectedRoute roles={['admin']}><AdminUsers /></ProtectedRoute>
      }/>

      {/* Fallback */}
      <Route path="*" element={<RoleHomeRedirect />} />
    </Routes>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <AppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
