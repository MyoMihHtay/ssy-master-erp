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

  const isManager = (userRole || '').toLowerCase() === 'manager';

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

  // ⭐️ ဤနေရာတွင် ဘယ်သူပြင်သည်၊ ဘယ်အချိန်ပြင်သည်ကို မှတ်သားပါသည် ⭐️
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
            updatedBy: userName, // ပြင်ဆင်သူ အမည်မှတ်ခြင်း
            updatedAt: new Date().toLocaleString('en-GB') // ပြင်ဆင်သည့် အချိန်မှတ်ခြင်း
          } 
        : item
    ));
    setEditingItem(null);
    alert('✅ ပစ္စည်းအချက်အလက်ကို အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-blue-800 border-b-2 pb-2">📦 ကုန်လှောင်ရုံ စီမံခန့်ခွဲမှု</h2>
      <div className="flex gap-4 mb-6">
        <button onClick={() => setActiveTab('balance')} className={`px-6 py-2 rounded-lg font-bold transition-colors ${activeTab === 'balance' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>လက်ကျန်စာရင်း</button>
        <button onClick={() => setActiveTab('stockIn')} className={`px-6 py-2 rounded-lg font-bold transition-colors ${activeTab === 'stockIn' ? 'bg-green-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>ပစ္စည်းအဝင် (Stock In)</button>
        <button onClick={() => setActiveTab('newItem')} className={`px-6 py-2 rounded-lg font-bold transition-colors ${activeTab === 'newItem' ? 'bg-orange-600 text-white shadow-md' : 'bg-gray-200 hover:bg-gray-300'}`}>+ ပစ္စည်းသစ်</button>
      </div>

      {activeTab === 'balance' && (
        <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
          <div className="p-4 bg-gray-50 border-b border-gray-200 flex justify-end">
            <input 
              type="text" 
              placeholder="🔍 Code သို့မဟုတ် အမည်ဖြင့် ရှာရန်..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="border border-gray-300 p-2 rounded-lg w-72 focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </div>
          <table className="w-full text-left">
            <thead className="bg-blue-50">
              <tr>
                <th className="p-4 font-bold text-gray-700">Code</th>
                <th className="p-4 font-bold text-gray-700">အမည်</th>
                <th className="p-4 font-bold text-gray-700 text-right">လက်ကျန်</th>
                {isManager && <th className="p-4 font-bold text-gray-700 text-center">လုပ်ဆောင်ချက်</th>}
              </tr>
            </thead>
            <tbody>
              {filteredItems.length > 0 ? (
                filteredItems.map(item => (
                  <tr key={item.id} className="border-b hover:bg-blue-50 transition-colors">
                    <td className="p-4 text-gray-600 font-medium">{item.code}</td>
                    
                    {/* ⭐️ ဤနေရာတွင် ပစ္စည်းအမည်အောက်၌ ဘယ်သူပြင်လဲ ပြပေးမည် ⭐️ */}
                    <td className="p-4">
                      <div className="font-bold text-gray-800">{item.name}</div>
                      {item.updatedBy && (
                        <div className="text-[11px] text-gray-400 mt-0.5">
                          Edited by {item.updatedBy} ({item.updatedAt})
                        </div>
                      )}
                    </td>
                    
                    <td className="p-4 text-right font-bold text-blue-700">{item.inStock} {item.unit}</td>
                    {isManager && (
                      <td className="p-4 text-center">
                        <button onClick={() => handleEditClick(item)} className="text-blue-600 hover:text-blue-800 font-bold mx-2 px-2 py-1 bg-blue-100 rounded-md transition-colors">ပြင်မည်</button>
                        <button onClick={() => handleDelete(item)} className="text-red-600 hover:text-red-800 font-bold mx-2 px-2 py-1 bg-red-100 rounded-md transition-colors">ဖျက်မည်</button>
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
      )}

      {editingItem && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 border-t-4 border-blue-500">
            <h3 className="text-xl font-bold mb-4 text-gray-800">ပစ္စည်းအချက်အလက် ပြင်ဆင်ရန်</h3>
            <form onSubmit={handleUpdateItem} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Code</label>
                <input type="text" value={editCode} onChange={e => setEditCode(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">အမည်</label>
                <input type="text" value={editName} onChange={e => setEditName(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
                <input type="text" value={editUnit} onChange={e => setEditUnit(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-blue-500" required />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setEditingItem(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">ပယ်ဖျက်မည်</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-md">သိမ်းဆည်းမည်</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'stockIn' && (
        <form onSubmit={handleStockInSubmit} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-green-500 flex flex-wrap gap-4 items-end">
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">ပစ္စည်းအမည်</label>
            <select value={selectedItem} onChange={e => setSelectedItem(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-green-500" required>
              <option value="">ရွေးချယ်ပါ</option>
              {items.map(i => <option key={i.id} value={i.name}>{i.name}</option>)}
            </select>
          </div>
          <div className="w-32">
            <label className="block text-sm font-semibold text-gray-700 mb-1">အရေအတွက်</label>
            <input type="number" value={inQty} onChange={e => setInQty(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-green-500" min="1" required />
          </div>
          <div className="w-48">
            <label className="block text-sm font-semibold text-gray-700 mb-1">ကျသင့်ငွေ (Ks)</label>
            <input type="number" value={totalCost} onChange={e => setTotalCost(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-green-500" />
          </div>
          <button type="submit" className="bg-green-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-green-700 transition-colors">
            အဝင်စာရင်းသွင်းမည်
          </button>
        </form>
      )}

      {activeTab === 'newItem' && (
        <form onSubmit={handleAddNewItem} className="bg-white shadow-lg p-6 rounded-xl border-t-4 border-orange-500 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Code</label>
            <input type="text" value={newCode} onChange={e => setNewCode(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500" required />
          </div>
          <div className="flex-1">
            <label className="block text-sm font-semibold text-gray-700 mb-1">အမည်</label>
            <input type="text" value={newName} onChange={e => setNewName(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500" required />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">Unit</label>
            <input type="text" value={newUnit} onChange={e => setNewUnit(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-orange-500" required />
          </div>
          <button type="submit" className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-orange-700 transition-colors">
            သိမ်းဆည်းမည်
          </button>
        </form>
      )}
    </div>
  );
};