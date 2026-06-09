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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0F172A 0%, #1E3A5F 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        <div style={{ textAlign: 'center', marginBottom: '36px' }}>
          <img
            src="/logo.svg"
            alt="Big Membres"
            style={{ width: '80px', height: '80px', objectFit: 'contain', display: 'block', margin: '0 auto 20px' }}
          />
          <h1 style={{ fontSize: '24px', fontWeight: '700', color: '#F8FAFC', margin: '0 0 8px', letterSpacing: '-0.5px' }}>
            Welcome back
          </h1>
          <p style={{ fontSize: '14px', color: 'rgba(248,250,252,0.48)', margin: 0 }}>
            Sign in to the Big Membres admin portal
          </p>
        </div>

        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '32px',
          boxShadow: '0 24px 64px rgba(0,0,0,0.45)',
        }}>
          <label style={{ display: 'block', fontSize: '12.5px', fontWeight: '600', color: '#374151', marginBottom: '9px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
            Password
          </label>

          <div style={{ position: 'relative', marginBottom: error ? '12px' : '20px' }}>
            <input
              type={showPass ? 'text' : 'password'}
              value={password}
              onChange={e => { setPassword(e.target.value); if (error) setError(''); }}
              onKeyDown={e => e.key === 'Enter' && attempt()}
              placeholder="Enter password"
              style={{
                width: '100%',
                padding: '12px 44px 12px 14px',
                background: '#F9FAFB',
                border: '1.5px solid #E5E7EB',
                borderRadius: '10px',
                color: '#111827',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.15s, background 0.15s',
              }}
              onFocus={e => { e.target.style.borderColor = '#3B82F6'; e.target.style.background = '#fff'; }}
              onBlur={e => { e.target.style.borderColor = '#E5E7EB'; e.target.style.background = '#F9FAFB'; }}
            />
            <button
              type="button"
              onClick={() => setShowPass(v => !v)}
              tabIndex={-1}
              style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)',
                background: 'none', border: 'none', cursor: 'pointer',
                color: '#9CA3AF', padding: '4px', display: 'flex',
              }}
            >
              {showPass
                ? <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19M1 1l22 22" /></svg>
                : <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
              }
            </button>
          </div>

          {error && (
            <div style={{
              marginBottom: '16px', padding: '10px 14px',
              background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '9px',
            }}>
              <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0 }}>{error}</p>
            </div>
          )}

          <button
            onClick={attempt}
            disabled={loading}
            style={{
              width: '100%', padding: '13px',
              background: loading
                ? 'linear-gradient(135deg, #93C5FD, #60A5FA)'
                : 'linear-gradient(135deg, #2563EB, #3B82F6)',
              border: 'none', borderRadius: '10px',
              color: '#fff', fontSize: '14px', fontWeight: '700',
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s', letterSpacing: '-0.1px',
              opacity: loading ? 0.8 : 1,
            }}
            onMouseEnter={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #1D4ED8, #2563EB)'; }}
            onMouseLeave={e => { if (!loading) e.currentTarget.style.background = 'linear-gradient(135deg, #2563EB, #3B82F6)'; }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </div>

        <p style={{ textAlign: 'center', marginTop: '28px', fontSize: '11px', color: 'rgba(248,250,252,0.2)', letterSpacing: '0.08em' }}>
          BIG MEMBRES · ADMIN PORTAL
        </p>
      </div>
    </div>
  );
}
