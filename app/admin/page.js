'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const attempt = () => {
    if (!password) { setError('Enter your password to continue.'); return; }
    setLoading(true);
    setTimeout(() => {
      if (password === 'admin@big') {
        localStorage.setItem('adminLoggedIn', 'true');
        router.push('/admin/dashboard');
      } else {
        setError('Incorrect password. Please try again.');
        setLoading(false);
      }
    }, 320);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-sm">

        <div className="text-center mb-8 sm:mb-10">
          <img
            src="/logo.svg"
            alt="Big Membres"
            className="w-20 h-20 object-contain block mx-auto mb-4 sm:mb-5"
          />
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-50 tracking-tight mb-2">
            Welcome back
          </h1>
          <p className="text-sm text-slate-400">Sign in to the Big Membres admin portal</p>
        </div>

        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl">
          <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">
            Password
          </label>

          <div className="relative mb-4">
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="Enter password"
              className="w-full pr-11 pl-3.5 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-gray-900 text-sm outline-none transition-all focus:border-blue-500 focus:bg-white"
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1 cursor-pointer"
            >
              {showPass
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              }
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl">
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={attempt}
            disabled={loading}
            className="w-full py-3 min-h-[48px] bg-gradient-to-br from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 disabled:opacity-75 text-white text-sm font-bold rounded-xl transition-all duration-200 cursor-pointer disabled:cursor-not-allowed tracking-tight"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p className="text-center mt-7 text-xs tracking-widest uppercase" style={{ color: 'rgba(248,250,252,0.2)' }}>
          Big Membres · Admin Portal
        </p>
      </div>
    </div>
  );
}
