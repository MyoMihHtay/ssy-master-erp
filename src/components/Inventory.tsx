import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps { 
  userRole: string; 
  userName: string; 
  items: InventoryItem[]; 
  setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>; 
  onStockIn: (itemName: string, qty: number, totalCost: number) => void; 
}

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [warehouseTab, setWarehouseTab] = useState<'RM' | 'SFG' | 'PKG'>('RM'); 
  const [searchQuery, setSearchTerm] = useState('');

  const isMDOnly = userRole?.toLowerCase() === 'md';

  const filteredItems = useMemo(() => {
    return items.filter(item => {
      if (!item) return false;
      let actualWarehouse = item.warehouse;
      if (!actualWarehouse) {
        if (item.code?.startsWith('PK') || item.category === 'Packaging') actualWarehouse = 'PKG';
        else if (item.code?.startsWith('SFG')) actualWarehouse = 'SFG';
        else actualWarehouse = 'RM';
      }
      const matchWarehouse = actualWarehouse === warehouseTab;
      const matchSearch = item.name?.toLowerCase().includes(searchQuery.toLowerCase()) || item.code?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchWarehouse && matchSearch;
    });
  }, [items, searchQuery, warehouseTab]);

  // 🌟 စုစုပေါင်း ရင်းနှီးမြှုပ်နှံမှုတန်ဖိုး တွက်ချက်ခြင်း (Inventory Valuation - LPP) 🌟
  const totalValuation = filteredItems.reduce((sum, item) => sum + (item.inStock * (item.lastPurchasePrice || 0)), 0);

  const handleDelete = (item: InventoryItem) => {
    if (!isMDOnly) return alert("❌ MD အကောင့်ဖြင့်သာ ဖျက်ခွင့်ရှိပါသည်။");
    if (item.inStock > 0) return alert(`❌ ဖျက်၍မရပါ။ လက်ကျန် (${item.inStock}) ရှိနေပါသည်။`);
    if (window.confirm(`⚠️ ${item.name} အား ဖျက်ရန် သေချာပါသလား?`)) {
      setItems(items.filter(i => i.id !== item.id));
    }
  };

  const handleEdit = (item: InventoryItem) => {
    if (!isMDOnly) return alert("❌ MD အကောင့်ဖြင့်သာ ပြင်ဆင်ခွင့်ရှိပါသည်။");
    
    const newName = window.prompt("📝 ပစ္စည်းအမည် အသစ်ရိုက်ထည့်ပါ:", item.name);
    if (newName === null) return;
    
    const newStockStr = window.prompt("📦 လက်ကျန်အရေအတွက် အသစ်ရိုက်ထည့်ပါ:", item.inStock.toString());
    if (newStockStr === null) return;
    
    // MD မှ LPP ကိုပါ Manual ပြင်ဆင်နိုင်ရန်
    const newLppStr = window.prompt("💰 ဤပစ္စည်း၏ နောက်ဆုံးဝယ်ဈေး (Unit Price) ကို ရိုက်ထည့်ပါ:", (item.lastPurchasePrice || 0).toString());
    if (newLppStr === null) return;

    setItems(items.map(i => i.id === item.id ? { ...i, name: newName, inStock: Number(newStockStr), lastPurchasePrice: Number(newLppStr) } : i));
    alert("✅ အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။");
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <div className="flex items-center gap-3 border-b-2 border-blue-200 pb-4 mb-6">
         <span className="text-4xl">📦</span>
         <h2 className="text-2xl font-bold text-blue-800">ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု (Triple Warehouse)</h2>
      </div>
      
      {/* 🌟 ရင်းနှီးမြှုပ်နှံမှု တန်ဖိုး Dashboard 🌟 */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-800 p-6 rounded-2xl shadow-xl mb-6 flex justify-between items-center text-white">
        <div>
           <p className="text-blue-200 font-bold mb-1 uppercase tracking-widest text-xs">Total Inventory Valuation</p>
           <h3 className="text-3xl md:text-4xl font-black">{totalValuation.toLocaleString()} <span className="text-xl text-blue-300">Ks</span></h3>
           <p className="text-xs text-blue-300 mt-2">*(Last Purchase Price - နောက်ဆုံးဝယ်ဈေးဖြင့် တွက်ချက်ထားသည်)*</p>
        </div>
        <div className="text-5xl opacity-50 hidden md:block">💎</div>
      </div>

      <div className="grid grid-cols-3 gap-2 md:gap-4 mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200">
        <button onClick={() => setWarehouseTab('RM')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'RM' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>📦 RM (ကုန်ကြမ်း)</button>
        <button onClick={() => setWarehouseTab('SFG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'SFG' ? 'bg-orange-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>🍳 SFG (ကုန်ပိုင်း)</button>
        <button onClick={() => setWarehouseTab('PKG')} className={`py-3 rounded-lg font-black text-xs md:text-lg transition-all ${warehouseTab === 'PKG' ? 'bg-purple-600 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>🏷️ PKG (ထုပ်ပိုးမှု)</button>
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span>{warehouseTab === 'RM' ? '📦' : warehouseTab === 'SFG' ? '🍳' : '🏷️'}</span>
            လက်ရှိပြသနေသော ဂိုထောင်: {warehouseTab === 'RM' ? 'Raw Materials' : warehouseTab === 'SFG' ? 'Semi-Finished Goods' : 'Packaging Materials'}
          </h3>
          <input type="text" placeholder="🔍 ပစ္စည်းအမည် ရှာရန်..." value={searchQuery} onChange={(e) => setSearchTerm(e.target.value)} className="border-2 border-gray-200 p-2.5 rounded-lg w-full md:w-72 outline-none focus:border-blue-500 font-bold" />
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[800px]">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">ပစ္စည်းအမည်</th>
                <th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်</th>
                <th className="p-4 font-bold text-gray-700 text-right">ဝယ်ဈေး (LPP)</th>
                <th className="p-4 font-bold text-gray-700 text-right">စုစုပေါင်းတန်ဖိုး</th>
                {isMDOnly && <th className="p-4 font-bold text-gray-700 text-center">Action</th>}
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
                  <td className="p-4 text-right font-bold text-gray-600">{(item.lastPurchasePrice || 0).toLocaleString()} Ks</td>
                  <td className="p-4 text-right font-black text-emerald-600 text-lg">{((item.lastPurchasePrice || 0) * item.inStock).toLocaleString()} Ks</td>
                  
                  {isMDOnly && (
                    <td className="p-4 text-center whitespace-nowrap">
                      <button onClick={() => handleEdit(item)} className="bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-sm mr-2">ပြင်မည်</button>
                      <button onClick={() => handleDelete(item)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-sm">ဖျက်မည်</button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredItems.length === 0 && (
                <tr><td colSpan={isMDOnly ? 6 : 5} className="p-8 text-center text-gray-400 font-bold">ဤဂိုထောင်တွင် ပစ္စည်းစာရင်း မရှိသေးပါ။</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
