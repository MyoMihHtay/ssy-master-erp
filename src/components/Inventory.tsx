import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps {
  userRole: string;
  userName: string;
  items: InventoryItem[];
  setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  onStockIn: (itemName: string, qty: number, totalCost: number) => void;
}

const categories = ['Semi-Finished (အသင့်သုံး ကုန်ကြမ်း)', 'Raw Materials (အခြေခံ ကုန်ကြမ်း)', 'Packaging (ထုပ်ပိုးပစ္စည်း)', 'Consumables (အထွေထွေ အသုံးအဆောင်)'];

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [activeTab, setActiveTab] = useState<'balance' | 'stockIn' | 'newItem'>('balance');
  const [warehouseTab, setWarehouseTab] = useState<'RM' | 'SFG'>('RM'); // Dual Warehouse State
  const [searchQuery, setSearchQuery] = useState('');

  // Stock In States
  const [selectedItem, setSelectedItem] = useState('');
  const [inQty, setInQty] = useState('');
  const [totalCost, setTotalCost] = useState('');

  // New Item States
  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0]);
  const [newUnit, setNewUnit] = useState('');
  const [newWarehouse, setNewWarehouse] = useState<'RM'|'SFG'>('RM');

  const isManager = (userRole || '').toLowerCase() === 'manager' || (userRole || '').toLowerCase() === 'md';

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      (item.warehouse === warehouseTab || (!item.warehouse && warehouseTab === 'RM')) &&
      (item.name.toLowerCase().includes(searchQuery.toLowerCase()) || item.code.toLowerCase().includes(searchQuery.toLowerCase()))
    );
  }, [items, searchQuery, warehouseTab]);

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !inQty) return;
    onStockIn(selectedItem, Number(inQty), Number(totalCost || 0));
    setSelectedItem(''); setInQty(''); setTotalCost('');
    alert('✅ ပစ္စည်းအဝင်စာရင်း မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newUnit) return;
    setItems([...items, { id: Date.now(), code: newCode, name: newName, category: newCategory, unit: newUnit, inStock: 0, warehouse: newWarehouse }]);
    setNewCode(''); setNewName(''); setNewUnit(''); setActiveTab('balance'); setWarehouseTab(newWarehouse);
    alert(`✅ ပစ္စည်းအမည်သစ် "${newName}" ကို [${newWarehouse}] ဂိုထောင်သို့ ထည့်သွင်းပြီးပါပြီ။`);
  };

  const handleDelete = (item: InventoryItem) => {
    if (item.inStock > 0) return alert(`❌ ဖျက်၍မရပါ။ လက်ကျန် (${item.inStock}) ရှိနေပါသည်။`);
    if (window.confirm(`⚠️ ဖျက်ရန် သေချာပါသလား?`)) setItems(items.filter(i => i.id !== item.id));
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-blue-800 border-b-2 pb-2">📦 ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု</h2>
      
      {/* Main Action Tabs */}
      <div className="flex flex-wrap gap-2 md:gap-4 mb-6">
        <button onClick={() => setActiveTab('balance')} className={`px-4 py-2 rounded-lg font-bold text-sm md:text-base ${activeTab === 'balance' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>လက်ကျန်စာရင်း</button>
        <button onClick={() => setActiveTab('stockIn')} className={`px-4 py-2 rounded-lg font-bold text-sm md:text-base ${activeTab === 'stockIn' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>ပစ္စည်းအဝင် (Stock In)</button>
        <button onClick={() => setActiveTab('newItem')} className={`px-4 py-2 rounded-lg font-bold text-sm md:text-base ${activeTab === 'newItem' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>+ ပစ္စည်းသစ်</button>
      </div>

      {activeTab === 'balance' && (
        <>
          {/* Dual Warehouse Tabs */}
          <div className="flex gap-4 mb-4">
            <button onClick={() => setWarehouseTab('RM')} className={`flex-1 py-3 rounded-xl font-black text-lg transition-all border-2 ${warehouseTab === 'RM' ? 'bg-blue-600 text-white border-blue-700 shadow-lg' : 'bg-white text-gray-500 border-gray-200'}`}>
              📦 RM ဂိုထောင်
            </button>
            <button onClick={() => setWarehouseTab('SFG')} className={`flex-1 py-3 rounded-xl font-black text-lg transition-all border-2 ${warehouseTab === 'SFG' ? 'bg-orange-500 text-white border-orange-600 shadow-lg' : 'bg-white text-gray-500 border-gray-200'}`}>
              🍳 SFG ဂိုထောင်
            </button>
          </div>

          <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
            <div className={`p-4 border-b flex justify-between items-center ${warehouseTab === 'RM' ? 'bg-blue-50' : 'bg-orange-50'}`}>
              <h3 className={`font-bold ${warehouseTab === 'RM' ? 'text-blue-800' : 'text-orange-800'}`}>
                {warehouseTab === 'RM' ? 'Raw Materials (ကုန်ကြမ်း)' : 'Semi-Finished Goods (ကုန်ပိုင်း)'}
              </h3>
              <input type="text" placeholder="🔍 ရှာရန်..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="border p-2 rounded-lg w-64 outline-none" />
            </div>
            
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left min-w-[600px]">
                <thead className={warehouseTab === 'RM' ? 'bg-blue-100' : 'bg-orange-100'}>
                  <tr><th className="p-4 font-bold text-gray-700">Code</th><th className="p-4 font-bold text-gray-700">အမည်</th><th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်</th>{isManager && <th className="p-4 font-bold text-gray-700 text-center">Action</th>}</tr>
                </thead>
                <tbody>
                  {filteredItems.map(item => (
                    <tr key={item.id} className="border-b hover:bg-gray-50">
                      <td className="p-4 text-gray-600 font-medium">{item.code}</td>
                      <td className="p-4 font-bold text-gray-800">{item.name}</td>
                      <td className="p-4 text-right font-black text-lg">{item.inStock.toLocaleString()} <span className="text-sm font-medium text-gray-500">{item.unit}</span></td>
                      {isManager && <td className="p-4 text-center"><button onClick={() => handleDelete(item)} className="text-red-500 font-bold bg-red-50 px-3 py-1 rounded">ဖျက်မည်</button></td>}
                    </tr>
                  ))}
                  {filteredItems.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-gray-400 font-bold">ဤဂိုထောင်တွင် ပစ္စည်းမရှိပါ။</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {activeTab === 'stockIn' && (
        <form onSubmit={handleStockInSubmit} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-green-500 flex flex-wrap gap-4 items-end">
          <div className="w-full md:flex-1"><label className="block text-sm font-bold mb-1">ပစ္စည်းအမည်</label><select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg"><option value="">ရွေးချယ်ပါ</option>{items.map(i => <option key={i.id} value={i.name}>[{i.warehouse || 'RM'}] {i.name}</option>)}</select></div>
          <div className="w-full md:w-32"><label className="block text-sm font-bold mb-1">အရေအတွက်</label><input type="number" value={inQty} onChange={e => setInQty(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" /></div>
          <button type="submit" className="w-full md:w-auto bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-green-700">အဝင်စာရင်းသွင်းမည်</button>
        </form>
      )}

      {activeTab === 'newItem' && (
        <form onSubmit={handleAddNewItem} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-orange-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
            <div><label className="block text-sm font-bold mb-1">ဂိုထောင်ရွေးပါ</label><select value={newWarehouse} onChange={e => setNewWarehouse(e.target.value as 'RM'|'SFG')} className="w-full border-2 p-2.5 rounded-lg font-bold text-orange-700 bg-orange-50"><option value="RM">📦 RM ဂိုထောင်</option><option value="SFG">🍳 SFG ဂိုထောင်</option></select></div>
            <div><label className="block text-sm font-bold mb-1">Code</label><input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" /></div>
            <div><label className="block text-sm font-bold mb-1">အမည်</label><input type="text" value={newName} onChange={e => setNewName(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" /></div>
            <div><label className="block text-sm font-bold mb-1">Unit</label><input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" /></div>
          </div>
          <button type="submit" className="bg-orange-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-orange-700">သိမ်းဆည်းမည်</button>
        </form>
      )}
    </div>
  );
};
