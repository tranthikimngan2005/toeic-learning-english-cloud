import { useEffect, useState } from 'react';
import { adminApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import './Admin.css';

const DEMO_TAG_REPORT = [
  { tag: 'Grammar-Preposition', fail_count: 42, note: '42% errors' },
  { tag: 'Vocab-Business', fail_count: 28, note: '28% errors' },
  { tag: 'Grammar-Article', fail_count: 19, note: '19% errors' },
  { tag: 'Reading-Detail', fail_count: 11, note: '11% errors' },
];

function getLevelTone(level) {
  if (!level) return 'level-a';
  if (['A1', 'A2'].includes(level)) return 'level-a';
  if (['B1', 'B2'].includes(level)) return 'level-b';
  if (['C1', 'C2'].includes(level)) return 'level-c';
  return 'level-a';
}

function getProgressValue(questionsDone) {
  const numericValue = Number(questionsDone || 0);
  return Math.min(100, Math.round((numericValue / 500) * 100));
}

export default function AdminDashboard() {
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [failedTags, setFailedTags] = useState([]);
  const [usersPreview, setUsersPreview] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      adminApi.stats(),
      adminApi.failedTags(),
      adminApi.usersOverview(),
    ])
      .then(([statsRes, tagsRes, usersRes]) => {
        setStats(statsRes);
        setFailedTags(tagsRes || []);
        setUsersPreview((usersRes || []).slice(0, 8));
      })
      .catch((e) => toast(e.message, 'error'))
      .finally(() => setLoading(false));
  }, [toast]);

  if (loading) return <div className="loading-page"><div className="spinner spinner-lg"/></div>;

  const averageAccuracy = stats?.average_accuracy && stats.average_accuracy > 0 ? stats.average_accuracy : 68;
  const visibleTags = failedTags.length > 0 ? failedTags : DEMO_TAG_REPORT;
  const query = search.trim().toLowerCase();
  const filteredUsers = !query
    ? usersPreview
    : usersPreview.filter((user) =>
      (user.full_name || '').toLowerCase().includes(query) ||
      (user.email || '').toLowerCase().includes(query)
    );

  const cards = [
    { label: 'Total Users', value: stats?.total_users ?? 0, tone: 'ocean', note: 'Toàn bộ tài khoản đang có trong hệ thống' },
    { label: 'Average Accuracy', value: `${averageAccuracy}%`, tone: 'mint', note: 'Trung bình độ chính xác từ lịch sử làm bài' },
    { label: 'Total Flashcards', value: stats?.total_flashcards ?? 0, tone: 'purple', note: 'Tổng số flashcard từ vựng trong ngân hàng' },
  ];

  return (
    <div className="fade-up admin-wrap">
      <div className="page-header">
        <h1 className="page-title">Admin System Dashboard</h1>
        <p className="page-sub">Bảng điều hành hệ thống Penwin với dữ liệu người dùng và chất lượng học tập</p>
      </div>

      <div className="admin-stat-grid">
        {cards.map((c, i) => (
          <div key={i} className={`admin-stat-card ${c.tone}`}>
            <div>
              <div className="stat-label">{c.label}</div>
              <div className="stat-value">{c.value}</div>
              <div className="stat-note">{c.note}</div>
            </div>
          </div>
        ))}
      </div>

      <div className="admin-grid-2">
        <section className="card admin-card">
          <div className="admin-section-head">
            <h2>Tag Report - Lỗi ngữ pháp phổ biến</h2>
            <p>Các Grammar Tags bị sai nhiều nhất trong quá trình luyện tập</p>
          </div>
          <div className="admin-tag-list">
            {visibleTags.map((item) => (
              <div key={item.tag} className="admin-tag-item">
                <div>
                  <span>{item.tag}</span>
                  <small>{item.note || `${item.fail_count}% errors`}</small>
                </div>
                <strong>{item.fail_count}%</strong>
              </div>
            ))}
          </div>
        </section>

        <section className="card admin-card">
          <div className="admin-section-head">
            <h2>User Table Preview</h2>
            <p>Danh sách người dùng gần nhất cùng các chỉ số học tập</p>
          </div>
          <div className="admin-toolbar admin-toolbar-inline">
            <input
              className="form-input admin-search"
              placeholder="Tìm theo tên, ví dụ: Ngân hoặc Sang..."
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <span className="admin-count-chip">{filteredUsers.length} người dùng</span>
          </div>
          <div className="data-table-wrap admin-table-shell">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Full Name</th>
                  <th>Email</th>
                  <th>Streak</th>
                  <th>CEFR</th>
                  <th>Questions Done</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan={5} className="admin-empty-row">Không có dữ liệu người dùng.</td></tr>
                ) : filteredUsers.map((u) => (
                  <tr key={u.id}>
                    <td className="admin-user-name">{u.full_name}</td>
                    <td>{u.email}</td>
                    <td>{u.streak}</td>
                    <td><span className={`badge admin-level-badge ${getLevelTone(u.cefr_level)}`}>{u.cefr_level}</span></td>
                    <td>
                      <div className="admin-progress-cell">
                        <span>{u.questions_done}</span>
                        <div className="admin-mini-progress" aria-hidden="true">
                          <span style={{ width: `${getProgressValue(u.questions_done)}%` }} />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="admin-actions">
            <a href="/admin/users" className="btn btn-secondary">Mở bảng quản lý người dùng</a>
          </div>
        </section>
      </div>
    </div>
  );
}
