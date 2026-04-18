import { useEffect, useState, useCallback } from 'react';
import { adminApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import './Admin.css';

function ContentTable({ title, items, onApprove, onReject, loading }) {
  return (
    <div style={{marginBottom:32}}>
      <h2 style={{fontSize:15,fontWeight:600,color:'var(--text)',marginBottom:12}}>
        {title}
            <span className="badge badge-yellow" style={{marginLeft:10}}>{items.length} pending</span>
      </h2>
      <div className="data-table-wrap">
        <table className="data-table">
          <thead>
            <tr>
                  <th>Content</th><th>Skill</th><th>Level</th>
                  <th>Creator ID</th><th>Created at</th><th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={6} style={{textAlign:'center',padding:'32px 0'}}>
                <div className="spinner" style={{margin:'0 auto'}}/>
              </td></tr>
            ) : items.length === 0 ? (
              <tr><td colSpan={6} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0'}}>
                    ✓ No content needs review
              </td></tr>
            ) : items.map(item=>(
              <tr key={item.id}>
                <td className="td-content">
                  {(item.title || item.content || '').slice(0,70)}
                  {(item.title || item.content || '').length > 70 ? '…' : ''}
                </td>
                <td><span className="badge badge-green" style={{textTransform:'capitalize'}}>{item.skill}</span></td>
                <td><span className="badge badge-blue">{item.level}</span></td>
                <td style={{color:'var(--text3)'}}>#{item.creator_id}</td>
                <td style={{fontSize:12,color:'var(--text3)'}}>
                  {new Date(item.created_at).toLocaleDateString('vi-VN')}
                </td>
                <td>
                  <div style={{display:'flex',gap:6}}>
                    <button className="btn btn-sm" style={{background:'rgba(45,212,160,0.15)',color:'var(--accent)',border:'1px solid rgba(45,212,160,0.3)'}}
                      onClick={()=>onApprove(item.id)}>✓ Duyệt</button>
                    <button className="btn btn-danger btn-sm"
                      onClick={()=>onReject(item.id)}>✕ Từ chối</button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default function AdminContent() {
  const toast = useToast();
  const [lessons,   setLessons]   = useState([]);
  const [loading,   setLoading]   = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const ls = await adminApi.pendingLessons();
      setLessons(ls);
    } catch (e) { toast(e.message,'error'); }
    finally { setLoading(false); }
  }, [toast]);

  useEffect(() => { load(); }, [load]);

  const approveL = async (id) => {
    try { await adminApi.moderateL(id,'approved'); toast('Lesson approved!'); load(); }
    catch (e) { toast(e.message,'error'); }
  };
  const rejectL = async (id) => {
    try { await adminApi.moderateL(id,'rejected'); toast('Rejected!'); load(); }
    catch (e) { toast(e.message,'error'); }
  };

  return (
    <div className="fade-up">
      <div className="page-header">
        <h1 className="page-title">Content moderation</h1>
        <p className="page-sub">Approve or reject lessons from creators</p>
      </div>

      <ContentTable title="Lessons" items={lessons} loading={loading}
        onApprove={approveL} onReject={rejectL} />
    </div>
  );
}
