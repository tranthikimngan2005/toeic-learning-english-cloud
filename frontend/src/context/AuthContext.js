import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { userApi } from '../api/client';

const AuthContext = createContext(null);

function avatarKey(userId) {
  return `pengwin_avatar_${userId}`;
}

function withAvatar(userData) {
  if (!userData?.id) return userData;
  const avatar = localStorage.getItem(avatarKey(userData.id));
  return { ...userData, avatar: avatar || null };
}

export function AuthProvider({ children }) {
  const [user, setUser]       = useState(null);
  const [loading, setLoading] = useState(true);

  const loadUser = useCallback(async () => {
    const token = localStorage.getItem('pengwin_token');
    if (!token) { setLoading(false); return; }
    try {
      const me = await userApi.me();
      setUser(withAvatar(me));
    } catch {
      localStorage.removeItem('pengwin_token');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadUser(); }, [loadUser]);

  const login = (token, userData) => {
    localStorage.setItem('pengwin_token', token);
    setUser(withAvatar(userData));
  };

  const setAvatar = (avatarDataUrl) => {
    if (!user?.id) return;
    localStorage.setItem(avatarKey(user.id), avatarDataUrl);
    setUser(prev => prev ? { ...prev, avatar: avatarDataUrl } : prev);
  };

  const clearAvatar = () => {
    if (!user?.id) return;
    localStorage.removeItem(avatarKey(user.id));
    setUser(prev => prev ? { ...prev, avatar: null } : prev);
  };

  const logout = () => {
    localStorage.removeItem('pengwin_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, reload: loadUser, setAvatar, clearAvatar }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);

