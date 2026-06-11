import React from 'react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userName, userRole, onLogout }) => {
  const role = (userRole || '').toLowerCase();

  // 🌟 Menu စာရင်းနှင့် ရာထူး (Role) အလိုက် ဝင်ရောက်ခွင့် သတ်မှတ်ချက်များ 🌟
  const navItems = [
    { id: 'sales', label: 'အရောင်း (Sales)', icon: '💰', roles: ['md', 'manager', 'sales', 'finance'] }, // 🌟 အရောင်း Menu အသစ်
    { id: 'procurement', label: 'ဝယ်ယူရေး', icon: '🛒', roles: ['md', 'manager', 'purchasing', 'qc', 'finance', 'storekeeper'] },
    { id: 'inventory', label: 'ကုန်လှောင်ရုံ', icon: '📦', roles: ['md', 'manager', 'storekeeper', 'qc', 'production'] },
    { id: 'production', label: 'ထုတ်လုပ်မှု', icon: '🍳', roles: ['md', 'manager', 'production'] },
    { id: 'packaging', label: 'ထုပ်ပိုးမှု', icon: '🏷️', roles: ['md', 'manager', 'production'] },
    { id: 'finished_goods', label: 'ကုန်ချော', icon: '🛍️', roles: ['md', 'manager', 'storekeeper', 'sales'] },
    { id: 'expenses', label: 'ဘဏ္ဍာရေး/စာရင်း', icon: '📊', roles: ['md', 'manager', 'finance'] },
    { id: 'accounts', label: 'အကောင့်များ', icon: '👥', roles: ['md'] },
  ];

  return (
    <div className="flex flex-col h-full text-white bg-slate-900 shadow-2xl">
      {/* 🌟 Logo Section 🌟 */}
      <div className="p-6 text-center border-b border-slate-800">
        <h1 className="text-4xl font-black text-blue-500 tracking-wider">SSY</h1>
        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">MASTER ERP</p>
      </div>
      
      {/* 🌟 User Profile Section 🌟 */}
      <div className="p-5 border-b border-slate-800 bg-slate-800/30">
        <div className="text-[11px] text-slate-400 font-bold mb-1">လက်ရှိအသုံးပြုသူ</div>
        <div className="font-black text-emerald-400 truncate text-lg">{userName}</div>
        <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">{role}</div>
      </div>

      {/* 🌟 Navigation Menu Section 🌟 */}
      <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
        <ul className="space-y-2 px-4">
          {navItems.map(item => {
            // သက်ဆိုင်ရာ Role မရှိပါက Menu ကို ဖျောက်ထားမည် (MD ကတော့ အကုန်မြင်ရမည်)
            if (!item.roles.includes(role) && role !== 'md') return null;
            
            return (
              <li key={item.id}>
                <button
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${
                    activeTab === item.id 
                      ? 'bg-blue-600 text-white shadow-lg scale-[1.02]' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                  }`}
                >
                  <span className="text-xl">{item.icon}</span>
                  <span className="tracking-wide">{item.label}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* 🌟 Logout Section 🌟 */}
      <div className="p-4 border-t border-slate-800 bg-slate-900">
        <button 
          onClick={onLogout} 
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-colors shadow-sm"
        >
          <span className="text-lg">🚪</span> အကောင့်ထွက်မည်
        </button>
      </div>
    </div>
  );
};
