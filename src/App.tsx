import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';

export interface AccountItem { id: number; username: string; password?: string; role: string; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; updatedBy?: string; updatedAt?: string; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }
export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }
export interface PackageRecipe { id: string; skuName: string; category: string; taste: string; gram: number; price: number; ingredients: RecipeIngredient[]; }

export default function App() {
  const [accounts, setAccounts] = useState<AccountItem[]>([
    { id: 1, username: 'md', password: '123', role: 'md', displayName: 'Managing Director' },
    { id: 2, username: 'finance', password: '123', role: 'finance', displayName: 'Finance Manager' },
    { id: 3, username: 'qc', password: '123', role: 'qc', displayName: 'QC / QA' },
    { id: 4, username: 'purchasing', password: '123', role: 'purchasing', displayName: 'Purchasing Officer' },
    { id: 5, username: 'store', password: '123', role: 'storekeeper', displayName: 'Store Keeper' },
    { id: 6, username: 'maint', password: '123', role: 'maintenance', displayName: 'Maintenance' },
    { id: 7, username: 'staff', password: '123', role: 'staff', displayName: 'Production Staff' },
  ]);

  const [inventoryItems, setInventoryItems] = useState<InventoryItem[]>([
    { id: 1, code: 'RM-001', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500 },
    { id: 2, code: 'RM-004', name: 'Gas အိုး (60Kg)', category: 'Consumables', unit: 'ပိဿာ', inStock: 100 },
    { id: 3, code: 'PK-001', name: '၇x၅ ပလပ်စတစ်အိတ်', category: 'Packaging', unit: 'ခု', inStock: 5000 },
  ]);

  const [finishedGoods, setFinishedGoods] = useState<FinishedGoodItem[]>([]);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [user, setUser] = useState<UserSession | null>(null);
  const [activeTab, setActiveTab] = useState<string>('inventory');

  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [packageRecipes, setPackageRecipes] = useState<PackageRecipe[]>([]);

  const handleStockInAndExpense = (itemName: string, qty: number, totalCost: number) => { };

  const handleConfirmProduction = (category: string, taste: string, gram: number, qty: number, bomResults: BOMResult[]) => {
    setInventoryItems(prevItems => prevItems.map(invItem => {
        const bomMatch = bomResults.find(b => b.itemName === invItem.name);
        return bomMatch ? { ...invItem, inStock: parseFloat((invItem.inStock - bomMatch.amount).toFixed(2)) } : invItem;
    }));
  };

  const handleConfirmPackaging = (recipe: PackageRecipe, outputQty: number, bomResults: BOMResult[]) => {
    setInventoryItems(prevItems => prevItems.map(invItem => {
        const bomMatch = bomResults.find(b => b.itemName === invItem.name);
        return bomMatch ? { ...invItem, inStock: parseFloat((invItem.inStock - bomMatch.amount).toFixed(2)) } : invItem;
    }));
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  return (
    <div className="flex min-h-screen bg-gray-100 font-sans text-gray-900">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-7xl mx-auto">
          {activeTab === 'inventory' && <Inventory userRole={user.role} userName={user.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
          {activeTab === 'production' && <Production userRole={user.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />}
          {activeTab === 'packaging' && <Packaging userRole={user.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />}
          {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
          {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
          {activeTab === 'accounts' && <AccountManagement accounts={accounts} setAccounts={setAccounts} currentUserRole={user.role} />}
        </div>
      </main>
    </div>
  );
}
