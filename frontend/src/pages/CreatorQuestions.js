import { useEffect, useState, useCallback } from 'react';
import { questionApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { IMG_GRAMMAR } from '../assets/images';
import './Creator.css';

const SKILLS=['reading','listening','writing','speaking'];
const LEVELS=['A1','A2','B1','B2','C1','C2'];
const TYPES=['mcq','fill_blank','writing','speaking'];
const STATUS_BADGE={pending:'badge-yellow',approved:'badge-green',rejected:'badge-red'};
const EMPTY={skill:'reading',level:'B1',q_type:'mcq',content:'',options:['','','',''],correct_answer:'',explanation:'',ai_prompt:''};

export default function CreatorQuestions() {
  const toast=useToast();
  const [questions,setQuestions]=useState([]);
  const [loading,setLoading]=useState(true);
  const [showForm,setShowForm]=useState(false);
  const [editId,setEditId]=useState(null);
  const [form,setForm]=useState(EMPTY);
  const [saving,setSaving]=useState(false);
  const [filterSkill,setFilterSkill]=useState('');
  const [filterLevel,setFilterLevel]=useState('');

  const load=useCallback(async()=>{
    setLoading(true);
    try{const p={};if(filterSkill)p.skill=filterSkill;if(filterLevel)p.level=filterLevel;setQuestions(await questionApi.list(p));}
    catch(e){toast(e.message,'error');}finally{setLoading(false);}
  },[filterSkill,filterLevel,toast]);

  useEffect(()=>{load();},[load]);

  const openNew=()=>{setForm(EMPTY);setEditId(null);setShowForm(true);};
  const openEdit=q=>{setForm({skill:q.skill,level:q.level,q_type:q.q_type,content:q.content,options:q.options||['','','',''],correct_answer:q.correct_answer,explanation:q.explanation||'',ai_prompt:q.ai_prompt||''});setEditId(q.id);setShowForm(true);};

  const handleSave=async()=>{
    if(!form.content.trim()||!form.correct_answer.trim()){toast('Please fill in all required fields','error');return;}
    setSaving(true);
    try{
      const p={...form,options:form.q_type==='mcq'?form.options.filter(Boolean):null};
      if(editId)await questionApi.update(editId,p);else await questionApi.create(p);
      toast(editId?'Updated!':'Published immediately! 🐧');setShowForm(false);load();
    }catch(e){toast(e.message,'error');}finally{setSaving(false);}
  };

  const handleDelete=async id=>{
    if(!window.confirm('Delete this question?'))return;
    try{await questionApi.delete(id);toast('Deleted!');load();}catch(e){toast(e.message,'error');}
  };

  const setOpt=(i,v)=>setForm(f=>{const o=[...f.options];o[i]=v;return{...f,options:o};});

  return (
    <div className="fade-up">
      <div className="page-header" style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start'}}>
        <div>
          <h1 className="page-title">❓ Question management</h1>
          <p className="page-sub">Create and edit questions; published immediately</p>
        </div>
        <button className="btn btn-primary" onClick={openNew}>✚ Create question</button>
      </div>

      <div className="filter-row">
        <select className="form-select" style={{width:160}} value={filterSkill} onChange={e=>setFilterSkill(e.target.value)}>
          <option value="">All skills</option>
          {SKILLS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
        </select>
        <select className="form-select" style={{width:140}} value={filterLevel} onChange={e=>setFilterLevel(e.target.value)}>
          <option value="">All levels</option>
          {LEVELS.map(l=><option key={l}>{l}</option>)}
        </select>
        <span style={{fontSize:13,color:'var(--text3)',fontWeight:700}}>{questions.length} questions</span>
      </div>

      {loading?<div className="loading-page" style={{height:200}}><div className="spinner spinner-lg"/></div>:(
        <div className="data-table-wrap">
          <table className="data-table">
            <thead><tr><th>Content</th><th>Skill</th><th>Level</th><th>Type</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              {questions.length===0?<tr><td colSpan={6} style={{textAlign:'center',color:'var(--text3)',padding:'32px 0',fontWeight:700}}>
                <img className="penguin-cutout" src={IMG_GRAMMAR} style={{width:60,display:'block',margin:'0 auto 10px',opacity:0.4}} alt=""/>
                No questions yet
              </td></tr>:questions.map(q=>(
                <tr key={q.id}>
                  <td className="td-content">{q.content.slice(0,65)}{q.content.length>65?'…':''}</td>
                  <td><span className="badge badge-green" style={{textTransform:'capitalize'}}>{q.skill}</span></td>
                  <td><span className="badge badge-blue">{q.level}</span></td>
                  <td><span className="badge badge-gray">{q.q_type.replace('_',' ')}</span></td>
                  <td><span className={`badge ${STATUS_BADGE[q.status]}`}>{q.status}</span></td>
                  <td><div style={{display:'flex',gap:6}}>
                    <button className="btn btn-ghost btn-sm" onClick={()=>openEdit(q)}>✎ Edit</button>
                    <button className="btn btn-danger btn-sm" onClick={()=>handleDelete(q.id)}>✕</button>
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm&&(
        <div className="modal-overlay" onClick={()=>setShowForm(false)}>
          <div className="modal-box" onClick={e=>e.stopPropagation()}>
            <div className="modal-header">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <img className="penguin-cutout" src={IMG_GRAMMAR} style={{width:36,animation:'float 3s ease-in-out infinite'}} alt=""/>
                <h3>{editId?'Edit question':'Create new question'}</h3>
              </div>
              <button className="btn btn-ghost btn-icon" onClick={()=>setShowForm(false)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="grid-3" style={{gap:10,marginBottom:14}}>
                <div className="form-group">
                  <label className="form-label">Skill</label>
                  <select className="form-select" value={form.skill} onChange={e=>setForm(f=>({...f,skill:e.target.value}))}>
                    {SKILLS.map(s=><option key={s} value={s} style={{textTransform:'capitalize'}}>{s}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Level</label>
                  <select className="form-select" value={form.level} onChange={e=>setForm(f=>({...f,level:e.target.value}))}>
                    {LEVELS.map(l=><option key={l}>{l}</option>)}
                  </select>
                </div>
                <div className="form-group">
                  <label className="form-label">Question type</label>
                  <select className="form-select" value={form.q_type} onChange={e=>setForm(f=>({...f,q_type:e.target.value}))}>
                    {TYPES.map(t=><option key={t} value={t}>{t.replace('_',' ')}</option>)}
                  </select>
                </div>
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Question content</label>
                <textarea className="form-textarea" rows={3} placeholder="Enter the question..."
                  value={form.content} onChange={e=>setForm(f=>({...f,content:e.target.value}))} />
              </div>
              {form.q_type==='mcq'&&(
                <div style={{marginBottom:14}}>
                  <label className="form-label" style={{display:'block',marginBottom:8}}>Options (MCQ)</label>
                  {form.options.map((opt,i)=>(
                    <div key={i} style={{display:'flex',gap:8,marginBottom:8,alignItems:'center'}}>
                      <span style={{width:28,fontSize:13,fontWeight:800,color:'var(--text2)'}}>{String.fromCharCode(65+i)}.</span>
                      <input className="form-input" placeholder={`Option ${String.fromCharCode(65+i)}`} value={opt} onChange={e=>setOpt(i,e.target.value)}/>
                    </div>
                  ))}
                </div>
              )}
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Correct answer</label>
                <input className="form-input" placeholder="Enter the answer..." value={form.correct_answer} onChange={e=>setForm(f=>({...f,correct_answer:e.target.value}))}/>
              </div>
              <div className="form-group" style={{marginBottom:14}}>
                <label className="form-label">Explanation (optional)</label>
                <textarea className="form-textarea" rows={2} placeholder="Explain the answer..." value={form.explanation} onChange={e=>setForm(f=>({...f,explanation:e.target.value}))}/>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-ghost" onClick={()=>setShowForm(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
                {saving?<><span className="spinner"/>Saving...</>:editId?'Update':'🐧 Create question'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
