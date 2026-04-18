import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import './Admin.css';

const ROLES = ['student','creator','admin'];

export default function AdminUsers() {
  const toast = useToast();
  const [users,   setUsers]   = useState([]);
  const [loading, setLoading] = useState(true);
  const [search,  setSearch]  = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overviewRows, baseRows] = await Promise.all([adminApi.usersOverview(), adminApi.users()]);
      const baseMap = new Map((baseRows || []).map((item) => [item.id, item]));
      const merged = (overviewRows || []).map((row) => ({
        ...row,
        role: baseMap.get(row.id)?.role || row.role,
        is_active: baseMap.get(row.id)?.is_active ?? row.is_active,
      }));
      setUsers(merged);
    }
    catch (e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const changeRole = async (id, role) => {
    try { await adminApi.changeRole(id, role); toast('Đã cập nhật vai trò.'); load(); }
    catch (e) { toast(e.message,'error'); }
  };

  const toggleBan = async (user) => {
    const msg = user.is_active
      ? `Bạn muốn khóa tài khoản "${user.full_name}"?`
      : `Bạn muốn mở khóa tài khoản "${user.full_name}"?`;
    if (!window.confirm(msg)) return;
    try { await adminApi.ban(user.id, !user.is_active); toast(user.is_active ? 'Đã khóa tài khoản.' : 'Đã mở khóa tài khoản.'); load(); }
    catch (e) { toast(e.message,'error'); }
  };

  const filtered = users.filter(u =>
    u.full_name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="fade-up admin-wrap">
      <div className="page-header">
        <h1 className="page-title">Bảng Quản Lý Người Dùng</h1>
        <p className="page-sub">Danh sách người dùng với chỉ số học tập cốt lõi</p>
      </div>

      <div className="admin-toolbar">
        <input className="form-input" style={{maxWidth:360}}
          placeholder="Tìm theo họ tên hoặc email..."
          value={search} onChange={e=>setSearch(e.target.value)} />
        <span className="admin-count-chip">{filtered.length} người dùng</span>
      </div>

      {loading ? <div className="loading-page" style={{height:200}}><div className="spinner spinner-lg"/></div> : (
        <div className="data-table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Full Name</th>
                <th>Email</th>
                <th>Streak</th>
                <th>CEFR Level</th>
                <th>Questions Done</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={8} className="admin-empty-row">Không tìm thấy người dùng phù hợp.</td></tr>
              )}
              {filtered.map(u=>(
                <tr key={u.id}>
                  <td style={{fontWeight:700,color:'var(--text)'}}>{u.full_name}</td>
                  <td>{u.email}</td>
                  <td>{u.streak}</td>
                  <td><span className="badge badge-blue">{u.cefr_level}</span></td>
                  <td>{u.questions_done}</td>
                  <td>
                    <select className="form-select" style={{width:110,padding:'4px 8px',fontSize:12}}
                      value={u.role}
                      onChange={e=>changeRole(u.id,e.target.value)}>
                      {ROLES.map(r=><option key={r}>{r}</option>)}
                    </select>
                  </td>
                  <td>
                    <span className={`badge ${u.is_active ? 'badge-green' : 'badge-red'}`}>
                      {u.is_active ? 'Đang hoạt động' : 'Đã khóa'}
                    </span>
                  </td>
                  <td>
                    <button
                      className={`btn btn-sm ${u.is_active ? 'btn-danger' : 'btn-secondary'}`}
                      onClick={()=>toggleBan(u)}>
                      {u.is_active ? 'Khóa' : 'Mở khóa'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
