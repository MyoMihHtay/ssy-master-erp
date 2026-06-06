import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { FinishedGoods } from './components/FinishedGoods';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';

// ==========================================
// Types & Interfaces
// ==========================================
export interface AccountItem {
  id: number; username: string; password?: string; role: 'manager' | 'supervisor' | 'storekeeper' | 'staff'; displayName: string;
}
export interface InventoryItem {
  id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string;
}
export interface FinishedGoodItem {
  id: number; category: string; taste: string; gram: number; price: number; stockQty: number;
}
export interface ExpenseItem {
  id: number; date: string; category: string; description: string; amount: number; updatedBy?: string; updatedAt?: string;
}
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }

// Dynamic Formula အတွက် Type များ
export interface RecipeIngredient {
  itemName: string; requiredQty: number; unit: string; defaultCost: number;
}
export interface Recipe {
  id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[];
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
  ]);

  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('production');

  // ဖော်မြူလာများကို State ဖြင့် သိမ်းဆည်းခြင်း
  const [recipes, setRecipes] = useState<Recipe[]>([
    {
      id: 'F-001', name: 'ငါးရေခွံကြော်', outputCategory: 'ငါးရေခွံကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1.4,
      ingredients: [
        { itemName: 'ငါးရေခွံကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 35000 },
        { itemName: 'Gas အိုး (60Kg)', requiredQty: 0.2, unit: 'ပိဿာ', defaultCost: 250 },
        { itemName: 'စီချွမ် Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 570 },
        { itemName: 'Garlic Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 360 },
        { itemName: 'Marlar Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 480 },
        { itemName: 'ငရုတ်သီးမှုန့်', requiredQty: 0.1, unit: 'ပိဿာ', defaultCost: 1000 },
        { itemName: 'ပျဉ်းတော်သိမ်ရွက်', requiredQty: 0.03, unit: 'ပိဿာ', defaultCost: 500 },
      ]
    },
    {
      id: 'F-002', name: 'ကြက်သွန်ပေါင်းကြော်', outputCategory: 'ကြက်သွန်ပေါင်းကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1.15,
      ingredients: [
        { itemName: 'ကြက်သွန်ပေါင်း ကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 16000 },
        { itemName: 'စားအုန်းဆီ', requiredQty: 0.5, unit: 'ပိဿာ', defaultCost: 3000 },
        { itemName: 'Gas အိုး (60Kg)', requiredQty: 0.2, unit: 'ပိဿာ', defaultCost: 250 },
        { itemName: 'စီချွမ် Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 570 },
        { itemName: 'Marlar Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 480 },
        { itemName: 'ငရုတ်သီးမှုန့်', requiredQty: 0.15, unit: 'ပိဿာ', defaultCost: 1500 },
      ]
    },
    {
      id: 'F-003', name: 'အာလူးပေါင်းကြော်', outputCategory: 'အာလူးပေါင်းကြော်', outputUnit: 'ပိဿာ', 
      outputQtyPerBatch: 1.15, // ⭐️ ဤနေရာတွင် ၁.၁၅ ဟု ပြင်ဆင်လိုက်ပါပြီ ⭐️
      ingredients: [
        { itemName: 'အာလူးပေါင်း ကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 4400 },
        { itemName: 'စားအုန်းဆီ', requiredQty: 0.5, unit: 'ပိဿာ', defaultCost: 3000 },
        { itemName: 'Gas အိုး (60Kg)', requiredQty: 0.2, unit: 'ပိဿာ', defaultCost: 250 },
        { itemName: 'Marlar Seasoning Powder', requiredQty: 20, unit: 'g', defaultCost: 480 },
        { itemName: 'ငရုတ်သီးမှုန့်', requiredQty: 0.15, unit: 'ပိဿာ', defaultCost: 1500 },
        { itemName: 'ပျဉ်းတော်သိမ်ရွက်', requiredQty: 0.03, unit: 'ပိဿာ', defaultCost: 500 },
      ]
    }
  ]);

  const handleStockInAndExpense = (itemName: string, qty: number, totalCost: number) => {
    const itemToUpdate = inventoryItems.find(item => item.name === itemName);
    const itemUnit = itemToUpdate ? itemToUpdate.unit : 'ခု';

    setInventoryItems(prevItems => 
      prevItems.map(item => 
        item.name === itemName 
          ? { ...item, inStock: item.inStock + qty } 
          : item
      )
    );
    
    if (totalCost > 0) {
      setExpenses(prevExpenses => [
        ...prevExpenses,
        { 
          id: Date.now(), 
          date: new Date().toLocaleDateString('en-GB'), 
          category: 'ကုန်ကြမ်းဝယ်ယူစရိတ်', 
          description: `${itemName} အဝင် (${qty} ${itemUnit}) အတွက်`, 
          amount: totalCost 
        }
      ]);
    }
  };

  const handleConfirmProduction = (category: string, taste: string, gram: number, qty: number, bomResults: BOMResult[]) => {
    setInventoryItems(prevItems => 
      prevItems.map(invItem => {
        const bomMatch = bomResults.find(b => b.itemName === invItem.name || invItem.name.includes(b.itemName));
        if (bomMatch) {
          return { ...invItem, inStock: parseFloat((invItem.inStock - bomMatch.amount).toFixed(3)) };
        }
        return invItem;
      })
    );

    setFinishedGoods(prevGoods => {
      const existingIdx = prevGoods.findIndex(g => g.category === category && g.taste === taste && g.gram === gram);
      if (existingIdx > -1) {
        return prevGoods.map((g, idx) => idx === existingIdx ? { ...g, stockQty: parseFloat((g.stockQty + qty).toFixed(3)) } : g);
      } else {
        return [...prevGoods, { id: Date.now(), category, taste, gram, price: 0, stockQty: parseFloat(qty.toFixed(3)) }];
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
            <Production 
              userRole={user.role} 
              inventoryItems={inventoryItems} 
              recipes={recipes} 
              setRecipes={setRecipes} 
              onProductionConfirm={handleConfirmProduction} 
            />
          )}
          {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
          {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
        </div>
      </main>
    </div>
  );
}