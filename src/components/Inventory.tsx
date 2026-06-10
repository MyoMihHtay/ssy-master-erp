import React, { useState, useMemo } from 'react';
import type { InventoryItem } from '../App';

interface InventoryProps {
  userRole: string;
  userName: string; // App.tsx မှ ပေးပို့လာသော User အမည်
  items: InventoryItem[];
  setItems: React.Dispatch<React.SetStateAction<InventoryItem[]>>;
  onStockIn: (itemName: string, qty: number, totalCost: number) => void;
}

const categories = ['Semi-Finished (အသင့်သုံး ကုန်ကြမ်း)', 'Raw Materials (အခြေခံ ကုန်ကြမ်း)', 'Packaging (ထုပ်ပိုးပစ္စည်း)', 'Consumables (အထွေထွေ အသုံးအဆောင်)'];

export const Inventory: React.FC<InventoryProps> = ({ userRole, userName, items, setItems, onStockIn }) => {
  const [activeTab, setActiveTab] = useState<'balance' | 'stockIn' | 'newItem'>('balance');
  const [searchQuery, setSearchQuery] = useState('');

  const [selectedItem, setSelectedItem] = useState('');
  const [inQty, setInQty] = useState('');
  const [totalCost, setTotalCost] = useState('');

  const [newCode, setNewCode] = useState('');
  const [newName, setNewName] = useState('');
  const [newCategory, setNewCategory] = useState(categories[0]);
  const [newUnit, setNewUnit] = useState('');

  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);
  const [editCode, setEditCode] = useState('');
  const [editName, setEditName] = useState('');
  const [editUnit, setEditUnit] = useState('');

  const isManager = (userRole || '').toLowerCase() === 'manager' || (userRole || '').toLowerCase() === 'md';

  const filteredItems = useMemo(() => {
    return items.filter(item => 
      item.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
      item.code.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [items, searchQuery]);

  const handleStockInSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedItem || !inQty) return;
    onStockIn(selectedItem, Number(inQty), Number(totalCost || 0));
    setSelectedItem(''); setInQty(''); setTotalCost('');
    alert('✅ ပစ္စည်းအဝင်စာရင်းနှင့် အသုံးစရိတ်ကို အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const handleAddNewItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCode || !newName || !newUnit) return;
    setItems([...items, { id: Date.now(), code: newCode, name: newName, category: newCategory, unit: newUnit, inStock: 0 }]);
    setNewCode(''); setNewName(''); setNewUnit(''); setActiveTab('balance');
    alert(`✅ ပစ္စည်းအမည်သစ် "${newName}" ထည့်သွင်းပြီးပါပြီ။`);
  };

  const handleDelete = (item: InventoryItem) => {
    if (item.inStock > 0) {
      alert(`❌ မအောင်မြင်ပါ။ "${item.name}" တွင် လက်ကျန် (${item.inStock} ${item.unit}) ရှိနေသေးသောကြောင့် ဖျက်၍မရပါ။ \nStock ကို သုည (0) ဖြစ်အောင် အရင် ရှင်းလင်းပါ။`);
      return;
    }
    if (window.confirm(`⚠️ "${item.name}" ကို စာရင်းမှ ပယ်ဖျက်ရန် သေချာပါသလား?`)) {
      setItems(items.filter(i => i.id !== item.id));
    }
  };

  const handleEditClick = (item: InventoryItem) => {
    setEditingItem(item);
    setEditCode(item.code);
    setEditName(item.name);
    setEditUnit(item.unit);
  };

  const handleUpdateItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingItem) return;
    setItems(items.map(item => 
      item.id === editingItem.id 
        ? { 
            ...item, 
            code: editCode, 
            name: editName, 
            unit: editUnit,
            updatedBy: userName,
            updatedAt: new Date().toLocaleDateString('en-GB')
          } 
        : item
    ));
    setEditingItem(null);
    alert('✅ ပစ္စည်းအချက်အလက်ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။');
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-blue-800 border-b-2 pb-2">📦 ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု</h2>
      
      <div className="flex flex-wrap gap-2 md:gap-4 mb-6">
        <button onClick={() => setActiveTab('balance')} className={`px-4 md:px-6 py-2 rounded-lg font-bold transition-colors text-sm md:text-base ${activeTab === 'balance' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>လက်ကျန်စာရင်း</button>
        <button onClick={() => setActiveTab('stockIn')} className={`px-4 md:px-6 py-2 rounded-lg font-bold transition-colors text-sm md:text-base ${activeTab === 'stockIn' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>ပစ္စည်းအဝင် (Stock In)</button>
        <button onClick={() => setActiveTab('newItem')} className={`px-4 md:px-6 py-2 rounded-lg font-bold transition-colors text-sm md:text-base ${activeTab === 'newItem' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>+ ပစ္စည်းသစ်</button>
      </div>

      {activeTab === 'balance' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-end">
            <input 
              type="text" 
              placeholder="🔍 Code သို့မဟုတ် အမည်ဖြင့် ရှာရန်..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 p-2.5 rounded-lg w-full md:w-72 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          
          {/* 🌟 ဇယားအား ဘယ်ညာပွတ်ဆွဲ၍ရအောင် ပြင်ဆင်ထားသော နေရာ 🌟 */}
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left min-w-[600px] md:min-w-full">
              <thead className="bg-blue-50">
                <tr>
                  <th className="p-4 font-bold text-gray-700 whitespace-nowrap">Code</th>
                  <th className="p-4 font-bold text-gray-700 whitespace-nowrap">အမည်</th>
                  <th className="p-4 font-bold text-gray-700 text-right whitespace-nowrap">လက်ကျန်</th>
                  {isManager && <th className="p-4 font-bold text-gray-700 text-center whitespace-nowrap">လုပ်ဆောင်ချက်</th>}
                </tr>
              </thead>
              <tbody>
                {filteredItems.length > 0 ? (
                  filteredItems.map(item => (
                    <tr key={item.id} className="border-b hover:bg-blue-50 transition-colors">
                      <td className="p-4 text-gray-600 font-medium whitespace-nowrap">{item.code}</td>
                      <td className="p-4 whitespace-nowrap">
                        <div className="font-bold text-gray-800">{item.name}</div>
                        {item.updatedBy && (
                          <div className="text-[11px] text-gray-400 mt-0.5">
                            Edited by {item.updatedBy} ({item.updatedAt})
                          </div>
                        )}
                      </td>
                      <td className="p-4 text-right font-bold text-blue-700 whitespace-nowrap">{item.inStock.toLocaleString()} {item.unit}</td>
                      {isManager && (
                        <td className="p-4 text-center whitespace-nowrap">
                          <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-bold mx-1 md:mx-2 px-3 py-1.5 bg-blue-100 rounded-md transition-colors text-sm">ပြင်မည်</button>
                          <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 font-bold mx-1 md:mx-2 px-3 py-1.5 bg-red-100 rounded-md transition-colors text-sm">ဖျက်မည်</button>
                        </td>
                      )}
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={isManager ? 4 : 3} className="p-6 text-center text-gray-500 font-medium">
                      ရှာဖွေမှုနှင့် ကိုက်ညီသော ပစ္စည်းမရှိပါ။
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {editingItem && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-full max-w-md border-t-4 border-blue-500">
            <h3 className="text-xl font-bold mb-4 text-gray-800">ပစ္စည်းအချက်အလက် ပြင်ဆင်ရန်</h3>
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Code</label>
                <input type="text" value={editCode} onChange={e => setEditCode(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">အမည်</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
                <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500 outline-none" required />
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button type="button" onClick={() => setEditingItem(null)} className="px-5 py-2.5 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">ပယ်ဖျက်မည်</button>
                <button type="submit" className="px-5 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">သိမ်းဆည်းမည်</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'stockIn' && (
        <form onSubmit={handleStockInSubmit} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-green-500 flex flex-wrap gap-4 items-end">
          <div className="w-full md:flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">ပစ္စည်းအမည်</label>
            <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-green-500 outline-none" required>
              <option value="">ရွေးချယ်ပါ</option>
              {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
          </div>
          <div className="w-full md:w-32">
            <label className="block text-sm font-semibold text-gray-700 mb-1">အရေအတွက်</label>
            <input type="number" value={inQty} onChange={e => setInQty(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-green-500 outline-none" min="1" required />
          </div>
          <div className="w-full md:w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1">ကျသင့်ငွေ (Ks)</label>
            <input type="number" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-green-500 outline-none" />
          </div>
          <button type="submit" className="w-full md:w-auto bg-green-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-green-700 transition-colors">
            အဝင်စာရင်းသွင်းမည်
          </button>
        </form>
      )}

      {activeTab === 'newItem' && (
        <form onSubmit={handleAddNewItem} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-orange-500 flex flex-wrap gap-4 items-end">
          <div className="w-full md:w-auto">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Code</label>
            <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500 outline-none" required />
          </div>
          <div className="w-full md:flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">အမည်</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500 outline-none" required />
          </div>
          <div className="w-full md:w-auto">
            <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
            <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500 outline-none" required />
          </div>
          <button type="submit" className="w-full md:w-auto bg-orange-600 text-white px-6 py-3 rounded-lg font-bold shadow-md hover:bg-orange-700 transition-colors">
            သိမ်းဆည်းမည်
          </button>
        </form>
      )}
    </div>
  );
};
