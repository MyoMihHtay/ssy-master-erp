import React, { useState } from 'react';
import { tr, type AppLanguage } from '../i18n';

interface LoginProps {
  onLogin: (displayName: string, role: string) => void;
  accounts: any[]; // App.tsx မှ အကောင့်စာရင်းကို လက်ခံမည်
  language: AppLanguage;
  setLanguage: React.Dispatch<React.SetStateAction<AppLanguage>>;
}

export const Login: React.FC<LoginProps> = ({ onLogin, accounts, language, setLanguage }) => {
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
      setError(tr(language, 'loginInvalidCredentials'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-4xl font-extrabold text-blue-600 mb-2">MAVORA</h1>
          <p className="text-gray-600 tracking-widest text-sm font-black">MANUFACTURING ERP</p>
            <p className="text-gray-400 text-xs font-semibold mt-1">Smart Factory Management Platform</p>
        </div>
        <h2 className="text-xl font-bold text-center text-gray-800">{tr(language, 'loginScreenTitle')}</h2>

        <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2">
          <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
            🌐 {tr(language, 'loginLanguage')}
          </span>
          <div className="grid grid-cols-2 gap-1 bg-slate-200 rounded-lg p-1 min-w-[150px]">
            <button
              type="button"
              onClick={() => setLanguage('my')}
              className={`px-3 py-1.5 rounded-md text-xs font-black transition-colors ${
                language === 'my'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              မြန်မာ
            </button>
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-3 py-1.5 rounded-md text-xs font-black transition-colors ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-600 hover:bg-white'
              }`}
            >
              EN
            </button>
          </div>
        </div>
        {error && (
          <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-200">
            {tr(language, 'loginInvalidCredentials')}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'loginUsername')}</label>
            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">{tr(language, 'loginPassword')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none" required />
          </div>
          <button type="submit" className="w-full bg-blue-600 text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md">{tr(language, 'loginButton')}</button>
        </form>
      </div>
    </div>
  );
};
