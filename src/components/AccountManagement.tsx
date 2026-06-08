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
  currentUserRole: string; // MD ဟုတ်မဟုတ် စစ်ဆေးရန်
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ accounts, setAccounts, currentUserRole }) => {
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: number]: boolean }>({});

  // MD ဟုတ်/မဟုတ် တိတိကျကျ စစ်ဆေးခြင်း
  const isMD = currentUserRole === 'md';

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
    setNewDisplayName(''); setNewUsername(''); setNewPassword('');
    alert('✅ အကောင့်သစ် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
  };

  const handleDelete = (id: number, role: string) => {
    // MD အကောင့်ကို မည်သည့်အကြောင်းနှင့်မျှ ဖျက်ခွင့်မပေးပါ
    if (role === 'md') {
      alert('⚠️ MD (Managing Director) အကောင့်ကို ဖျက်ခွင့်မရှိပါ။');
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
      case 'md': return 'Managing Director (MD)';
      case 'manager': return 'စက်ရုံမှူး (Manager)';
      case 'finance': return 'Finance Manager';
      case 'qc': return 'QC / QA';
      case 'purchasing': return 'Purchasing Officer';
      case 'storekeeper': return 'Store Keeper';
      case 'maintenance': return 'Maintenance';
      case 'staff': return 'Staff (ဝန်ထမ်း)';
      default: return role;
    }
  };

  // MD မဟုတ်ပါက လုံးဝ ဝင်ခွင့်ပိတ်မည့် မျက်နှာပြင် (Strict Block)
  if (!isMD) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-10 text-center">
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-10 shadow-lg">
          <div className="text-6xl mb-4">🛡️</div>
          <h2 className="text-3xl font-extrabold text-red-700 mb-4">Access Denied (ဝင်ခွင့်မရှိပါ)</h2>
          <p className="text-lg text-red-500 font-medium">
            ဤစာမျက်နှာ (အကောင့်နှင့် လုံခြုံရေး စီမံခန့်ခွဲမှု) ကို Managing Director (MD) တစ်ဦးတည်းသာလျှင် ဝင်ရောက်ကြည့်ရှုခွင့် နှင့် ပြင်ဆင်ခွင့် ရှိပါသည်။
          </p>
        </div>
      </div>
    );
  }

  // MD ဝင်လာပါက မြင်ရမည့် မျက်နှာပြင်
  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-red-700 border-b-2 border-red-200 pb-3 flex items-center gap-3">
        <span>👑</span> MD's Security Dashboard (Full Authority)
      </h2>

      <div className="bg-white shadow-xl p-6 rounded-2xl border-t-4 border-red-500">
        <h3 className="text-lg font-bold text-gray-800 mb-4">+ အကောင့်အသစ် ထပ်ထည့်ရန်</h3>
        <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ရာထူး (Role)</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full bg-gray-50 focus:border-red-500 focus:ring-0 font-semibold text-gray-700">
              <option value="md">Managing Director (MD)</option>
              <option value="manager">စက်ရုံမှူး (Manager)</option>
              <option value="finance">Finance Manager</option>
              <option value="qc">QC / QA</option>
              <option value="purchasing">Purchasing Officer</option>
              <option value="storekeeper">Store Keeper</option>
              <option value="maintenance">Maintenance</option>
              <option value="staff">Staff (ဝန်ထမ်း)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">အမည်ရင်း (Display Name)</label>
            <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0" required placeholder="ဥပမာ - ဦးမျိုးမင်းဌေး" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Username (အကောင့်)</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0" required placeholder="ဥပမာ - md_myo" />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0" required placeholder="လျှို့ဝှက်နံပါတ်" />
          </div>
          <button type="submit" className="bg-red-600 text-white p-2.5 rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors w-full h-12">
            အကောင့်ဖန်တီးမည်
          </button>
        </form>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-red-50 text-red-900 border-b-2 border-red-100">
              <tr>
                <th className="p-4 font-extrabold">အမည် (Name)</th>
                <th className="p-4 font-extrabold">ရာထူး (Role)</th>
                <th className="p-4 font-extrabold">Username</th>
                <th className="p-4 font-extrabold">Password စီမံရန်</th>
                <th className="p-4 font-extrabold text-center">လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {accounts.map((acc) => (
                <tr key={acc.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 font-bold text-gray-800">{acc.displayName}</td>
                  <td className="p-4 font-bold text-red-600">{getRoleName(acc.role)}</td>
                  <td className="p-4 text-gray-600 font-medium">{acc.username}</td>
                  <td className="p-4">
                    <div className="flex items-center gap-2">
                      <input 
                        type={visiblePasswords[acc.id] ? "text" : "password"} 
                        value={acc.password || ''} 
                        onChange={(e) => handlePasswordChange(acc.id, e.target.value)}
                        className="border-2 border-gray-200 p-2 rounded-xl w-40 focus:border-red-500 outline-none bg-gray-50 font-bold"
                      />
                      <button 
                        onClick={() => togglePasswordVisibility(acc.id)}
                        className="px-3 py-2 text-xl text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                        title="Show/Hide Password"
                      >
                        {visiblePasswords[acc.id] ? '👁️' : '👁️‍🗨️'}
                      </button>
                    </div>
                  </td>
                  <td className="p-4 text-center">
                    <button 
                      onClick={() => handleDelete(acc.id, acc.role)}
                      disabled={acc.role === 'md'}
                      className={`px-4 py-2 rounded-xl font-bold transition-all ${acc.role === 'md' ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-red-100 text-red-700 hover:bg-red-600 hover:text-white shadow-sm'}`}
                    >
                      ဖျက်မည်
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
