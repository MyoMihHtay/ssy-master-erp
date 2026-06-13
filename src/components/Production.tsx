import React, { useState, useMemo } from 'react';
import type { InventoryItem, Recipe, RecipeIngredient, BOMResult } from '../App';

interface ProductionProps { userRole: string; inventoryItems: InventoryItem[]; recipes: Recipe[]; setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>; onProductionConfirm: (recipe: Recipe, producedQty: number, totalCost: number, consumedItems: BOMResult[]) => void; }

export const Production: React.FC<ProductionProps> = ({ userRole, inventoryItems, recipes, setRecipes, onProductionConfirm }) => {
  const [activeTab, setActiveTab] = useState<'produce' | 'recipes'>('produce');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  
  // Recipe Form State
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [outputQty, setOutputQty] = useState<number | ''>('');
  
  // Production Form State
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [targetOutputQty, setTargetOutputQty] = useState<number | ''>(''); // 🌟 ကိုယ်ထုတ်ချင်သော ပိဿာ အရေအတွက် 🌟

  const isManager = userRole === 'manager' || userRole === 'md';

  // 🌟 RM (Raw Materials) များကို သေချာစစ်ထုတ်ခြင်း (Tag မပါလျှင်တောင် RM ဟု ယူဆမည်) 🌟
  const rmItems = useMemo(() => inventoryItems.filter(i => {
    let actualWarehouse = i.warehouse;
    if (!actualWarehouse) {
      if (i.code?.startsWith('PK') || i.category === 'Packaging') actualWarehouse = 'PKG';
      else if (i.code?.startsWith('SFG')) actualWarehouse = 'SFG';
      else actualWarehouse = 'RM';
    }
    return actualWarehouse === 'RM';
  }), [inventoryItems]);

  // 🌟 BOM Calculation (Formula အရ အော်တို တွက်ချက်ခြင်း) 🌟
  const bomDetails = useMemo(() => {
    if (!selectedRecipe || !targetOutputQty) return null;
    const target = Number(targetOutputQty);
    if (target <= 0) return null;

    // လိုချင်သော ပမာဏ နှင့် Formula ပါ ပမာဏ အချိုးချခြင်း
    const multiplier = target / selectedRecipe.outputQtyPerBatch;
    let totalCost = 0;

    const consumedRM = selectedRecipe.ingredients.map(ing => {
      const invItem = rmItems.find(i => i.name === ing.itemName);
      const currentUnitPrice = invItem?.lastPurchasePrice || 0; 
      
      const amountNeeded = ing.requiredQty * multiplier; // 🌟 လိုအပ်သော RM အတိအကျ 🌟
      const ingCost = amountNeeded * currentUnitPrice;
      
      totalCost += ingCost;
      return { 
         itemName: ing.itemName, 
         amount: amountNeeded, 
         unit: ing.unit, 
         currentUnitPrice, 
         ingCost, 
         isStockEnough: (invItem?.inStock || 0) >= amountNeeded 
      };
    });
    
    const unitSfgCost = totalCost / target;
    const allStockEnough = consumedRM.every(ing => ing.isStockEnough);

    return { consumedRM, totalCost, unitSfgCost, allStockEnough, target };
  }, [selectedRecipe, targetOutputQty, rmItems]);

  const handleConfirmProduction = () => {
    if (!selectedRecipe || !bomDetails) return;
    if (!bomDetails.allStockEnough) return alert("❌ ပါဝင်ပစ္စည်း လက်ကျန် မလုံလောက်ပါ။");
    if (!isManager) return alert("❌ Manager/MD သာလျှင် အတည်ပြုခွင့် ရှိပါသည်။");

    if (window.confirm(`⚠️ ${bomDetails.target} ${selectedRecipe.outputUnit} ထုတ်လုပ်ပြီး RM ဂိုထောင်မှ ပါဝင်ပစ္စည်းများအား အော်တို နှုတ်ရန် သေချာပါသလား?`)) {
       onProductionConfirm(selectedRecipe, bomDetails.target, bomDetails.totalCost, bomDetails.consumedRM);
       setSelectedRecipe(null);
       setTargetOutputQty('');
    }
  };

  const openRecipeModal = (recipe?: Recipe) => {
    if (recipe) { setEditingRecipe(recipe); setRecipeName(recipe.name); setIngredients(recipe.ingredients); setOutputQty(recipe.outputQtyPerBatch); } 
    else { setEditingRecipe(null); setRecipeName(''); setIngredients([]); setOutputQty(''); }
    setIsRecipeModalOpen(true);
  };

  const handleSaveRecipe = () => {
    if (!recipeName || !outputQty || ingredients.length === 0) return alert('အချက်အလက်ပြည့်စုံစွာ ဖြည့်ပါ။');
    const newRecipe: Recipe = { id: editingRecipe?.id || Date.now().toString(), name: recipeName, outputCategory: 'Semi-Finished Goods', outputUnit: 'ပိဿာ', outputQtyPerBatch: Number(outputQty), ingredients: ingredients };
    if (editingRecipe) setRecipes(recipes.map(r => r.id === editingRecipe.id ? newRecipe : r));
    else setRecipes([newRecipe, ...recipes]);
    setIsRecipeModalOpen(false);
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto relative">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-3 tracking-tight border-b-2 border-orange-200 pb-4">
         <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2"><span>🍳</span> ထုတ်လုပ်မှု စီမံခန့်ခွဲမှု (Production)</h2>
         <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setActiveTab('produce')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'produce' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>ထုတ်လုပ်မည် (To SFG)</button>
            <button onClick={() => setActiveTab('recipes')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'recipes' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>ဖော်မြူလာ သတ်မှတ်မည် (Formula)</button>
         </div>
      </div>

      {activeTab === 'produce' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white p-5 md:p-6 rounded-2xl shadow-lg border border-gray-100">
             <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b">၁။ ထုတ်လုပ်မည့် ဖော်မြူလာ (Formula) ရွေးပါ</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {recipes.map(r => (
                 <div key={r.id} onClick={() => { setSelectedRecipe(r); setTargetOutputQty(r.outputQtyPerBatch); }} className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-orange-300 ${selectedRecipe?.id === r.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                    <h4 className="font-extrabold text-orange-900">{r.name}</h4>
                    <p className="text-xs text-orange-700 font-bold mt-1">Base Formula: {r.outputQtyPerBatch} {r.outputUnit}</p>
                 </div>
               ))}
               {recipes.length === 0 && <div className="text-center text-gray-400 py-6 md:col-span-2">ဖော်မြူလာ မရှိသေးပါ။ (ဖော်မြူလာ သတ်မှတ်မည်) တွင်အရင်ထည့်ပါ။</div>}
             </div>
             
             {selectedRecipe && (
               <div className="mt-6 border-t pt-4">
                 <label className="block text-sm font-bold text-gray-600 mb-1.5">၂။ ထုတ်လုပ်လိုသော ပမာဏ ({selectedRecipe.outputUnit}) ရိုက်ထည့်ပါ</label>
                 <input type="number" value={targetOutputQty} onChange={(e) => setTargetOutputQty(e.target.value === '' ? '' : Number(e.target.value))} className="w-full md:w-48 p-3 border-2 border-orange-200 rounded-lg outline-none focus:border-orange-500 font-black text-xl text-orange-900" placeholder="ဥပမာ - ၁၀" />
               </div>
             )}
           </div>

           {/* BOM Auto Calculation Display */}
           {selectedRecipe && bomDetails && (
             <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl border border-orange-100 flex flex-col h-full sticky top-4">
               <div className="flex justify-between items-center border-b pb-4 mb-4">
                 <h3 className="text-lg font-bold text-orange-950 flex items-center gap-2"><span>📊 လိုအပ်သော ကုန်ကြမ်း (Auto-Calculated)</span></h3>
                 {!bomDetails.allStockEnough && <span className="text-xs font-bold text-white bg-red-600 px-3 py-1 rounded-full">လက်ကျန်မလုံလောက်</span>}
               </div>

               <div className="flex-1 space-y-3 mb-6 overflow-y-auto min-h-[150px]">
                 {bomDetails.consumedRM.map((ing, idx) => (
                    <div key={idx} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex justify-between items-center mb-1">
                        <span className="font-black text-slate-800">{ing.itemName}</span>
                        <span className={`font-black text-lg ${ing.isStockEnough ? 'text-indigo-600' : 'text-red-600'}`}>
                           {ing.amount.toLocaleString(undefined, {maximumFractionDigits: 3})} <span className="text-sm font-bold text-slate-500">{ing.unit}</span>
                        </span>
                      </div>
                      <div className="flex justify-between text-[10px] font-medium text-slate-500 border-t border-gray-200 pt-1 mt-1">
                        <span>LPP: {ing.currentUnitPrice.toLocaleString()} Ks</span>
                        <span>Cost: {ing.ingCost.toLocaleString()} Ks</span>
                      </div>
                    </div>
                 ))}
               </div>

               <div className="border-t-2 border-dashed border-gray-200 pt-4 mt-auto space-y-3">
                 <div className="flex justify-between items-end"><span className="text-gray-500 font-bold text-sm">စုစုပေါင်း ကုန်ကြမ်းကျသင့်ငွေ</span><span className="text-xl font-black text-gray-900">{bomDetails.totalCost.toLocaleString()} Ks</span></div>
                 <div className="flex justify-between items-end bg-orange-50 p-3 rounded-lg border border-orange-100">
                    <span className="text-orange-950 font-bold text-sm">COGS အရင်းဈေး (1 {selectedRecipe.outputUnit})</span>
                    <span className="text-2xl font-black text-orange-600">{bomDetails.unitSfgCost.toLocaleString()} Ks</span>
                 </div>
                 {isManager && (
                   <button onClick={handleConfirmProduction} disabled={!bomDetails.allStockEnough} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:shadow-none transition-all text-lg">
                     အတည်ပြု၍ ထုတ်လုပ်မည် (Deduct RM & Add SFG)
                   </button>
                 )}
               </div>
             </div>
           )}
        </div>
      )}

      {/* Recipe Management */}
      {activeTab === 'recipes' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <button onClick={() => openRecipeModal()} className="bg-orange-50 text-orange-700 font-bold px-4 py-2.5 rounded-lg border border-orange-200 mb-6">+ ဖော်မြူလာ အသစ်ထည့်မည်</button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(r => (
              <div key={r.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 group relative">
                <h4 className="font-black text-lg text-orange-950 mb-3">{r.name}</h4>
                <p className="text-sm font-bold text-slate-600">ပါဝင်ပစ္စည်း:</p>
                <ul className="text-sm text-slate-700 font-medium space-y-1 mt-1 mb-3">
                  {r.ingredients.map((ing, i) => <li key={i}>- {ing.itemName} ({ing.requiredQty} {ing.unit})</li>)}
                </ul>
                <div className="border-t pt-2 text-orange-800 text-xs font-bold">Standard Output: {r.outputQtyPerBatch} {r.outputUnit}</div>
                {isManager && (
                   <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                     <button onClick={() => openRecipeModal(r)} className="bg-white border p-2 rounded text-slate-500 hover:text-orange-600">✏️</button>
                     <button onClick={() => setRecipes(recipes.filter(re => re.id !== r.id))} className="bg-white border p-2 rounded text-slate-500 hover:text-red-600">✕</button>
                   </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 🌟 Recipe Modal (စာရိုက်၍ ရှာနိုင်သော Datalist ထည့်သွင်းထားသည်) 🌟 */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-orange-500 text-white p-4 font-bold text-lg">{editingRecipe ? '✏️ ဖော်မြူလာ ပြင်မည်' : '➕ ဖော်မြူလာ အသစ်ထည့်မည်'}</div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-orange-400 font-bold" placeholder="ဖော်မြူလာ အမည် (ဥပမာ - ငါးရေခွံကြော်)" />
              <input type="number" value={outputQty} onChange={e => setOutputQty(Number(e.target.value))} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-orange-400 font-bold" placeholder="အခြေခံ ထွက်ရှိမည့် ပမာဏ (ပိဿာ)" />
              
              <h5 className="font-bold border-b pb-2 pt-2">ပါဝင်ပစ္စည်းများ (Raw Materials - RM)</h5>
              
              {/* Datalist for RM Autocomplete */}
              <datalist id="rm-list">
                 {rmItems.map(i => <option key={i.id} value={i.name} />)}
              </datalist>

              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100 flex-wrap md:flex-nowrap">
                  <input 
                    type="text" 
                    list="rm-list" 
                    value={ing.itemName} 
                    onChange={e => {
                      const val = e.target.value;
                      const item = rmItems.find(r => r.name === val);
                      const updated = [...ingredients]; 
                      updated[idx] = { ...ing, itemName: val, unit: item?.unit || ing.unit || 'ယူနစ်', defaultCost: item?.lastPurchasePrice || 0 };
                      setIngredients(updated);
                    }} 
                    className="flex-[2] w-full border border-gray-200 p-2 rounded-md outline-none bg-white font-bold text-sm" 
                    placeholder="ကုန်ကြမ်းအမည် ရိုက်ထည့်ပါ..." 
                  />
                  <input type="number" step="0.001" value={ing.requiredQty || ''} onChange={e => { const updated = [...ingredients]; updated[idx] = { ...ing, requiredQty: Number(e.target.value) }; setIngredients(updated); }} className="flex-1 w-full md:w-auto border border-gray-200 p-2 rounded-md font-bold text-sm" placeholder="အရေအတွက်" />
                  <input type="text" value={ing.unit} onChange={e => { const updated = [...ingredients]; updated[idx] = { ...ing, unit: e.target.value }; setIngredients(updated); }} className="w-20 border border-gray-200 p-2 rounded-md font-bold text-sm text-slate-500" placeholder="ယူနစ်" />
                  <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-2 hover:bg-red-50 p-1 rounded-md">✕</button>
                </div>
              ))}
              <button onClick={() => setIngredients([...ingredients, { itemName: '', requiredQty: 0, unit: 'ယူနစ်', defaultCost: 0 }])} className="text-orange-600 font-bold text-sm mt-2 hover:text-orange-800">+ RM ပါဝင်ပစ္စည်း ထပ်ထည့်မည်</button>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end bg-gray-50"><button onClick={() => setIsRecipeModalOpen(false)} className="px-5 py-2 rounded-lg font-bold bg-white border">Cancel</button><button onClick={handleSaveRecipe} className="px-5 py-2 rounded-lg font-bold bg-orange-500 text-white">Save Formula</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
