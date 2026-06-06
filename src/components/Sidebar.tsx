import React from 'react';
import { LayoutDashboard, Warehouse, PackageCheck, CircleDollarSign, Receipt, LogOut, Users } from 'lucide-react';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
  userRole: string; // ရာထူးကို လက်ခံမည်
  onLogout: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ activeTab, setActiveTab, userName, userRole, onLogout }) => {
  // ရာထူးအလိုက် မြင်ရမည့် မီနူးများကို သတ်မှတ်ခြင်း
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, roles: ['manager', 'supervisor', 'staff'] },
    { id: 'inventory', label: 'ကုန်လှောင်ရုံ (Warehouse)', icon: Warehouse, roles: ['manager', 'supervisor'] }, // Staff မမြင်ရ
    { id: 'production', label: 'ထုတ်လုပ်မှု (Production)', icon: PackageCheck, roles: ['manager', 'supervisor', 'staff'] },
    { id: 'finished_goods', label: 'ကုန်ချောစာရင်း', icon: PackageCheck, roles: ['manager', 'supervisor', 'staff'] },
    { id: 'expenses', label: 'အသုံးစရိတ်များ', icon: CircleDollarSign, roles: ['manager', 'supervisor'] }, // Staff မမြင်ရ
    { id: 'invoices', label: 'အရောင်းဘောင်ချာ', icon: Receipt, roles: ['manager', 'supervisor'] },
    { id: 'accounts', label: 'အကောင့်စီမံခန့်ခွဲမှု', icon: Users, roles: ['manager'] }, // Manager သာ မြင်ရမည်
  ];

  // လက်ရှိရာထူးနှင့် ကိုက်ညီသော မီနူးများကိုသာ စစ်ထုတ်ခြင်း
  const visibleMenus = menuItems.filter(item => item.roles.includes(userRole));

  return (
    <div className="w-64 bg-gray-900 text-white min-h-screen p-4 shadow-xl flex flex-col">
      <div className="mb-8 mt-4 text-center">
        <h1 className="text-3xl font-extrabold text-blue-400">SSY</h1>
        <p className="text-sm text-gray-400 tracking-widest mt-1">MASTER ERP</p>
      </div>

      <div className="bg-gray-800 p-3 rounded-xl mb-6 border border-gray-700">
        <p className="text-xs text-gray-400 mb-1">လက်ရှိအသုံးပြုသူ</p>
        <p className="text-sm font-bold text-green-400">{userName}</p>
      </div>
      
      <nav className="flex-1">
        {visibleMenus.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full flex items-center gap-4 p-3 rounded-xl mb-3 transition-all duration-200 text-left ${
                activeTab === item.id 
                  ? 'bg-blue-600 text-white shadow-md' 
                  : 'hover:bg-gray-800 text-gray-400 hover:text-white'
              }`}
            >
              <Icon size={22} className="flex-shrink-0" />
              <span className="font-medium leading-tight">{item.label}</span>
            </button>
          );
        })}
      </nav>

      <div className="mt-auto pt-4 border-t border-gray-800">
        <button onClick={onLogout} className="w-full flex items-center gap-4 p-3 rounded-xl hover:bg-red-600/20 text-red-400 hover:text-red-500 transition-colors text-left">
          <LogOut size={22} className="flex-shrink-0" />
          <span className="font-medium leading-tight">အကောင့်ထွက်မည်</span>
        </button>
      </div>
    </div>
  );
};
