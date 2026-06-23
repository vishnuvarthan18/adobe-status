'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function ClientLogin() {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const router = useRouter();

  const login = async () => {
    if (!email || !password) { setError('Enter email and password.'); return; }
    setLoading(true); setError('');
    try {
      const r = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const d = await r.json();
      if (!r.ok || d.error) { setError(d.error || 'Invalid credentials.'); setLoading(false); return; }
      localStorage.setItem('clientSession', JSON.stringify({ id: d.id, name: d.name, email: d.email }));
      router.push('/dashboard');
    } catch {
      setError('Login failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">

      {/* Gold top accent line */}
      <div className="fixed top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent" />

      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="text-center mb-8">
          <div className="flex justify-center mb-6">
            <img src="/logo.png" alt="MG Digital" className="h-40 w-auto" />
          </div>
          <h1 className="text-2xl font-bold text-white mb-1">MG Digital Portal</h1>
          <p className="text-sm text-zinc-500">Sign in to manage your subscriptions</p>
        </div>

        {/* Card */}
        <div className="bg-zinc-900 rounded-2xl p-6 border border-zinc-800 shadow-2xl">
          <div className="flex flex-col gap-4">

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                Email
              </label>
              <input
                type="email" value={email}
                onChange={e => { setEmail(e.target.value); setError(''); }}
                onKeyDown={e => e.key === 'Enter' && login()}
                placeholder="you@company.com"
                className="w-full px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm outline-none transition-all focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 placeholder:text-zinc-600"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-400 mb-2 uppercase tracking-wider">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPass ? 'text' : 'password'} value={password}
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  onKeyDown={e => e.key === 'Enter' && login()}
                  placeholder="Enter password"
                  className="w-full pr-11 pl-4 py-3 bg-zinc-800 border border-zinc-700 rounded-xl text-white text-sm outline-none transition-all focus:border-amber-400 focus:ring-1 focus:ring-amber-400/30 placeholder:text-zinc-600"
                />
                <button type="button" onClick={() => setShowPass(v => !v)} tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 p-1 cursor-pointer transition-colors">
                  {showPass
                    ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22"/></svg>
                    : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                  }
                </button>
              </div>
            </div>

            {error && (
              <div className="p-3 bg-red-950 border border-red-800 rounded-xl text-sm text-red-400">
                {error}
              </div>
            )}

            <button onClick={login} disabled={loading}
              className="mt-1 py-3 min-h-[48px] bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-black text-sm font-bold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed">
              {loading ? 'Signing in…' : 'Sign in'}
            </button>

          </div>
        </div>

        <p className="text-center mt-8 text-xs text-zinc-700 tracking-widest uppercase">
          MG Digital
        </p>
      </div>
    </div>
  );
}
