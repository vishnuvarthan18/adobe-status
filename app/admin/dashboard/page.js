'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const todayStr = () => new Date().toISOString().split('T')[0];

function fmt(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const inputSx = {
  width: '100%',
  padding: '10px 13px',
  background: '#F9FAFB',
  border: '1.5px solid #E5E7EB',
  borderRadius: '9px',
  color: '#111827',
  fontSize: '13.5px',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 0.15s, background 0.15s',
  appearance: 'none',
  WebkitAppearance: 'none',
};

function applyFocus(e) { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#fff'; }
function removeFocus(e) { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#F9FAFB'; }

function FormField({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: '11.5px', fontWeight: '600', color: '#6B7280', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
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
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)' }}>

      {/* Header */}
      <header style={{
        background: 'rgba(15,23,42,0.85)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        height: '60px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.svg" alt="Big Membres" style={{ height: '36px', width: 'auto' }} />
          <span style={{
            fontSize: '10.5px', fontWeight: '600',
            color: 'rgba(248,250,252,0.45)',
            background: 'rgba(255,255,255,0.07)',
            border: '1px solid rgba(255,255,255,0.1)',
            padding: '3px 8px', borderRadius: '5px',
            letterSpacing: '0.05em', textTransform: 'uppercase',
          }}>Admin Panel</span>
        </div>
        <button
          onClick={logout}
          style={{
            padding: '8px 16px',
            background: 'linear-gradient(135deg, #DC2626, #EF4444)',
            border: 'none', borderRadius: '8px',
            color: '#fff', fontSize: '13px', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.2s',
          }}
          onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, #B91C1C, #DC2626)'}
          onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, #DC2626, #EF4444)'}
        >
          Logout
        </button>
      </header>

      {/* Body */}
      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '36px 24px' }}>

        <div style={{ marginBottom: '28px' }}>
          <h1 style={{ fontSize: '22px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            Subscription Management
          </h1>
          <p style={{ fontSize: '13.5px', color: 'rgba(248,250,252,0.4)', margin: 0 }}>
            Add and manage Big Membres subscriptions
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,320px) 1fr', gap: '24px', alignItems: 'start' }}>

          {/* Form card */}
          <div style={{ background: '#fff', borderRadius: '20px', padding: '28px', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: '0 0 22px', letterSpacing: '-0.3px' }}>
              Add User
            </h2>
            <form onSubmit={handleAdd} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

              <FormField label="Full name">
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required style={inputSx} onFocus={applyFocus} onBlur={removeFocus} />
              </FormField>

              <FormField label="Email address">
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="jane@company.com" required style={inputSx} onFocus={applyFocus} onBlur={removeFocus} />
              </FormField>

              <FormField label="Plan type">
                <select value={planType} onChange={e => setPlanType(e.target.value)} style={{ ...inputSx, cursor: 'pointer' }} onFocus={applyFocus} onBlur={removeFocus}>
                  <option value="yearly">Yearly</option>
                  <option value="lifetime">Lifetime</option>
                </select>
              </FormField>

              <FormField label="Start date">
                <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} required style={inputSx} onFocus={applyFocus} onBlur={removeFocus} />
              </FormField>

              <button
                type="submit"
                disabled={loading}
                style={{
                  marginTop: '4px', padding: '12px',
                  background: loading ? '#93C5FD' : 'linear-gradient(135deg, #2563EB, #3B82F6)',
                  border: 'none', borderRadius: '10px',
                  color: '#fff', fontSize: '14px', fontWeight: '700',
                  cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                }}
                onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1D4ED8, #2563EB)'; }}
                onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB, #3B82F6)'; }}
              >
                {loading ? 'Adding…' : 'Add User'}
              </button>

              {msg && (
                <div style={{
                  padding: '10px 13px', borderRadius: '9px',
                  background: msg.ok ? '#F0FDF4' : '#FEF2F2',
                  border: `1px solid ${msg.ok ? '#BBF7D0' : '#FECACA'}`,
                }}>
                  <p style={{ fontSize: '12.5px', color: msg.ok ? '#15803D' : '#B91C1C', margin: 0 }}>
                    {msg.ok ? '✓ ' : '✕ '}{msg.text}
                  </p>
                </div>
              )}
            </form>
          </div>

          {/* Table card */}
          <div style={{ background: '#fff', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{
              padding: '18px 24px', borderBottom: '1px solid #F3F4F6',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <h2 style={{ fontSize: '15px', fontWeight: '700', color: '#111827', margin: 0 }}>
                Users <span style={{ color: '#9CA3AF', fontWeight: '500' }}>({users.length})</span>
              </h2>
              <button
                onClick={fetchUsers}
                style={{
                  padding: '6px 12px', background: '#F9FAFB',
                  border: '1px solid #E5E7EB', borderRadius: '7px',
                  color: '#6B7280', fontSize: '12px', fontWeight: '500', cursor: 'pointer', transition: 'all 0.15s',
                }}
                onMouseEnter={e => e.currentTarget.style.background = '#F3F4F6'}
                onMouseLeave={e => e.currentTarget.style.background = '#F9FAFB'}
              >
                Refresh
              </button>
            </div>

            {users.length === 0 ? (
              <div style={{ padding: '64px 24px', textAlign: 'center' }}>
                <p style={{ fontSize: '14px', color: '#9CA3AF', margin: '0 0 6px' }}>No users yet</p>
                <p style={{ fontSize: '12.5px', color: '#D1D5DB', margin: 0 }}>Add your first user using the form</p>
              </div>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F9FAFB' }}>
                      {['Name', 'Email', 'Plan', 'Start', 'Expires', 'Status', ''].map(h => (
                        <th key={h} style={{
                          textAlign: 'left', padding: '10px 16px',
                          fontSize: '11px', fontWeight: '600', color: '#9CA3AF',
                          borderBottom: '1px solid #F3F4F6',
                          whiteSpace: 'nowrap', letterSpacing: '0.04em', textTransform: 'uppercase',
                        }}>
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
      style={{
        borderBottom: last ? 'none' : '1px solid #F9FAFB',
        background: hover ? '#FAFAFA' : '#fff',
        transition: 'background 0.1s',
      }}
    >
      <td style={{ padding: '14px 16px', fontSize: '13.5px', color: '#111827', fontWeight: '600', whiteSpace: 'nowrap' }}>
        {row.users?.name || '—'}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {row.users?.email || '—'}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{
          fontSize: '11.5px', fontWeight: '600',
          color: isLifetime ? '#7C3AED' : '#2563EB',
          background: isLifetime ? '#F5F3FF' : '#EFF6FF',
          border: `1px solid ${isLifetime ? '#DDD6FE' : '#BFDBFE'}`,
          padding: '3px 9px', borderRadius: '6px', textTransform: 'capitalize',
        }}>
          {row.plan_type}
        </span>
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {fmt(row.activated_at)}
      </td>
      <td style={{ padding: '14px 16px', fontSize: '13px', color: '#6B7280', whiteSpace: 'nowrap' }}>
        {isLifetime ? <span style={{ color: '#D1D5DB' }}>—</span> : fmt(row.expires_at)}
      </td>
      <td style={{ padding: '14px 16px' }}>
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: '5px',
          fontSize: '11.5px', fontWeight: '600', color: '#15803D',
          background: '#F0FDF4', border: '1px solid #BBF7D0',
          padding: '3px 9px', borderRadius: '6px', textTransform: 'capitalize',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#16A34A' }} />
          {row.status}
        </span>
      </td>
      <td style={{ padding: '14px 16px' }}>
        <button
          onClick={onDelete}
          disabled={deleting}
          style={{
            background: 'none', border: 'none',
            cursor: deleting ? 'not-allowed' : 'pointer',
            fontSize: '12.5px', fontWeight: '500',
            color: '#EF4444', padding: 0,
            opacity: deleting ? 0.5 : 1, transition: 'opacity 0.15s',
          }}
        >
          {deleting ? '…' : 'Remove'}
        </button>
      </td>
    </tr>
  );
}
