'use client';

import { useState, useEffect } from 'react';

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default function Home() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleCheck = async () => {
    const val = email.trim();
    if (!val) { setError('Please enter your email address.'); return; }
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const r = await fetch('/api/check-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: val }),
      });
      const d = await r.json();
      if (d.found) setResult(d);
      else setError(d.error || 'No subscription found for this email.');
    } catch {
      setError('Unable to retrieve subscription status. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      padding: '64px 20px 80px',
    }}>

      <div style={{ textAlign: 'center', marginBottom: '44px' }}>
        <img
          src="/logo.svg"
          alt="Big Membres"
          style={{ width: '88px', height: '88px', objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
        />
        <h1 style={{ fontSize: '30px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 8px', letterSpacing: '-0.6px' }}>
          Check Subscription
        </h1>
        <p style={{ fontSize: '14px', color: 'rgba(248,250,252,0.48)', margin: 0 }}>
          Enter your registered email to view your plan details
        </p>
      </div>

      <div style={{ width: '100%', maxWidth: '480px' }}>

        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '28px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
          marginBottom: '16px',
        }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#374151', marginBottom: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Email address
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              placeholder="you@company.com"
              style={{
                flex: 1, padding: '11px 14px',
                background: '#F9FAFB', border: '1.5px solid #E5E7EB',
                borderRadius: '10px', color: '#111827', fontSize: '14px', outline: 'none',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#F9FAFB'; }}
            />
            <CheckButton loading={loading} onClick={handleCheck} />
          </div>

          {error && (
            <div style={{
              marginTop: '14px', padding: '12px 14px',
              background: '#FEF2F2', border: '1px solid #FECACA',
              borderRadius: '10px', display: 'flex', gap: '9px', alignItems: 'flex-start',
            }}>
              <svg style={{ marginTop: '1px', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span style={{ fontSize: '13px', color: '#B91C1C', lineHeight: '1.5' }}>{error}</span>
            </div>
          )}
        </div>

        {result && <SubscriptionCard result={result} />}
      </div>

      <p style={{ marginTop: '52px', fontSize: '11px', color: 'rgba(248,250,252,0.18)', letterSpacing: '0.08em' }}>
        © Big Membres · Subscription Portal
      </p>
    </div>
  );
}

function CheckButton({ loading, onClick }) {
  const [hov, setHov] = useState(false);
  return (
    <button
      onClick={onClick}
      disabled={loading}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        padding: '11px 20px',
        background: hov && !loading
          ? 'linear-gradient(135deg, #1D4ED8, #2563EB)'
          : 'linear-gradient(135deg, #2563EB, #3B82F6)',
        border: 'none', borderRadius: '10px', color: '#fff',
        fontSize: '14px', fontWeight: '600',
        cursor: loading ? 'not-allowed' : 'pointer',
        whiteSpace: 'nowrap', transition: 'all 0.2s',
        display: 'flex', alignItems: 'center', gap: '7px',
        opacity: loading ? 0.75 : 1, flexShrink: 0,
      }}
    >
      {loading && (
        <svg style={{ animation: 'spin 0.75s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
        </svg>
      )}
      {loading ? 'Checking…' : 'Check Status'}
    </button>
  );
}

function SubscriptionCard({ result }) {
  const isLifetime = result.planType === 'lifetime';
  const isActive = result.status === 'active' && (isLifetime || result.daysRemaining > 0);

  return (
    <div style={{
      background: '#fff', borderRadius: '20px', overflow: 'hidden',
      boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
      animation: 'fadeInUp 0.5s ease forwards',
    }}>

      {/* Header strip */}
      <div style={{
        padding: '16px 24px',
        background: isActive ? 'linear-gradient(135deg, #F0FDF4, #DCFCE7)' : 'linear-gradient(135deg, #FFF1F2, #FEE2E2)',
        borderBottom: `1px solid ${isActive ? '#BBF7D0' : '#FECACA'}`,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <StatusBadge active={isActive} />
        <span style={{ fontSize: '12px', color: '#9CA3AF', fontFamily: 'monospace' }}>{result.email}</span>
      </div>

      <div style={{ padding: '24px' }}>

        {/* Name + org */}
        <div style={{ marginBottom: '20px' }}>
          <h2 style={{ fontSize: '20px', fontWeight: '700', color: '#111827', margin: '0 0 4px', letterSpacing: '-0.4px' }}>
            {result.name}
          </h2>
          <p style={{ fontSize: '13.5px', color: '#6B7280', margin: 0 }}>{result.organization}</p>
        </div>

        {/* Plan tile */}
        <div style={{
          padding: '14px 16px', background: '#F8FAFC',
          border: '1px solid #E2E8F0', borderRadius: '12px', marginBottom: '20px',
        }}>
          <p style={{ fontSize: '11px', fontWeight: '600', color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Plan
          </p>
          <p style={{ fontSize: '14px', fontWeight: '600', color: '#111827', margin: 0, textTransform: 'capitalize' }}>
            {result.planType}
          </p>
        </div>

        <Divider />

        {/* Dates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', margin: '18px 0' }}>
          <DateRow label="Activated" value={formatDate(result.activatedAt)} />
          {!isLifetime && <DateRow label="Expires" value={formatDate(result.expiresAt)} />}
        </div>

        <Divider />

        {/* Progress */}
        <div style={{ margin: '18px 0' }}>
          {isLifetime ? (
            <div style={{
              padding: '14px 16px', background: '#F5F3FF',
              border: '1px solid #DDD6FE', borderRadius: '12px',
              display: 'flex', alignItems: 'center', gap: '10px',
            }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#5B21B6' }}>
                Lifetime access · No expiration date
              </span>
            </div>
          ) : (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <span style={{ fontSize: '13px', color: '#6B7280' }}>Subscription progress</span>
                <span style={{ fontSize: '15px', fontWeight: '700', color: isActive ? '#16A34A' : '#DC2626' }}>
                  {result.daysRemaining > 0 ? `${result.daysRemaining} days left` : 'Expired'}
                </span>
              </div>
              <AnimatedProgressBar percent={result.progressPercent} active={isActive} />
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
                <span style={{ fontSize: '11px', color: '#D1D5DB' }}>Start</span>
                <span style={{ fontSize: '11px', fontWeight: '500', color: '#6B7280' }}>{result.progressPercent}% complete</span>
                <span style={{ fontSize: '11px', color: '#D1D5DB' }}>Expiry</span>
              </div>
            </>
          )}
        </div>

        <Divider />

        {/* Info box */}
        <div style={{
          marginTop: '18px', padding: '14px 16px',
          background: '#EFF6FF', border: '1px solid #BFDBFE',
          borderRadius: '12px', display: 'flex', gap: '10px', alignItems: 'flex-start',
        }}>
          <svg style={{ marginTop: '1px', flexShrink: 0 }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p style={{ fontSize: '12.5px', color: '#1E40AF', margin: 0, lineHeight: '1.55' }}>
            If you need to update your subscription or have billing questions, please contact Big Membres support.
          </p>
        </div>

      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: '6px',
      padding: '5px 12px',
      background: active ? '#DCFCE7' : '#FEE2E2',
      border: `1px solid ${active ? '#86EFAC' : '#FECACA'}`,
      borderRadius: '99px',
    }}>
      <span style={{ width: '7px', height: '7px', borderRadius: '50%', background: active ? '#16A34A' : '#DC2626' }} />
      <span style={{ fontSize: '12px', fontWeight: '700', color: active ? '#15803D' : '#DC2626', letterSpacing: '0.02em' }}>
        {active ? 'Active' : 'Expired'}
      </span>
    </div>
  );
}

function DateRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <span style={{ fontSize: '13.5px', color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: '13.5px', fontWeight: '600', color: '#111827' }}>{value}</span>
    </div>
  );
}

function Divider() {
  return <hr style={{ border: 'none', borderTop: '1px solid #F3F4F6', margin: 0 }} />;
}

function AnimatedProgressBar({ percent, active }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(100, Math.max(0, percent))), 80);
    return () => clearTimeout(t);
  }, [percent]);

  return (
    <div style={{ height: '10px', background: '#F3F4F6', borderRadius: '99px', overflow: 'hidden' }}>
      <div style={{
        height: '100%', width: `${width}%`,
        background: active
          ? 'linear-gradient(90deg, #22C55E, #16A34A)'
          : 'linear-gradient(90deg, #EF4444, #DC2626)',
        borderRadius: '99px',
        transition: 'width 1s ease-out',
      }} />
    </div>
  );
}
