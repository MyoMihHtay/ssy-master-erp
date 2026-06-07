import React, { useState, useMemo, useEffect } from 'react';
import type { InventoryItem, BOMResult, PackageRecipe, RecipeIngredient } from '../App';

interface PackagingProps {
  userRole: string;
  inventoryItems: InventoryItem[];
  packageRecipes: PackageRecipe[];
  setPackageRecipes: React.Dispatch<React.SetStateAction<PackageRecipe[]>>;
  onPackagingConfirm: (recipe: PackageRecipe, outputQty: number, bomResults: BOMResult[]) => void;
}

export const Packaging: React.FC<PackagingProps> = ({ userRole, inventoryItems, packageRecipes, setPackageRecipes, onPackagingConfirm }) => {
  const [activeTab, setActiveTab] = useState<'package' | 'builder'>('package');
  const isManager = (userRole || '').toLowerCase() === 'manager';

  const [selectedRecipeId, setSelectedRecipeId] = useState<string>('');
  const [packCount, setPackCount] = useState<number>(1);
  const [customCosts, setCustomCosts] = useState<{ [key: string]: number }>({});

  const [newSkuName, setNewSkuName] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const [newTaste, setNewTaste] = useState('Normal');
  const [newGram, setNewGram] = useState<number | ''>('');
  const [newPrice, setNewPrice] = useState<number | ''>('');
  const [newIngredients, setNewIngredients] = useState<RecipeIngredient[]>([]);

  useEffect(() => {
    if (!selectedRecipeId && packageRecipes.length > 0) {
      setSelectedRecipeId(packageRecipes[0].id);
    }
  }, [packageRecipes, selectedRecipeId]);

  const selectedRecipe = packageRecipes.find(r => r.id === selectedRecipeId) || packageRecipes[0];

  const handleCostChange = (itemName: string, newCost: string) => {
    setCustomCosts(prev => ({ ...prev, [itemName]: Number(newCost) }));
  };

  const packagingDetails = useMemo(() => {
    if (!selectedRecipe) return null;
    let totalCost = 0;
    let canPackage = true;

    const materials = selectedRecipe.ingredients.map(ing => {
      const invItem = inventoryItems.find(i => i.name === ing.itemName);
      const inStock = invItem ? invItem.inStock : 0;
      
      const totalRequired = ing.requiredQty * packCount;
      const currentCost = customCosts[ing.itemName] !== undefined ? customCosts[ing.itemName] : ing.defaultCost;
      const materialCost = currentCost * packCount;
      
      totalCost += materialCost;
      if (inStock < totalRequired) canPackage = false;

      return { ...ing, totalRequired, inStock, materialCost, currentCost, isShortage: inStock < totalRequired };
    });

    return { materials, totalCost, canPackage, totalOutput: packCount };
  }, [selectedRecipe, packCount, customCosts, inventoryItems]);

  const handlePackage = () => {
    if (!packagingDetails?.canPackage) {
      alert('❌ ကုန်ကြမ်း (သို့) ထုပ်ပိုးပစ္စည်း လက်ကျန် မလုံလောက်ပါ။ စာရင်းပြန်စစ်ပါ။'); return;
    }
    const bomResults: BOMResult[] = packagingDetails.materials.map(m => ({ itemName: m.itemName, amount: m.totalRequired }));

    if (window.confirm(`⚠️ ${selectedRecipe.skuName} (${packagingDetails.totalOutput} ထုပ်) ကို ထုပ်ပိုးမည် သေချာပါသလား?`)) {
      onPackagingConfirm(selectedRecipe, packagingDetails.totalOutput, bomResults);
      alert('✅ ထုပ်ပိုးမှု အောင်မြင်ပါသည်။ ကုန်ချော (Finished Goods) စာရင်းသို့ ဝင်သွားပါပြီ။');
      setPackCount(1);
    }
  };

  const handleDeleteRecipe = () => {
    if (!selectedRecipe) return;
    if (window.confirm(`⚠️ "${selectedRecipe.skuName}" ကို အပြီးအပိုင် ဖျက်ရန် သေချာပါသလား?`)) {
      const updatedRecipes = packageRecipes.filter(r => r.id !== selectedRecipe.id);
      setPackageRecipes(updatedRecipes);
      setSelectedRecipeId(updatedRecipes.length > 0 ? updatedRecipes[0].id : '');
      alert('✅ SKU ကို အောင်မြင်စွာ ဖျက်လိုက်ပါပြီ။');
    }
  };

  const handleAddIngredientRow = () => {
    setNewIngredients([...newIngredients, { itemName: inventoryItems[0]?.name || '', requiredQty: 0, unit: 'ခု', defaultCost: 0 }]);
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
    if (!newSkuName || !newCategory || !newGram || !newPrice || newIngredients.length === 0) {
      alert('အချက်အလက်များကို အပြည့်အစုံ ဖြည့်သွင်းပါ။'); return;
    }
    const newRecipe: PackageRecipe = {
      id: `PK-${Date.now()}`,
      skuName: newSkuName,
      category: newCategory,
      taste: newTaste,
      gram: Number(newGram),
      price: Number(newPrice),
      ingredients: newIngredients
    };
    setPackageRecipes([...packageRecipes, newRecipe]);
    setNewSkuName(''); setNewCategory(''); setNewTaste('Normal'); setNewGram(''); setNewPrice(''); setNewIngredients([]);
    setSelectedRecipeId(newRecipe.id);
    alert('✅ ထုပ်ပိုးမှု SKU အသစ် အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    setActiveTab('package');
  };

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <div className="flex justify-between items-end mb-6 border-b-2 pb-2 border-teal-200">
        <h2 className="text-2xl font-bold text-teal-800">🏷️ ထုပ်ပိုးမှု လုပ်ငန်းစဉ် (Packaging)</h2>
        <div className="flex gap-2">
          <button onClick={() => setActiveTab('package')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'package' ? 'bg-teal-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>ထုပ်ပိုးမည်</button>
          {isManager && <button onClick={() => setActiveTab('builder')} className={`px-4 py-2 rounded-lg font-bold ${activeTab === 'builder' ? 'bg-teal-600 text-white' : 'bg-gray-200 hover:bg-gray-300'}`}>+ SKU အသစ်ဖန်တီးမည်</button>}
        </div>
      </div>

      {activeTab === 'package' && packagingDetails && selectedRecipe && (
        <>
          <div className="bg-white shadow-lg rounded-xl p-6 border-t-4 border-teal-500 mb-6 flex flex-wrap gap-6 items-end">
            <div className="flex-1 min-w-[300px]">
              <div className="flex justify-between items-end mb-2">
                <label className="block text-sm font-bold text-gray-700">ကုန်ချော အမျိုးအစား (SKU)</label>
                {isManager && (
                  <button onClick={handleDeleteRecipe} className="text-red-500 hover:text-red-700 text-xs font-bold underline">
                    ဤ SKU ကို ဖျက်မည်
                  </button>
                )}
              </div>
              <select value={selectedRecipeId} onChange={e => setSelectedRecipeId(e.target.value)} className="border border-gray-300 p-3 rounded-lg w-full bg-gray-50 focus:ring-2 focus:ring-teal-500 font-semibold text-teal-900">
                {packageRecipes.map(r => <option key={r.id} value={r.id}>{r.skuName}</option>)}
              </select>
            </div>
            <div className="w-48">
              <label className="block text-sm font-bold text-gray-700 mb-2">ထုပ်ပိုးမည့် အရေအတွက်</label>
              <input type="number" min="1" value={packCount} onChange={e => setPackCount(Number(e.target.value))} className="border border-gray-300 p-3 rounded-lg w-full focus:ring-2 focus:ring-teal-500 font-bold" />
            </div>
            <div className="w-64 bg-teal-50 p-3 rounded-lg border border-teal-100">
              <div className="text-sm text-teal-600 font-bold">ထွက်ရှိမည့် ကုန်ချော</div>
              <div className="text-xl font-black text-teal-900">{packagingDetails.totalOutput} ထုပ်</div>
            </div>
          </div>

          <div className="bg-white shadow-md rounded-xl overflow-hidden border">
            <div className="p-4 bg-gray-800 text-white font-bold flex justify-between items-center">
              <span>လိုအပ်သော ကုန်ကြမ်း နှင့် ထုပ်ပိုးပစ္စည်းများ (Packaging BOM)</span>
              <span className="text-yellow-400">ခန့်မှန်း ကုန်ကျစရိတ် - {packagingDetails.totalCost.toLocaleString()} Ks</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-gray-100 text-gray-700 text-sm">
                  <tr>
                    <th className="p-4">ပစ္စည်းအမည်</th>
                    <th className="p-4 text-center">လိုအပ်သော ပမာဏ</th>
                    <th className="p-4 text-center">Warehouse လက်ကျန်</th>
                    <th className="p-4 text-right">ဈေးနှုန်း (Ks)</th>
                    <th className="p-4 text-right">စုစုပေါင်း ကျသင့်ငွေ</th>
                  </tr>
                </thead>
                <tbody>
                  {packagingDetails.materials.map((mat, idx) => (
                    <tr key={idx} className={`border-b ${mat.isShortage ? 'bg-red-50' : 'hover:bg-teal-50'}`}>
                      <td className="p-4 font-semibold text-gray-800">{mat.itemName}</td>
                      <td className="p-4 text-center font-bold text-teal-600">{mat.totalRequired.toFixed(3)} {mat.unit}</td>
                      <td className="p-4 text-center">
                        <span className={`font-bold px-3 py-1 rounded-full text-sm ${mat.isShortage ? 'bg-red-200 text-red-800' : 'bg-green-100 text-green-800'}`}>
                          {mat.inStock.toFixed(2)} {mat.isShortage ? ' (မလောက်ပါ)' : ''}
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
              <button onClick={handlePackage} disabled={!packagingDetails.canPackage || !isManager} className={`px-8 py-3 rounded-lg font-bold shadow-md ${packagingDetails.canPackage && isManager ? 'bg-teal-600 text-white hover:bg-teal-700' : 'bg-gray-300 text-gray-500'}`}>
                {!isManager ? 'Manager သာ ထုပ်ပိုးနိုင်သည်' : !packagingDetails.canPackage ? 'ပစ္စည်း မလုံလောက်ပါ' : 'အတည်ပြု ထုပ်ပိုးမည်'}
              </button>
            </div>
          </div>
        </>
      )}

      {activeTab === 'builder' && isManager && (
        <form onSubmit={handleSaveRecipe} className="bg-white shadow-xl rounded-xl p-6 border-t-4 border-pink-500">
          <h3 className="text-lg font-bold mb-4 text-gray-800">📦 ရောင်းတန်းဝင် SKU အသစ် တည်ဆောက်ခြင်း</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-6">
            <div className="col-span-2">
              <label className="block text-sm font-bold text-gray-700 mb-1">SKU အမည်အပြည့်အစုံ</label>
              <input type="text" value={newSkuName} onChange={e => setNewSkuName(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" placeholder="ဥပမာ - ငါးရေခွံကြော် ၃၅g (Spicy)" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">အမျိုးအစား (Category)</label>
              <input type="text" value={newCategory} onChange={e => setNewCategory(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" placeholder="ဥပမာ - ငါးရေခွံကြော်" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">အရသာ (Taste)</label>
              <input type="text" value={newTaste} onChange={e => setNewTaste(e.target.value)} className="border p-2.5 rounded-lg w-full bg-gray-50" placeholder="ဥပမာ - Spicy" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">အလေးချိန် (Gram)</label>
              <input type="number" value={newGram} onChange={e => setNewGram(Number(e.target.value))} className="border p-2.5 rounded-lg w-full bg-gray-50" required />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ရောင်းဈေး (Price)</label>
              <input type="number" value={newPrice} onChange={e => setNewPrice(Number(e.target.value))} className="border p-2.5 rounded-lg w-full bg-gray-50" required />
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 mb-6">
            <div className="flex justify-between items-center mb-4">
              <h4 className="font-bold text-gray-700">ထုပ်ပိုးရန် လိုအပ်သောပစ္စည်းများ (Packaging BOM)</h4>
              <button type="button" onClick={handleAddIngredientRow} className="bg-pink-100 text-pink-700 px-3 py-1.5 rounded font-bold hover:bg-pink-200 text-sm">
                + ပစ္စည်း ထည့်မည်
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
                  <input type="number" step="0.001" value={ing.requiredQty || ''} onChange={e => handleIngredientChange(idx, 'requiredQty', Number(e.target.value))} placeholder="ပမာဏ" className="border p-2 rounded w-full" required />
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
            {newIngredients.length === 0 && <div className="text-sm text-gray-500 italic text-center py-4">ပစ္စည်းများ ထည့်သွင်းထားခြင်း မရှိသေးပါ။</div>}
