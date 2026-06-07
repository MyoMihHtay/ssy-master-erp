import React, { useState, useMemo } from 'react';
import type { InventoryItem, BOMResult, Recipe, RecipeIngredient } from '../App';

interface ProductionProps {
  userRole: string;
  inventoryItems: InventoryItem[];
  recipes: Recipe[];
  setRecipes: React.Dispatch<React.SetStateAction<Recipe[]>>;
  onProductionConfirm: (category: string, taste: string, gram: number, qty: number, bomResults: BOMResult[]) => void;
}

export const Production: React.FC<ProductionProps> = ({ userRole, inventoryItems, recipes, setRecipes, onProductionConfirm }) => {
  const [activeTab, setActiveTab] = useState<'produce' | 'builder'>('produce');
  const isManager = (userRole || '').toLowerCase() === 'manager';

  // --- Produce State ---
  const [selectedRecipeId, setSelectedRecipeId] = useState<string>(recipes[0]?.id || '');
  const [batchCount, setBatchCount] = useState<number>(1);
  const [customCosts, setCustomCosts] = useState<{ [key: string]: number }>({});

  // --- Builder State ---
  const [newRecipeName, setNewRecipeName] = useState('');
  const [newOutputQty, setNewOutputQty] = useState('');
  const [newOutputUnit, setNewOutputUnit] = useState('ပိဿာ');
  const [newIngredients, setNewIngredients] = useState<RecipeIngredient[]>([]);

  const selectedRecipe = recipes.find(r => r.id === selectedRecipeId) || recipes[0];

  // ----------------------------------------------------
  // Logic: Production (ထုတ်လုပ်ခြင်း)
  // ----------------------------------------------------
  const handleCostChange = (itemName: string, newCost: string) => {
    setCustomCosts(prev => ({ ...prev, [itemName]: Number(newCost) }));
  };

  const productionDetails = useMemo(() => {
    if (!selectedRecipe) return null;
    let totalCost = 0;
    let canProduce = true;

    const materials = selectedRecipe.ingredients.map(ing => {
      const invItem = inventoryItems.find(i => i.name === ing.itemName);
      const inStock = invItem ? invItem.inStock : 0;
      
      const totalRequired = ing.requiredQty * batchCount;
      const currentCost = customCosts[ing.itemName] !== undefined ? customCosts[ing.itemName] : ing.defaultCost;
      const materialCost = currentCost * batchCount;
      
      totalCost += materialCost;
      if (inStock < totalRequired) canProduce = false;

      return { ...ing, totalRequired, inStock, materialCost, currentCost, isShortage: inStock < totalRequired };
    });

    return { materials, totalCost, canProduce, totalOutput: selectedRecipe.outputQtyPerBatch * batchCount };
  }, [selectedRecipe, batchCount, customCosts, inventoryItems]);

  const handleProduce = () => {
    if (!productionDetails?.canProduce) {
      alert('❌ ကုန်ကြမ်း လက်ကျန် မလုံလောက်ပါ။ စာရင်းပြန်စစ်ပါ။'); return;
    }
    const bomResults: BOMResult[] = productionDetails.materials.map(m => ({ itemName: m.itemName, amount: m.totalRequired }));

    if (window.confirm(`⚠️ ${selectedRecipe.outputCategory} (${productionDetails.totalOutput} ${selectedRecipe.outputUnit}) ထုတ်လုပ်မည် သေချာပါသလား?`)) {
      onProductionConfirm(selectedRecipe.outputCategory, 'Normal', 0, productionDetails.totalOutput, bomResults);
      alert('✅ ထုတ်လုပ်မှု အောင်မြင်ပါသည်။ ကုန်ကြမ်းများကို စာရင်းမှ နှုတ်လိုက်ပါပြီ။');
    }
  };

  // ----------------------------------------------------
  // Logic: Formula Builder (ဖော်မြူလာ တည်ဆောက်ခြင်း)
  // ----------------------------------------------------
  const handleAddIngredientRow = () => {
    setNewIngredients([...newIngredients, { itemName: inventoryItems[0]?.name || '', requiredQty: 0, unit: 'ပိဿာ', defaultCost: 0 }]);
  };

  const handleIngredientChange = (index: number, field: keyof RecipeIngredient, value: any) => {
    const updated = [...newIngredients];
    updated[index] = { ...updated[index], [field]: value };
    setNewIngredients(updated);
  };

  const handleRemoveIngredient = (index: number) => {
    setNewIngredients(newIngredients.filter((_, i) => i !== index));
  };

  const handleSaveRecipe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRecipeName || !newOutputQty || newIngredients.length === 0) {
      alert('အချက်အလက်များကို အပြည့်အစုံ ဖြည့်သွင်းပါ။'); return;
    }
    const newRecipe: Recipe = {
      id: `F-${Date.now()}`,
      name: newRecipeName,
      outputCategory: newRecipeName,
      outputUnit: newOutputUnit,
      outputQtyPerBatch: Number(newOutputQty),
      ingredients: newIngredients
    };
    setRecipes([...recipes, newRecipe]);
    setNewRecipeName(''); setNewOutputQty(''); setNewIngredients([]);
    alert('✅ ဖော်မြူလာအသစ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    setActiveTab('produce');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6 border-b-2 pb-2 border-indigo-200">
        <h2 className="text-2xl font-bold text-indigo-800">⚙️ ကုန်ချော ထုတ်လုပ်မှု နှင့် ဖော်မြူလာ</h2>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('produce')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'produce' ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>ထုတ်လုပ်မည်</button>
          {isManager && <button onClick={() => setActiveTab('builder')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'builder' ? 'bg-indigo-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>+ ဖော်မြူလာ တည်ဆောက်မည်</button>}
        </div>
      </div>

      {/* ----------------- PRODUCE TAB ----------------- */}
      {activeTab === 'produce' && productionDetails && selectedRecipe && (
        <>
          <div className="bg-white shadow-lg rounded-xl p-6 border-t-4 border-indigo-500 mb-6 flex flex-wrap gap-6 items-end">
            <div className="flex-1 min-w-[300px]">
              <label className="block text-sm font-bold text-gray-700 mb-2">ထုတ်လုပ်မည့် ကုန်ချော (Recipe)</label>
              <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)} className="border border-gray-300 p-3 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-indigo-500 font-semibold text-indigo-900">
                {recipes.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-sm font-bold text-gray-700 mb-2">အကြိမ်အရေအတွက် (Batch)</label>
              <input type="number" min="1" value={batchCount} onChange={e => setBatchCount(Number(e.target.value))} className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-indigo-500 font-bold" />
            </div>
            <div className="w-64 bg-indigo-50 p-3 rounded-lg border border-indigo-100">
              <div className="text-sm text-indigo-600 font-bold">ထွက်ရှိမည့် ပမာဏ</div>
              <div className="text-xl font-black text-indigo-900">{productionDetails.totalOutput} {selectedRecipe.outputUnit}</div>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-xl overflow-hidden border">
            <div className="p-4 bg-gray-800 text-white font-bold flex justify-between items-center">
              <span>လိုအပ်သော ကုန်ကြမ်းစာရင်း (BOM)</span>
              <span className="text-yellow-400">ခန့်မှန်း ကုန်ကျစရိတ် - {productionDetails.totalCost.toLocaleString()} Ks</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-700 text-sm">
                  <tr>
                    <th className="p-4">ကုန်ကြမ်း အမည်</th>
                    <th className="p-4 text-center">လိုအပ်သော ပမာဏ</th>
                    <th className="p-4 text-center">Warehouse လက်ကျန်</th>
                    <th className="p-4 text-right">ဈေးနှုန်း (Ks)</th>
                    <th className="p-4 text-right">စုစုပေါင်း ကျသင့်ငွေ</th>
                  </tr>
                </thead>
                <tbody>
                  {productionDetails.materials.map((mat, idx) => (
                    <tr key={idx} className={`border-b ${mat.isShortage ? 'bg-red-50' : 'hover:bg-indigo-50'}`}>
                      <td className="p-4 font-semibold text-gray-800">{mat.itemName}</td>
                      <td className="p-4 text-center font-bold text-indigo-600">{mat.totalRequired.toFixed(3)} {mat.unit}</td>
                      <td className="p-4 text-center">
                        <span className={`font-bold px-3 py-1 rounded-full text-sm ${mat.isShortage ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {mat.inStock.toFixed(3)} {mat.isShortage ? ' (မလောက်ပါ)' : ''}
                        </span>
                      </td>
                      <td className="p-4 text-right">
                        <input type="number" value={mat.currentCost} onChange={(e) => handleCostChange(mat.itemName, e.target.value)} className="border border-gray-300 p-1.5 rounded w-24 text-right" />
                      </td>
                      <td className="p-4 text-right font-bold text-gray-700">{mat.materialCost.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="p-6 bg-gray-50 border-t flex justify-end">
              <button onClick={handleProduce} disabled={!productionDetails.canProduce || !isManager} className={`px-8 py-3 rounded-lg font-bold shadow-md ${productionDetails.canProduce && isManager ? 'bg-indigo-600 text-white hover:bg-indigo-700' : 'bg-gray-300 text-gray-500'}`}>
                {!isManager ? 'Manager သာ ထုတ်လုပ်နိုင်သည်' : !productionDetails.canProduce ? 'ကုန်ကြမ်း မလုံလောက်ပါ' : 'အတည်ပြု ထုတ်လုပ်မည်'}
              </button>
            </div>
          </div>
        </>
      )}

      {/* ----------------- FORMULA BUILDER TAB ----------------- */}
      {activeTab === 'builder' && isManager && (
        <form onSubmit={handleSaveRecipe} className="bg-white shadow-xl rounded-xl p-6 border-t-4 border-orange-500">
          <h3 className="text-lg font-bold mb-4 text-gray-800">📋 ဖော်မြူလာအသစ် တည်ဆောက်ခြင်း</h3>
          <div className="flex gap-4 mb-6">
            <div className="flex-1">
              <label className="block text-sm font-bold text-gray-700 mb-1">ထွက်ရှိမည့် ကုန်ချောအမည်</label>
              <input type="text" value={newRecipeName} onChange={e => setNewRecipeName(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" placeholder="ဥပမာ - ကြက်သွန်ဖြူကြော်" required />
            </div>
            <div className="w-48">
              <label className="block text-sm font-bold text-gray-700 mb-1">ထွက်ရှိမည့် ပမာဏ</label>
              <input type="number" step="0.01" value={newOutputQty} onChange={e => setNewOutputQty(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" placeholder="ဥပမာ - 1.5" required />
            </div>
            <div className="w-32">
              <label className="block text-sm font-bold text-gray-700 mb-1">ယူနစ်</label>
              <input type="text" value={newOutputUnit} onChange={e => setNewOutputUnit(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" required />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-700">ပါဝင်ရမည့် ကုန်ကြမ်းများ (Ingredients)</h4>
              <button type="button" onClick={handleAddIngredientRow} className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded font-bold hover:bg-blue-200 text-sm">
                + ကုန်ကြမ်း ထည့်မည်
              </button>
            </div>
            
            {newIngredients.map((ing, idx) => (
              <div key={idx} className="flex gap-2 mb-2 items-center bg-gray-50 p-2 rounded">
                <div className="flex-1">
                  <select value={ing.itemName} onChange={e => handleIngredientChange(idx, 'itemName', e.target.value)} className="border p-2 rounded w-full">
                    {inventoryItems.map(item => <option key={item.id} value={item.name}>{item.name} ({item.unit})</option>)}
                  </select>
                </div>
                <div className="w-32">
                  <input type="number" step="0.01" value={ing.requiredQty || ''} onChange={e => handleIngredientChange(idx, 'requiredQty', Number(e.target.value))} placeholder="ပမာဏ" className="border p-2 rounded w-full" required />
                </div>
                <div className="w-24">
                  <input type="text" value={ing.unit} onChange={e => handleIngredientChange(idx, 'unit', e.target.value)} placeholder="ယူနစ်" className="border p-2 rounded w-full" required />
                </div>
                <div className="w-32">
                  <input type="number" value={ing.defaultCost || ''} onChange={e => handleIngredientChange(idx, 'defaultCost', Number(e.target.value))} placeholder="ခန့်မှန်းဈေး" className="border p-2 rounded w-full" required />
                </div>
                <button type="button" onClick={() => handleRemoveIngredient(idx)} className="text-red-500 hover:text-red-700 font-bold px-2">X</button>
              </div>
            ))}
            {newIngredients.length === 0 && <div className="text-sm text-gray-500 italic text-center py-4">ကုန်ကြမ်းများ ထည့်သွင်းထားခြင်း မရှိသေးပါ။</div>}
          </div>

          <div className="flex justify-end">
            <button type="submit" className="bg-orange-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-orange-700 shadow-md">
              ဖော်မြူလာ သိမ်းဆည်းမည်
            </button>
          </div>
        </form>
      )}
    </div>
  );
};
