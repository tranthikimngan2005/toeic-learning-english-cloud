const BASE =
  window.location.hostname === 'localhost'
    ? 'http://localhost:8000'
    : 'https://toeic-learning-english-cloud.onrender.com';

const API_PREFIX = '/api';
const REQUEST_TIMEOUT_MS = 20000;

function getToken() {
  return localStorage.getItem('pengwin_token');
}

function toQueryString(params = {}) {
  const q = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') {
      q.append(key, String(value));
    }
  });
  const qs = q.toString();
  return qs ? `?${qs}` : '';
}

async function request(method, path, body, opts = {}) {
  const token = getToken();
  const headers = {};

  if (!opts.formData) {
    headers['Content-Type'] = 'application/json';
  }
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers,
      body: opts.formData
        ? body
        : body !== undefined && body !== null
          ? JSON.stringify(body)
          : undefined,
      signal: controller.signal,
    });

    if (res.status === 204) return null;

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('pengwin_token');
      }
      const msg = data?.detail || data?.message || `HTTP ${res.status}`;
      throw new Error(typeof msg === 'string' ? msg : JSON.stringify(msg));
    }

    return data;
  } catch (err) {
    if (err?.name === 'AbortError') {
      throw new Error('Request timeout after 20s. Please try again.');
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export const api = {
  get: (path) => request('GET', path),
  post: (path, body) => request('POST', path, body),
  put: (path, body) => request('PUT', path, body),
  patch: (path, body) => request('PATCH', path, body),
  delete: (path) => request('DELETE', path),
  postForm: (path, formData) => request('POST', path, formData, { formData: true }),
};

export const authApi = {
  register: (data) => api.post(`${API_PREFIX}/auth/register`, data),
  login: (email, password) => {
    const form = new URLSearchParams();
    form.append('username', email);
    form.append('password', password);
    return api.postForm(`${API_PREFIX}/auth/login`, form);
  },
};

export const userApi = {
  getMe: () => api.get(`${API_PREFIX}/users/me`),
  me: () => api.get(`${API_PREFIX}/users/me`),
  updateMe: (data) => api.put(`${API_PREFIX}/users/me`, data),
  dashboard: () => api.get(`${API_PREFIX}/users/me/dashboard`),
  progress: () => api.get(`${API_PREFIX}/users/me/progress`),
};

export const lessonApi = {
  list: (params = {}) => api.get(`${API_PREFIX}/lessons${toQueryString(params)}`),
  get: (id) => api.get(`${API_PREFIX}/lessons/${id}`),
  create: (data) => api.post(`${API_PREFIX}/lessons`, data),
  update: (id, data) => api.put(`${API_PREFIX}/lessons/${id}`, data),
  delete: (id) => api.delete(`${API_PREFIX}/lessons/${id}`),
  moderate: (id, status) => api.patch(`${API_PREFIX}/lessons/${id}/moderate`, { status }),
};

export const questionApi = {
  list: (params = {}) => api.get(`${API_PREFIX}/questions${toQueryString(params)}`),
  random: (part) =>
    api.get(`${API_PREFIX}/questions/random${part !== undefined && part !== null ? `?part=${encodeURIComponent(part)}` : ''}`),
  create: (data) => api.post(`${API_PREFIX}/questions`, data),
  update: (id, data) => api.put(`${API_PREFIX}/questions/${id}`, data),
  delete: (id) => api.delete(`${API_PREFIX}/questions/${id}`),
  recommendations: () => api.get(`${API_PREFIX}/questions/recommendations`),
  startPractice: (skill, count = 10, part = null) =>
    api.post(`${API_PREFIX}/questions/practice/start`, { skill, count, part }),
  submitAnswer: (question_id, user_answer) =>
    api.post(`${API_PREFIX}/questions/practice/submit`, { question_id, user_answer }),
};

export const reviewApi = {
  due: () => api.get(`${API_PREFIX}/review/due`),
  srs: () => api.get(`${API_PREFIX}/review/srs`),
  mistakes: () => api.get(`${API_PREFIX}/review/mistakes`),
  recentMistakes: () => api.get(`${API_PREFIX}/review/recent-mistakes`),
  submit: (card_id, result) => api.post(`${API_PREFIX}/review/submit`, { card_id, result }),
};

export const chatApi = {
  history: () => api.get(`${API_PREFIX}/chat/history`),
  send: (content) => api.post(`${API_PREFIX}/chat/send`, { content }),
  generate: (content, system_prompt) => api.post(`${API_PREFIX}/chat/generate`, { content, system_prompt }),
  saveAI: (content) => api.post(`${API_PREFIX}/chat/ai-response`, { content }),
  systemPrompt: () => api.get(`${API_PREFIX}/chat/system-prompt`),
  clear: () => api.delete(`${API_PREFIX}/chat/history`),
};

export const flashcardApi = {
  list: (params = {}) => api.get(`${API_PREFIX}/flashcards${toQueryString(params)}`),
  match: (params = {}) => api.get(`${API_PREFIX}/flashcards/match${toQueryString(params)}`),
  manageList: (params = {}) => api.get(`${API_PREFIX}/flashcards/manage${toQueryString(params)}`),
  create: (data) => api.post(`${API_PREFIX}/flashcards/manage`, data),
  update: (id, data) => api.put(`${API_PREFIX}/flashcards/manage/${id}`, data),
  delete: (id) => api.delete(`${API_PREFIX}/flashcards/manage/${id}`),
};

export const adminApi = {
  stats: () => api.get(`${API_PREFIX}/admin/stats`),
  users: () => api.get(`${API_PREFIX}/admin/users`),
  usersOverview: () => api.get(`${API_PREFIX}/admin/users/overview`),
  failedTags: () => api.get(`${API_PREFIX}/admin/reports/failed-tags`),
  changeRole: (id, role) => api.patch(`${API_PREFIX}/admin/users/${id}/role`, { role }),
  ban: (id, active) => api.patch(`${API_PREFIX}/admin/users/${id}/ban`, { is_active: active }),
  pendingLessons: () => api.get(`${API_PREFIX}/admin/content/pending/lessons`),
};

export const analyticsApi = {
  upload: (data) => api.post(`${API_PREFIX}/analytics/upload`, data),
};

