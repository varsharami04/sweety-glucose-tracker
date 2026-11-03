import { useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChartNoAxesCombined, CirclePlus, HeartPulse, LogOut, Pencil, Trash2, X } from 'lucide-react';
import api, { apiError } from './api';

const slots = [
  { value: 'morning', label: 'Morning (fasting)' },
  { value: 'after_breakfast', label: 'After breakfast' },
  { value: 'after_lunch', label: 'After lunch' },
  { value: 'after_dinner', label: 'After dinner' }
];
const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
};
const prettyDate = value => value ? new Date(`${value}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
const emptyForm = () => ({ date: todayISO(), slot: 'morning', value: '' });

function AuthScreen({ onAuth }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault(); setError(''); setBusy(true);
    try {
      const endpoint = mode === 'login' ? '/auth/login' : '/auth/register';
      const { data } = await api.post(endpoint, form);
      localStorage.setItem('sweety_token', data.token);
      onAuth(data.user);
    } catch (err) { setError(apiError(err)); }
    finally { setBusy(false); }
  }
  return <main className="auth-shell">
    <div className="auth-brand"><div className="brand-icon"><HeartPulse size={27}/></div><span>Sweety</span></div>
    <section className="auth-card">
      <div className="eyebrow">YOUR HEALTH, IN YOUR HANDS</div>
      <h1>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
      <p className="muted">{mode === 'login' ? 'Sign in to keep track of your daily readings.' : 'Start building a clearer picture of your glucose.'}</p>
      <form onSubmit={submit} className="stack-form">
        {mode === 'register' && <label>Full name<input required autoComplete="name" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Your name"/></label>}
        <label>Email address<input type="email" required autoComplete="email" value={form.email} onChange={e=>setForm({...form,email:e.target.value})} placeholder="you@example.com"/></label>
        <label>Password<input type="password" required minLength="8" autoComplete={mode==='login'?'current-password':'new-password'} value={form.password} onChange={e=>setForm({...form,password:e.target.value})} placeholder="At least 8 characters"/></label>
        {error && <div className="error-box" role="alert">{error}</div>}
        <button className="primary-btn full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
      </form>
      <div className="auth-switch">{mode === 'login' ? 'New to Sweety?' : 'Already have an account?'} <button onClick={()=>{setMode(mode==='login'?'register':'login');setError('');}}>{mode==='login'?'Create an account':'Sign in'}</button></div>
      {mode==='login' && <div className="demo-hint"><strong>Demo account</strong><br/>demo@sweety.local · SweetyDemo123!</div>}
    </section>
    <p className="auth-foot">A simple companion for tracking, not a substitute for medical advice.</p>
  </main>;
}

function SummaryCard({ title, value, unit, detail, icon: Icon }) {
  return <article className="summary-card"><div className="summary-top"><span>{title}</span><span className="summary-icon"><Icon size={18}/></span></div><div className="summary-value">{value}<small>{unit}</small></div><p>{detail}</p></article>;
}

function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayISO());
  const [readings, setReadings] = useState([]);
  const [reports, setReports] = useState({});
  const [form, setForm] = useState(emptyForm());
  const [editingId, setEditingId] = useState(null);
  const [formError, setFormError] = useState('');
  const [pageError, setPageError] = useState('');
  const [busy, setBusy] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const token = localStorage.getItem('sweety_token');
    if (!token) { setAuthLoading(false); return; }
    api.get('/auth/me').then(({data})=>setUser(data.user)).catch(()=>localStorage.removeItem('sweety_token')).finally(()=>setAuthLoading(false));
  }, []);

  useEffect(() => {
    if (!user) return;
    let active = true;
    setPageError('');
    Promise.all([
      api.get('/readings', { params: { date: selectedDate } }),
      api.get('/reports/daily', { params: { date: selectedDate } }),
      api.get('/reports/month-to-date', { params: { date: selectedDate } }),
      api.get('/reports/previous-month', { params: { date: selectedDate } })
    ]).then(([all, daily, mtd, prev]) => {
      if (!active) return;
      setReadings(all.data.readings);
      setReports({ daily: daily.data, mtd: mtd.data, previous: prev.data });
    }).catch(err => { if (active) setPageError(apiError(err)); });
    return () => { active = false; };
  }, [user, selectedDate, refreshKey]);

  const dailySummary = reports.daily?.summary;
  const doneSlots = useMemo(()=>new Set(readings.map(r=>r.slot)),[readings]);

  function logout() {
    localStorage.removeItem('sweety_token'); setUser(null); setReadings([]); setReports({});
  }
  function startEdit(reading) {
    setEditingId(reading.id); setForm({ date: reading.date, slot: reading.slot, value: String(reading.value) }); setFormError('');
    document.getElementById('reading-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
  function cancelEdit() { setEditingId(null); setForm(emptyForm()); setFormError(''); }
  async function saveReading(e) {
    e.preventDefault(); setFormError(''); setBusy(true);
    try {
      if (!form.value.trim()) throw new Error('Please enter a glucose value.');
      if (!/^\d+$/.test(form.value) || Number(form.value)<40 || Number(form.value)>600) throw new Error('Value must be between 40 and 600 mg/dl.');
      if (form.date > todayISO()) throw new Error('Date cannot be in the future.');
      if (!form.date) throw new Error('Please select a valid date.');
      const payload = { ...form, value: Number(form.value) };
      if (editingId) await api.put(`/readings/${editingId}`, payload);
      else await api.post('/readings', payload);
      const savedDate = form.date;
      cancelEdit(); setSelectedDate(savedDate); setRefreshKey(k=>k+1);
    } catch (err) { setFormError(err.response ? apiError(err) : (err.message || 'Unable to save this reading.')); }
    finally { setBusy(false); }
  }
  async function deleteReading(id) {
    if (!window.confirm('Delete this reading? This cannot be undone.')) return;
    try { await api.delete(`/readings/${id}`); setRefreshKey(k=>k+1); }
    catch (err) { setPageError(apiError(err)); }
  }
  if (authLoading) return <div className="loading-screen">Loading Sweety…</div>;
  if (!user) return <AuthScreen onAuth={setUser}/>;

  const renderReport = (title, report, caption) => <article className="report-card">
    <div className="report-heading"><div><h3>{title}</h3><p>{report?.rangeLabel || caption}</p></div><ChartNoAxesCombined size={19}/></div>
    {report?.summary ? <div className="report-stats">
      <div><span>Highest</span><strong>{report.summary.highest}<small> mg/dL</small></strong></div>
      <div><span>Lowest</span><strong>{report.summary.lowest}<small> mg/dL</small></strong></div>
      <div><span>Average</span><strong>{Number(report.summary.average).toFixed(1)}<small> mg/dL</small></strong></div>
      <div><span>Readings</span><strong>{report.summary.count}</strong></div>
    </div> : <div className="empty-state compact"><div className="empty-circle"><Activity size={20}/></div><strong>No readings yet</strong><span>Add a reading to see your report.</span></div>}
  </article>;

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><div className="brand-icon"><HeartPulse size={23}/></div><span>Sweety</span></div>
      <div className="side-label">WORKSPACE</div>
      <div className="nav-item active"><Activity size={18}/> Glucose overview</div>
      <div className="sidebar-note"><div className="note-heart"><HeartPulse size={20}/></div><strong>Small steps matter</strong><p>Every reading helps you understand your patterns.</p></div>
      <div className="sidebar-user"><div className="avatar">{user.name?.charAt(0)?.toUpperCase() || 'U'}</div><div className="user-meta"><strong>{user.name}</strong><span>{user.email}</span></div><button title="Log out" className="icon-btn" onClick={logout}><LogOut size={17}/></button></div>
    </aside>
    <main className="main-content">
      <header className="topbar"><div><div className="eyebrow">HEALTH DASHBOARD</div><h1>Good to see you, {user.name?.split(' ')[0]} <span className="wave">✦</span></h1><p>Here’s your glucose snapshot. One day at a time.</p></div><div className="date-picker"><CalendarDays size={18}/><input aria-label="Select report date" type="date" max={todayISO()} value={selectedDate} onChange={e=>setSelectedDate(e.target.value)}/></div></header>
      {pageError && <div className="error-box page-error" role="alert">{pageError}<button onClick={()=>setPageError('')}><X size={15}/></button></div>}
      <section className="summary-grid">
        <SummaryCard title="Daily average" value={dailySummary ? Number(dailySummary.average).toFixed(1) : '—'} unit={dailySummary?'mg/dL':''} detail={dailySummary ? `${dailySummary.count} reading${dailySummary.count===1?'':'s'} on ${prettyDate(selectedDate)}` : 'No readings for this date'} icon={Activity}/>
        <SummaryCard title="Highest reading" value={dailySummary?.highest ?? '—'} unit={dailySummary?'mg/dL':''} detail="For the selected day" icon={ChartNoAxesCombined}/>
        <SummaryCard title="Lowest reading" value={dailySummary?.lowest ?? '—'} unit={dailySummary?'mg/dL':''} detail="For the selected day" icon={HeartPulse}/>
      </section>
      <section className="content-grid">
        <article className="panel reading-panel">
          <div className="section-heading"><div><div className="eyebrow">DAILY LOG</div><h2>{editingId?'Edit reading':'Your readings'}</h2><p>{prettyDate(selectedDate)} · {readings.length} of 4 slots filled</p></div><span className="count-pill">{readings.length}/4</span></div>
          <form id="reading-form" className="reading-form" onSubmit={saveReading}>
            <div className="form-row"><label>Date<input type="date" max={todayISO()} required value={form.date} onChange={e=>setForm({...form,date:e.target.value})}/></label><label>Time slot<select value={form.slot} onChange={e=>setForm({...form,slot:e.target.value})}>{slots.map(s=><option key={s.value} value={s.value}>{s.label}</option>)}</select></label></div>
            <label>Glucose value <span className="label-hint">(mg/dL)</span><div className="value-input"><input type="number" min="40" max="600" step="1" inputMode="numeric" placeholder="e.g. 110" value={form.value} onChange={e=>setForm({...form,value:e.target.value})}/><span>mg/dL</span></div></label>
            {formError && <div className="error-box" role="alert">{formError}</div>}
            <div className="form-actions"><button className="primary-btn" disabled={busy}>{busy?'Saving…':editingId?'Save changes':<><CirclePlus size={17}/> Add reading</>}</button>{editingId&&<button type="button" className="secondary-btn" onClick={cancelEdit}>Cancel</button>}</div>
          </form>
          <div className="divider"/>
          {readings.length ? <div className="reading-list">{readings.map(r=><div className="reading-row" key={r.id}><div className={`slot-dot ${r.slot}`}/><div className="reading-info"><strong>{r.slotLabel || slots.find(s=>s.value===r.slot)?.label}</strong><span>{prettyDate(r.date)}</span></div><div className="reading-number">{r.value}<small> mg/dL</small></div><div className="row-actions"><button className="icon-btn" title="Edit reading" onClick={()=>startEdit(r)}><Pencil size={16}/></button><button className="icon-btn danger" title="Delete reading" onClick={()=>deleteReading(r.id)}><Trash2 size={16}/></button></div></div>)}</div> : <div className="empty-state"><div className="empty-circle"><Activity size={24}/></div><strong>No readings for this day</strong><span>Add your first reading using the form above.</span></div>}
          <div className="slot-status"><span>Daily slots</span>{slots.map(s=><span key={s.value} className={doneSlots.has(s.value)?'slot-chip complete':'slot-chip'} title={s.label}>{doneSlots.has(s.value)?'✓':'○'} {s.label}</span>)}</div>
        </article>
        <div className="reports-column"><div className="reports-intro"><div className="eyebrow">YOUR TRENDS</div><h2>Reports at a glance</h2><p>Compare your readings across time periods.</p></div>
          {renderReport('Daily report',reports.daily,prettyDate(selectedDate))}
          {renderReport('Month to date',reports.mtd,'From the 1st to selected date')}
          {renderReport('Previous month',reports.previous,'Full previous calendar month')}
        </div>
      </section>
      <footer className="disclaimer"><HeartPulse size={16}/><span>Sweety is for tracking only and does not provide medical advice. Follow your healthcare professional’s guidance.</span></footer>
    </main>
  </div>;
}
export default App;
