import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps { userRole: string; userName: string; items: InventoryItem[]; setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; onStockIn: (itemName: string, qty: number, totalCost: number) => void; }

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [warehouseTab, setWarehouseTab] = useState<'RM' | 'SFG' | 'PKG'>('RM'); 
  const [searchQuery, setSearchQuery] = useState('');

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item && (item.warehouse === warehouseTab || (!item.warehouse && warehouseTab === 'RM')) &&
      (item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.code?.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [items, searchQuery, warehouseTab]);

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-blue-800 border-b-2 pb-2">📦 ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု (Triple Warehouse)</h2>
      
      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 bg-white p-2 rounded-xl shadow-sm border">
        <button onClick={() => setWarehouseTab('RM')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'RM' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}>
           📦 RM (ကုန်ကြမ်း)
        </button>
        <button onClick={() => setWarehouseTab('SFG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'SFG' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}>
           🍳 SFG (ကုန်ပိုင်း)
        </button>
        <button onClick={() => setWarehouseTab('PKG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'PKG' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-50 text-gray-500'}`}>
           🏷️ PKG (ထုပ်ပိုးမှု)
        </button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-gray-700">
            လက်ရှိဂိုထောင်: {warehouseTab === 'RM' ? 'Raw Materials' : warehouseTab === 'SFG' ? 'Semi-Finished Goods' : 'Packaging Materials'}
          </h3>
          <input type="text" placeholder="🔍 ရှာရန်..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border p-2 rounded-lg w-full md:w-64 outline-none focus:border-blue-500" />
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[600px]">
            <thead className="bg-gray-100">
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">ပစ္စည်းအမည်</th>
                <th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်အရေအတွက်</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.map(item => (
                <tr key={item.id} className="border-b hover:bg-gray-50 transition-colors">
                  <td className="p-4 text-gray-600 font-medium">{item.code}</td>
                  <td className="p-4 font-bold text-gray-800">{item.name}</td>
                  <td className="p-4 text-right font-black text-lg text-indigo-700">{item.inStock?.toLocaleString()} <span className="text-sm font-medium text-gray-500">{item.unit}</span></td>
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={3} className="p-6 text-center text-gray-400 font-bold">ဤဂိုထောင်တွင် ပစ္စည်းစာရင်း မရှိသေးပါ။</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
