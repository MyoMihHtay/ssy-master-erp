import React, { useState } from 'react';

interface LoginProps {
  onLogin: (displayName: string, role: string) => void;
  accounts: any[];
}

export const Login: React.FC<LoginProps> = ({ onLogin, accounts }) => {
  const [selectedAccount, setSelectedAccount] = useState<any | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (selectedAccount.password === password) {
      onLogin(selectedAccount.displayName, selectedAccount.role);
    } else {
      setError('စကားဝှက် (Password) မှားယွင်းနေပါသည်။');
    }
  };

  // ရာထူး ၇ မျိုးအတွက် အရောင်များ သတ်မှတ်ခြင်း
  const getRoleStyles = (role: string) => {
    switch (role) {
      case 'md': return { bg: 'bg-red-100', text: 'text-red-700', border: 'border-red-200' };
      case 'finance': return { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-200' };
      case 'qc': return { bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-200' };
      case 'purchasing': return { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-200' };
      case 'storekeeper': return { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-200' };
      case 'maintenance': return { bg: 'bg-slate-100', text: 'text-slate-700', border: 'border-slate-200' };
      case 'staff': return { bg: 'bg-blue-100', text: 'text-blue-700', border: 'border-blue-200' };
      default: return { bg: 'bg-gray-100', text: 'text-gray-700', border: 'border-gray-200' };
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4 font-sans">
      <div className="max-w-md w-full bg-white rounded-3xl shadow-xl p-8 border border-gray-100">
        
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4 shadow-lg text-white text-3xl">
            🏭
          </div>
          <h1 className="text-3xl font-extrabold text-gray-900 mb-1">SSY Master ERP</h1>
          {!selectedAccount && (
            <p className="text-gray-500 font-medium text-sm">မိမိ၏ အကောင့်ကို ရွေးချယ်၍ ဝင်ရောက်ပါ</p>
          )}
        </div>

        {!selectedAccount ? (
          <div className="space-y-3">
            {accounts.map((acc) => {
              const styles = getRoleStyles(acc.role);
              const initial = acc.displayName ? acc.displayName.charAt(0) : '?';
              return (
                <button
                  key={acc.id}
                  onClick={() => { setSelectedAccount(acc); setError(''); setPassword(''); }}
                  className="w-full flex items-center p-4 bg-white border-2 border-gray-100 rounded-2xl hover:border-blue-400 hover:shadow-md transition-all text-left group"
                >
                  <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold mr-4 ${styles.bg} ${styles.text}`}>
                    {initial}
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-800 group-hover:text-blue-600 transition-colors">
                      {acc.displayName}
                    </h3>
                    <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider mt-1 ${styles.bg} ${styles.text}`}>
                      {acc.role}
                    </span>
                  </div>
                  <div className="text-gray-300 group-hover:text-blue-500 transition-colors">
                    ▶
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="animate-fade-in-up">
            <div className="flex items-center justify-center gap-3 mb-6 bg-gray-50 p-4 rounded-2xl border border-gray-100">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${getRoleStyles(selectedAccount.role).bg} ${getRoleStyles(selectedAccount.role).text}`}>
                {selectedAccount.displayName.charAt(0)}
              </div>
              <div className="text-left">
                <div className="font-bold text-gray-800 leading-tight">{selectedAccount.displayName}</div>
                <div className="text-xs text-gray-500 capitalize">{selectedAccount.role}</div>
              </div>
            </div>

            {error && <div className="bg-red-50 text-red-600 p-3 rounded-xl text-sm font-medium text-center mb-4">{error}</div>}
            
            <form onSubmit={handleLogin} className="space-y-5">
              <div>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)} 
                  className="w-full border-2 border-gray-200 p-4 rounded-xl focus:border-blue-500 focus:ring-4 focus:ring-blue-100 outline-none text-center text-lg font-bold tracking-widest placeholder:tracking-normal" 
                  placeholder="စကားဝှက် ရိုက်ထည့်ပါ"
                  autoFocus
                  required 
                />
              </div>
              <div className="flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setSelectedAccount(null)} 
                  className="w-1/3 bg-gray-100 text-gray-700 p-3.5 rounded-xl font-bold hover:bg-gray-200 transition-colors"
                >
                  နောက်သို့
                </button>
                <button 
                  type="submit" 
                  className="w-2/3 bg-blue-600 text-white p-3.5 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
                >
                  ဝင်မည်
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
};
