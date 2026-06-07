import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
// ⭐️ Packaging Component ကို ခေါ်ယူထားပါသည် (နောက်တစ်ဆင့်တွင် ဖန်တီးပါမည်)
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';

export interface AccountItem { id: number; username: string; password?: string; role: 'manager' | 'supervisor' | 'storekeeper' | 'staff'; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; updatedBy?: string; updatedAt?: string; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }

export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }

// ⭐️ Packaging Formula အတွက် Type အသစ် ⭐️
export interface PackageRecipe {
  id: string;
  skuName: string; // ဥပမာ - ငါးရေခွံ ၃၅ ဂရမ် (Spicy)
  category: string; // ငါးရေခွံကြော်
  taste: string; // Spicy
  gram: number; // 35
  price: number; // 1500
  ingredients: RecipeIngredient[]; // အကြမ်းထည်၊ အိတ်၊ တံဆိပ် စသည်
}

export default function App() {
  const [accounts, setAccounts] = useState<AccountItem[]>([
    { id: 1, username: 'manager', password: '123', role: 'manager', displayName: 'Manager (စက်ရုံမှူး)' },
    { id: 2, username: 'supervisor', password: '123', role: 'supervisor', displayName: 'Supervisor (ကြီးကြပ်သူ)' },
  ]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: 1, code: 'RM-001', name: 'အာလူးပေါင်း ကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500 },
    { id: 2, code: 'RM-002', name: 'ကြက်သွန်ပေါင်း ကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 200 },
    { id: 3, code: 'RM-003', name: 'စားအုန်းဆီ', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 150 },
    { id: 4, code: 'RM-004', name: 'Gas အိုး (60Kg)', category: 'Consumables', unit: 'ပိဿာ', inStock: 100 },
    { id: 5, code: 'RM-005', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 50 },
    { id: 6, code: 'RM-006', name: 'စီချွမ် Seasoning Powder', category: 'Raw Materials', unit: 'g', inStock: 5000 },
    { id: 7, code: 'RM-007', name: 'Garlic Seasoning Powder', category: 'Raw Materials', unit: 'g', inStock: 5000 },
    { id: 8, code: 'RM-008', name: 'Marlar Seasoning Powder', category: 'Raw Materials', unit: 'g', inStock: 5000 },
    { id: 9, code: 'RM-009', name: 'ငရုတ်သီးမှုန့်', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 10 },
    { id: 10, code: 'RM-010', name: 'ပျဉ်းတော်သိမ်ရွက်', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 5 },
    { id: 11, code: 'RM-011', name: 'ဆား', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 20 },
    { id: 12, code: 'RM-012', name: 'ငပိ', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 10 },
    // ⭐️ Packaging ပစ္စည်းများနှင့် အကြမ်းထည်များ ထပ်တိုးထားပါသည် ⭐️
    { id: 13, code: 'SF-001', name: 'ငါးရေခွံကြော် (အကြမ်းထည်)', category: 'Semi-Finished', unit: 'ပိဿာ', inStock: 10 },
    { id: 14, code: 'PK-001', name: '၇x၅ ပလပ်စတစ်အိတ်', category: 'Packaging', unit: 'ခု', inStock: 5000 },
    { id: 15, code: 'PK-002', name: '၃၅ဂရမ် တံဆိပ် (Sticker)', category: 'Packaging', unit: 'ခု', inStock: 5000 },
  ]);

  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('packaging'); // စမ်းသပ်ရန် packaging ကို အရင်ဖွင့်ထားပါသည်

  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 'F-001', name: 'ငါးရေခွံကြော်', outputCategory: 'ငါးရေခွံကြော် (အကြမ်းထည်)', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1.4,
      ingredients: [
        { itemName: 'ငါးရေခွံကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 35000 },
        { itemName: 'Gas အိုး (60Kg)', requiredQty: 0.2, unit: 'ပိဿာ', defaultCost: 250 },
        { itemName: 'စီချွမ် Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 570 },
        { itemName: 'Garlic Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 360 },
        { itemName: 'Marlar Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 480 },
        { itemName: 'ငရုတ်သီးမှုန့်', requiredQty: 0.1, unit: 'ပိဿာ', defaultCost: 1000 },
        { itemName: 'ပျဉ်းတော်သိမ်ရွက်', requiredQty: 0.03, unit: 'ပိဿာ', defaultCost: 500 },
        { itemName: 'ဆား', requiredQty: 0.05, unit: 'ပိဿာ', defaultCost: 100 },
        { itemName: 'ငပိ', requiredQty: 0.05, unit: 'ပိဿာ', defaultCost: 500 },
      ]
    }
  ]);

  // ⭐️ Packaging (SKU) ဖော်မြူလာများ ⭐️
  const [packageRecipes, setPackageRecipes] = useState<PackageRecipe[]>([
    {
      id: 'PK-001', skuName: 'ငါးရေခွံကြော် ၃၅g (Marlar)', category: 'ငါးရေခွံကြော်', taste: 'Marlar', gram: 35, price: 1500,
      ingredients: [
        { itemName: 'ငါးရေခွံကြော် (အကြမ်းထည်)', requiredQty: 0.021, unit: 'ပိဿာ', defaultCost: 650 }, // 35g ခန့်မှန်း
        { itemName: '၇x၅ ပလပ်စတစ်အိတ်', requiredQty: 1, unit: 'ခု', defaultCost: 20 },
        { itemName: '၃၅ဂရမ် တံဆိပ် (Sticker)', requiredQty: 1, unit: 'ခု', defaultCost: 15 },
      ]
    }
  ]);

  const handleStockInAndExpense = (itemName: string, qty: number, totalCost: number) => {
    // (ယခင်အတိုင်း)
  };

  // ⭐️ Production (ကြော်ခြင်း) ပြီးလျှင် အကြမ်းထည် အဖြစ် Warehouse သို့ ဝင်မည် ⭐️
  const handleConfirmProduction = (category: string, taste: string, gram: number, qty: number, bomResults: BOMResult[]) => {
    setInventoryItems(prevItems => {
      let updatedItems = prevItems.map(invItem => {
        const bomMatch = bomResults.find(b => b.itemName === invItem.name || invItem.name.includes(b.itemName));
        if (bomMatch) {
          return { ...invItem, inStock: parseFloat((invItem.inStock - bomMatch.amount).toFixed(2)) };
        }
        return invItem;
      });

      // ထွက်လာသော အကြမ်းထည်ကို Inventory ထဲ ပေါင်းထည့်မည်
      const outputItem = updatedItems.find(i => i.name === category);
      if (outputItem) {
        outputItem.inStock = parseFloat((outputItem.inStock + qty).toFixed(2));
      } else {
        updatedItems.push({
          id: Date.now(), code: `SF-${Date.now()}`, name: category, category: 'Semi-Finished', unit: 'ပိဿာ', inStock: qty
        });
      }
      return updatedItems;
    });
  };

  // ⭐️ Packaging ပြီးလျှင် ကုန်ချော (Finished Goods) သို့ ဝင်မည် ⭐️
  const handleConfirmPackaging = (recipe: PackageRecipe, outputQty: number, bomResults: BOMResult[]) => {
    // ၁. Warehouse မှ အကြမ်းထည် နှင့် အိတ်များကို နှုတ်မည်
    setInventoryItems(prevItems => 
      prevItems.map(invItem => {
        const bomMatch = bomResults.find(b => b.itemName === invItem.name || invItem.name.includes(b.itemName));
        if (bomMatch) {
          return { ...invItem, inStock: parseFloat((invItem.inStock - bomMatch.amount).toFixed(2)) };
        }
        return invItem;
      })
    );

    // ၂. Finished Goods ထဲသို့ ကုန်ချောထုပ်များ ပေါင်းထည့်မည်
    setFinishedGoods(prevGoods => {
      const existingIdx = prevGoods.findIndex(g => g.category === recipe.category && g.taste === recipe.taste && g.gram === recipe.gram);
      if (existingIdx > -1) {
        return prevGoods.map((g, idx) => idx === existingIdx ? { ...g, stockQty: g.stockQty + outputQty } : g);
      } else {
        return [...prevGoods, { id: Date.now(), category: recipe.category, taste: recipe.taste, gram: recipe.gram, price: recipe.price, stockQty: outputQty }];
      }
    });
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'inventory' && <Inventory userRole={user.role} userName={user.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
          {activeTab === 'production' && (
            <Production userRole={user.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />
          )}
          {/* ⭐️ Packaging Component ကို ခေါ်ထားပါသည် ⭐️ */}
          {activeTab === 'packaging' && (
             <Packaging userRole={user.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />
          )}
          {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
          {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
        </div>
      </main>
    </div>
  );
}
