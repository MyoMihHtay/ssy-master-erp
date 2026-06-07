import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userName, userRole, onLogout }) => {
  return (
    <div className="w-64 bg-gray-900 text-white flex flex-col shadow-2xl h-screen sticky top-0">
      <div className="p-6 border-b border-gray-800 text-center">
        <h1 className="text-3xl font-black text-blue-400 tracking-wider">SSY</h1>
        <p className="text-xs text-gray-400 tracking-widest mt-1">MASTER ERP</p>
      </div>
      
      <div className="p-4 bg-gray-800 mx-4 mt-6 rounded-lg border border-gray-700">
        <p className="text-xs text-gray-400 mb-1">လက်ရှိအသုံးပြုသူ</p>
        <p className="font-bold text-green-400 truncate">{userName}</p>
      </div>

      <nav className="flex-1 px-4 mt-8 space-y-2 overflow-y-auto pb-4">
        <button
          onClick={() => setActiveTab('inventory')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'inventory' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>📦</span>
          <div className="text-left">
            <div className="text-sm">ကုန်လှောင်ရုံ</div>
            <div className="text-[10px] opacity-70">(Warehouse)</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('production')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'production' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>🍳</span>
          <div className="text-left">
            <div className="text-sm">ထုတ်လုပ်မှု</div>
            <div className="text-[10px] opacity-70">(Production)</div>
          </div>
        </button>

        {/* ⭐️ အသစ်ထည့်ထားသော Packaging Menu ⭐️ */}
        <button
          onClick={() => setActiveTab('packaging')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'packaging' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>🏷️</span>
          <div className="text-left">
            <div className="text-sm">ထုပ်ပိုးမှု</div>
            <div className="text-[10px] opacity-70">(Packaging)</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('finished_goods')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'finished_goods' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>🛍️</span>
          <div className="text-left">
            <div className="text-sm">ကုန်ချောစာရင်း</div>
            <div className="text-[10px] opacity-70">(Finished Goods)</div>
          </div>
        </button>

        <button
          onClick={() => setActiveTab('expenses')}
          className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
            activeTab === 'expenses' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
          }`}
        >
          <span>💰</span>
          <div className="text-left">
            <div className="text-sm">အသုံးစရိတ်များ</div>
            <div className="text-[10px] opacity-70">(Expenses)</div>
          </div>
        </button>

        {userRole === 'manager' && (
          <button
            onClick={() => setActiveTab('accounts')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-all duration-200 ${
              activeTab === 'accounts' ? 'bg-blue-600 text-white shadow-md' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            <span>👥</span>
            <div className="text-left">
              <div className="text-sm">အကောင့်စီမံခန့်ခွဲမှု</div>
              <div className="text-[10px] opacity-70">(Accounts)</div>
            </div>
          </button>
        )}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-bold text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
        >
          <span>[→</span>
          အကောင့်ထွက်မည်
        </button>
      </div>
    </div>
  );
};
