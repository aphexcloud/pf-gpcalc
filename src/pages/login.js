'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import { signIn, useSession } from '@/lib/auth-client';

export default function LoginPage() {
  const router = useRouter();
  const { data: session, isPending } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [loginSuccess, setLoginSuccess] = useState(false);

  // Redirect to home when session is established after successful login
  useEffect(() => {
    if (loginSuccess && !isPending && session?.user) {
      router.push('/');
    }
  }, [loginSuccess, isPending, session, router]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const result = await signIn.email({
        email,
        password,
      });
      if (result.error) {
        setError(result.error.message || 'Sign in failed');
        setLoading(false);
      } else {
        // Wait for session to be established before redirecting
        setLoginSuccess(true);
      }
    } catch (err) {
      setError(err.message || 'Authentication failed');
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="apple-card p-10 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="app-title text-3xl text-gray-900 mb-2">
            Profit Dashboard
          </h1>
          <p className="business-name text-sm">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="apple-search"
              placeholder="you@example.com"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="apple-search"
              placeholder="Enter your password"
              required
              minLength={8}
            />
          </div>

          {error && (
            <div className="bg-red-50 text-red-600 text-sm p-3 rounded-lg">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full apple-button py-3 text-base"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                Signing in...
              </span>
            ) : (
              'Sign In'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            Contact your administrator for access
          </p>
        </div>
      </div>
    </div>
  );
}
