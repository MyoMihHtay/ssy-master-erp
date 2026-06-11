import React, { useState } from 'react';
import type { FinishedGoodItem } from '../App';

interface FinishedGoodsProps {
  userRole: string;
  products: FinishedGoodItem[];
  setProducts: React.Dispatch<React.SetStateAction<FinishedGoodItem[]>>;
}

export const FinishedGoods: React.FC<FinishedGoodsProps> = ({ userRole, products, setProducts }) => {
  const [category, setCategory] = useState('ငါးရေခွံကြော်');
  const [taste, setTaste] = useState('Normal');
  const [gram, setGram] = useState('');
  const [price, setPrice] = useState('');

  // 🌟 MD ပါ ပြင်ဆင်ခွင့်ရရန် ထပ်တိုးထားပါသည်
  const canEditDelete = userRole.toLowerCase() === 'manager' || userRole.toLowerCase() === 'supervisor' || userRole.toLowerCase() === 'md';

  const handleSetPrice = (e: React.FormEvent) => {
    e.preventDefault();
    const idx = products.findIndex(p => p.category === category && p.taste === taste && p.gram === Number(gram));
    if (idx > -1) {
      setProducts(products.map((p, i) => i === idx ? { ...p, price: Number(price) } : p));
      alert('✅ ဈေးနှုန်း အောင်မြင်စွာ ပြင်ဆင်ပြီးပါပြီ။');
    } else {
      setProducts([...products, { id: Date.now(), category, taste, gram: Number(gram), price: Number(price), stockQty: 0 }]);
      alert('✅ ကုန်ချောစာရင်းသစ် ထည့်သွင်းပြီးပါပြီ။ (ထုပ်ပိုးမှု Module မှ ကုန်ချောများ ဤနေရာသို့ ဝင်လာပါမည်)');
    }
    setPrice(''); setGram('');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('⚠️ ဤကုန်ချောစာရင်းကို ဖျက်ရန် သေချာပါသလား? (သတိပြုရန်: လက်ကျန်များပါ ပျက်သွားပါမည်)')) {
      setProducts(products.filter(p => p.id !== id));
    }
  };

  const handleEdit = (product: FinishedGoodItem) => {
    setCategory(product.category);
    setTaste(product.taste);
    setGram(product.gram.toString());
    setPrice(product.price.toString());
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-3 border-b-2 border-orange-200 pb-4 mb-6">
        <span className="text-4xl">🛍️</span>
        <h2 className="text-2xl font-extrabold text-orange-900">ကုန်ချောစာရင်း နှင့် ဈေးနှုန်းသတ်မှတ်ခြင်း (Finished Goods)</h2>
      </div>
      
      {/* ဈေးနှုန်းသတ်မှတ်ရန် Form */}
      {canEditDelete && (
        <form onSubmit={handleSetPrice} className="bg-white shadow-xl p-6 md:p-8 rounded-2xl mb-8 border-t-4 border-orange-500 flex gap-4 items-end flex-wrap">
          <div className="flex-1 min-w-[200px]">
             <label className="block text-sm font-bold text-gray-700 mb-2">အမျိုးအစား</label>
             <input type="text" value={category} onChange={e => setCategory(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full bg-white focus:border-orange-500 outline-none font-bold" required placeholder="ဥပမာ - ငါးရေခွံကြော်" />
          </div>
          <div className="flex-1 min-w-[150px]">
             <label className="block text-sm font-bold text-gray-700 mb-2">အရသာ</label>
             <input type="text" value={taste} onChange={e => setTaste(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full bg-white focus:border-orange-500 outline-none font-bold" required placeholder="ဥပမာ - Normal" />
          </div>
          <div className="w-full md:w-32">
             <label className="block text-sm font-bold text-gray-700 mb-2">ဂရမ် (g)</label>
             <input type="number" value={gram} onChange={e => setGram(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-orange-500 outline-none font-black" required />
          </div>
          <div className="w-full md:w-40">
             <label className="block text-sm font-bold text-gray-700 mb-2">ဈေးနှုန်း (Ks)</label>
             <input type="number" value={price} onChange={e => setPrice(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-orange-500 outline-none font-black text-orange-600" required />
          </div>
          <button type="submit" className="w-full md:w-auto bg-orange-600 text-white px-8 py-3.5 rounded-xl font-black shadow-lg hover:bg-orange-700 transition-colors text-lg">
             ဈေးသတ်မှတ်မည်
          </button>
        </form>
      )}

      {/* ကုန်ချောဇယား */}
      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
        <div className="bg-gray-800 p-4 border-b flex items-center gap-2">
           <span className="text-white text-lg">📦</span><h3 className="font-bold text-white">ရောင်းချရန် အသင့်ရှိသော ကုန်ချောများ</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-orange-50 text-orange-900 border-b-2 border-orange-200">
              <tr>
                <th className="p-4 font-black">အမျိုးအစား (SKU)</th>
                <th className="p-4 font-black">အလေးချိန်</th>
                <th className="p-4 font-black text-center">ဂိုထောင်လက်ကျန် (FG Stock)</th>
                <th className="p-4 font-black text-right">ရောင်းဈေး (Unit Price)</th>
                {canEditDelete && <th className="p-4 font-black text-center">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {products.map(p => (
                <tr key={p.id} className="border-b hover:bg-orange-50/50 transition-colors">
                  <td className="p-4 font-extrabold text-gray-800 text-lg">{p.category} <span className="text-sm font-medium text-gray-500">({p.taste})</span></td>
                  <td className="p-4 font-bold text-gray-600">{p.gram} g</td>
                  <td className="p-4 text-center">
                    <span className={`py-1.5 px-4 rounded-full text-sm font-black border-2 shadow-sm ${p.stockQty > 0 ? 'bg-green-100 text-green-800 border-green-300' : 'bg-red-50 text-red-600 border-red-200'}`}>
                      {p.stockQty.toLocaleString()} ထုပ်
                    </span>
                  </td>
                  <td className="p-4 text-right font-black text-xl text-orange-600">
                     {p.price > 0 ? `${p.price.toLocaleString()} Ks` : <span className="text-red-500 italic text-sm border border-red-200 bg-red-50 px-2 py-1 rounded">မသတ်မှတ်ရသေး</span>}
                  </td>
                  
                  {canEditDelete && (
                    <td className="p-4 text-center whitespace-nowrap">
                      <button onClick={() => handleEdit(p)} className="text-blue-600 hover:text-blue-800 font-bold mx-1 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-200">ပြင်မည်</button>
                      <button onClick={() => handleDelete(p.id)} className="text-red-600 hover:text-red-800 font-bold mx-1 bg-red-50 px-3 py-1.5 rounded-lg border border-red-200">ဖျက်မည်</button>
                    </td>
                  )}
                </tr>
              ))}
              {products.length === 0 && (
                <tr><td colSpan={5} className="p-8 text-center text-gray-400 font-bold">ကုန်ချောစာရင်း မရှိသေးပါ။ ထုပ်ပိုးမှု (Packaging) ပြီးစီးပါက ဤနေရာသို့ ရောက်လာပါမည်။</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
