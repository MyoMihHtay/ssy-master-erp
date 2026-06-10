import React, { useState } from 'react';
import type { InventoryItem, Recipe, BOMResult } from '../App';

interface ProductionProps {
  userRole: string;
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  onProductionConfirm: (recipe: Recipe, outputQty: number, bom: BOMResult[]) => void;
}

export const Production: React.FC<ProductionProps> = ({ userRole, inventoryItems, recipes, onProductionConfirm }) => {
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [batchCount, setBatchCount] = useState<number>(1);

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId);

  const handleConfirm = () => {
    if (!selectedRecipe) return;
    const outputQty = selectedRecipe.outputQtyPerBatch * batchCount;
    const bom: BOMResult[] = selectedRecipe.ingredients.map(ing => ({
      itemName: ing.itemName,
      amount: ing.requiredQty * batchCount
    }));
    
    // Check stock in RM Warehouse
    for (const b of bom) {
       const stockItem = inventoryItems.find(i => i.name === b.itemName && (i.warehouse === 'RM' || !i.warehouse));
       const currentStock = stockItem ? stockItem.inStock : 0;
       if (currentStock < b.amount) {
           alert(`❌ ${b.itemName} လုံလောက်မှုမရှိပါ။ \nလိုအပ်သောပမာဏ: ${b.amount} \nRM လက်ကျန်: ${currentStock}`);
           return;
       }
    }

    if(window.confirm(`⚠️ အတည်ပြုပါသလား?\n\nRM ဂိုထောင်မှ ကုန်ကြမ်းများကို နှုတ်ပြီး၊ SFG ဂိုထောင်သို့ ${outputQty} ${selectedRecipe.outputUnit} ပေါင်းထည့်ပါမည်။`)) {
       onProductionConfirm(selectedRecipe, outputQty, bom);
       setSelectedRecipeId('');
       setBatchCount(1);
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-5xl mx-auto">
      <div className="flex items-center gap-3 border-b-2 border-blue-200 pb-4 mb-6">
        <span className="text-4xl">🍳</span>
        <h2 className="text-2xl font-extrabold text-blue-900">ထုတ်လုပ်မှု စီမံခန့်ခွဲမှု (Production to SFG)</h2>
      </div>

      <div className="bg-white shadow-xl rounded-2xl p-6 border-t-4 border-blue-500">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">ထုတ်လုပ်မည့် ကုန်ပိုင်း (Recipe)</label>
            <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)} className="w-full border-2 border-gray-200 p-3 rounded-xl font-bold text-blue-900 outline-none">
              <option value="">ရွေးချယ်ပါ...</option>
              {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">အကြိမ်အရေအတွက် (Batches)</label>
            <input type="number" min="1" value={batchCount} onChange={e => setBatchCount(Number(e.target.value))} className="w-full border-2 border-gray-200 p-3 rounded-xl font-bold outline-none" />
          </div>
        </div>

        {selectedRecipe && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-6 mt-4">
             <h4 className="font-black text-blue-800 mb-4 flex items-center gap-2"><span>🔄</span> လုပ်ငန်းစဉ် ခန့်မှန်းတွက်ချက်မှု</h4>
             
             <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <div className="bg-white p-4 rounded-xl shadow-sm border border-red-100">
                   <div className="text-xs font-bold text-red-500 uppercase tracking-widest mb-3 border-b pb-2">RM ဂိုထောင်မှ နှုတ်မည့် ကုန်ကြမ်းများ</div>
                   <ul className="space-y-2">
                     {selectedRecipe.ingredients.map((ing, idx) => (
                       <li key={idx} className="flex justify-between font-bold text-gray-700">
                         <span>{ing.itemName}</span>
                         <span className="text-red-600">- {(ing.requiredQty * batchCount).toLocaleString()} {ing.unit}</span>
                       </li>
                     ))}
                   </ul>
                </div>

                <div className="bg-white p-4 rounded-xl shadow-sm border border-green-100">
                   <div className="text-xs font-bold text-green-600 uppercase tracking-widest mb-3 border-b pb-2">SFG ဂိုထောင်သို့ ဝင်မည့် ကုန်ပိုင်း</div>
                   <div className="flex justify-between items-center h-full pb-4">
                      <span className="font-black text-lg text-gray-800">{selectedRecipe.name}</span>
                      <span className="text-2xl font-black text-green-600">+ {(selectedRecipe.outputQtyPerBatch * batchCount).toLocaleString()} <span className="text-sm font-bold">{selectedRecipe.outputUnit}</span></span>
                   </div>
                </div>
             </div>

             <button onClick={handleConfirm} className="w-full mt-6 bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-lg transition-transform active:scale-95 text-lg">
               အတည်ပြု၍ ထုတ်လုပ်မည် (Deduct RM & Add to SFG)
             </button>
          </div>
        )}
      </div>
    </div>
  );
};
