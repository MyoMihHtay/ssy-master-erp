import React, { useState } from 'react';
import type { FinishedGoodItem } from '../App';
import { tr, type AppLanguage } from '../i18n';

interface FinishedGoodsProps {
  userRole: string;
  products: FinishedGoodItem[];
  setProducts: React.Dispatch<React.SetStateAction<FinishedGoodItem[]>>;
  language: AppLanguage;
}

export const FinishedGoods: React.FC<FinishedGoodsProps> = ({ userRole, products, setProducts, language }) => {
  const [activeCategory, setActiveCategory] = useState('ငါးရေခွံကြော်');
  
  const isMDOnly = userRole?.toLowerCase() === 'md';

  // Categories list based on distinct category names in products
  const categories = [...new Set(products.map(p => p.category))];

  const filteredProducts = products.filter(p => p.category === activeCategory);

  const handleEditFg = (product: FinishedGoodItem) => {
    if (!isMDOnly) return alert(tr(language, 'finishedGoodsEditMdOnly'));
    
    // MD မှ COGS (အရင်းဈေး) နှင့် Price (ရောင်းဈေး) ကို Manual ပြင်ဆင်နိုင်ရန်
    const newPriceStr = window.prompt(
      language === 'my'
        ? `📝 ${product.category} (${product.taste}) - ${product.gram}g \nယခု ရောင်းဈေး Ks: ${product.price} \nရောင်းဈေးအသစ် ရိုက်ထည့်ပါ:`
        : `📝 ${product.category} (${product.taste}) - ${product.gram}g \nCurrent Selling Price: ${product.price} Ks \nEnter new selling price:`,
      product.price.toString()
    );
    if (newPriceStr === null) return;

    const newCogsStr = window.prompt(
      language === 'my'
        ? `💰 ယခု အရင်းဈေး (COGS) Ks: ${product.cogs || 0} \nအရင်းဈေးအသစ် ရိုက်ထည့်ပါ:`
        : `💰 Current COGS: ${product.cogs || 0} Ks \nEnter new COGS:`,
      (product.cogs || 0).toString()
    );
    if (newCogsStr === null) return;

    setProducts(products.map(p => p.id === product.id ? { ...p, price: Number(newPriceStr), cogs: Number(newCogsStr) } : p));
    alert(tr(language, 'finishedGoodsEditSuccess'));
  };

  const handleDeleteFg = (product: FinishedGoodItem) => {
    if (!isMDOnly) return alert(tr(language, 'finishedGoodsDeleteMdOnly'));
    if (product.stockQty > 0) return alert(
      language === 'my'
        ? `❌ ဖျက်၍မရပါ။ လက်ကျန် (${product.stockQty}) ရှိနေပါသည်။`
        : `❌ Cannot delete this item because stock (${product.stockQty}) remains.`
    );
    
    if (window.confirm(
      language === 'my'
        ? `⚠️ ${product.category} (${product.taste}) - ${product.gram}g အား ဖျက်ရန် သေချာပါသလား?`
        : `⚠️ Are you sure you want to delete ${product.category} (${product.taste}) - ${product.gram}g?`
    )) {
      setProducts(products.filter(p => p.id !== product.id));
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-3 tracking-tight border-b-2 border-emerald-200 pb-4">
         <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2"><span>🛍️</span> {tr(language, 'finishedGoodsTitle')}</h2>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200 print:hidden">
        {categories.map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)} className={`px-5 py-3 rounded-lg font-black text-xs md:text-lg transition-all whitespace-nowrap ${activeCategory === cat ? 'bg-emerald-500 text-white shadow-md' : 'bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
            🛍️ {cat}
          </button>
        ))}
      </div>

      <div className="bg-white shadow-lg rounded-xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-50 border-b flex justify-between items-center flex-wrap gap-2">
          <h3 className="font-bold text-gray-700 flex items-center gap-2">
            <span>🛍️</span>
            {activeCategory} - {tr(language, 'finishedGoodsStockList')}
          </h3>
          <input type="text" placeholder={tr(language, 'finishedGoodsSearch')} className="border-2 border-gray-200 p-2.5 rounded-lg w-full md:w-72 outline-none focus:border-emerald-500 font-bold" />
        </div>
        
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left min-w-[700px]">
            <thead className="bg-gray-100 border-b-2 border-gray-200">
              <tr>
                <th className="p-4 font-bold text-gray-700">{tr(language, 'finishedGoodsDescription')}</th>
                <th className="p-4 font-bold text-gray-700 text-right">{tr(language, 'finishedGoodsWeight')}</th>
                <th className="p-4 font-bold text-gray-700 text-right">{tr(language, 'finishedGoodsSellingPrice')}</th>
                <th className="p-4 font-bold text-gray-700 text-right">{tr(language, 'finishedGoodsCogs')}</th>
                <th className="p-4 font-bold text-gray-700 text-right">{tr(language, 'finishedGoodsStockQty')}</th>
                {isMDOnly && <th className="p-4 font-bold text-gray-700 text-center">{tr(language, 'finishedGoodsAction')}</th>}
              </tr>
            </thead>
            <tbody>
              {filteredProducts.map(product => (
                <tr key={product.id} className="border-b hover:bg-emerald-50/50 transition-colors">
                  <td className="p-4">
                    <div className="font-black text-gray-800 text-lg leading-tight">{product.category}</div>
                    <div className="text-xs text-emerald-600 font-bold bg-emerald-50 px-2 py-0.5 rounded-md inline-block mt-1">{tr(language, 'finishedGoodsTaste')}: {product.taste}</div>
                  </td>
                  <td className="p-4 text-right font-bold text-gray-600 text-lg">{product.gram} g</td>
                  <td className="p-4 text-right font-black text-xl text-emerald-600">{product.price.toLocaleString()}</td>
                  
                  {/* 🌟 COGS Column အသစ် 🌟 */}
                  <td className="p-4 text-right font-bold text-rose-600">{(product.cogs || 0).toLocaleString()}</td>
                  
                  <td className="p-4 text-right font-black text-2xl text-slate-800">
                    {product.stockQty?.toLocaleString()} <span className="text-sm font-bold text-gray-500">{tr(language, 'finishedGoodsPacks')}</span>
                  </td>
                  
                  {isMDOnly && (
                    <td className="p-4 text-center whitespace-nowrap">
                      <button onClick={() => handleEditFg(product)} className="bg-white text-gray-600 border border-gray-200 hover:bg-emerald-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-sm mr-2">{tr(language, 'finishedGoodsEdit')}</button>
                      <button onClick={() => handleDeleteFg(product)} className="bg-red-50 text-red-600 border border-red-200 hover:bg-red-600 hover:text-white font-bold px-3 py-1.5 rounded-lg transition-colors text-sm">{tr(language, 'finishedGoodsDelete')}</button>
                    </td>
                  )}
                </tr>
              ))}
              {filteredProducts.length === 0 && (
                <tr><td colSpan={isMDOnly ? 6 : 5} className="p-8 text-center text-gray-400 font-bold">{tr(language, 'finishedGoodsEmpty')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
