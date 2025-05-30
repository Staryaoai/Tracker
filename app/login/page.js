'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  const handleVerify = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    if (!password) {
      setError('请输入密码。');
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password }),
      });

      const data = await response.json();

      if (response.ok && data.success) {
        sessionStorage.setItem('isAuthenticated', 'true'); // Mark as authenticated
        sessionStorage.setItem('isGuest', 'false');       // Mark as not a guest
        router.push('/'); // Redirect to the main page
      } else {
        setError(data.message || '验证失败，请重试。');
      }
    } catch (err) {
      console.error('Login request error:', err);
      setError('发生错误，请稍后重试。');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGuestMode = () => {
    sessionStorage.setItem('isAuthenticated', 'true'); // Mark as "authenticated" to allow access
    sessionStorage.setItem('isGuest', 'true');       // Mark as a guest
    router.push('/'); // Redirect to the main page
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-gray-900 p-6">
      <div className="w-full max-w-sm p-8 bg-white/10 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/20">
        <h1 className="text-3xl font-bold text-center text-white mb-8">
          身份验证
        </h1>
        <form onSubmit={handleVerify} className="space-y-6">
          <div>
            <label htmlFor="password" className="sr-only">密码</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="block w-full px-4 py-3 bg-white/20 text-white placeholder-gray-400 border-0 rounded-lg shadow-sm focus:ring-2 focus:ring-pink-500 focus:outline-none sm:text-sm"
              placeholder="请输入密码"
            />
          </div>

          {error && (
            <p className="text-sm text-red-400 bg-red-900/50 p-3 rounded-md text-center">
              {error}
            </p>
          )}

          <div className="space-y-4">
            <button
              type="submit"
              disabled={isLoading}
              className="w-full flex justify-center py-3 px-4 border border-transparent rounded-lg shadow-sm text-sm font-medium text-white bg-pink-600 hover:bg-pink-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:ring-offset-slate-900 disabled:opacity-70"
            >
              {isLoading ? '验证中...' : '验 证'}
            </button>
            <button
              type="button"
              onClick={handleGuestMode}
              className="w-full flex justify-center py-3 px-4 border border-pink-500/50 rounded-lg shadow-sm text-sm font-medium text-pink-300 hover:bg-pink-500/20 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-pink-500 focus:ring-offset-slate-900"
            >
              游客模式
            </button>
          </div>
        </form>
      </div>
      <footer className="mt-10 text-center text-sm text-gray-500">
        <p>&copy; {new Date().getFullYear()} 学习记录应用</p>
      </footer>
    </div>
  );
}