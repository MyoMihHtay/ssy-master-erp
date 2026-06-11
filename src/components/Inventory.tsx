import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps { userRole: string; userName: string; items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; onStockIn: (itemName: string, qty: number, totalCost: number) => void; }

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [warehouseTab, setWarehouseTab] = useState<'RM' | 'SFG' | 'PKG'>('RM'); 
  const [searchQuery, setSearchQuery] = useState('');

  // 🌟 MD (Managing Director) သာလျှင် ဖျက်ခွင့်/ပြင်ခွင့်ရှိမည့် Role Guard
  const isMDOnly = userRole?.toLowerCase() === 'md';

  // 🌟 ဂိုထောင်အမျိုးအစား (Triple Warehouse) အတိအကျ ခွဲခြားသည့် Logic
  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!item) return false;
      
      // 1. Data အဟောင်းများတွင် warehouse မပါလျှင် code ဖြင့် Auto-Detect လုပ်ပေးခြင်း
      let actualWarehouse = item.warehouse;
      if (!actualWarehouse) {
        if (item.code?.startsWith('PK') || item.category === 'Packaging') actualWarehouse = 'PKG';
        else if (item.code?.startsWith('SFG')) actualWarehouse = 'SFG';
        else actualWarehouse = 'RM';
      }

      // 2. သက်ဆိုင်ရာ Tab အလိုက် တိကျစွာ စစ်ထုတ်ခြင်း
      const matchWarehouse = actualWarehouse === warehouseTab;
      
      // 3. Search ရှာဖွေမှု
      const matchSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.code?.toLowerCase().includes(searchQuery.toLowerCase());
      
      return matchWarehouse && matchSearch;
    });
  }, [items, searchQuery, warehouseTab]);

  const handleDelete = (item: InventoryItem) => {
    if (!isMDOnly) return alert("❌ MD အကောင့်ဖြင့်သာ ဖျက်ခွင့်ရှိပါသည်။");
    if (item.inStock > 0) return alert(`❌ ဖျက်၍မရပါ။ လက်ကျန် (${item.inStock}) ရှိနေပါသည်။`);
    if (window.confirm(`⚠️ ${item.name} အား ဖျက်ရန် သေချာပါသလား?`)) {
      setItems(items.filter(i => i.id !== item.id));
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <div className="flex items-center gap-3 border-b-2 border-blue-200 pb-4 mb-6">
         <span className="text-4xl">📦</span>
         <h2 className="text-2xl font-bold text-blue-800">ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု (Triple Warehouse)</h2>
      </div>
      
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
        <button onClick={() => setWarehouseTab('RM')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'RM' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
           📦 RM (ကုန်ကြမ်း)
        </button>
        <button onClick={() => setWarehouseTab('SFG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'SFG' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
           🍳 SFG (ကုန်ပိုင်း)
        </button>
        <button onClick={() => setWarehouseTab('PKG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'PKG' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
           🏷️ PKG (ထုပ်ပိုးမှု)
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span>{warehouseTab === 'RM' ? '📦' : warehouseTab === 'SFG' ? '🍳' : '🏷️'}</span>
            လက်ရှိပြသနေသော ဂိုထောင်: {warehouseTab === 'RM' ? 'Raw Materials' : warehouseTab === 'SFG' ? 'Semi-Finished Goods' : 'Packaging Materials'}
          </h3>
          <input type="text" placeholder="🔍 ပစ္စည်းအမည် ရှာရန်..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-lg w-full md:w-72 outline-none focus:border-blue-500 font-bold" />
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">ပစ္စည်းအမည်</th>
                <th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်အရေအတွက်</th>
                {isMDOnly && <th className="p-4 font-bold text-gray-700 text-center">Action (MD Only)</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b hover:bg-blue-50/50 transition-colors">
                  <td className="p-4 text-gray-600 font-bold">{item.code}</td>
                  <td className="p-4 font-black text-gray-800 text-lg">{item.name}</td>
                  <td className="p-4 text-right font-black text-xl text-indigo-700">
                    {item.inStock?.toLocaleString()} <span className="text-sm font-bold text-gray-500">{item.unit}</span>
                  </td>
                  {/* 🌟 MD သာလျှင် Delete ခလုတ်ကို မြင်ရ/နှိပ်ရပါမည် */}
                  {isMDOnly && (
                    <td className="p-4 text-center">
                      <button onClick={() => handleDelete(item)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-sm">
                        ဖျက်မည်
                      </button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={isMDOnly ? 4 : 3} className="p-8 text-center text-gray-400 font-bold">ဤဂိုထောင်တွင် ပစ္စည်းစာရင်း မရှိသေးပါ။</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
