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
    { id: 'procurement', name: 'ဝယ်ယူရေး', icon: '🛒' },
    { id: 'inventory', name: 'ကုန်လှောင်ရုံ', icon: '📦' },
    { id: 'production', name: 'ထုတ်လုပ်မှု', icon: '🍳' },
    { id: 'packaging', name: 'ထုပ်ပိုးမှု', icon: '🏷️' },
    { id: 'finished_goods', name: 'ကုန်ချော', icon: '🛍️' },
    { id: 'expenses', name: 'အသုံးစရိတ်', icon: '💰' },
  ];

  return (
    <div className="w-full md:w-64 bg-gray-900 text-white md:min-h-screen flex flex-col shadow-2xl transition-all duration-300">
      
      {/* 🌟 Header Section (Mobile တွင် ဘေးတိုက်၊ Desktop တွင် အထက်အောက် ပေါ်ပါမည်) */}
      <div className="flex justify-between items-center md:flex-col md:justify-center p-3 md:p-6 border-b border-gray-800">
        <div className="flex items-center gap-2 md:flex-col md:gap-0 text-left md:text-center">
          <h1 className="text-2xl md:text-3xl font-black text-blue-500 tracking-wider">SSY</h1>
          <p className="text-[10px] md:text-xs text-gray-400 tracking-widest uppercase font-bold hidden md:block mt-1">Master ERP</p>
        </div>
        
        {/* Mobile သီးသန့် အသုံးပြုသူအမည် နှင့် Logout ခလုတ် */}
        <div className="flex md:hidden items-center gap-3">
            <div className="text-right">
               <div className="text-[9px] text-gray-400 uppercase">User</div>
               <div className="font-bold text-green-400 text-xs">{userName}</div>
            </div>
            <button onClick={onLogout} className="bg-red-500/20 text-red-400 px-3 py-1.5 rounded-lg text-xs font-bold border border-red-500/30">
              ထွက်မည်
            </button>
        </div>
      </div>

      {/* Desktop သီးသန့် အသုံးပြုသူပြသသည့်နေရာ */}
      <div className="hidden md:block p-6 border-b border-gray-800 bg-gray-800/50">
        <div className="text-xs text-gray-400 mb-1">လက်ရှိအသုံးပြုသူ</div>
        <div className="font-bold text-green-400">{userName}</div>
      </div>

      {/* 🌟 Navigation Menu (Mobile တွင် ဘယ်ညာပွတ်ဆွဲ၍ရပြီး၊ Desktop တွင် အောက်သို့စီပါမည်) */}
      <nav className="flex flex-row md:flex-col overflow-x-auto md:overflow-y-auto flex-1 p-2 md:p-4 space-x-2 md:space-x-0 md:space-y-2">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all font-medium text-sm md:text-base ${activeTab === tab.id ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
            <span className="text-lg md:text-xl">{tab.icon}</span>
            <span className="whitespace-nowrap">{tab.name}</span>
          </button>
        ))}
        {userRole === 'md' && (
          <button onClick={() => setActiveTab('accounts')} className={`flex-shrink-0 md:w-full flex items-center space-x-2 md:space-x-3 px-4 py-2.5 md:py-3 rounded-lg md:rounded-xl transition-all font-medium text-sm md:text-base ${activeTab === 'accounts' ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/50' : 'text-gray-400 hover:bg-gray-800 hover:text-gray-200'}`}>
            <span className="text-lg md:text-xl">👥</span>
            <span className="whitespace-nowrap">အကောင့်များ</span>
          </button>
        )}
      </nav>

      {/* Desktop သီးသန့် Logout ခလုတ် */}
      <div className="hidden md:block p-4 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center justify-center space-x-2 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-all font-bold">
          <span>[→ အကောင့်ထွက်မည်</span>
        </button>
      </div>
    </div>
  );
};
