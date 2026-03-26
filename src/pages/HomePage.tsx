import React from 'react';
import { Link } from 'react-router-dom';

const HomePage = () => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-100 p-6">
      <div className="max-w-lg text-center bg-slate-900/80 border border-slate-800 rounded-2xl p-8 shadow-xl">
        <h1 className="text-3xl font-bold mb-4">Welcome</h1>
        <p className="text-slate-300 mb-8">
          Start with Login or Sign Up and then continue to Studio.
        </p>
        <div className="flex gap-4 justify-center">
          <Link
            to="/login"
            className="px-6 py-2 rounded-lg font-semibold bg-blue-600 text-white hover:bg-blue-500"
          >
            Login
          </Link>
          <Link
            to="/signup"
            className="px-6 py-2 rounded-lg font-semibold bg-slate-700 text-white hover:bg-slate-600"
          >
            Sign up
          </Link>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
