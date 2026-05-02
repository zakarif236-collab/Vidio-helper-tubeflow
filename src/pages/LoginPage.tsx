import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const LoginPage: React.FC = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const { signIn, signInWithGoogle } = useAuth();
  const navigate = useNavigate();

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await signIn(email, password);
      navigate('/studio');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in';
      setError(msg.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''));
    } finally {
      setIsLoading(false);
    }
  };

  const onGoogle = async () => {
    setError('');
    setIsLoading(true);
    try {
      await signInWithGoogle();
      navigate('/studio');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to sign in with Google';
      setError(msg.replace('Firebase: ', '').replace(/ \(auth\/.*\)\.?/, ''));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-slate-950 p-6 text-slate-100">
      <button
        type="button"
        onClick={() => navigate('/')}
        aria-label="Close sign in"
        className="absolute right-6 top-6 z-20 flex items-center gap-2 rounded-full border border-white/20 bg-slate-800/90 px-4 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-slate-700"
      >
        <span className="text-lg leading-none">×</span>
        <span>Close</span>
      </button>

      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/75 p-8 shadow-2xl">
        <div className="mb-6">
          <h1 className="mb-2 text-2xl font-bold">Sign in to your account</h1>
          <p className="text-slate-400">Use your email or Google account to continue.</p>
        </div>

        {error && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Email address
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-2 ring-slate-900 focus:ring-blue-500"
              placeholder="jane@example.com"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Password
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-2 ring-slate-900 focus:ring-blue-500"
              placeholder="Min. 8 characters"
            />
          </label>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>

        <div className="my-6 flex items-center text-slate-400">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="px-3 text-sm">or continue with</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <button
          onClick={onGoogle}
          disabled={isLoading}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span className="text-base">G</span> Google
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          Don't have an account?{' '}
          <Link to="/signup" className="font-semibold text-blue-400 hover:text-blue-300">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
};

export default LoginPage;
