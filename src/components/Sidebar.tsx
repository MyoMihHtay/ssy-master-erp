import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userName, userRole, onLogout }) => {
  const tabs = [
    { id: 'inventory', name: 'ကုန်လှောင်ရုံ', icon: '📦' },
    { id: 'production', name: 'ထုတ်လုပ်မှု', icon: '🍳' },
    { id: 'packaging', name: 'ထုပ်ပိုးမှု', icon: '🏷️' },
    { id: 'finished_goods', name: 'ကုန်ချောစာရင်း', icon: '🛍️' },
    { id: 'procurement', name: 'ဝယ်ယူရေးနှင့် တင်ဒါ', icon: '🛒' }, // <--- အသစ်တိုးထားသော နေရာ
    { id: 'expenses', name: 'အသုံးစရိတ်များ', icon: '💰' },
  ];

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen flex flex-col shadow-2xl">
      <div className="p-6 text-center border-b border-gray-800">
        <h1 className="text-3xl font-black text-blue-500 mb-1 tracking-wider">SSY</h1>
        <p className="text-xs text-gray-400 tracking-widest uppercase font-bold">Master ERP</p>
      </div>
      <div className="p-6 border-b border-gray-800 bg-gray-800/50">
        <div className="text-xs text-gray-400 mb-1">လက်ရှိအသုံးပြုသူ</div>
        <div className="font-bold text-green-400">{userName}</div>
      </div>
      <nav className="flex-1 p-4 space-y-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
            <span className="text-xl">{tab.icon}</span>
            <span>{tab.name}</span>
          </button>
        ))}
        {userRole === 'md' && (
          <button onClick={() => setActiveTab('accounts')} className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl transition-all font-medium ${activeTab === 'accounts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
            <span className="text-xl">👥</span>
            <span>အကောင့်စီမံခန့်ခွဲမှု</span>
          </button>
        )}
      </nav>
      <div className="p-4 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all font-bold">
          <span>[→ အကောင့်ထွက်မည်</span>
        </button>
      </div>
    </div>
  );
};
