'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function Countdown({ expiresAt, expiredLabel = 'Expired', color = 'amber' }) {
  const [remaining, setRemaining] = useState('');
  useEffect(() => {
    const update = () => {
      const diff = new Date(expiresAt) - Date.now();
      if (diff <= 0) { setRemaining(expiredLabel); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setRemaining(`${h}h ${m}m ${s}s`);
    };
    update();
    const t = setInterval(update, 1000);
    return () => clearInterval(t);
  }, [expiresAt, expiredLabel]);
  const expired = new Date(expiresAt) <= Date.now();
  const cls = expired
    ? 'text-zinc-600'
    : color === 'blue' ? 'text-blue-400' : 'text-amber-400';
  return (
    <span className={`font-mono text-xs font-bold ${cls}`}>
      {remaining || '—'}
    </span>
  );
}

const STATUS_STYLES = {
  queued:         'bg-zinc-700/50  border-zinc-600     text-zinc-300',
  pending:        'bg-amber-400/10 border-amber-400/30 text-amber-400',
  approved:       'bg-green-500/10 border-green-500/30 text-green-400',
  rejected:       'bg-red-500/10   border-red-500/30   text-red-400',
  revoked:        'bg-zinc-700/50  border-zinc-600     text-zinc-400',
  revoke_pending: 'bg-orange-500/10 border-orange-500/30 text-orange-400',
};
const STATUS_LABELS = {
  queued: 'Queued', pending: 'Pending', approved: 'Active',
  rejected: 'Rejected', revoked: 'Revoked', revoke_pending: 'Refund Sent',
};

function StatusBadge({ status }) {
  return (
    <span className={`text-xs font-semibold px-2.5 py-1 rounded-md border ${STATUS_STYLES[status] || STATUS_STYLES.pending}`}>
      {STATUS_LABELS[status] || status}
    </span>
  );
}

const inputCls = 'w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm outline-none transition-all focus:border-amber-400 focus:ring-1 focus:ring-amber-400/20 placeholder:text-zinc-600 appearance-none';

// ── Nav items ──
const NAV = [
  {
    key: 'add',
    label: 'Add User',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
        <circle cx="9" cy="7" r="4"/>
        <line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/>
      </svg>
    ),
  },
  {
    key: 'requests',
    label: 'My Requests',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
        <rect x="9" y="3" width="6" height="4" rx="1"/>
        <line x1="9" y1="12" x2="15" y2="12"/><line x1="9" y1="16" x2="13" y2="16"/>
      </svg>
    ),
  },
  {
    key: 'credits',
    label: 'Credit History',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
      </svg>
    ),
  },
];

export default function ClientDashboard() {
  const router = useRouter();
  const [session, setSession]           = useState(null);
  const [activeTab, setActiveTab]       = useState('add');
  const [sidebarOpen, setSidebarOpen]   = useState(false);

  const [name, setName]                 = useState('');
  const [email, setEmail]               = useState('');
  const [addLoading, setAddLoading]     = useState(false);
  const [addMsg, setAddMsg]             = useState(null);

  const [requests, setRequests]         = useState([]);
  const [credits, setCredits]           = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [dataLoading, setDataLoading]   = useState(true);
  const [revokingId, setRevokingId]     = useState(null);
  const [cancellingId, setCancellingId] = useState(null);

  const fetchData = useCallback(async (clientId, isInitial = false) => {
    if (isInitial) setDataLoading(true);
    try {
      const [rReq, rCred] = await Promise.all([
        fetch(`/api/my-requests?clientId=${clientId}`),
        fetch(`/api/credits?clientId=${clientId}`),
      ]);
      const [dReq, dCred] = await Promise.all([rReq.json(), rCred.json()]);
      const newRequests     = dReq.requests     || [];
      const newCredits      = dCred.credits     ?? 0;
      const newTransactions = dCred.transactions || [];

      // Only re-render if data actually changed
      setRequests(prev => {
        const sig = r => `${r.id}:${r.status}:${r.has_revoke_request}`;
        return JSON.stringify(prev.map(sig)) !== JSON.stringify(newRequests.map(sig))
          ? newRequests : prev;
      });
      setCredits(prev => prev !== newCredits ? newCredits : prev);
      setTransactions(prev =>
        JSON.stringify(prev.map(t => t.id)) !== JSON.stringify(newTransactions.map(t => t.id))
          ? newTransactions : prev
      );
    } catch {}
    if (isInitial) setDataLoading(false);
  }, []);

  useEffect(() => {
    const s = localStorage.getItem('clientSession');
    if (!s) { router.push('/'); return; }
    const parsed = JSON.parse(s);
    setSession(parsed);
    fetchData(parsed.id, true);

    // Poll every 10s but only re-render when data actually changes
    const interval = setInterval(() => fetchData(parsed.id, false), 10000);
    return () => clearInterval(interval);
  }, [fetchData, router]);

  const handleAdd = async (e) => {
    e.preventDefault();
    if (credits !== null && credits <= 0) {
      setAddMsg({ ok: false, text: 'No credits left. Contact admin to recharge.' });
      return;
    }
    setAddLoading(true); setAddMsg(null);
    try {
      const r = await fetch('/api/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: session.id, name, email, planType: 'yearly' }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setAddMsg({ ok: false, text: d.error || 'Failed to submit.' });
      } else {
        setAddMsg({ ok: true, text: 'Request submitted — waiting for admin approval. 1 credit deducted.' });
        setName(''); setEmail('');
        fetchData(session.id, true);
      }
    } catch (err) {
      setAddMsg({ ok: false, text: err.message });
    }
    setAddLoading(false);
  };

  const handleRevoke = async (requestId, userEmail) => {
    if (!confirm(`Submit a refund request for ${userEmail}?\n\nThis is only available within 12 hours of approval. If the admin approves, your credit will be returned.`)) return;
    setRevokingId(requestId);
    try {
      const r = await fetch('/api/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: session.id, subscriptionRequestId: requestId }),
      });
      const d = await r.json();
      if (!r.ok || d.error) alert(d.error || 'Revoke request failed.');
      else fetchData(session.id);
    } catch (err) { alert(err.message); }
    setRevokingId(null);
  };

  const handleCancel = async (requestId, userEmail) => {
    if (!confirm(`Cancel the request for ${userEmail}?\n\nYour credit will be refunded immediately.`)) return;
    setCancellingId(requestId);
    try {
      const r = await fetch('/api/cancel-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: session.id, requestId }),
      });
      const d = await r.json();
      if (!r.ok || d.error) alert(d.error || 'Cancel failed.');
      else fetchData(session.id, true);
    } catch (err) { alert(err.message); }
    setCancellingId(null);
  };

  const logout = () => { localStorage.removeItem('clientSession'); router.push('/'); };

  const now = Date.now();
  const pendingCount = requests.filter(r =>
    r.status === 'pending' && !(r.queued_until && new Date(r.queued_until) > now)
  ).length;
  const currentNav = NAV.find(n => n.key === activeTab);

  if (!session) return null;

  return (
    <div className="h-screen flex overflow-hidden bg-zinc-950">

      {/* ── Mobile overlay ── */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/60 z-20 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ════════════════════════════════
          SIDEBAR
      ════════════════════════════════ */}
      <aside className={`
        fixed lg:static inset-y-0 left-0 z-30
        w-64 flex flex-col bg-zinc-900 border-r border-zinc-800
        transform transition-transform duration-300 ease-in-out
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>

        {/* Logo */}
        <div className="flex items-center justify-center px-6 py-6 border-b border-zinc-800">
          <img src="/logo.png" alt="MG Digital" className="h-16 w-auto" />
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          {NAV.map(({ key, label, icon }) => {
            const active = activeTab === key;
            return (
              <button
                key={key}
                onClick={() => { setActiveTab(key); setSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all cursor-pointer text-left ${
                  active
                    ? 'bg-amber-400/10 text-amber-400 border border-amber-400/20'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800 border border-transparent'
                }`}
              >
                <span className={active ? 'text-amber-400' : 'text-zinc-500'}>{icon}</span>
                {label}
                {key === 'requests' && pendingCount > 0 && (
                  <span className="ml-auto bg-amber-400 text-black text-xs font-bold px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Bottom: credits + account + logout */}
        <div className="px-3 pb-6 space-y-3 border-t border-zinc-800 pt-4">

          {/* Credits pill */}
          <div className={`flex items-center gap-2 px-4 py-3 rounded-xl border ${
            credits === null  ? 'bg-zinc-800 border-zinc-700'
            : credits > 5    ? 'bg-amber-400/10 border-amber-400/20'
            : credits > 0    ? 'bg-orange-500/10 border-orange-500/20'
            :                  'bg-red-500/10 border-red-500/20'
          }`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
              className={credits > 5 ? 'text-amber-400' : credits > 0 ? 'text-orange-400' : 'text-red-400'}>
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-bold ${credits > 5 ? 'text-amber-400' : credits > 0 ? 'text-orange-400' : 'text-red-400'}`}>
                {credits === null ? '…' : credits} credits
              </p>
              <p className="text-xs text-zinc-600">Available balance</p>
            </div>
          </div>

          {/* Account info */}
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-zinc-800/50">
            <div className="w-8 h-8 rounded-full bg-amber-400/20 border border-amber-400/30 flex items-center justify-center shrink-0">
              <span className="text-amber-400 text-xs font-bold">
                {session.name?.[0]?.toUpperCase() || 'A'}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">{session.name}</p>
              <p className="text-xs text-zinc-500 truncate">{session.email}</p>
            </div>
          </div>

          {/* Logout */}
          <button onClick={logout}
            className="w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-zinc-500 hover:text-red-400 hover:bg-red-500/10 text-sm font-semibold transition-all cursor-pointer border border-transparent hover:border-red-500/20">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/>
              <polyline points="16 17 21 12 16 7"/>
              <line x1="21" y1="12" x2="9" y2="12"/>
            </svg>
            Sign out
          </button>
        </div>
      </aside>

      {/* ════════════════════════════════
          MAIN CONTENT
      ════════════════════════════════ */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">

        {/* Top bar (mobile hamburger + page title) */}
        <div className="shrink-0 h-16 bg-zinc-900 border-b border-zinc-800 flex items-center gap-4 px-4 sm:px-6">
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden text-zinc-400 hover:text-white cursor-pointer">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="18" x2="21" y2="18"/>
            </svg>
          </button>
          <div className="flex items-center gap-2 text-zinc-500">
            <span className="text-amber-400">{currentNav?.icon}</span>
            <h1 className="text-base font-semibold text-white">{currentNav?.label}</h1>
          </div>
        </div>

        {/* Scrollable page content */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">

          {/* ══ ADD USER ══ */}
          {activeTab === 'add' && (
            <div className="max-w-lg">
              <div className="mb-6">
                <h2 className="text-2xl font-bold text-white">Add User</h2>
                <p className="text-sm text-zinc-500 mt-1">Submit a subscription request for a new user</p>
              </div>

              <div className="bg-zinc-900 rounded-2xl border border-zinc-800 p-6 shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <p className="text-sm text-zinc-400">1 credit will be deducted on submit</p>
                  <span className={`text-xs font-bold px-3 py-1.5 rounded-lg border ${
                    credits > 0
                      ? 'bg-amber-400/10 border-amber-400/30 text-amber-400'
                      : 'bg-red-500/10 border-red-500/30 text-red-400'
                  }`}>
                    {credits ?? '…'} credits left
                  </span>
                </div>

                <form onSubmit={handleAdd} className="flex flex-col gap-5">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Full name</label>
                    <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required className={inputCls} />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">Email address</label>
                    <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" required className={inputCls} />
                  </div>
                  <div className="px-4 py-3 bg-zinc-800/60 rounded-xl border border-zinc-700/50 flex items-center justify-between">
                    <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">Plan</span>
                    <span className="text-sm font-bold text-amber-400">Yearly</span>
                  </div>

                  {addMsg && (
                    <div className={`p-4 rounded-xl border text-sm ${
                      addMsg.ok
                        ? 'bg-green-500/10 border-green-500/30 text-green-400'
                        : 'bg-red-500/10 border-red-500/30 text-red-400'
                    }`}>
                      {addMsg.ok ? '✓ ' : '✕ '}{addMsg.text}
                    </div>
                  )}

                  <button type="submit" disabled={addLoading || credits === 0}
                    className="py-3.5 min-h-[52px] bg-amber-400 hover:bg-amber-300 disabled:opacity-40 text-black text-sm font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed">
                    {addLoading ? 'Submitting…' : 'Submit Request'}
                  </button>
                </form>
              </div>

              <div className="mt-4 p-4 bg-zinc-900/50 rounded-xl border border-zinc-800/50">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  <span className="text-zinc-300 font-semibold">How it works:</span> Submitting deducts 1 credit immediately. Admin reviews and approves — the subscription start date is set at the time of approval, not submission. Once approved, your user gets an activation email. You can submit a refund request within <span className="text-amber-400 font-semibold">12 hours</span> of approval.
                </p>
              </div>
            </div>
          )}

          {/* ══ MY REQUESTS ══ */}
          {activeTab === 'requests' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">My Requests</h2>
                  <p className="text-sm text-zinc-500 mt-1">{requests.length} total request{requests.length !== 1 ? 's' : ''}</p>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1.5 text-xs text-zinc-600">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse inline-block" />
                    Live
                  </div>
                  <button onClick={() => fetchData(session.id)}
                    className="flex items-center gap-2 px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-xl text-zinc-400 text-sm font-medium hover:bg-zinc-700 hover:text-white transition-all cursor-pointer">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <path d="M23 4v6h-6"/><path d="M1 20v-6h6"/>
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
                    </svg>
                    Refresh
                  </button>
                </div>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-24 text-zinc-600 text-sm">Loading…</div>
              ) : requests.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-24 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2"/>
                      <rect x="9" y="3" width="6" height="4" rx="1"/>
                    </svg>
                  </div>
                  <p className="text-zinc-400 font-semibold mb-1">No requests yet</p>
                  <p className="text-zinc-600 text-sm">Add your first user using the Add User tab</p>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full border-collapse min-w-[720px]">
                      <thead>
                        <tr className="bg-zinc-800/60">
                          {['Name', 'Email', 'Submitted', 'Status', 'Refund timer', 'Action'].map(h => (
                            <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-zinc-500 border-b border-zinc-800 whitespace-nowrap uppercase tracking-wider">{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {requests.map((req, i) => {
                          const isQueued    = req.status === 'pending' && req.queued_until && new Date(req.queued_until) > Date.now();
                          const withinWindow = req.status === 'approved'
                            && req.revoke_window_expires_at
                            && new Date(req.revoke_window_expires_at) > Date.now();
                          const canRevoke   = withinWindow && !req.has_revoke_request;
                          const displayStatus = isQueued
                            ? 'queued'
                            : req.has_revoke_request ? 'revoke_pending' : req.status;
                          return (
                            <tr key={req.id} className={`transition-colors hover:bg-zinc-800/30 ${i < requests.length - 1 ? 'border-b border-zinc-800' : ''}`}>
                              <td className="px-5 py-4 text-sm font-semibold text-white whitespace-nowrap">{req.user_name}</td>
                              <td className="px-5 py-4 text-sm text-zinc-400 whitespace-nowrap">{req.user_email}</td>
                              <td className="px-5 py-4 text-sm text-zinc-400 whitespace-nowrap">{fmtTime(req.requested_at)}</td>
                              <td className="px-5 py-4">
                                <div className="flex flex-col gap-1">
                                  <StatusBadge status={displayStatus} />
                                  {isQueued && req.queued_until && (
                                    <span className="text-xs text-zinc-600">
                                      Opens <Countdown expiresAt={req.queued_until} expiredLabel="soon" color="blue" />
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="px-5 py-4">
                                {req.status === 'approved' && withinWindow ? (
                                  <Countdown expiresAt={req.revoke_window_expires_at} expiredLabel="—" color="amber" />
                                ) : (
                                  <span className="text-xs text-zinc-700">—</span>
                                )}
                              </td>
                              <td className="px-5 py-4">
                                {(isQueued || req.status === 'pending') && !req.has_revoke_request ? (
                                  // Not yet approved — client can cancel and get credit back
                                  <button
                                    onClick={() => handleCancel(req.id, req.user_email)}
                                    disabled={cancellingId === req.id}
                                    className="text-xs font-semibold text-red-400 hover:text-red-300 border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap">
                                    {cancellingId === req.id ? '…' : 'Cancel'}
                                  </button>
                                ) : canRevoke ? (
                                  // Approved + within 12h window — can request refund
                                  <button
                                    onClick={() => handleRevoke(req.id, req.user_email)}
                                    disabled={revokingId === req.id}
                                    className="text-xs font-semibold text-amber-400 hover:text-amber-300 border border-amber-400/30 bg-amber-400/10 hover:bg-amber-400/20 px-3 py-1.5 rounded-lg transition-all cursor-pointer disabled:opacity-50 whitespace-nowrap">
                                    {revokingId === req.id ? '…' : 'Submit for Refund'}
                                  </button>
                                ) : req.has_revoke_request ? (
                                  <span className="text-xs text-orange-400 font-medium">Refund Pending</span>
                                ) : (
                                  <span className="text-xs text-zinc-700">—</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ══ CREDIT HISTORY ══ */}
          {activeTab === 'credits' && (
            <div>
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-2xl font-bold text-white">Credit History</h2>
                  <p className="text-sm text-zinc-500 mt-1">
                    Current balance: <span className="text-amber-400 font-bold">{credits ?? '…'} credits</span>
                  </p>
                </div>
              </div>

              {/* Balance card */}
              <div className={`flex items-center gap-4 p-5 rounded-2xl border mb-6 ${
                credits > 5    ? 'bg-amber-400/5 border-amber-400/20'
                : credits > 0  ? 'bg-orange-500/5 border-orange-500/20'
                :                'bg-red-500/5 border-red-500/20'
              }`}>
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl font-black ${
                  credits > 5 ? 'bg-amber-400/20 text-amber-400' : credits > 0 ? 'bg-orange-500/20 text-orange-400' : 'bg-red-500/20 text-red-400'
                }`}>
                  {credits ?? '…'}
                </div>
                <div>
                  <p className="text-white font-bold text-lg">{credits ?? '…'} credits available</p>
                  <p className="text-zinc-500 text-sm">Contact admin to recharge your balance</p>
                </div>
              </div>

              {dataLoading ? (
                <div className="flex items-center justify-center py-16 text-zinc-600 text-sm">Loading…</div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-zinc-900 rounded-2xl flex items-center justify-center mb-4 border border-zinc-800">
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#52525b" strokeWidth="1.5" strokeLinecap="round">
                      <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                    </svg>
                  </div>
                  <p className="text-zinc-400 font-semibold">No transactions yet</p>
                </div>
              ) : (
                <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden">
                  <div className="divide-y divide-zinc-800">
                    {transactions.map(tx => (
                      <div key={tx.id} className="px-5 py-4 flex items-center gap-4 hover:bg-zinc-800/30 transition-colors">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                          tx.amount > 0
                            ? 'bg-green-500/10 text-green-400 border border-green-500/20'
                            : 'bg-red-500/10 text-red-400 border border-red-500/20'
                        }`}>
                          {tx.amount > 0 ? `+${tx.amount}` : tx.amount}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-white truncate">{tx.description}</p>
                          <p className="text-xs text-zinc-500 mt-0.5">{fmtTime(tx.created_at)}</p>
                        </div>
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg border capitalize shrink-0 ${
                          tx.type === 'recharge' ? 'bg-green-500/10 border-green-500/30 text-green-400'
                          : tx.type === 'refund' ? 'bg-blue-500/10  border-blue-500/30  text-blue-400'
                          :                        'bg-red-500/10   border-red-500/30   text-red-400'
                        }`}>
                          {tx.type}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
