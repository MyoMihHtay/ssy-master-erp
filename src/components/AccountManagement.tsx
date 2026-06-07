import React, { useState } from 'react';

// App.tsx မှာ သတ်မှတ်ထားတဲ့ Account Interface
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
  // အကောင့်သစ်အတွက် State များ
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');

  // Password ဖျောက်/ပြ လုပ်ရန် State (Row ID လိုက် မှတ်ထားမည်)
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: number]: boolean }>({});

  // ၁။ အကောင့်သစ် ထည့်သွင်းခြင်း Function
  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword) return;

    // Username တူနေခြင်း ရှိမရှိ စစ်ဆေးရန်
    if (accounts.some(acc => acc.username === newUsername)) {
      alert('ဤ Username ကို အသုံးပြုထားပြီးဖြစ်ပါသည်။ အခြား Username ပြောင်းပေးပါ။');
      return;
    }

    const newAccount: Account = {
      id: Date.now(),
      username: newUsername,
      password: newPassword,
      role: newRole,
      displayName: getRoleName(newRole) // ယာယီအားဖြင့် Role နာမည်ကိုသာ Display Name အဖြစ် သုံးထားပါသည်
    };

    setAccounts([...accounts, newAccount]);
    setNewUsername('');
    setNewPassword('');
    alert('အကောင့်သစ် အောင်မြင်စွာ ထည့်သွင်းပြီးပါပြီ။');
  };

  // ၂။ အကောင့် ဖျက်ခြင်း Function
  const handleDelete = (id: number, role: string) => {
    if (role === 'manager') {
      alert('Manager (စက်ရုံမှူး) အကောင့်ကို ဖျက်ခွင့်မရှိပါ။');
      return;
    }
    if (window.confirm('ဤအကောင့်ကို ဖျက်ရန် သေချာပါသလား?')) {
      setAccounts(accounts.filter(a => a.id !== id));
    }
  };

  // ၃။ Password ပြင်ဆင်ခြင်း (Real-time update)
  const handlePasswordChange = (id: number, newPass: string) => {
    setAccounts(accounts.map(acc => acc.id === id ? { ...acc, password: newPass } : acc));
  };

  // ၄။ Password မျက်စိ (Show/Hide) ခလုတ်
  const togglePasswordVisibility = (id: number) => {
    setVisiblePasswords(prev => ({ ...prev, [id]: !prev[id] }));
  };

  // Role နာမည်များကို မြန်မာလို ပြရန် Helper Function
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
    <div className="p-6 max-w-5xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-indigo-700 border-b pb-2 flex items-center gap-2">
        <span>🔑</span> အကောင့်နှင့် လုံခြုံရေး စီမံခန့်ခွဲမှု (Manager Access Only)
      </h2>

      {/* အကောင့်သစ် ထည့်ရန် Form */}
      <div className="bg-white shadow-md p-6 rounded-xl border-t-4 border-indigo-500">
        <h3 className="text-lg font-bold text-gray-800 mb-4">+ အကောင့်အသစ် ထပ်ထည့်ရန်</h3>
        <form onSubmit={handleAddAccount} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-1">ရာထူး (Role)</label>
            <select value={newRole} onChange={e => setNewRole(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-indigo-500">
              <option value="manager">Manager (စက်ရုံမှူး)</option>
              <option value="supervisor">Supervisor (ကြီးကြပ်သူ)</option>
              <option value="storekeeper">Store Keeper (ဂိုဒေါင်မှူး)</option>
              <option value="staff">Staff (ဝန်ထမ်း)</option>
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Username</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" required placeholder="ဥပမာ - aung_aung" />
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Password</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-indigo-500" required placeholder="လျှို့ဝှက်နံပါတ်" />
          </div>
          <button type="submit" className="bg-indigo-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-indigo-700 transition-colors">
            ထည့်သွင်းမည်
          </button>
        </form>
      </div>

      {/* လက်ရှိ အကောင့်များ စာရင်း */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-indigo-50 text-indigo-900 border-b border-indigo-200">
            <tr>
              <th className="p-4 font-bold">ရာထူး (Role)</th>
              <th className="p-4 font-bold">Username</th>
              <th className="p-4 font-bold">Password ပြင်ဆင်ရန်</th>
              <th className="p-4 font-bold text-center">လုပ်ဆောင်ချက်</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((acc) => (
              <tr key={acc.id} className="border-b hover:bg-indigo-50 transition-colors">
                <td className="p-4 font-semibold text-gray-800">{getRoleName(acc.role)}</td>
                <td className="p-4 text-gray-600">{acc.username}</td>
                <td className="p-4">
                  <div className="flex items-center gap-2">
                    <input 
                      type={visiblePasswords[acc.id] ? "text" : "password"} 
                      value={acc.password || ''} 
                      onChange={(e) => handlePasswordChange(acc.id, e.target.value)}
                      className="border border-gray-300 p-2 rounded-lg w-40 focus:ring-2 focus:ring-indigo-500 bg-gray-50"
                    />
                    {/* မျက်စိ ပုံစံ Icon Button */}
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
        
        {/* မူလက ပါဝင်သော သတိပေးချက် စာသား */}
        <div className="bg-yellow-50 p-4 text-sm text-yellow-800 border-t border-yellow-200">
          <b>မှတ်ချက်:</b> ဤနေရာတွင် ပြင်ဆင်လိုက်သော Password များနှင့် အကောင့်သစ်များကို သက်ဆိုင်ရာ ဝန်ထမ်းများ နောက်တစ်ကြိမ် Login ဝင်သည့်အခါ အသုံးပြုရမည်ဖြစ်ပါသည်။ (Database မချိတ်ရသေးသဖြင့် Browser Refresh လုပ်ပါက မူလ Password သို့ ပြန်ရောက်သွားပါမည်။)
        </div>
      </div>
    </div>
  );
};
