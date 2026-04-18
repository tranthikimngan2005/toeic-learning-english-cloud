const BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const REQUEST_TIMEOUT_MS = 8000;

function getToken() {
  return localStorage.getItem('pengwin_token');
}

async function request(method, path, body, opts = {}) {
  const token = getToken();
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (opts.formData) delete headers['Content-Type'];

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: opts.formData ? body : body ? JSON.stringify(body) : undefined,
      signal: controller.signal,
    });
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timeout. Please check backend server and try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }

  if (res.status === 204) return null;

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (res.status === 401) {
      // Drop stale credentials so protected views can redirect cleanly.
      localStorage.removeItem('pengwin_token');
    }
    const msg = data.detail || data.message || `HTTP ${res.status}`;
    throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
  }
  return data;
}

export const api = {
  get:    (path)         => request('GET', path),
  post:   (path, body)   => request('POST', path, body),
  put:    (path, body)   => request('PUT', path, body),
  patch:  (path, body)   => request('PATCH', path, body),
  delete: (path)         => request('DELETE', path),
  postForm: (path, formData) => request('POST', path, formData, { formData: true }),
};

// Auth
export const authApi = {
  register: (data)             => api.post('/api/auth/register', data),
  login: (email, password) => {
    const fd = new URLSearchParams();
    fd.append('username', email);
    fd.append('password', password);
    return api.postForm('/api/auth/login', fd);
  },
};

// Users
export const userApi = {
  me:        ()    => api.get('/api/users/me'),
  dashboard: ()    => api.get('/api/users/me/dashboard'),
  progress:  ()    => api.get('/api/users/me/progress'),
};

// Lessons
export const lessonApi = {
  list:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/lessons${q ? '?' + q : ''}`);
  },
  get:      (id)           => api.get(`/api/lessons/${id}`),
  create:   (data)         => api.post('/api/lessons', data),
  update:   (id, data)     => api.put(`/api/lessons/${id}`, data),
  delete:   (id)           => api.delete(`/api/lessons/${id}`),
  moderate: (id, status)   => api.patch(`/api/lessons/${id}/moderate`, { status }),
};

// Questions
export const questionApi = {
  list:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/questions${q ? '?' + q : ''}`);
  },
  create:   (data)         => api.post('/api/questions', data),
  update:   (id, data)     => api.put(`/api/questions/${id}`, data),
  delete:   (id)           => api.delete(`/api/questions/${id}`),
  moderate: (id, status)   => api.patch(`/api/questions/${id}/moderate`, { status }),
  startPractice: (skill, count = 10, part = null) =>
    api.post('/api/questions/practice/start', { skill, count, part }),
  submitAnswer: (question_id, user_answer) =>
    api.post('/api/questions/practice/submit', { question_id, user_answer }),
  recommendations: () =>
    api.get('/api/recommendations'),
};

// Review
export const reviewApi = {
  due:    ()               => api.get('/api/review/due'),
  srs:    ()               => api.get('/api/review/srs'),
  mistakes: ()             => api.get('/api/review/mistakes'),
  recentMistakes: ()       => api.get('/api/review/recent-mistakes'),
  submit: (card_id, result) => api.post('/api/review/submit', { card_id, result }),
};

export const flashcardApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/flashcards${q ? '?' + q : ''}`);
  },
  match: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/flashcards/match${q ? '?' + q : ''}`);
  },
  manageList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/api/flashcards/manage${q ? '?' + q : ''}`);
  },
  create: (data) => api.post('/api/flashcards/manage', data),
  update: (id, data) => api.put(`/api/flashcards/manage/${id}`, data),
  delete: (id) => api.delete(`/api/flashcards/manage/${id}`),
};

// Chat
export const chatApi = {
  history:      ()      => api.get('/api/chat/history'),
  send:         (content) => api.post('/api/chat/send', { content }),
  generate:     (content, system_prompt) => api.post('/api/chat/generate', { content, system_prompt }),
  saveAI:       (content) => api.post('/api/chat/ai-response', { content }),
  systemPrompt: ()      => api.get('/api/chat/system-prompt'),
  clear:        ()      => api.delete('/api/chat/history'),
};

// Admin
export const adminApi = {
  stats:           ()           => api.get('/api/admin/stats'),
  users:           ()           => api.get('/api/admin/users'),
  usersOverview:   ()           => api.get('/api/admin/users/overview'),
  failedTags:      ()           => api.get('/api/admin/reports/failed-tags'),
  changeRole:      (id, role)   => api.patch(`/api/admin/users/${id}/role`, { role }),
  ban:             (id, active) => api.patch(`/api/admin/users/${id}/ban`, { is_active: active }),
  pendingLessons:  ()           => api.get('/api/admin/content/pending/lessons'),
  moderateL:       (id, status) => api.patch(`/api/lessons/${id}/moderate`, { status }),
};

