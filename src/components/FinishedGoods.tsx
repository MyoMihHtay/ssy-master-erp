import React, { useState } from 'react';
import type { FinishedGoodItem } from '../App';

interface FinishedGoodsProps {
  userRole: string; // App.tsx မှ userRole ကို လက်ခံရန်
  products: FinishedGoodItem[];
  setProducts: React.Dispatch<React.SetStateAction<FinishedGoodItem[]>>;
}

export const FinishedGoods: React.FC<FinishedGoodsProps> = ({ userRole, products, setProducts }) => {
  const [category, setCategory] = useState('အာလူး (Potato)');
  const [taste, setTaste] = useState('ဇကာစပ်');
  const [gram, setGram] = useState('');
  const [price, setPrice] = useState('');

  // Manager သို့မဟုတ် Supervisor ဖြစ်မှသာ ပြင်ခွင့်/ဖျက်ခွင့် ပေးမည့် Logic
  const canEditDelete = userRole === 'manager' || userRole === 'supervisor';

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = products.findIndex(p => p.category === category && p.taste === taste && p.gram === Number(gram));
    if (idx > -1) {
      setProducts(products.map((p, i) => i === idx ? { ...p, price: Number(price) } : p));
      alert('ဈေးနှုန်း အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။');
    } else {
      setProducts([...products, { id: Date.now(), category, taste, gram: Number(gram), price: Number(price), stockQty: 0 }]);
      alert('ကုန်ချောစာရင်းသစ် ထည့်သွင်းပြီးပါပြီ။');
    }
    setPrice(''); setGram('');
  };

  // ဖျက်ရန် Function
  const handleDelete = (id: number) => {
    if (window.confirm('ဤကုန်ချောစာရင်းကို ဖျက်ရန် သေချာပါသလား? (သတိပြုရန်: လက်ကျန်များပါ ပျက်သွားပါမည်)')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  // ပြင်ရန် Form ထဲသို့ Data ပြန်ခေါ်သည့် Function
  const handleEdit = (product: FinishedGoodItem) => {
    setCategory(product.category);
    setTaste(product.taste);
    setGram(product.gram.toString());
    setPrice(product.price.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' }); // Form ဆီသို့ အပေါ် ပြန်တက်သွားစေရန်
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-orange-600 border-b pb-2">🛍️ ကုန်ချောစာရင်း</h2>
      
      {/* ဈေးနှုန်းသတ်မှတ်ရန် Form */}
      <form onSubmit={handleSetPrice} className="bg-white shadow-lg p-6 rounded-xl mb-6 border-t-4 border-orange-500 flex gap-4 items-end flex-wrap">
        <div className="flex-1 min-w-[150px]"><label className="block text-sm font-semibold text-gray-700 mb-1">အမျိုးအစား</label><select value={category} onChange={e => setCategory(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full mt-1 bg-gray-50 focus:ring-2 focus:ring-orange-500"><option value="အာလူး (Potato)">အာလူး (Potato)</option></select></div>
        <div className="flex-1 min-w-[150px]"><label className="block text-sm font-semibold text-gray-700 mb-1">အရသာ</label><select value={taste} onChange={e => setTaste(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full mt-1 bg-gray-50 focus:ring-2 focus:ring-orange-500"><option value="ဇကာစပ်">ဇကာစပ်</option><option value="ပုံမှန်">ပုံမှန်</option></select></div>
        <div className="w-28"><label className="block text-sm font-semibold text-gray-700 mb-1">ဂရမ် (g)</label><input type="number" value={gram} onChange={e => setGram(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full mt-1 focus:ring-2 focus:ring-orange-500" required /></div>
        <div className="w-32"><label className="block text-sm font-semibold text-gray-700 mb-1">ဈေးနှုန်း (Ks)</label><input type="number" value={price} onChange={e => setPrice(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full mt-1 focus:ring-2 focus:ring-orange-500" required /></div>
        <button type="submit" className="bg-orange-600 text-white px-6 py-2.5 rounded-lg font-bold shadow-md hover:bg-orange-700">ဈေးသတ်မှတ်မည်</button>
      </form>

      {/* ကုန်ချောဇယား */}
      <div className="bg-white shadow-md rounded-xl overflow-hidden border border-gray-200">
        <table className="w-full text-left">
          <thead className="bg-orange-100 text-orange-900 border-b-2 border-orange-200">
            <tr>
              <th className="p-4 font-bold">အမျိုးအစား</th>
              <th className="p-4 font-bold">အလေးချိန်</th>
              <th className="p-4 font-bold">လက်ကျန် (Stock)</th>
              <th className="p-4 font-bold text-right">ရောင်းဈေး</th>
              {canEditDelete && <th className="p-4 font-bold text-center">လုပ်ဆောင်ချက်</th>}
            </tr>
          </thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id} className="border-b hover:bg-orange-50 transition-colors">
                <td className="p-4 font-bold text-gray-800">{p.category} ({p.taste})</td>
                <td className="p-4 text-gray-600">{p.gram} g</td>
                <td className="p-4">
                  <span className={`py-1 px-3 rounded-full text-sm font-bold border ${p.stockQty > 0 ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-100 text-red-800 border-red-300'}`}>
                    {p.stockQty} ထုပ်
                  </span>
                </td>
                <td className="p-4 text-right font-bold text-gray-800">{p.price > 0 ? `${p.price.toLocaleString()} Ks` : <span className="text-red-500 italic text-sm">မသတ်မှတ်ရသေး</span>}</td>
                
                {/* Manager / Supervisor အတွက်သာ ပြသမည့် လုပ်ဆောင်ချက် ခလုတ်များ */}
                {canEditDelete && (
                  <td className="p-4 text-center">
                    <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800 font-bold mx-2">ပြင်မည်</button>
                    <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 font-bold mx-2">ဖျက်မည်</button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
