import React from 'react';
import { tr, type AppLanguage, type TranslationKey } from '../i18n';

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userName: string;
  userRole: string;
  onLogout: () => void;
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

interface SidebarNavItem {
  id: string;
  labelKey: TranslationKey;
  icon: string;
  roles: string[];
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  userName,
  userRole,
  onLogout,
  language,
  setLanguage,
}) => {
  const role = (userRole || '').toLowerCase();

  const navItems: SidebarNavItem[] = [
    { id: 'dashboard', labelKey: 'dashboard', icon: '📊', roles: ['md', 'manager'] },

    { id: 'workspace', labelKey: 'workspace', icon: '💬',
      roles: ['md', 'manager', 'sales', 'finance', 'purchasing', 'qc', 'storekeeper', 'production', 'hr'] },

    { id: 'sales', labelKey: 'sales', icon: '💰',
      roles: ['md', 'manager', 'sales', 'finance'] },

    { id: 'procurement', labelKey: 'procurement', icon: '🛒',
      roles: ['md', 'manager', 'purchasing', 'qc', 'finance', 'storekeeper'] },

    { id: 'inventory', labelKey: 'inventory', icon: '📦',
      roles: ['md', 'manager', 'storekeeper', 'qc', 'production'] },

    { id: 'production', labelKey: 'production', icon: '🍳',
      roles: ['md', 'manager', 'production'] },

    { id: 'packaging', labelKey: 'packaging', icon: '🏷️',
      roles: ['md', 'manager', 'production'] },

    { id: 'finished_goods', labelKey: 'finishedGoods', icon: '🛍️',
      roles: ['md', 'manager', 'storekeeper', 'sales', 'qc'] },

    { id: 'expenses', labelKey: 'finance', icon: '💸',
      roles: ['md', 'manager', 'finance'] },

    { id: 'reports', labelKey: 'reports', icon: '📑',
      roles: ['md', 'manager', 'finance'] },

    { id: 'hr', labelKey: 'hr', icon: '👥',
      roles: ['all'] },

    { id: 'accounts', labelKey: 'accounts', icon: '⚙️',
      roles: ['md'] },
  ];

  const filteredNavItems = navItems.filter(
    item =>
      role === 'md' ||
      item.roles.includes('all') ||
      item.roles.includes(role)
  );

  return (
    <div className="flex flex-col h-full text-white bg-slate-900 shadow-2xl">

      <div className="p-6 text-center border-b border-slate-800">
        <h1 className="text-4xl font-black text-blue-500 tracking-wider">
          MAVORA
        </h1>

        <p className="text-[10px] font-bold text-slate-400 tracking-widest mt-1">
          MANUFACTURING ERP
        </p>
      </div>

      <div className="p-5 border-b border-slate-800 bg-slate-800/30">

        <div className="text-[11px] text-slate-400 font-bold mb-1">
          {tr(language, 'currentUser')}
        </div>

        <div className="font-black text-emerald-400 truncate text-lg">
          {userName}
        </div>

        <div className="text-xs uppercase tracking-wider text-slate-500 mt-1 font-bold">
          {role}
        </div>

        <div className="mt-4">

          <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-2">
            🌐 {tr(language, 'language')}
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-xl bg-slate-900/70 p-1 border border-slate-700">

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLanguage('my');
              }}
              className={`px-2 py-2 rounded-lg text-xs font-black transition-all ${
                language === 'my'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              မြန်မာ
            </button>

            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                setLanguage('en');
              }}
              className={`px-2 py-2 rounded-lg text-xs font-black transition-all ${
                language === 'en'
                  ? 'bg-blue-600 text-white shadow'
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              EN
            </button>

          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-6 custom-scrollbar">
        <ul className="space-y-2 px-4">

          {filteredNavItems.map(item => (

            <li key={item.id}>

              <button
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-xl font-bold transition-all duration-200 ${
                  activeTab === item.id
                    ? 'bg-blue-600 text-white shadow-lg scale-[1.02]'
                    : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'
                }`}
              >

                <span className="text-xl shrink-0">
                  {item.icon}
                </span>

                <span className="tracking-wide text-left leading-tight">
                  {tr(language, item.labelKey)}
                </span>

              </button>

            </li>

          ))}

        </ul>
      </nav>

      <div className="p-4 border-t border-slate-800 bg-slate-900">

        <button
          onClick={onLogout}
          className="w-full flex items-center justify-center gap-2 px-4 py-3.5 bg-rose-500/10 text-rose-500 hover:bg-rose-500 hover:text-white rounded-xl font-bold transition-colors shadow-sm"
        >

          <span className="text-lg">🚪</span>

          {tr(language, 'logout')}

        </button>

      </div>

    </div>
  );
};
