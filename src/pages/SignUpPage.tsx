import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

const SignUpPage: React.FC = () => {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const navigate = useNavigate();

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (password !== confirmPassword) {
      alert('Passwords do not match');
      return;
    }
    // Dummy signup: accept any values for now
    navigate('/studio');
  };

  const onGoogle = () => {
    // Dummy google signup: redirect to studio
    navigate('/studio');
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900/75 p-8 shadow-2xl">
        <h1 className="text-2xl font-bold mb-2">Create your account</h1>
        <p className="text-slate-400 mb-6">Get started for free today.</p>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block text-sm font-medium text-slate-200">
            Full Name
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-2 ring-slate-900 focus:ring-blue-500"
              placeholder="Jane Doe"
            />
          </label>

          <label className="block text-sm font-medium text-slate-200">
            Email Address
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

          <label className="block text-sm font-medium text-slate-200">
            Confirm Password
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="mt-2 w-full rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 outline-none ring-2 ring-slate-900 focus:ring-blue-500"
              placeholder="Repeat your password"
            />
          </label>

          <button
            type="submit"
            className="w-full rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white hover:bg-blue-500"
          >
            Create Account
          </button>
        </form>

        <div className="my-6 flex items-center text-slate-400">
          <div className="h-px flex-1 bg-slate-700" />
          <span className="px-3 text-sm">or continue with</span>
          <div className="h-px flex-1 bg-slate-700" />
        </div>

        <button
          onClick={onGoogle}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-slate-700 bg-slate-800 px-4 py-2 text-white hover:bg-slate-700"
        >
          <span className="text-base">G</span> Google
        </button>

        <p className="mt-6 text-center text-sm text-slate-400">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-blue-400 hover:text-blue-300">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
};

export default SignUpPage;
