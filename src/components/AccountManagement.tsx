import React, { useState } from 'react';

interface Account {
  id: number;
  username: string;
  password?: string;
  role: string;
  displayName: string;
}

interface AccountManagementProps {
  accounts: Account[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ accounts, setAccounts }) => {
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');

  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: number]: boolean }>({});

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newDisplayName) return;

    if (accounts.some(acc => acc.username === newUsername)) {
      alert('ဤ Username ကို အသုံးပြုထားပြီးဖြစ်ပါသည်။ အခြား Username ပြောင်းပေးပါ။');
      return;
    }

    const newAccount: Account = {
      id: Date.now(),
      username: newUsername,
      password: newPassword,
      role: newRole,
      displayName: newDisplayName
    };

    setAccounts([...accounts, newAccount]);
    setNewDisplayName('');
    setNewUsername('');
    setNewPassword('');
    alert('✅ အကောင့်သစ် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
  };

  const handleDelete = (id: number, role: string) => {
    if (role === 'manager') {
      alert('Manager (စက်ရုံမှူး) အကောင့်ကို ဖျက်ခွင့်မရှိပါ။');
      return;
    }
    if (window.confirm('ဤအကောင့်ကို ဖျက်ရန် သေချာပါသလား?')) {
      setAccounts(accounts.filter(a => a.id !== id));
    }
  };

  const handlePasswordChange = (id: number, newPass: string) => {
    setAccounts(accounts.map(acc => acc.id === id ? { ...acc, password: newPass } : acc));
  };

  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  const getRoleName = (role: string) => {
    switch (role) {
      case 'manager': return 'Manager (စက်ရုံမှူး)';
      case 'supervisor': return 'Supervisor (ကြီးကြပ်သူ)';
      case 'storekeeper': return 'Store Keeper (ဂိုဒေါင်မှူး)';
      case 'staff': return 'Staff (ဝန်ထမ်း)';
      default: return role;
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-indigo-700 border-b pb-2 flex items-center gap-2">
        <span>🔑</span> အကောင့်နှင့် လုံခြုံရေး စီမံခန့်ခွဲမှု (Manager Access Only)
      </h2>

      <div className="bg-white shadow-md p-6 rounded-xl border-t-4 border-indigo-500">
        <h3 className="text-lg font-bold text-gray-800 mb-4">+ အကောင့်အသစ် ထပ်ထည့်ရန်</h3>
        <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">ရာထူး (Role)</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-indigo-500">
              <option value="manager">Manager</option>
              <option value="supervisor">Supervisor</option>
              <option value="storekeeper">Store Keeper</option>
              <option value="staff">Staff</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">အမည်ရင်း (Display Name)</label>
            <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" required placeholder="ဥပမာ - ဦးမျိုးမင်းဌေး" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Username (အကောင့်အမည်)</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" required placeholder="ဥပမာ - myo_min" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" required placeholder="လျှို့ဝှက်နံပါတ်" />
          </div>
          <button type="submit" className="bg-indigo-600 text-white p-2.5 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors w-full h-11">
            အကောင့်ဖန်တီးမည်
          </button>
        </form>
      </div>

      <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-indigo-50 text-indigo-900 border-b border-indigo-200">
              <tr>
                <th className="p-4 font-bold">အမည် (Name)</th>
                <th className="p-4 font-bold">ရာထူး (Role)</th>
                <th className="p-4 font-bold">Username</th>
                <th className="p-4 font-bold">Password ပြင်ဆင်ရန်</th>
                <th className="p-4 font-bold text-center">လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b hover:bg-indigo-50 transition-colors">
                  <td className="p-4 font-bold text-gray-800">{acc.displayName}</td>
                  <td className="p-4 font-semibold text-indigo-600">{getRoleName(acc.role)}</td>
                  <td className="p-4 text-gray-600">{acc.username}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type={visiblePasswords[acc.id] ? "text" : "password"} 
                        value={acc.password || ''} 
                        onChange={(e) => handlePasswordChange(acc.id, e.target.value)}
                        className="border border-gray-300 p-2 rounded-lg w-40 focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                      />
                      <button 
                        onClick={() => togglePasswordVisibility(acc.id)}
                        className="px-3 py-2 text-xl text-gray-500 hover:text-indigo-600 hover:bg-indigo-100 rounded-lg transition-colors"
                        title="Show/Hide Password"
                      >
                        {visiblePasswords[acc.id] ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleDelete(acc.id, acc.role)}
                      disabled={acc.role === 'manager'}
                      className={`px-4 py-1.5 rounded-lg font-bold transition-all ${acc.role === 'manager' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-600 hover:bg-red-600 hover:text-white shadow-sm'}`}
                    >
                      ဖျက်မည်
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="bg-yellow-50 p-4 text-sm text-yellow-800 border-t border-yellow-200">
          <b>မှတ်ချက်:</b> ဤနေရာတွင် ပြင်ဆင်လိုက်သော Password များနှင့် အကောင့်သစ်များကို သက်ဆိုင်ရာ ဝန်ထမ်းများ နောက်တစ်ကြိမ် Login ဝင်သည့်အခါ အသုံးပြုရမည်ဖြစ်ပါသည်။
        </div>
      </div>
    </div>
  );
};
