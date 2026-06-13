import React, { useState, useMemo } from 'react';
import type { InventoryItem, Recipe, RecipeIngredient, BOMResult } from '../App';

interface ProductionProps { userRole: string; inventoryItems: InventoryItem[]; recipes: Recipe[]; setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>; onProductionConfirm: (recipe: Recipe, batchQty: number, totalCost: number, consumedItems: BOMResult[]) => void; }

export const Production: React.FC<ProductionProps> = ({ userRole, inventoryItems, recipes, setRecipes, onProductionConfirm }) => {
  const [activeTab, setActiveTab] = useState<'produce' | 'recipes'>('produce');
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  
  // Recipe Form State
  const [editingRecipe, setEditingRecipe] = useState<Recipe | null>(null);
  const [recipeName, setRecipeName] = useState('');
  const [ingredients, setIngredients] = useState<RecipeIngredient[]>([]);
  const [outputQty, setOutputQty] = useState<number | ''>('');
  
  // 🌟 Production Form State 🌟
  const [selectedRecipe, setSelectedRecipe] = useState<Recipe | null>(null);
  const [batchQty, setBatchQty] = useState<number>(1); // default 1 batch

  const isManager = userRole === 'manager' || userRole === 'md';

  // 🌟 RM (Raw Materials) သာလျှင် ပါဝင်ပစ္စည်းအဖြစ် ရွေးချယ်ခွင့်ရှိမည် 🌟
  const rmItems = useMemo(() => inventoryItems.filter(i => i.warehouse === 'RM'), [inventoryItems]);

  // BOM Calculation based on LPP
  const bomDetails = useMemo(() => {
    if (!selectedRecipe) return null;
    let totalBatchCost = 0;
    const consumedRM = selectedRecipe.ingredients.map(ing => {
      const invItem = inventoryItems.find(i => i.name === ing.itemName && i.warehouse === 'RM');
      
      // 🌟 MD ကြီး တောင်းဆိုထားသော WAC စနစ် - LPP (Last Purchase Price) ကို အခြေခံ၍ တွက်ချက်သည် 🌟
      const currentUnitPrice = invItem?.lastPurchasePrice || 0; 
      const amountNeeded = ing.requiredQty * batchQty;
      const ingCost = amountNeeded * currentUnitPrice;
      
      totalBatchCost += ingCost;
      return { itemName: ing.itemName, amount: amountNeeded, unit: ing.unit, currentUnitPrice, ingCost, isStockEnough: (invItem?.inStock || 0) >= amountNeeded };
    });
    
    const outputQty = selectedRecipe.outputQtyPerBatch * batchQty;
    const unitSfgCost = totalBatchCost / outputQty;
    const allStockEnough = consumedRM.every(ing => ing.isStockEnough);

    return { consumedRM, totalBatchCost, outputQty, outputUnit: selectedRecipe.outputUnit, unitSfgCost, allStockEnough };
  }, [selectedRecipe, batchQty, inventoryItems]);

  const handleConfirmProduction = () => {
    if (!selectedRecipe || !bomDetails) return;
    if (!bomDetails.allStockEnough) return alert("❌ ပါဝင်ပစ္စည်း လက်ကျန် မလုံလောက်ပါ။");
    if (!isManager) return alert("❌ Manager/MD သာလျှင် အတည်ပြုခွင့် ရှိပါသည်။");

    if (window.confirm(`⚠️ ${batchQty} Batch (${bomDetails.outputQty} ${bomDetails.outputUnit}) ထုတ်လုပ်ပြီး RM ဂိုထောင်မှ ပါဝင်ပစ္စည်းများအား အော်တို နှုတ်ရန် သေချာပါသလား?`)) {
       onProductionConfirm(selectedRecipe, batchQty, bomDetails.totalBatchCost, bomDetails.consumedRM);
       setSelectedRecipe(null);
       setBatchQty(1);
    }
  };

  // Recipe Management Functions (မူလအတိုင်း)
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
         <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2"><span>🍳</span> SFG ထုတ်လုပ်မှု (Production)</h2>
         <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-gray-200 w-full md:w-auto">
            <button onClick={() => setActiveTab('produce')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'produce' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>🍳 SFG ထုတ်မည်</button>
            <button onClick={() => setActiveTab('recipes')} className={`flex-1 md:flex-none px-5 py-2 rounded-lg font-bold text-sm ${activeTab === 'recipes' ? 'bg-orange-500 text-white shadow-md' : 'text-slate-500 hover:bg-gray-100'}`}>📋 Recipe စီမံမည်</button>
         </div>
      </div>

      {activeTab === 'produce' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           {/* Recipe Selection Area */}
           <div className="bg-white p-5 md:p-6 rounded-2xl shadow-lg border border-gray-100">
             <h3 className="font-bold text-gray-700 mb-4 pb-2 border-b">၁။ Recipe ရွေးချယ်ပါ</h3>
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {recipes.map(r => (
                 <div key={r.id} onClick={() => setSelectedRecipe(r)} className={`p-4 rounded-xl border-2 cursor-pointer transition-all hover:border-orange-300 ${selectedRecipe?.id === r.id ? 'border-orange-500 bg-orange-50' : 'border-gray-100 bg-gray-50'}`}>
                    <h4 className="font-extrabold text-orange-900">{r.name}</h4>
                    <p className="text-xs text-orange-700 font-bold mt-1">Output per Batch: {r.outputQtyPerBatch.toLocaleString()} {r.outputUnit}</p>
                 </div>
               ))}
               {recipes.length === 0 && <div className="text-center text-gray-400 py-6 md:col-span-2">Recipe မရှိသေးပါ။ (Recipe စီမံမည်) တွင်အရင်ထည့်ပါ။</div>}
             </div>
             
             {selectedRecipe && (
               <div className="mt-6 border-t pt-4">
                 <label className="block text-sm font-bold text-gray-600 mb-1.5">၂။ ထုတ်လုပ်မည့် Batch အရေအတွက်</label>
                 <input type="number" min="1" value={batchQty} onChange={(e) => setBatchQty(Number(e.target.value))} className="w-full md:w-32 p-3 border-2 border-orange-200 rounded-lg outline-none focus:border-orange-500 font-black text-xl text-orange-900" />
               </div>
             )}
           </div>

           {/* BOM & Costing Area ( ट्रिपल Warehouse Logical Check ) */}
           {selectedRecipe && bomDetails && (
             <div className="bg-white p-5 md:p-6 rounded-2xl shadow-xl border border-orange-100 flex flex-col h-full sticky top-4">
               <div className="flex justify-between items-center border-b pb-4 mb-4">
                 <h3 className="text-lg font-bold text-orange-950 flex items-center gap-2"><span>BOM:</span> {batchQty} Batch - {bomDetails.outputQty.toLocaleString()} {bomDetails.outputUnit}</h3>
                 {!bomDetails.allStockEnough && <span className="text-xs font-bold text-white bg-red-600 px-3 py-1 rounded-full">လက်ကျန်မလုံလောက်</span>}
               </div>

               <div className="flex-1 space-y-3 mb-6 overflow-y-auto min-h-[150px]">
                 {bomDetails.consumedRM.map((ing, idx) => (
                    <div key={idx} className="flex flex-col bg-gray-50 p-3 rounded-lg border border-gray-100">
                      <div className="flex justify-between mb-1">
                        <span className="font-black text-slate-800">{ing.itemName} (RM)</span>
                        <span className={`font-bold ${ing.isStockEnough ? 'text-gray-600' : 'text-red-600'}`}>{ing.amount.toLocaleString()} {ing.unit}</span>
                      </div>
                      <div className="flex justify-between text-xs font-medium text-slate-500">
                        <span>LPP: {ing.currentUnitPrice.toLocaleString()} Ks</span>
                        <span>Ing. Cost: {ing.ingCost.toLocaleString()} Ks</span>
                      </div>
                    </div>
                 ))}
               </div>

               <div className="border-t-2 border-dashed border-gray-200 pt-4 mt-auto space-y-3">
                 <div className="flex justify-between items-end"><span className="text-gray-500 font-bold">စုစုပေါင်း RM ကုန်ကျစရိတ်</span><span className="text-2xl font-black text-gray-900">{bomDetails.totalBatchCost.toLocaleString()} Ks</span></div>
                 <div className="flex justify-between items-end bg-orange-50 p-3 rounded-lg border border-orange-100"><span className="text-orange-950 font-bold">{recipeName} အရင်းဈေး (1 {bomDetails.outputUnit})</span><span className="text-2xl font-black text-orange-600">{bomDetails.unitSfgCost.toLocaleString()} Ks</span></div>
                 {isManager && (
                   <button onClick={handleConfirmProduction} disabled={!bomDetails.allStockEnough} className="w-full bg-orange-500 text-white font-black py-4 rounded-xl shadow-lg hover:bg-orange-600 disabled:bg-gray-300 disabled:shadow-none transition-all text-lg">⚖️ ထုတ်လုပ်မှု အတည်ပြုမည် (နှုတ်/ပေါင်း)</button>
                 )}
               </div>
             </div>
           )}
        </div>
      )}

      {/* Recipe Management (မူလအတိုင်း) */}
      {activeTab === 'recipes' && (
        <div className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100">
          <button onClick={() => openRecipeModal()} className="bg-orange-50 text-orange-700 font-bold px-4 py-2.5 rounded-lg border border-orange-200 mb-6">+ Recipe အသစ်ထည့်မည်</button>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {recipes.map(r => (
              <div key={r.id} className="bg-gray-50 p-5 rounded-2xl border border-gray-100 group relative">
                <h4 className="font-black text-lg text-orange-950 mb-3">{r.name}</h4>
                <p className="text-sm font-bold text-slate-600">ပါဝင်ပစ္စည်း:</p>
                <ul className="text-sm text-slate-700 font-medium space-y-1 mt-1 mb-3">
                  {r.ingredients.map((ing, i) => <li key={i}>- {ing.itemName} ({ing.requiredQty} {ing.unit})</li>)}
                </ul>
                <div className="border-t pt-2 text-orange-800 text-xs font-bold">Standard Output: {r.outputQtyPerBatch} {r.outputUnit} per Batch</div>
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

      {/* Recipe Modal (မူလအတိုင်း) */}
      {isRecipeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="bg-white rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-orange-500 text-white p-4 font-bold text-lg">{editingRecipe ? '✏️ Recipe ပြင်မည်' : '➕ Recipe အသစ်ထည့်မည်'}</div>
            <div className="p-6 overflow-y-auto space-y-4">
              <input type="text" value={recipeName} onChange={e => setRecipeName(e.target.value)} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-orange-400 font-bold" placeholder="Recipe အမည် (ဥပမာ - Mala ငါးရေခွံကြော်)" />
              <input type="number" value={outputQty} onChange={e => setOutputQty(Number(e.target.value))} className="w-full border-2 border-gray-100 p-3 rounded-lg outline-none focus:border-orange-400 font-bold" placeholder="Standard Output (ပိဿာ) per Batch" />
              <h5 className="font-bold border-b pb-2 pt-2">ပါဝင်ပစ္စည်းများ (Raw Materials - RM)</h5>
              {ingredients.map((ing, idx) => (
                <div key={idx} className="flex gap-2 items-center bg-gray-50 p-2 rounded-lg border border-gray-100">
                  <select value={ing.itemName} onChange={e => {
                      const item = rmItems.find(r => r.name === e.target.value);
                      const updated = [...ingredients]; updated[idx] = { ...ing, itemName: e.target.value, unit: item?.unit || 'ယူနစ်', defaultCost: item?.lastPurchasePrice || 0 };
                      setIngredients(updated);
                    }} className="flex-[2] border border-gray-200 p-2 rounded-md outline-none bg-white font-bold text-sm">
                    <option value="">ပါဝင်ပစ္စည်း (RM) ရွေးပါ</option>
                    {rmItems.map(i => <option key={i.id} value={i.name}>{i.name} (Unit: {i.unit})</option>)}
                  </select>
                  <input type="number" value={ing.requiredQty || ''} onChange={e => { const updated = [...ingredients]; updated[idx] = { ...ing, requiredQty: Number(e.target.value) }; setIngredients(updated); }} className="flex-1 border border-gray-200 p-2 rounded-md font-bold text-sm" placeholder="အရေအတွက်" />
                  <span className="w-16 text-sm font-bold text-slate-500">{ing.unit}</span>
                  <button onClick={() => setIngredients(ingredients.filter((_, i) => i !== idx))} className="text-red-500 font-bold px-2">✕</button>
                </div>
              ))}
              <button onClick={() => setIngredients([...ingredients, { itemName: '', requiredQty: 0, unit: '', defaultCost: 0 }])} className="text-orange-600 font-bold text-sm">+ RM ပါဝင်ပစ္စည်း ထပ်ထည့်မည်</button>
            </div>
            <div className="p-4 border-t flex gap-2 justify-end bg-gray-50"><button onClick={() => setIsRecipeModalOpen(false)} className="px-5 py-2 rounded-lg font-bold bg-white border">Cancel</button><button onClick={handleSaveRecipe} className="px-5 py-2 rounded-lg font-bold bg-orange-500 text-white">Save Recipe</button></div>
          </div>
        </div>
      )}
    </div>
  );
};
