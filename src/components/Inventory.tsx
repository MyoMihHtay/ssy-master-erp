import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps { userRole: string; userName: string; items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; onStockIn: (itemName: string, qty: number, totalCost: number) => void; }

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [activeTab, setActiveTab] = useState<'RM' | 'SFG'>('RM'); // 🌟 ဂိုထောင် ရွေးချယ်မှု State
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.warehouse === activeTab || (!item.warehouse && activeTab === 'RM')) && // 🌟 ရွေးထားသော ဂိုထောင်အလိုက် စစ်ထုတ်မည်
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [items, searchQuery, activeTab]);

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-blue-800 border-b-2 pb-2">📦 ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု (Dual Warehouse)</h2>
      
      {/* 🌟 ဂိုထောင် ၂ ခု ခွဲထားသော ခလုတ်များ */}
      <div className="flex gap-4 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
        <button onClick={() => setActiveTab('RM')} className={`flex-1 py-3 rounded-lg font-black text-lg transition-all ${activeTab === 'RM' ? 'bg-blue-600 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
           📦 RM ဂိုထောင် (ကုန်ကြမ်း)
        </button>
        <button onClick={() => setActiveTab('SFG')} className={`flex-1 py-3 rounded-lg font-black text-lg transition-all ${activeTab === 'SFG' ? 'bg-orange-500 text-white shadow-lg scale-105' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
           🍳 SFG ဂိုထောင် (ကုန်ပိုင်း)
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className={`p-4 border-b flex justify-between items-center ${activeTab === 'RM' ? 'bg-blue-50' : 'bg-orange-50'}`}>
          <h3 className={`font-bold ${activeTab === 'RM' ? 'text-blue-800' : 'text-orange-800'}`}>
            လက်ရှိပြသနေသော ဂိုထောင်: {activeTab === 'RM' ? 'Raw Materials (RM)' : 'Semi-Finished Goods (SFG)'}
          </h3>
          <input type="text" placeholder="🔍 ရှာရန်..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border p-2 rounded-lg w-64 outline-none" />
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead className={activeTab === 'RM' ? 'bg-blue-100' : 'bg-orange-100'}>
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">အမည်</th>
                <th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600 font-medium">{item.code}</td>
                  <td className="p-4 font-bold text-gray-800">{item.name}</td>
                  <td className="p-4 text-right font-black text-lg text-gray-800">{item.inStock.toLocaleString()} <span className="text-sm font-medium text-gray-500">{item.unit}</span></td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-gray-400 font-bold">ဤဂိုထောင်တွင် ပစ္စည်းမရှိသေးပါ။</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
