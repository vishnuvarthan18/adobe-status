'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';

// ─────────────────────────── helpers ───────────────────────────
const todayStr = () => new Date().toISOString().split('T')[0];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}
function fmtTime(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}
function isExpired(row) {
  if (row.plan_type === 'lifetime') return false;
  if (row.status !== 'active') return true;
  return row.expires_at && new Date(row.expires_at) < new Date();
}

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white appearance-none';
const selectCls = 'px-2.5 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-600 text-xs font-medium outline-none focus:border-blue-400 cursor-pointer appearance-none';

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

// Status badge used in multiple tabs
function Badge({ color, label }) {
  const colors = {
    green:  'bg-green-50 border-green-200 text-green-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-700',
    gray:   'bg-gray-50 border-gray-200 text-gray-500',
    violet: 'bg-violet-50 border-violet-200 text-violet-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    orange: 'bg-orange-50 border-orange-200 text-orange-700',
  };
  return (
    <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${colors[color] || colors.gray}`}>{label}</span>
  );
}

const ACTION_LABELS = {
  subscription_request_created: 'Request submitted',
  subscription_approved:        'Subscription approved',
  subscription_rejected:        'Subscription rejected',
  revoke_request_created:       'Revoke requested',
  revoke_approved:              'Revoke approved',
  revoke_rejected:              'Revoke rejected',
  credits_recharged:            'Credits recharged',
};

// ─────────────────────────── main component ───────────────────
export default function AdminDashboard() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState('users');

  // ── existing add-user form ──
  const [name,      setName]      = useState('');
  const [email,     setEmail]     = useState('');
  const [planType,  setPlanType]  = useState('yearly');
  const [startDate, setStartDate] = useState(todayStr());
  const [loading,   setLoading]   = useState(false);
  const [msg,       setMsg]       = useState(null);

  // ── data ──
  const [users,    setUsers]    = useState([]);
  const [requests, setRequests] = useState([]);
  const [revokes,  setRevokes]  = useState([]);
  const [clients,  setClients]  = useState([]);
  const [logs,     setLogs]     = useState([]);
  const [deletingId, setDeletingId] = useState(null);

  // ── filters (users tab) ──
  const [search,       setSearch]       = useState('');
  const [filterPlan,   setFilterPlan]   = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // ── recharge modal ──
  const [rechargeClient,  setRechargeClient]  = useState(null);
  const [rechargeAmount,  setRechargeAmount]  = useState(5);
  const [rechargeLoading, setRechargeLoading] = useState(false);
  const [rechargeMsg,     setRechargeMsg]     = useState(null);

  // ── action loading states ──
  const [processingId, setProcessingId] = useState(null);

  const fetchAll = useCallback(async () => {
    try {
      const [rUsers, rReq, rRev, rClients, rLogs] = await Promise.all([
        fetch('/api/users'),
        fetch('/api/admin/requests'),
        fetch('/api/admin/revoke'),
        fetch('/api/admin/clients'),
        fetch('/api/admin/logs'),
      ]);
      const [dU, dR, dRv, dC, dL] = await Promise.all([
        rUsers.json(), rReq.json(), rRev.json(), rClients.json(), rLogs.json(),
      ]);
      setUsers(dU.users || []);
      setRequests(dR.requests || []);
      setRevokes(dRv.requests || []);
      setClients(dC.clients || []);
      setLogs(dL.logs || []);
    } catch {}
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('adminLoggedIn')) { router.push('/admin'); return; }
    fetchAll();
  }, [fetchAll, router]);

  // ── filtered users ──
  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return users.filter(row => {
      if (q && !((row.users?.name || '').toLowerCase().includes(q)) && !((row.users?.email || '').toLowerCase().includes(q))) return false;
      if (filterPlan   !== 'all' && row.plan_type !== filterPlan) return false;
      if (filterStatus === 'active'  && isExpired(row))  return false;
      if (filterStatus === 'expired' && !isExpired(row)) return false;
      return true;
    });
  }, [users, search, filterPlan, filterStatus]);

  // ── existing add-user ──
  const handleAdd = async e => {
    e.preventDefault();
    setLoading(true); setMsg(null);
    try {
      const r = await fetch('/api/add-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, planType, startDate }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setMsg({ ok: false, text: d.error || 'Something went wrong.' });
      } else {
        setMsg({ ok: true, text: 'User added successfully.' });
        setName(''); setEmail(''); setPlanType('yearly'); setStartDate(todayStr());
        fetchAll();
      }
    } catch (err) { setMsg({ ok: false, text: err.message }); }
    setLoading(false);
  };

  // ── existing delete ──
  const handleDelete = async (subId, userId) => {
    if (!confirm('Remove this user and their subscription?')) return;
    setDeletingId(subId);
    try {
      const r = await fetch('/api/users', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscriptionId: subId, userId }),
      });
      const d = await r.json();
      if (!r.ok || d.error) alert(d.error || 'Delete failed.');
      else fetchAll();
    } catch (err) { alert(err.message); }
    setDeletingId(null);
  };

  // ── approve / reject subscription request ──
  const handleRequest = async (requestId, action) => {
    setProcessingId(requestId);
    try {
      const r = await fetch('/api/admin/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId, action }),
      });
      const d = await r.json();
      if (!r.ok || d.error) alert(d.error || 'Action failed.');
      else fetchAll();
    } catch (err) { alert(err.message); }
    setProcessingId(null);
  };

  // ── approve / reject revoke request ──
  const handleRevoke = async (revokeId, action) => {
    setProcessingId(revokeId);
    try {
      const r = await fetch('/api/admin/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ revokeId, action }),
      });
      const d = await r.json();
      if (!r.ok || d.error) alert(d.error || 'Action failed.');
      else fetchAll();
    } catch (err) { alert(err.message); }
    setProcessingId(null);
  };

  // ── recharge credits ──
  const handleRecharge = async () => {
    if (!rechargeClient || rechargeAmount <= 0) return;
    setRechargeLoading(true); setRechargeMsg(null);
    try {
      const r = await fetch('/api/admin/clients', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clientId: rechargeClient.id, amount: parseInt(rechargeAmount, 10) }),
      });
      const d = await r.json();
      if (!r.ok || d.error) {
        setRechargeMsg({ ok: false, text: d.error });
      } else {
        setRechargeMsg({ ok: true, text: `+${rechargeAmount} credits added. New balance: ${d.newBalance}` });
        fetchAll();
      }
    } catch (err) { setRechargeMsg({ ok: false, text: err.message }); }
    setRechargeLoading(false);
  };

  const logout = () => { localStorage.removeItem('adminLoggedIn'); router.push('/admin'); };

  // badge counts for tab labels
  const pendingRequestCount = requests.filter(r => r.status === 'pending').length;
  const pendingRevokeCount  = revokes.filter(r => r.status === 'pending').length;

  const TABS = [
    { key: 'users',    label: 'Users',             badge: null },
    { key: 'requests', label: 'Pending Requests',  badge: pendingRequestCount },
    { key: 'revokes',  label: 'Revoke Requests',   badge: pendingRevokeCount },
    { key: 'clients',  label: 'Client Accounts',   badge: null },
    { key: 'logs',     label: 'Activity Log',      badge: null },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">

      {/* ── Header ── */}
      <header className="sticky top-0 z-10 h-14 sm:h-16 bg-slate-900/90 backdrop-blur border-b border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src="/logo.svg" alt="Big Membres" className="h-8 sm:h-9 w-auto" />
          <span className="hidden sm:inline text-xs font-semibold text-slate-400 bg-white/[0.07] border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">
            Admin Panel
          </span>
        </div>
        <button onClick={logout}
          className="px-3 sm:px-4 py-2 min-h-[40px] bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer">
          Logout
        </button>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">

        <div className="mb-6">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 mb-1">Admin Dashboard</h1>
          <p className="text-sm text-slate-400">Big Membres · Subscription Management</p>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex flex-wrap gap-1 bg-white/10 rounded-xl p-1 mb-6 w-fit">
          {TABS.map(({ key, label, badge }) => (
            <button key={key} onClick={() => setActiveTab(key)}
              className={`relative px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-lg transition-all cursor-pointer whitespace-nowrap ${
                activeTab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-slate-300 hover:text-white'
              }`}>
              {label}
              {badge > 0 && (
                <span className="ml-1.5 bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{badge}</span>
              )}
            </button>
          ))}
        </div>

        {/* ══════════════════════════════════════════════
            TAB: Users  (existing functionality)
        ══════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 lg:gap-6 items-start">

            {/* Add User form */}
            <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-2xl">
              <h2 className="text-base font-bold text-gray-900 mb-5">Add User Directly</h2>
              <form onSubmit={handleAdd} className="flex flex-col gap-4">
                <FormField label="Full name">
                  <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required className={inputCls} />
                </FormField>
                <FormField label="Email address">
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" required className={inputCls} />
                </FormField>
                <FormField label="Plan type">
                  <select value={planType} onChange={e => setPlanType(e.target.value)} className={`${inputCls} cursor-pointer`}>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                </FormField>
                <FormField label="Start date">
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={inputCls} />
                </FormField>
                <button type="submit" disabled={loading}
                  className="mt-1 py-3 min-h-[48px] bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-75 text-white text-sm font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed">
                  {loading ? 'Adding…' : 'Add User'}
                </button>
                {msg && (
                  <div className={`p-3 rounded-xl border text-sm ${msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                    {msg.ok ? '✓ ' : '✕ '}{msg.text}
                  </div>
                )}
              </form>
            </div>

            {/* Users table */}
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-100">
                <div className="flex flex-wrap items-center gap-3">
                  <h2 className="text-base font-bold text-gray-900 shrink-0">
                    Users <span className="font-normal text-gray-400">({filtered.length})</span>
                  </h2>
                  <div className="relative flex-1 min-w-[160px]">
                    <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                      <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    </svg>
                    <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name or email…"
                      className="w-full pl-7 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-700 text-xs outline-none focus:border-blue-400 focus:bg-white placeholder:text-gray-400" />
                  </div>
                  <select value={filterPlan} onChange={e => setFilterPlan(e.target.value)} className={selectCls}>
                    <option value="all">All plans</option>
                    <option value="yearly">Yearly</option>
                    <option value="lifetime">Lifetime</option>
                  </select>
                  <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className={selectCls}>
                    <option value="all">All statuses</option>
                    <option value="active">Active</option>
                    <option value="expired">Expired</option>
                  </select>
                  <button onClick={fetchAll} className="shrink-0 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 cursor-pointer">Refresh</button>
                </div>
              </div>

              {filtered.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-gray-400">
                  {users.length === 0 ? 'No users yet' : 'No users match your filters'}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse min-w-[560px]">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Name', 'Email', 'Plan', 'Start', 'Expires', 'Status', ''].map(h => (
                          <th key={h} className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map((row, i) => {
                        const expired = isExpired(row);
                        return (
                          <tr key={row.id} className={`transition-colors hover:bg-gray-50 ${i < filtered.length - 1 ? 'border-b border-gray-50' : ''}`}>
                            <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">{row.users?.name || '—'}</td>
                            <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{row.users?.email || '—'}</td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <Badge color={row.plan_type === 'lifetime' ? 'violet' : 'blue'} label={row.plan_type} />
                            </td>
                            <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmt(row.activated_at)}</td>
                            <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
                              {row.plan_type === 'lifetime' ? <span className="text-gray-300">—</span> : fmt(row.expires_at)}
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <Badge color={expired ? 'red' : 'green'} label={expired ? 'Expired' : 'Active'} />
                            </td>
                            <td className="px-4 sm:px-5 py-3.5">
                              <button onClick={() => handleDelete(row.id, row.user_id)} disabled={deletingId === row.id}
                                className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 min-h-[32px]">
                                {deletingId === row.id ? '…' : 'Remove'}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Pending Requests
        ══════════════════════════════════════════════ */}
        {activeTab === 'requests' && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Subscription Requests</h2>
                <p className="text-xs text-gray-400 mt-0.5">Submitted by Client X — approve to activate, reject to refund credit</p>
              </div>
              <button onClick={fetchAll} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 cursor-pointer">Refresh</button>
            </div>

            {requests.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">No requests yet</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[700px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['From Client', 'User Name', 'User Email', 'Plan', 'Start Date', 'Requested', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req, i) => (
                      <tr key={req.id} className={`transition-colors hover:bg-gray-50 ${i < requests.length - 1 ? 'border-b border-gray-50' : ''}`}>
                        <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{req.clients?.name || '—'}</td>
                        <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">{req.user_name}</td>
                        <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{req.user_email}</td>
                        <td className="px-4 sm:px-5 py-3.5">
                          <Badge color={req.plan_type === 'lifetime' ? 'violet' : 'blue'} label={req.plan_type} />
                        </td>
                        <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmt(req.start_date)}</td>
                        <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtTime(req.requested_at)}</td>
                        <td className="px-4 sm:px-5 py-3.5">
                          <Badge
                            color={req.status === 'approved' ? 'green' : req.status === 'rejected' ? 'red' : req.status === 'revoked' ? 'gray' : 'yellow'}
                            label={req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                          />
                        </td>
                        <td className="px-4 sm:px-5 py-3.5">
                          {req.status === 'pending' ? (
                            <div className="flex gap-2">
                              <button onClick={() => handleRequest(req.id, 'approve')} disabled={processingId === req.id}
                                className="text-xs font-semibold px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                                {processingId === req.id ? '…' : 'Approve'}
                              </button>
                              <button onClick={() => handleRequest(req.id, 'reject')} disabled={processingId === req.id}
                                className="text-xs font-semibold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                                Reject
                              </button>
                            </div>
                          ) : <span className="text-xs text-gray-300">Done</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Revoke Requests
        ══════════════════════════════════════════════ */}
        {activeTab === 'revokes' && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Revoke Requests</h2>
                <p className="text-xs text-gray-400 mt-0.5">Approve to cancel subscription and refund credit · Reject to keep subscription active</p>
              </div>
              <button onClick={fetchAll} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 cursor-pointer">Refresh</button>
            </div>

            {revokes.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">No revoke requests</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[680px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['From Client', 'User', 'Email', 'Requested', 'Window Expires', 'Status', 'Actions'].map(h => (
                        <th key={h} className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap uppercase tracking-wider">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {revokes.map((rev, i) => {
                      const windowExpired = rev.revoke_window_expires_at && new Date(rev.revoke_window_expires_at) < Date.now();
                      return (
                        <tr key={rev.id} className={`transition-colors hover:bg-gray-50 ${i < revokes.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-700 whitespace-nowrap">{rev.clients?.name || '—'}</td>
                          <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">{rev.user_name}</td>
                          <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{rev.user_email}</td>
                          <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmtTime(rev.requested_at)}</td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <span className={`text-xs font-semibold ${windowExpired ? 'text-red-500' : 'text-orange-600'}`}>
                              {fmtTime(rev.revoke_window_expires_at)}
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <Badge
                              color={rev.status === 'approved' ? 'green' : rev.status === 'rejected' ? 'red' : 'yellow'}
                              label={rev.status.charAt(0).toUpperCase() + rev.status.slice(1)}
                            />
                          </td>
                          <td className="px-4 sm:px-5 py-3.5">
                            {rev.status === 'pending' ? (
                              <div className="flex gap-2">
                                <button onClick={() => handleRevoke(rev.id, 'approve')} disabled={processingId === rev.id}
                                  className="text-xs font-semibold px-2.5 py-1.5 bg-green-500 hover:bg-green-600 text-white rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                                  {processingId === rev.id ? '…' : 'Approve'}
                                </button>
                                <button onClick={() => handleRevoke(rev.id, 'reject')} disabled={processingId === rev.id}
                                  className="text-xs font-semibold px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200 rounded-lg cursor-pointer disabled:opacity-50 transition-colors">
                                  Reject
                                </button>
                              </div>
                            ) : <span className="text-xs text-gray-300">Done</span>}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Client Accounts
        ══════════════════════════════════════════════ */}
        {activeTab === 'clients' && (
          <div>
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
              <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <div>
                  <h2 className="text-base font-bold text-gray-900">Client Accounts</h2>
                  <p className="text-xs text-gray-400 mt-0.5">Recharge credits to allow clients to add more users</p>
                </div>
                <button onClick={fetchAll} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 cursor-pointer">Refresh</button>
              </div>

              {clients.length === 0 ? (
                <div className="px-6 py-16 text-center text-sm text-gray-400">No client accounts</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full border-collapse">
                    <thead>
                      <tr className="bg-gray-50">
                        {['Name', 'Email', 'Credits', 'Joined', 'Action'].map(h => (
                          <th key={h} className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap uppercase tracking-wider">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {clients.map((cl, i) => (
                        <tr key={cl.id} className={`transition-colors hover:bg-gray-50 ${i < clients.length - 1 ? 'border-b border-gray-50' : ''}`}>
                          <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-900">{cl.name}</td>
                          <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500">{cl.email}</td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <span className={`text-sm font-bold ${cl.credits > 5 ? 'text-green-600' : cl.credits > 0 ? 'text-yellow-600' : 'text-red-500'}`}>
                              {cl.credits} credits
                            </span>
                          </td>
                          <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmt(cl.created_at)}</td>
                          <td className="px-4 sm:px-5 py-3.5">
                            <button onClick={() => { setRechargeClient(cl); setRechargeAmount(5); setRechargeMsg(null); }}
                              className="text-xs font-semibold px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 rounded-lg cursor-pointer transition-colors">
                              Recharge
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Recharge modal */}
            {rechargeClient && (
              <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                <div className="bg-white rounded-2xl p-6 shadow-2xl w-full max-w-sm" style={{ animation: 'fadeInUp 0.2s ease' }}>
                  <h3 className="text-base font-bold text-gray-900 mb-1">Recharge Credits</h3>
                  <p className="text-sm text-gray-500 mb-5">
                    Client: <strong>{rechargeClient.name}</strong> · Current: <strong>{rechargeClient.credits} credits</strong>
                  </p>
                  <FormField label="Credits to add">
                    <input type="number" min="1" max="1000" value={rechargeAmount}
                      onChange={e => setRechargeAmount(e.target.value)}
                      className={inputCls} />
                  </FormField>
                  {rechargeMsg && (
                    <div className={`mt-3 p-3 rounded-xl border text-sm ${rechargeMsg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                      {rechargeMsg.ok ? '✓ ' : '✕ '}{rechargeMsg.text}
                    </div>
                  )}
                  <div className="flex gap-2 mt-5">
                    <button onClick={handleRecharge} disabled={rechargeLoading}
                      className="flex-1 py-2.5 bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white text-sm font-bold rounded-xl cursor-pointer disabled:opacity-70">
                      {rechargeLoading ? 'Adding…' : `Add ${rechargeAmount} credits`}
                    </button>
                    <button onClick={() => setRechargeClient(null)}
                      className="px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-semibold rounded-xl cursor-pointer">
                      Cancel
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════
            TAB: Activity Log
        ══════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-gray-900">Activity Log</h2>
                <p className="text-xs text-gray-400 mt-0.5">All admin and client actions — last 200 entries</p>
              </div>
              <button onClick={fetchAll} className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 cursor-pointer">Refresh</button>
            </div>

            {logs.length === 0 ? (
              <div className="px-6 py-16 text-center text-sm text-gray-400">No activity yet</div>
            ) : (
              <div className="divide-y divide-gray-50">
                {logs.map(log => (
                  <div key={log.id} className="px-5 sm:px-6 py-4 flex items-start gap-3 hover:bg-gray-50 transition-colors">
                    {/* Actor icon */}
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5 ${
                      log.actor_type === 'admin'  ? 'bg-blue-100 text-blue-700'
                      : log.actor_type === 'client' ? 'bg-violet-100 text-violet-700'
                      :                              'bg-gray-100 text-gray-500'
                    }`}>
                      {log.actor_name ? log.actor_name[0].toUpperCase() : '?'}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-semibold text-gray-900">{log.actor_name || log.actor_type}</span>
                        <Badge
                          color={log.actor_type === 'admin' ? 'blue' : log.actor_type === 'client' ? 'violet' : 'gray'}
                          label={log.actor_type}
                        />
                      </div>
                      <p className="text-sm text-gray-600 mt-0.5">{ACTION_LABELS[log.action] || log.action}</p>
                      {log.details && Object.keys(log.details).length > 0 && (
                        <p className="text-xs text-gray-400 mt-1 font-mono truncate">
                          {Object.entries(log.details)
                            .filter(([k]) => !['request_id','subscription_id','revoke_id','client_id'].includes(k))
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ')}
                        </p>
                      )}
                    </div>

                    <span className="text-xs text-gray-400 shrink-0 whitespace-nowrap">{fmtTime(log.created_at)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
