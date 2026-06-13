import React, { useState, useEffect, useRef } from 'react';
import { Send, Image as ImageIcon, Mic, Square, X, MessageSquare, Trash2, Edit } from 'lucide-react';
import { supabase } from '../supabase';

interface Post {
  id: string;
  created_at: string;
  sender_name: string;
  sender_role: string;
  post_type: string;
  content: string;
  photo_url: string | null;
  audio_url: string | null;
}

interface WorkspaceProps {
  userName: string;
  userRole: string;
}

export const Workspace: React.FC<WorkspaceProps> = ({ userName, userRole }) => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [content, setContent] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const audioChunks = useRef<Blob[]>([]);

  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');

  useEffect(() => {
    fetchPosts();
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('workspace_posts')
      .select('*')
      .order('created_at', { ascending: false });
    
    if (!error && data) {
      setPosts(data);
    }
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorder.current = recorder;
      audioChunks.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunks.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(audioChunks.current, { type: 'audio/webm' });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      alert("မိုက်ကရိုဖုန်း အသုံးပြုခွင့် မရပါ။ (Microphone access denied)");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder.current && isRecording) {
      mediaRecorder.current.stop();
      setIsRecording(false);
    }
  };

  const handleSubmit = async () => {
    if (!content.trim() && !imageFile && !audioBlob) return alert("စာသား၊ ပုံ သို့မဟုတ် အသံဖိုင် တစ်ခုခု ထည့်ပါ ခင်ဗျာ။");
    
    setIsSubmitting(true);
    let finalPhotoUrl = null;
    let finalAudioUrl = null;

    if (imageFile) {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
      const { error } = await supabase.storage.from('workspace-files').upload(fileName, imageFile);
      if (!error) {
        const { data } = supabase.storage.from('workspace-files').getPublicUrl(fileName);
        finalPhotoUrl = data.publicUrl;
      }
    }

    if (audioBlob) {
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.webm`;
      const { error } = await supabase.storage.from('workspace-files').upload(fileName, audioBlob);
      if (!error) {
        const { data } = supabase.storage.from('workspace-files').getPublicUrl(fileName);
        finalAudioUrl = data.publicUrl;
      }
    }

    const newPost = {
      id: Date.now().toString(),
      sender_name: userName,
      sender_role: userRole,
      post_type: 'general',
      content,
      photo_url: finalPhotoUrl,
      audio_url: finalAudioUrl
    };

    const { data, error } = await supabase.from('workspace_posts').insert([newPost]).select();
    
    if (!error && data) {
      setPosts([data[0] as Post, ...posts]);
      setContent('');
      setImageFile(null);
      setAudioBlob(null);
      setAudioUrl(null);
    } else {
      alert("ပို့ရာတွင် အမှားအယွင်းရှိပါသည်: " + error?.message);
    }
    setIsSubmitting(false);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("ဤသတင်းပို့ချက်ကို ဖျက်ရန် သေချာပါသလား?")) return;
    const { error } = await supabase.from('workspace_posts').delete().eq('id', id);
    if (!error) setPosts(posts.filter(post => post.id !== id));
  };

  const handleUpdate = async (id: string) => {
    const { error } = await supabase.from('workspace_posts').update({ content: editContent }).eq('id', id);
    if (!error) {
      setPosts(posts.map(post => post.id === id ? { ...post, content: editContent } : post));
      setEditingId(null);
    }
  };

  const getRoleStyle = (role: string) => {
    const r = role.toLowerCase();
    switch(r) {
      case 'md': return { label: 'MD', color: 'bg-purple-100 text-purple-700 border-purple-200' };
      case 'finance': return { label: 'FINANCE', color: 'bg-emerald-100 text-emerald-700 border-emerald-200' };
      case 'manager': return { label: 'MANAGER', color: 'bg-amber-100 text-amber-700 border-amber-200' };
      case 'hr': return { label: 'HR', color: 'bg-pink-100 text-pink-700 border-pink-200' };
      default: return { label: r.toUpperCase(), color: 'bg-blue-100 text-blue-700 border-blue-200' };
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-100px)] md:h-full bg-slate-50 relative rounded-2xl overflow-hidden border shadow-sm max-w-5xl mx-auto">
      <div className="bg-white p-4 border-b flex items-center justify-between shadow-sm z-10 shrink-0">
        <h2 className="text-xl font-black text-slate-800 flex items-center gap-2">
          <MessageSquare className="text-blue-500" /> လုပ်ငန်းခွင် ဆက်သွယ်ရေး (CRM)
        </h2>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {posts.length === 0 ? (
          <div className="text-center text-slate-400 mt-10 font-bold">သတင်းပို့ချက်များ မရှိသေးပါ...</div>
        ) : (
          posts.map(post => {
            const roleStyle = getRoleStyle(post.sender_role);
            const canManage = userRole === 'md' || userName === post.sender_name;

            return (
              <div key={post.id} className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 group">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black border ${roleStyle.color}`}>
                      {post.sender_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <div className="font-bold text-slate-800">{post.sender_name}</div>
                      <div className="flex items-center gap-2">
                        <span className={`text-[9px] font-black px-1.5 py-0.5 rounded uppercase ${roleStyle.color}`}>{roleStyle.label}</span>
                        <span className="text-xs text-slate-400 font-medium">{new Date(post.created_at).toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                  
                  {canManage && (
                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => { setEditingId(post.id); setEditContent(post.content); }} className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" title="ပြင်မည်"><Edit size={16} /></button>
                      <button onClick={() => handleDelete(post.id)} className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="ဖျက်မည်"><Trash2 size={16} /></button>
                    </div>
                  )}
                </div>
                
                {editingId === post.id ? (
                  <div className="mb-3">
                    <textarea value={editContent} onChange={e => setEditContent(e.target.value)} className="w-full bg-slate-50 border border-blue-200 rounded-xl p-3 outline-none focus:ring-2 focus:ring-blue-500/20 mb-2 font-medium" rows={2} />
                    <div className="flex gap-2">
                      <button onClick={() => handleUpdate(post.id)} className="px-4 py-1.5 bg-blue-600 text-white text-sm font-bold rounded-lg shadow-sm hover:bg-blue-700">သိမ်းမည်</button>
                      <button onClick={() => setEditingId(null)} className="px-4 py-1.5 bg-slate-200 text-slate-600 text-sm font-bold rounded-lg hover:bg-slate-300">မလုပ်တော့ပါ</button>
                    </div>
                  </div>
                ) : (
                  post.content && <p className="text-slate-700 font-medium whitespace-pre-wrap mb-3 leading-relaxed">{post.content}</p>
                )}
                
                {post.photo_url && <div className="mb-3"><img src={post.photo_url} alt="Post" className="max-w-xs md:max-w-md max-h-64 rounded-xl object-cover border shadow-sm" /></div>}
                {post.audio_url && <div className="bg-slate-50 p-2 rounded-xl inline-block border"><audio controls src={post.audio_url} className="h-10"></audio></div>}
              </div>
            );
          })
        )}
      </div>

      <div className="bg-white p-4 border-t shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-10 shrink-0">
        {(imageFile || audioUrl) && (
          <div className="flex gap-3 mb-3">
            {imageFile && (
              <div className="relative inline-block">
                <img src={URL.createObjectURL(imageFile)} alt="Preview" className="h-16 w-16 object-cover rounded-lg border shadow-sm" />
                <button onClick={() => setImageFile(null)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow"><X size={12}/></button>
              </div>
            )}
            {audioUrl && (
              <div className="relative flex items-center bg-blue-50 border border-blue-100 rounded-lg pr-8 pl-2">
                <audio controls src={audioUrl} className="h-8"></audio>
                <button onClick={() => { setAudioUrl(null); setAudioBlob(null); }} className="absolute right-2 text-red-500 hover:text-red-700"><X size={16}/></button>
              </div>
            )}
          </div>
        )}

        <div className="flex items-end gap-2">
          <label className="p-3 bg-slate-100 text-slate-500 hover:bg-slate-200 rounded-xl cursor-pointer transition-colors shadow-sm border">
            <ImageIcon size={22} />
            <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) setImageFile(e.target.files[0]); }} />
          </label>
          <button onClick={isRecording ? stopRecording : startRecording} className={`p-3 rounded-xl transition-all shadow-sm border ${isRecording ? 'bg-red-500 text-white animate-pulse' : 'bg-slate-100 text-slate-500 hover:bg-slate-200'}`} title={isRecording ? "အသံဖမ်းရပ်မည်" : "အသံဖမ်းမည်"}>
            {isRecording ? <Square size={22} fill="currentColor" /> : <Mic size={22} />}
          </button>
          <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="သတင်းပို့ချက် သို့မဟုတ် ညွှန်ကြားချက် ရိုက်ထည့်ပါ..." className="flex-1 bg-slate-50 border border-slate-200 rounded-xl p-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all font-medium resize-none min-h-[50px] max-h-32" rows={1} />
          <button onClick={handleSubmit} disabled={isSubmitting} className="p-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-all disabled:opacity-50 flex items-center gap-2">
            <Send size={22} /> <span className="hidden sm:inline font-bold">{isSubmitting ? 'ပို့နေသည်...' : 'ပို့မည်'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
