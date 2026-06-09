'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const todayStr = () => new Date().toISOString().split('T')[0];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const inputCls = 'w-full px-3 py-2.5 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white appearance-none';

function FormField({ label, children }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  );
}

export default function AdminDashboard() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [planType, setPlanType] = useState('yearly');
  const [startDate, setStartDate] = useState(todayStr());
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [msg, setMsg] = useState(null);

  useEffect(() => {
    if (!localStorage.getItem('adminLoggedIn')) router.push('/admin');
    else fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const r = await fetch('/api/users');
      const d = await r.json();
      setUsers(d.users || []);
    } catch {}
  };

  const handleAdd = async e => {
    e.preventDefault();
    setLoading(true);
    setMsg(null);
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
        fetchUsers();
      }
    } catch (err) {
      setMsg({ ok: false, text: err.message });
    }
    setLoading(false);
  };

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
      else fetchUsers();
    } catch (err) { alert(err.message); }
    setDeletingId(null);
  };

  const logout = () => { localStorage.removeItem('adminLoggedIn'); router.push('/admin'); };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900">

      {/* Header */}
      <header className="sticky top-0 z-10 h-14 sm:h-16 bg-slate-900/90 backdrop-blur border-b border-white/10 flex items-center justify-between px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-2 sm:gap-3">
          <img src="/logo.svg" alt="Big Membres" className="h-8 sm:h-9 w-auto" />
          <span className="hidden sm:inline text-xs font-semibold text-slate-400 bg-white/[0.07] border border-white/10 px-2 py-0.5 rounded uppercase tracking-widest">
            Admin Panel
          </span>
        </div>
        <button
          onClick={logout}
          className="px-3 sm:px-4 py-2 min-h-[40px] bg-gradient-to-br from-red-600 to-red-500 hover:from-red-700 hover:to-red-600 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all duration-200 cursor-pointer"
        >
          Logout
        </button>
      </header>

      {/* Body */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 lg:py-10">

        <div className="mb-6 sm:mb-8">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-50 tracking-tight mb-1">
            Subscription Management
          </h1>
          <p className="text-sm text-slate-400">Add and manage Big Membres subscriptions</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-5 lg:gap-6 items-start">

          {/* Form card */}
          <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-2xl">
            <h2 className="text-base font-bold text-gray-900 mb-5 tracking-tight">Add User</h2>
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
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required className={`${inputCls} light-date`} />
              </FormField>

              <button
                type="submit"
                disabled={loading}
                className="mt-1 py-3 min-h-[48px] bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-75 text-white text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-not-allowed"
              >
                {loading ? 'Adding…' : 'Add User'}
              </button>

              {msg && (
                <div className={`p-3 rounded-xl border text-sm ${msg.ok ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {msg.ok ? '✓ ' : '✕ '}{msg.text}
                </div>
              )}
            </form>
          </div>

          {/* Table card */}
          <div className="bg-white rounded-2xl overflow-hidden shadow-2xl">
            <div className="px-5 sm:px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-base font-bold text-gray-900">
                Users <span className="font-normal text-gray-400">({users.length})</span>
              </h2>
              <button
                onClick={fetchUsers}
                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-gray-500 text-xs font-medium hover:bg-gray-100 transition-colors cursor-pointer"
              >
                Refresh
              </button>
            </div>

            {users.length === 0 ? (
              <div className="px-6 py-16 text-center">
                <p className="text-sm text-gray-400 mb-1">No users yet</p>
                <p className="text-xs text-gray-300">Add your first user using the form</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse min-w-[560px]">
                  <thead>
                    <tr className="bg-gray-50">
                      {['Name', 'Email', 'Plan', 'Start', 'Expires', 'Status', ''].map(h => (
                        <th key={h} className="text-left px-4 sm:px-5 py-3 text-xs font-semibold text-gray-400 border-b border-gray-100 whitespace-nowrap uppercase tracking-wider">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((row, i) => (
                      <TableRow
                        key={row.id}
                        row={row}
                        last={i === users.length - 1}
                        deleting={deletingId === row.id}
                        onDelete={() => handleDelete(row.id, row.user_id)}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function TableRow({ row, last, deleting, onDelete }) {
  const [hover, setHover] = useState(false);
  const isLifetime = row.plan_type === 'lifetime';

  return (
    <tr
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className={`transition-colors duration-100 ${!last ? 'border-b border-gray-50' : ''} ${hover ? 'bg-gray-50' : 'bg-white'}`}
    >
      <td className="px-4 sm:px-5 py-3.5 text-sm font-semibold text-gray-900 whitespace-nowrap">
        {row.users?.name || '—'}
      </td>
      <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {row.users?.email || '—'}
      </td>
      <td className="px-4 sm:px-5 py-3.5">
        <span className={`text-xs font-semibold px-2 py-1 rounded-md capitalize ${isLifetime ? 'text-violet-700 bg-violet-50 border border-violet-200' : 'text-blue-700 bg-blue-50 border border-blue-200'}`}>
          {row.plan_type}
        </span>
      </td>
      <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">{fmt(row.activated_at)}</td>
      <td className="px-4 sm:px-5 py-3.5 text-sm text-gray-500 whitespace-nowrap">
        {isLifetime ? <span className="text-gray-300">—</span> : fmt(row.expires_at)}
      </td>
      <td className="px-4 sm:px-5 py-3.5">
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-1 rounded-md capitalize">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
          {row.status}
        </span>
      </td>
      <td className="px-4 sm:px-5 py-3.5">
        <button
          onClick={onDelete}
          disabled={deleting}
          className="text-xs font-medium text-red-400 hover:text-red-600 transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed min-h-[32px] flex items-center"
        >
          {deleting ? '…' : 'Remove'}
        </button>
      </td>
    </tr>
  );
}
