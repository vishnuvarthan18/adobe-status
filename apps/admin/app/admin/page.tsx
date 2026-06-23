'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AdminLogin() {
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const router = useRouter();

  const login = () => {
    if (password === process.env.NEXT_PUBLIC_ADMIN_PASSWORD) {
      localStorage.setItem('adminLoggedIn', '1');
      router.push('/admin/dashboard');
    } else {
      setError('Invalid password.');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 to-blue-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-8 shadow-2xl w-full max-w-sm">
        <h1 className="text-xl font-bold text-gray-900 mb-6">Admin Login</h1>
        <input
          type="password" value={password}
          onChange={e => { setPassword(e.target.value); setError(''); }}
          onKeyDown={e => e.key === 'Enter' && login()}
          placeholder="Password"
          className="w-full px-3 py-3 bg-gray-50 border-2 border-gray-200 rounded-xl text-sm outline-none focus:border-blue-500 mb-3"
        />
        {error && <p className="text-sm text-red-600 mb-3">{error}</p>}
        <button onClick={login}
          className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-all cursor-pointer">
          Sign in
        </button>
      </div>
    </div>
  );
}
