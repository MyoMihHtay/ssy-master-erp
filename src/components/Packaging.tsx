import React, { useState, useMemo } from 'react';
import type { InventoryItem, PackageRecipe, RecipeIngredient, BOMResult, FinishedGoodItem } from '../App';
import { tr, type AppLanguage } from '../i18n';

interface PackagingProps { userRole: string; inventoryItems: InventoryItem[]; packageRecipes: PackageRecipe[]; setPackageRecipes: React.Dispatch<React.SetStateAction<PackageRecipe[]>>; onPackagingConfirm: (recipe: PackageRecipe, packQty: number, totalCost: number, consumedSFG: BOMResult[], consumedPKG: BOMResult[]) => void; language: AppLanguage; }

export const Packaging: React.FC<PackagingProps> = ({ userRole, inventoryItems, packageRecipes, setPackageRecipes, onPackagingConfirm, language }) => {
  const [activeTab, setActiveTab] = useState<'pack' | 'recipes'>('pack');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  
  // Recipe Form State (Sku)
  const [editingRecipe, setEditingRecipe] = useState<PackageRecipe | null>(null);
  const [category, setCategory] = useState('ငါးရေခွံကြော်');
  const [taste, setTaste] = useState('');
  const [gram, setGram] = useState<number | ''>('');
  const [price, setPrice] = useState<number | ''>('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]); // 🌟 SFG 1 item + PKG items 🌟
  
  // 🌟 Packaging Form State 🌟
  const [selectedRecipe, setSelectedRecipe] = useState<PackageRecipe | null>(null);
  const [packQty, setPackQty] = useState<number>(100); // default 100 packs

  const isManager = userRole === 'manager' || userRole === 'md';

  // 🌟 SFG (Semi-Finished Goods) နှင့် PKG (Packaging) ဂိုထောင်ပစ္စည်းများကို BOM အတွက် ခွဲထုတ်သည် 🌟
  const sfgItems = useMemo(() => inventoryItems.filter(i => i.warehouse === 'SFG'), [inventoryItems]);
  const pkgItems = useMemo(() => inventoryItems.filter(i => i.warehouse === 'PKG'), [inventoryItems]);

  // BOM & COGS Calculation based on current LPP of SFG and PKG
  const bomDetails = useMemo(() => {
    if (!selectedRecipe) return null;
    let totalSfgCost = 0;
    let totalPkgCost = 0;
    const consumedSFG: BOMResult[] = [];
    const consumedPKG: BOMResult[] = [];

    selectedRecipe.ingredients.forEach(ing => {
      // ၁။ SFG သို့မဟုတ် PKG Warehouse နှစ်ခုလုံးကို စစ်ဆေးသည်
      const invItem = inventoryItems.find(i => i.name === ing.itemName && (i.warehouse === 'SFG' || i.warehouse === 'PKG'));
      const currentUnitPrice = invItem?.lastPurchasePrice || 0;
      
      // SKU recipe သည် ကုန်ချော ၁ ထုပ်အတွက် (ဥပမာ- SFG 0.035kg + 1 Bag) ရေးထားခြင်းဖြစ်သည်
      const amountNeeded = ing.requiredQty * packQty;
      const ingCost = amountNeeded * currentUnitPrice;
      
      const details = { itemName: ing.itemName, amount: amountNeeded, unit: ing.unit, currentUnitPrice, ingCost, isStockEnough: (invItem?.inStock || 0) >= amountNeeded };

      if (invItem?.warehouse === 'SFG') {
         totalSfgCost += ingCost; consumedSFG.push(details);
      } else if (invItem?.warehouse === 'PKG') {
         totalPkgCost += ingCost; consumedPKG.push(details);
      }
    });
    
    const totalCost = totalSfgCost + totalPkgCost;
    const unitFgCogs = totalCost / packQty; // 🌟 🌟 Defining COGS here 🌟 🌟
    const allStockEnough = [...consumedSFG, ...consumedPKG].every(ing => ing.isStockEnough);

    return { consumedSFG, consumedPKG, totalCost, unitFgCogs, packQty, allStockEnough };
  }, [selectedRecipe, packQty, inventoryItems]);

  const handleConfirmPackaging = () => {
    if (!selectedRecipe || !bomDetails) return;
    if (!bomDetails.allStockEnough) return alert(tr(language, 'packagingStockAlert'));
    if (!isManager) return alert(tr(language, 'packagingManagerOnly'));

    if (window.confirm(
      language === 'my'
        ? `⚠️ ${packQty} ထုပ် (Finished Goods) ထုပ်ပိုးပြီး SFG & PKG ဂိုထောင်များမှ ပါဝင်ပစ္စည်းများအား နှုတ်ရန် သေချာပါသလား?`
        : `⚠️ Confirm packaging of ${packQty} finished-goods packs and deduct the required SFG and PKG materials?`
    )) {
       onPackagingConfirm(selectedRecipe, packQty, bomDetails.totalCost, bomDetails.consumedSFG, bomDetails.consumedPKG);
       setSelectedRecipe(null);
       setPackQty(100);
    }
  };

  // Recipe Management Functions (SKU - ကုန်ချော) (မူလအတိုင်း)
  const openRecipeModal = (recipe?: PackageRecipe) => {
    if (recipe) { setEditingRecipe(recipe); setCategory(recipe.category); setTaste(recipe.taste); setGram(recipe.gram); setPrice(recipe.price); setIngredients(recipe.ingredients); } 
    else { setEditingRecipe(null); setCategory('ငါးရေခွံကြော်'); setTaste(''); setGram(''); setPrice(''); setIngredients([]); }
    setIsRecipeModalOpen(true);
  };
  const handleSaveRecipe = () => {
    if (!taste || !gram || !price || ingredients.length === 0) return alert(tr(language, 'packagingRequiredInfo'));
    const skuName = `${category} (${taste}) - ${gram}g`;
    const newRecipe: PackageRecipe = { id: editingRecipe?.id || Date.now().toString(), skuName, category, taste, gram: Number(gram), price: Number(price), ingredients };
    if (editingRecipe) setPackageRecipes(packageRecipes.map(r => r.id === editingRecipe.id ? newRecipe : r));
    else setPackageRecipes([newRecipe, ...packageRecipes]);
    setIsRecipeModalOpen(false);
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-3 tracking-tight border-b-2 border-purple-200 pb-4">
         <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2"><span>🏷️</span> {tr(language, 'packagingTitle')}</h2>
         <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setActiveTab('pack')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'pack' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>{tr(language, 'packagingPackTab')}</button>
            <button onClick={() => setActiveTab('recipes')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'recipes' ? 'bg-purple-600 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>{tr(language, 'packagingSkuTab')}</button>
         </div>
      </div>

      {activeTab === 'pack' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* SKU Selection Area */}
           <div className="bg-white p-5 md:p-6 rounded-2xl shadow-lg border border-gray-100">
             <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b">{tr(language, 'packagingSelectSku')}</h3>
             <div className="space-y-3">
               {packageRecipes.map(r => (
                 <div key={r.id} onClick={() => setSelectedRecipe(r)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-purple-300 flex justify-between items-center ${selectedRecipe?.id === r.id ? 'border-purple-500 bg-purple-50' : 'border-gray-100 bg-gray-50'}`}>
                    <div>
                      <h4 className="font-extrabold text-purple-900 text-lg">{r.skuName}</h4>
                      <p className="text-sm font-bold text-purple-700">{tr(language, 'packagingPrice')}: {r.price.toLocaleString()} Ks</p>
                    </div>
                    {selectedRecipe?.id === r.id && <span className="text-2xl">✅</span>}
                 </div>
               ))}
               {packageRecipes.length === 0 && <div className="text-center text-gray-400 py-6 md:col-span-2">{tr(language, 'packagingNoSku')}</div>}
             </div>
             
             {selectedRecipe && (
               <div className="mt-6 border-t pt-4">
                 <label className="block text-sm font-bold text-gray-600 mb-1.5">{tr(language, 'packagingPackQty')} ({tr(language, 'packagingPacks')})</label>
                 <input type="number" min="1" step="10" value={packQty} onChange={(e) => setPackQty(Number(e.target.value))} className="w-full md:w-40 p-3 border-2 border-purple-200 rounded-lg outline-none focus:border-purple-500 font-black text-xl text-purple-900" />
               </div>
             )}
           </div>

           {/* BOM & Costing (WAC Check) */}
           {selectedRecipe && bomDetails && (
             <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl border border-purple-100 flex flex-col h-full sticky top-4">
               <div className="flex justify-between items-center border-b pb-4 mb-4">
                 <h3 className="text-lg font-bold text-purple-950 flex items-center gap-2"><span>BOM:</span> {packQty} {tr(language, 'packagingPacks')} - {selectedRecipe.skuName}</h3>
                 {!bomDetails.allStockEnough && <span className="text-xs font-bold text-white bg-red-600 px-3 py-1 rounded-full">{tr(language, 'packagingStockInsufficient')}</span>}
               </div>

               <div className="flex-1 space-y-4 mb-6 overflow-y-auto min-h-[200px]">
                  {/* SFG Ingredients */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{tr(language, 'packagingSfgIngredients')}</h5>
                    {bomDetails.consumedSFG.map((ing, idx) => ing.currentUnitPrice > 0 && (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-1.5">
                           <span className="font-black text-slate-800">{ing.itemName} (SFG)</span>
                           <div className="text-right">
                             <div className={`font-bold ${ing.isStockEnough ? 'text-gray-800' : 'text-red-600'}`}>{ing.amount.toLocaleString('en-US', {maximumFractionDigits: 3})} {ing.unit}</div>
                             <div className="text-xs text-gray-500">LPP: {ing.currentUnitPrice.toLocaleString()} Ks</div>
                           </div>
                        </div>
                    ))}
                  </div>
                  
                  {/* PKG Ingredients */}
                  <div>
                    <h5 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">{tr(language, 'packagingPkgIngredients')}</h5>
                    {bomDetails.consumedPKG.map((ing, idx) => ing.currentUnitPrice > 0 && (
                        <div key={idx} className="flex justify-between items-center bg-gray-50 p-3 rounded-lg border border-gray-100 mb-1.5">
                           <span className="font-black text-slate-800">{ing.itemName} (PKG)</span>
                           <div className="text-right">
                             <div className={`font-bold ${ing.isStockEnough ? 'text-gray-800' : 'text-red-600'}`}>{ing.amount.toLocaleString()} {ing.unit}</div>
                             <div className="text-xs text-gray-500">LPP: {ing.currentUnitPrice.toLocaleString()} Ks</div>
                           </div>
                        </div>
                    ))}
                  </div>
               </div>

               <div className="border-t-2 border-dashed border-gray-200 pt-4 mt-auto space-y-3">
                 <div className="flex justify-between items-end bg-purple-50 p-3 rounded-lg border border-purple-100"><span className="text-purple-950 font-black">{tr(language, 'packagingFinishedCogs')}</span><span className="text-3xl font-black text-purple-600">{bomDetails.unitFgCogs.toLocaleString()} Ks</span></div>
                 {isManager && (
                   <button onClick={handleConfirmPackaging} disabled={!bomDetails.allStockEnough} className="w-full bg-purple-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-purple-700 disabled:bg-gray-300 disabled:shadow-none transition-all text-lg">{tr(language, 'packagingConfirm')}</button>
                 )}
               </div>
             </div>
           )}
        </div>
      )}

      {/* Recipe Management - SKU (မူလအတိုင်း) */}
      {activeTab === 'recipes' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <button onClick={() => openRecipeModal()} className="bg-purple-50 text-purple-700 font-bold px-4 py-2.5 rounded-lg border border-purple-200 mb-6">{tr(language, 'packagingAddSku')}</button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {packageRecipes.map(r => (
              <div key={r.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 group relative shadow-sm">
                <h4 className="font-black text-lg text-purple-950 mb-1.5">{r.skuName}</h4>
                <div className="text-emerald-700 font-black text-2xl mb-3">{r.price.toLocaleString()} Ks</div>
                <p className="text-sm font-bold text-slate-600">{tr(language, 'packagingBomStructure')}:</p>
                <ul className="text-sm text-slate-700 font-medium space-y-1 mt-1">
                  {r.ingredients.map((ing, i) => <li key={i}>- {ing.itemName} ({ing.requiredQty} {ing.unit})</li>)}
                </ul>
                {isManager && (
                   <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => openRecipeModal(r)} className="bg-white border p-2 rounded text-slate-500 hover:text-purple-600">✏️</button>
                     <button onClick={() => setPackageRecipes(packageRecipes.filter(re => re.id !== r.id))} className="bg-white border p-2 rounded text-slate-500 hover:text-red-600">✕</button>
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* SKU Modal (မူလအတိုင်း) */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh]">
            <div className="bg-purple-500 text-white p-4 font-bold text-lg">{editingRecipe ? tr(language, 'packagingEditSku') : tr(language, 'packagingNewSku')}</div>
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                 <input type="text" value={taste} onChange={e => setTaste(e.target.value)} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-purple-400 font-bold" placeholder={tr(language, 'packagingTaste')} />
                 <input type="number" value={gram} onChange={e => setGram(Number(e.target.value))} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-purple-400 font-bold" placeholder={tr(language, 'packagingWeight')} />
              </div>
              <input type="number" value={price} onChange={e => setPrice(Number(e.target.value))} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-purple-400 font-black text-lg text-emerald-600" placeholder={tr(language, 'packagingSalePrice')} />
              
              <h5 className="font-bold border-b pb-2 pt-2 text-gray-700">{tr(language, 'packagingIngredients')}</h5>
              
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <select value={ing.itemName} onChange={e => {
                      const item = inventoryItems.find(i => i.name === e.target.value);
                      const updated = [...ingredients]; updated[idx] = { ...ing, itemName: e.target.value, unit: item?.unit || 'ယူနစ်', defaultCost: item?.lastPurchasePrice || 0 };
                      setIngredients(updated);
                    }} className="flex-[2] border border-gray-200 p-2 rounded-md outline-none bg-white font-bold text-sm">
                    <option value="">{tr(language, 'packagingSelectIngredient')}</option>
                    <optgroup label=" Semi-Finished Goods (SFG)">
                       {sfgItems.map(i => <option key={i.id} value={i.name}>{i.name} ({i.gram}g) ({i.inStock} {i.unit} {tr(language, 'packagingInStock')})</option>)}
                    </optgroup>
                    <optgroup label=" Packaging Materials (PKG)">
                       {pkgItems.map(i => <option key={i.id} value={i.name}>{i.name} ({i.inStock} {i.unit} {tr(language, 'packagingInStock')})</option>)}
                    </optgroup>
                  </select>
                  {/* gram logic */}
                  <input type="number" step="0.001" value={ing.requiredQty || ''} onChange={e => { const updated = [...ingredients]; updated[idx] = { ...ing, requiredQty: Number(e.target.value) }; setIngredients(updated); }} className="flex-1 border border-gray-200 p-2 rounded-md font-bold text-sm" placeholder="e.g. 0.035kg / 1 bag" />
                  <span className="w-16 text-sm font-bold text-slate-500 whitespace-nowrap">{ing.unit}</span>
                  <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-2 hover:bg-red-50 p-1 rounded-full">✕</button>
                </div>
              ))}
              <button onClick={() => setIngredients([...ingredients, { itemName: '', requiredQty: 0, unit: '', defaultCost: 0 }])} className="text-purple-600 font-bold text-sm hover:text-purple-800">{tr(language, 'packagingAddIngredient')}</button>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end bg-gray-50"><button onClick={() => setIsRecipeModalOpen(false)} className="px-5 py-2 rounded-lg font-bold bg-white border hover:bg-gray-100">{tr(language, 'packagingCancel')}</button><button onClick={handleSaveRecipe} className="px-5 py-2 rounded-lg font-bold bg-purple-500 text-white hover:bg-purple-600">{tr(language, 'packagingSaveSku')}</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
