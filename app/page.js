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
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex flex-col items-center px-4 py-12 sm:py-16 lg:py-20">

      <div className="text-center mb-10 sm:mb-12">
        <img
          src="/logo.svg"
          alt="Big Membres"
          className="w-20 h-20 sm:w-24 sm:h-24 object-contain block mx-auto mb-4 sm:mb-5"
        />
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mb-2">
          Check Subscription
        </h1>
        <p className="text-sm text-slate-400">
          Enter your registered email to view your plan details
        </p>
      </div>

      <div className="w-full max-w-lg">

        <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-2xl mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
            Email address
          </label>
          <div className="flex gap-2">
            <input
              type="email"
              value={email}
              onChange={e => { setEmail(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleCheck()}
              placeholder="you@company.com"
              className="flex-1 min-w-0 px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
            <CheckButton loading={loading} onClick={handleCheck} />
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
              <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm text-red-700 leading-relaxed">{error}</span>
            </div>
          )}
        </div>

        {result && <SubscriptionCard result={result} />}
      </div>

      <p className="mt-12 text-xs tracking-widest" style={{ color: 'rgba(248,250,252,0.2)' }}>
        © Big Membres · Subscription Portal
      </p>
    </div>
  );
}

function CheckButton({ loading, onClick }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className="shrink-0 px-4 sm:px-5 min-h-[48px] bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-75 text-white text-sm font-semibold rounded-xl transition-all duration-200 flex items-center gap-2 whitespace-nowrap cursor-pointer disabled:cursor-not-allowed"
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
    <div className="bg-white rounded-2xl overflow-hidden shadow-2xl" style={{ animation: 'fadeInUp 0.5s ease forwards' }}>

      <div
        className="px-5 sm:px-6 py-4 flex items-center justify-between border-b"
        style={{
          background: isActive ? 'linear-gradient(135deg,#F0FDF4,#DCFCE7)' : 'linear-gradient(135deg,#FFF1F2,#FEE2E2)',
          borderColor: isActive ? '#BBF7D0' : '#FECACA',
        }}
      >
        <StatusBadge active={isActive} />
        <span className="text-xs text-gray-400 font-mono truncate ml-3 max-w-[160px] sm:max-w-xs">{result.email}</span>
      </div>

      <div className="p-5 sm:p-6">

        <div className="mb-5">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight mb-1">{result.name}</h2>
          <p className="text-sm text-gray-500">{result.organization}</p>
        </div>

        <div className="p-3 sm:p-4 bg-slate-50 border border-slate-200 rounded-xl mb-5">
          <p className="text-xs font-semibold text-gray-400 mb-1 uppercase tracking-widest">Plan</p>
          <p className="text-sm font-semibold text-gray-900 capitalize">{result.planType}</p>
        </div>

        <hr className="border-gray-100 mb-4" />

        <div className="flex flex-col gap-2.5 mb-5">
          <DateRow label="Activated" value={formatDate(result.activatedAt)} />
          {!isLifetime && <DateRow label="Expires" value={formatDate(result.expiresAt)} />}
        </div>

        <hr className="border-gray-100 mb-4" />

        <div className="mb-5">
          {isLifetime ? (
            <div className="p-3 sm:p-4 bg-violet-50 border border-violet-200 rounded-xl flex items-center gap-2.5">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2" strokeLinecap="round">
                <rect x="3" y="11" width="18" height="11" rx="2" /><path d="M7 11V7a5 5 0 0110 0v4" />
              </svg>
              <span className="text-sm font-semibold text-violet-700">Lifetime access · No expiration date</span>
            </div>
          ) : (
            <>
              <div className="flex justify-between items-center mb-2.5">
                <span className="text-sm text-gray-500">Subscription progress</span>
                <span className="text-sm sm:text-base font-bold" style={{ color: isActive ? '#16A34A' : '#DC2626' }}>
                  {result.daysRemaining > 0 ? `${result.daysRemaining} days left` : 'Expired'}
                </span>
              </div>
              <AnimatedProgressBar percent={result.progressPercent} active={isActive} />
              <div className="flex justify-between mt-1.5">
                <span className="text-xs text-gray-300">Start</span>
                <span className="text-xs font-medium text-gray-500">{result.progressPercent}% complete</span>
                <span className="text-xs text-gray-300">Expiry</span>
              </div>
            </>
          )}
        </div>

        <hr className="border-gray-100 mb-4" />

        <div className="p-3 sm:p-4 bg-blue-50 border border-blue-200 rounded-xl flex gap-2.5 items-start">
          <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2" strokeLinecap="round">
            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
          </svg>
          <p className="text-xs sm:text-sm text-blue-800 leading-relaxed">
            If you need to update your subscription or have billing questions, please contact Big Membres support.
          </p>
        </div>

      </div>
    </div>
  );
}

function StatusBadge({ active }) {
  return (
    <div
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border shrink-0"
      style={{
        background: active ? '#DCFCE7' : '#FEE2E2',
        borderColor: active ? '#86EFAC' : '#FECACA',
      }}
    >
      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: active ? '#16A34A' : '#DC2626' }} />
      <span className="text-xs font-bold" style={{ color: active ? '#15803D' : '#DC2626' }}>
        {active ? 'Active' : 'Expired'}
      </span>
    </div>
  );
}

function DateRow({ label, value }) {
  return (
    <div className="flex justify-between items-center gap-4">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-semibold text-gray-900">{value}</span>
    </div>
  );
}

function AnimatedProgressBar({ percent, active }) {
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const t = setTimeout(() => setWidth(Math.min(100, Math.max(0, percent))), 80);
    return () => clearTimeout(t);
  }, [percent]);

  return (
    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
      <div
        className="h-full rounded-full"
        style={{
          width: `${width}%`,
          background: active ? 'linear-gradient(90deg,#22C55E,#16A34A)' : 'linear-gradient(90deg,#EF4444,#DC2626)',
          transition: 'width 1s ease-out',
        }}
      />
    </div>
  );
}
