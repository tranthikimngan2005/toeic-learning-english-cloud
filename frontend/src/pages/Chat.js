import { useEffect, useState, useRef } from 'react';
import { chatApi } from '../api/client';
import { useToast } from '../context/ToastContext';
import { IMG_CHAT, IMG_GRAMMAR } from '../assets/images';
import './Chat.css';

const SUGGESTIONS = [
  'Yesterday I go to school with my friend.',
  'She is more taller than her sister.',
  'I have been to Paris last year.',
  'He don\'t know the answer.',
];


function Message({ msg }) {
  const isUser = msg.role==='user';
  const time   = new Date(msg.created_at).toLocaleTimeString('vi-VN',{hour:'2-digit',minute:'2-digit'});
  return (
    <div className={`msg-row ${isUser?'user':'ai'}`}>
      {!isUser && <img src={IMG_CHAT} className="msg-avatar" alt="AI" />}
      <div className={`msg-bubble ${isUser?'user-bubble':'ai-bubble'}`}>
        <div className="msg-content" style={{whiteSpace:'pre-wrap'}}>{msg.content}</div>
        <div className="msg-time">{time}</div>
      </div>
      {isUser && <div className="msg-avatar-user">{msg.role==='user'?'👤':''}</div>}
    </div>
  );
}

function Typing() {
  return (
    <div className="msg-row ai">
      <img src={IMG_CHAT} className="msg-avatar" alt="AI" />
      <div className="ai-bubble msg-bubble typing-bubble">
        <span/><span/><span/>
      </div>
    </div>
  );
}

export default function Chat() {
  const toast     = useToast();
  const bottomRef = useRef(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState('');
  const [loading,  setLoading]  = useState(true);
  const [typing,   setTyping]   = useState(false);

  useEffect(()=>{
    chatApi.history().then(setMessages).catch(e=>toast(e.message,'error')).finally(()=>setLoading(false));
  },[toast]);
  useEffect(()=>{ setTimeout(()=>bottomRef.current?.scrollIntoView({behavior:'smooth'}),50); },[messages,typing]);

  const callAI = async (text) => {
    setTyping(true);
    try {
      const saved = await chatApi.generate(text);
      setMessages(prev=>[...prev,saved]);
    } catch(e) { toast(e.message || 'Could not save the AI response','error'); }
    finally { setTyping(false); }
  };

  const handleSend = async () => {
    const text = input.trim();
    if(!text||typing) return;
    setInput('');
    try {
      const saved = await chatApi.send(text);
      setMessages(prev => [...prev, saved]);
      await callAI(text);
    } catch(e) { toast(e.message,'error'); }
  };

  return (
    <div className="chat-page">
      <div className="chat-topbar">
        <div>
          <h1 className="page-title" style={{marginBottom:2}}>💬 AI Writing Coach</h1>
          <p className="page-sub">Free writing — Pengwin AI will correct your grammar!</p>
        </div>
        <button className="btn btn-ghost btn-sm"
          onClick={async()=>{if(!window.confirm('Clear chat history?'))return;await chatApi.clear();setMessages([]);toast('Deleted!');}}
          disabled={messages.length===0}>
          🗑 Clear chat
        </button>
      </div>

      <div className="chat-area">
        {loading ? <div className="loading-page"><div className="spinner spinner-lg"/></div>
        : messages.length===0 ? (
          <div className="chat-empty">
            <img className="penguin-cutout" src={IMG_GRAMMAR} style={{width:90,animation:'float 3s ease-in-out infinite',marginBottom:16}} alt="" />
            <h3 style={{fontFamily:'var(--font-head)',fontSize:20,color:'var(--navy)',marginBottom:8}}>Hello! I&apos;m Pengwin AI 🐧</h3>
            <p style={{fontSize:14,color:'var(--text2)',fontWeight:600,marginBottom:20,maxWidth:360}}>
              Write any sentence in English and I&apos;ll help you improve it!
            </p>
            <div style={{width:'100%',maxWidth:420}}>
              <p style={{fontSize:11,fontWeight:800,textTransform:'uppercase',letterSpacing:'0.08em',color:'var(--text3)',marginBottom:10}}>💡 Try these prompts:</p>
              {SUGGESTIONS.map((s,i)=>(
                <button key={i} className="sug-btn" onClick={()=>setInput(s)}>{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="messages">
            {messages.map(m=><Message key={m.id} msg={m}/>)}
            {typing && <Typing/>}
            <div ref={bottomRef}/>
          </div>
        )}
      </div>

      <div className="chat-input-area">
        <input className="chat-textarea"
          placeholder="Type a prompt... for example: write an English paragraph about travel"
          value={input} onChange={e=>setInput(e.target.value)}
          onKeyDown={e=>{if(e.key==='Enter'){e.preventDefault();handleSend();}}}
          disabled={typing} />
        <button className="btn btn-primary chat-send" onClick={handleSend} disabled={!input.trim()||typing}>
          {typing?<span className="spinner"/>:'↑'}
        </button>
      </div>
    </div>
  );
}
