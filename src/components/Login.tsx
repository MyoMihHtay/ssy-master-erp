import React, { useState } from 'react';

interface LoginProps {
  onLogin: (displayName: string, role: string) => void;
  accounts: any[]; // App.tsx မှ အကောင့်စာရင်းကို လက်ခံမည်
}

export const Login: React.FC<LoginProps> = ({ onLogin, accounts }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Dynamic Account Verification
    const validUser = accounts.find(acc => acc.username === username && acc.password === password);

    if (validUser) {
      onLogin(validUser.displayName, validUser.role);
    } else {
      setError('Username သို့မဟုတ် Password မှားယွင်းနေပါသည်။');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-2">SSY</h1>
          <p className="text-gray-500 tracking-widest text-sm font-semibold">MASTER ERP SYSTEM</p>
        </div>
        <h2 className="text-xl font-bold text-center text-gray-800">စနစ်ထဲသို့ ဝင်ရောက်ရန်</h2>
        {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-200">{error}</div>}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Username (အကောင့်အမည်)</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password (စကားဝှက်)</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md">Login ဝင်မည်</button>
        </form>
      </div>
    </div>
  );
};
