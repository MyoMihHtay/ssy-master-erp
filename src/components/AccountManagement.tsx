import React, { useState } from 'react';
import { tr, type AppLanguage } from '../i18n';

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
  language: AppLanguage;
}

export const AccountManagement: React.FC<AccountManagementProps> = ({ accounts, setAccounts, currentUserRole, language }) => {
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState('staff');
  const [visiblePasswords, setVisiblePasswords] = useState<{ [key: number]: boolean }>({});

  const isMD = currentUserRole === 'md';

  const handleAddAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUsername || !newPassword || !newDisplayName || !newRole) {
      alert(tr(language, 'accountRequiredFields'));
      return;
    }

    if (accounts.some(acc => acc.username === newUsername)) {
      alert(tr(language, 'accountUsernameExists'));
      return;
    }

    const newAccount: Account = {
      id: Date.now(),
      username: newUsername,
      password: newPassword,
      // 🌟 အသစ်ထည့်လိုက်သော ရာထူးအားလုံးကို အလွယ်တကူ စစ်ဆေးနိုင်ရန် lowercase ပြောင်းသိမ်းပါသည် 🌟
      role: newRole.toLowerCase(),
      displayName: newDisplayName
    };

    setAccounts([...accounts, newAccount]);
    setNewDisplayName(''); setNewUsername(''); setNewPassword(''); setNewRole('');
    alert(tr(language, 'accountCreatedSuccess'));
  };

  const handleDelete = (id: number, role: string) => {
    if (role === 'md') {
      alert(tr(language, 'accountMdDeleteBlocked'));
      return;
    }
    if (window.confirm(tr(language, 'accountDeleteConfirm'))) {
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
      case 'md': return tr(language, 'accountRoleMD');
      case 'manager': return tr(language, 'accountRoleManager');
      case 'finance': return tr(language, 'accountRoleFinance');
      case 'qc': return tr(language, 'accountRoleQC');
      case 'purchasing': return tr(language, 'accountRolePurchasing');
      case 'storekeeper': return tr(language, 'accountRoleStorekeeper');
      case 'maintenance': return tr(language, 'accountRoleMaintenance');
      case 'staff': return tr(language, 'accountRoleStaff');
      case 'sales': return tr(language, 'accountRoleSales');
      case 'hr': return tr(language, 'accountRoleHR');
      // 🌟 ရာထူးအသစ်များအတွက် သူရိုက်ထည့်ထားသည့်အတိုင်း ပြန်ပြပါမည် 🌟
      default: return role.toUpperCase();
    }
  };

  if (!isMD) {
    return (
      <div className="p-6 max-w-4xl mx-auto mt-10 text-center">
        <div className="bg-red-50 border-2 border-red-200 rounded-3xl p-10 shadow-lg">
          <div className="text-6xl mb-4">🛡️</div>
          <h2 className="text-3xl font-extrabold text-red-700 mb-4">{tr(language, 'accountAccessDenied')}</h2>
          <p className="text-lg text-red-500 font-medium">
            {tr(language, 'accountAccessDeniedDesc')}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-red-700 border-b-2 border-red-200 pb-3 flex items-center gap-3">
        <span>👑</span> {tr(language, 'accountSecurityDashboard')}
      </h2>

      <div className="bg-white shadow-xl p-6 rounded-2xl border-t-4 border-red-500">
        <h3 className="text-lg font-bold text-gray-800 mb-4">+ {tr(language, 'accountAddNew')}</h3>
        <form onSubmit={handleAddAccount} className="grid grid-cols-1 md:grid-cols-5 gap-4 items-end">

          {/* 🌟 ရာထူးကို စိတ်ကြိုက် ရိုက်ထည့်နိုင်ရန် <datalist> အသုံးပြုထားပါသည် 🌟 */}
          <div className="relative">
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr(language, 'accountRole')}</label>
            <input
               list="role-options"
               value={newRole}
               onChange={e => setNewRole(e.target.value)}
               placeholder={tr(language, 'accountRolePlaceholder')}
               className="border-2 border-gray-200 p-2.5 rounded-xl w-full bg-gray-50 focus:border-red-500 focus:ring-0 font-bold text-gray-800 outline-none"
               required
            />
            <datalist id="role-options">
              <option value="md">{tr(language, 'accountRoleMD')}</option>
              <option value="manager">{tr(language, 'accountRoleManager')}</option>
              <option value="finance">{tr(language, 'accountRoleFinance')}</option>
              <option value="qc">{tr(language, 'accountRoleQC')}</option>
              <option value="purchasing">{tr(language, 'accountRolePurchasing')}</option>
              <option value="storekeeper">{tr(language, 'accountRoleStorekeeper')}</option>
              <option value="maintenance">{tr(language, 'accountRoleMaintenance')}</option>
              <option value="staff">{tr(language, 'accountRoleStaff')}</option>
              <option value="driver">{tr(language, 'accountRoleDriver')}</option>
              <option value="security">{tr(language, 'accountRoleSecurity')}</option>
              <option value="electrician">{tr(language, 'accountRoleElectrician')}</option>
            </datalist>
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr(language, 'accountDisplayName')}</label>
            <input type="text" value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0 outline-none" required placeholder={tr(language, 'accountDisplayNamePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr(language, 'accountUsername')}</label>
            <input type="text" value={newUsername} onChange={e => setNewUsername(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0 outline-none" required placeholder={tr(language, 'accountUsernamePlaceholder')} />
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">{tr(language, 'accountPassword')}</label>
            <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0 outline-none" required placeholder={tr(language, 'accountPasswordPlaceholder')} />
          </div>
          <button type="submit" className="bg-red-600 text-white p-2.5 rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors w-full h-12">
            {tr(language, 'accountCreate')}
          </button>
        </form>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-red-50 text-red-900 border-b-2 border-red-100">
              <tr>
                <th className="p-4 font-extrabold">{tr(language, 'accountNameColumn')}</th>
                <th className="p-4 font-extrabold">{tr(language, 'accountRoleColumn')}</th>
                <th className="p-4 font-extrabold">Username</th>
                <th className="p-4 font-extrabold">{tr(language, 'accountPasswordManagement')}</th>
                <th className="p-4 font-extrabold text-center">{tr(language, 'accountActions')}</th>
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
                        title={tr(language, 'accountShowHidePassword')}
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
                      {tr(language, 'accountDelete')}
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