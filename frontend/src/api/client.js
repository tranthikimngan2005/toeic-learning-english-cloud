const BASE = (process.env.REACT_APP_API_URL || 'https://toeic-learning-english-cloud.onrender.com').replace(/\/$/, '');
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
  register: (data)             => api.post('/auth/register', data),
  login: (email, password) => {
    const fd = new URLSearchParams();
    fd.append('username', email);
    fd.append('password', password);
    return api.postForm('/auth/login', fd);
  },
};

// Users
export const userApi = {
  me:        ()    => api.get('/users/me'),
  dashboard: ()    => api.get('/users/me/dashboard'),
  progress:  ()    => api.get('/users/me/progress'),
};

// Lessons
export const lessonApi = {
  list:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/lessons${q ? '?' + q : ''}`);
  },
  get:      (id)           => api.get(`/lessons/${id}`),
  create:   (data)         => api.post('/lessons', data),
  update:   (id, data)     => api.put(`/lessons/${id}`, data),
  delete:   (id)           => api.delete(`/lessons/${id}`),
  moderate: (id, status)   => api.patch(`/lessons/${id}/moderate`, { status }),
};

// Questions
export const questionApi = {
  list:     (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/questions${q ? '?' + q : ''}`);
  },
  random:   (part = null)  => api.get(`/questions/random${part != null ? `?part=${encodeURIComponent(part)}` : ''}`),
  create:   (data)         => api.post('/questions', data),
  update:   (id, data)     => api.put(`/questions/${id}`, data),
  delete:   (id)           => api.delete(`/questions/${id}`),
  moderate: (id, status)   => api.patch(`/questions/${id}/moderate`, { status }),
  startPractice: (skill, count = 10, part = null) =>
    api.post('/questions/practice/start', { skill, count, part }),
  submitAnswer: (question_id, user_answer) =>
    api.post('/questions/practice/submit', { question_id, user_answer }),
  recommendations: () =>
    api.get('/recommendations'),
};

// Review
export const reviewApi = {
  due:    ()               => api.get('/review/due'),
  srs:    ()               => api.get('/review/srs'),
  mistakes: ()             => api.get('/review/mistakes'),
  recentMistakes: ()       => api.get('/review/recent-mistakes'),
  submit: (card_id, result) => api.post('/review/submit', { card_id, result }),
};

export const flashcardApi = {
  list: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/flashcards${q ? '?' + q : ''}`);
  },
  match: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/flashcards/match${q ? '?' + q : ''}`);
  },
  manageList: (params = {}) => {
    const q = new URLSearchParams(params).toString();
    return api.get(`/flashcards/manage${q ? '?' + q : ''}`);
  },
  create: (data) => api.post('/flashcards/manage', data),
  update: (id, data) => api.put(`/flashcards/manage/${id}`, data),
  delete: (id) => api.delete(`/flashcards/manage/${id}`),
};

// Chat
export const chatApi = {
  history:      ()      => api.get('/chat/history'),
  send:         (content) => api.post('/chat/send', { content }),
  generate:     (content, system_prompt) => api.post('/chat/generate', { content, system_prompt }),
  saveAI:       (content) => api.post('/chat/ai-response', { content }),
  systemPrompt: ()      => api.get('/chat/system-prompt'),
  clear:        ()      => api.delete('/chat/history'),
};

// Admin
export const adminApi = {
  stats:           ()           => api.get('/admin/stats'),
  users:           ()           => api.get('/admin/users'),
  usersOverview:   ()           => api.get('/admin/users/overview'),
  failedTags:      ()           => api.get('/admin/reports/failed-tags'),
  changeRole:      (id, role)   => api.patch(`/admin/users/${id}/role`, { role }),
  ban:             (id, active) => api.patch(`/admin/users/${id}/ban`, { is_active: active }),
  pendingLessons:  ()           => api.get('/admin/content/pending/lessons'),
  moderateL:       (id, status) => api.patch(`/lessons/${id}/moderate`, { status }),
};

export const analyticsApi = {
  upload: (data) => api.post('/analytics/upload', data),
};

