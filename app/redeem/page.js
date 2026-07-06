'use client';

import { useState } from 'react';

export default function Redeem() {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [redirecting, setRedirecting] = useState(false);

  const handleRedeem = async () => {
    const val = code.trim();
    if (!val) { setError('Please enter your code.'); return; }
    setLoading(true);
    setError('');
    try {
      const r = await fetch('/api/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: val }),
      });
      const d = await r.json();
      if (d.success) {
        setRedirecting(true);
        window.location.href = d.url;
        return;
      }
      setError(d.error || 'Unable to redeem this code.');
    } catch {
      setError('Something went wrong. Please try again.');
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex flex-col items-center px-4 py-12 sm:py-16 lg:py-20">

      <div className="text-center mb-10 sm:mb-12">
        <p className="text-xl sm:text-2xl font-extrabold text-slate-50 tracking-tight mb-4 sm:mb-5">
          Air Digital
        </p>
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mb-2">
          Redeem Your Offer
        </h1>
        <p className="text-sm text-slate-400">
          Enter your redeem code to unlock your offer
        </p>
      </div>

      <div className="w-full max-w-lg">
        <div className="bg-white rounded-2xl p-5 sm:p-7 shadow-2xl mb-4">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
            Redeem code
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={e => { setCode(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleRedeem()}
              placeholder="XXXX-XXXX-XXXX"
              disabled={redirecting}
              className="flex-1 min-w-0 px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white uppercase tracking-wider disabled:opacity-60"
            />
            <RedeemButton loading={loading || redirecting} onClick={handleRedeem} />
          </div>

          {error && (
            <div className="mt-3 p-3 bg-red-50 border border-red-200 rounded-xl flex gap-2 items-start">
              <svg className="mt-0.5 shrink-0" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2" strokeLinecap="round">
                <circle cx="12" cy="12" r="10" /><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" />
              </svg>
              <span className="text-sm text-red-700 leading-relaxed">{error}</span>
            </div>
          )}

          {redirecting && (
            <div className="mt-3 p-3 bg-green-50 border border-green-200 rounded-xl flex gap-2 items-center">
              <svg className="shrink-0" style={{ animation: 'spin 0.75s linear infinite' }} width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#16A34A" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
              <span className="text-sm text-green-700 leading-relaxed">Code accepted — redirecting you now…</span>
            </div>
          )}
        </div>
      </div>

      <p className="mt-12 text-xs tracking-widest" style={{ color: 'rgba(248,250,252,0.2)' }}>
        © Air Digital · Redeem Portal
      </p>
    </div>
  );
}

function RedeemButton({ loading, onClick }) {
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
      {loading ? 'Please wait…' : 'Redeem'}
    </button>
  );
}
