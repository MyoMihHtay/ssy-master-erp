import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';
import { Procurement } from './components/Procurement';

export interface AccountItem { id: number; username: string; password?: string; role: string; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; warehouse?: 'RM' | 'SFG' | 'PKG' | 'FG'; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; voucherNo?: string; receiptImage?: string; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }
export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }
export interface PackageRecipe { id: string; skuName: string; category: string; taste: string; gram: number; price: number; ingredients: RecipeIngredient[]; }
export interface AttachedFile { name: string; dataUrl: string; type: string; }
export interface SupplierOption { id: string; name: string; price: number; qualityDesc: string; analysisNote: string; productFiles?: AttachedFile[]; quotationFiles?: AttachedFile[]; }

export interface PurchaseRequest { 
  id: number; date: string; itemName: string; requestedQty: number; unit: string; suppliers: SupplierOption[]; selectedSupplierId?: string; 
  status: 'Pending' | 'QC_Approved' | 'Finance_Approved' | 'MD_Approved' | 'Purchased' | 'QC_Received' | 'Store_Received' | 'Completed' | 'Rejected'; 
  rejectReason?: string; qcSelectedSupplierId?: string; qcRemark?: string; financeSelectedSupplierId?: string; financeRemark?: string; storeRemark?: string;
  targetWarehouse?: 'RM' | 'SFG' | 'PKG'; 
}

function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try { const item = window.localStorage.getItem(key); return item ? JSON.parse(item) : initialValue; } catch (error) { return initialValue; }
  });
  const setValue = (value: T | ((val: T) => T)) => {
    try { const valueToStore = value instanceof Function ? value(storedValue) : value; setStoredValue(valueToStore); window.localStorage.setItem(key, JSON.stringify(valueToStore)); } catch (error) { console.error(error); }
  };
  return [storedValue, setValue] as const;
}

export default function App() {
  const [accounts, setAccounts] = useLocalStorage<AccountItem[]>('ssy_accounts', [
    { id: 1, username: 'md', password: '123', role: 'md', displayName: 'Managing Director (MD)' },
    { id: 2, username: 'manager', password: '123', role: 'manager', displayName: 'စက်ရုံမှူး (Manager)' },
    { id: 3, username: 'finance', password: '123', role: 'finance', displayName: 'Finance Manager' },
    { id: 4, username: 'qc', password: '123', role: 'qc', displayName: 'QC / QA' },
    { id: 5, username: 'purchasing', password: '123', role: 'purchasing', displayName: 'Purchasing Officer' },
    { id: 6, username: 'store', password: '123', role: 'storekeeper', displayName: 'Store Keeper' },
  ]);

  const [inventoryItems, setInventoryItems] = useLocalStorage<InventoryItem[]>('ssy_inventory', [
    { id: 1, code: 'RM-001', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500, warehouse: 'RM' },
    { id: 2, code: 'RM-002', name: 'ကြက်သွန်ကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 300, warehouse: 'RM' },
    { id: 3, code: 'PK-001', name: 'ပလက်စတစ်အိတ် (၇x၅)', category: 'Packaging', unit: 'ခု', inStock: 5000, warehouse: 'PKG' },
    { id: 4, code: 'PK-002', name: 'ကုန်ပစ္စည်းတံဆိပ် စတစ်ကာ', category: 'Packaging', unit: 'ခု', inStock: 2500, warehouse: 'PKG' },
  ]);

  const [finishedGoods, setFinishedGoods] = useLocalStorage<FinishedGoodItem[]>('ssy_finished_goods', []);
  const [expenses, setExpenses] = useLocalStorage<ExpenseItem[]>('ssy_expenses', []);
  const [purchaseRequests, setPurchaseRequests] = useLocalStorage<PurchaseRequest[]>('ssy_pr', []);
  const [user, setUser] = useLocalStorage<UserSession | null>('ssy_user', null);
  const [activeTab, setActiveTab] = useState<string>('procurement');

  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('ssy_recipes', [
    { id: 'F-001', name: 'ငါးရေခွံကြော်', outputCategory: 'ငါးရေခွံကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1.4, ingredients: [{ itemName: 'ငါးရေခွံကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 35000 }] },
  ]);

  const handleStockInAndExpense = (itemName: string, qty: number, totalCost: number) => { };

  // Production Algorithm: RM နှုတ်၍ SFG သို့ ပေါင်းထည့်ခြင်း
  const handleConfirmProduction = (recipe: Recipe, outputQty: number, bom: BOMResult[]) => {
      setInventoryItems(prev => {
          let updatedItems = [...prev];
          bom.forEach(b => {
              const idx = updatedItems.findIndex(i => i && i.name === b.itemName && (i.warehouse === 'RM' || !i.warehouse));
              if (idx !== -1) updatedItems[idx] = { ...updatedItems[idx], inStock: updatedItems[idx].inStock - b.amount };
          });
          const sfgIdx = updatedItems.findIndex(i => i && i.name === recipe.name && i.warehouse === 'SFG');
          if (sfgIdx !== -1) {
              updatedItems[sfgIdx] = { ...updatedItems[sfgIdx], inStock: updatedItems[sfgIdx].inStock + outputQty };
          } else {
              updatedItems.push({ id: Date.now(), code: `SFG-${Date.now().toString().slice(-4)}`, name: recipe.name, category: recipe.outputCategory, unit: recipe.outputUnit, inStock: outputQty, warehouse: 'SFG' });
          }
          return updatedItems;
      });
  };

  const handleProcurementComplete = (pr: PurchaseRequest) => {
    if (!pr || !pr.itemName) return;
    const targetWH = pr.targetWarehouse || 'RM';
    setInventoryItems(prev => {
      const existingItem = prev.find(item => item && item.name === pr.itemName && item.warehouse === targetWH);
      if (existingItem) {
        return prev.map(item => item.id === existingItem.id ? { ...item, inStock: item.inStock + pr.requestedQty } : item);
      } else {
        const newItem: InventoryItem = { id: Date.now(), code: `${targetWH}-${Date.now().toString().slice(-4)}`, name: pr.itemName, category: targetWH === 'PKG' ? 'Packaging' : 'Purchased Items', unit: pr.unit, inStock: pr.requestedQty, warehouse: targetWH };
        return [...prev, newItem];
      }
    });
    alert(`✅ ${pr.itemName} (${pr.requestedQty} ${pr.unit}) အား [${targetWH} ဂိုထောင်] သို့ ထည့်သွင်းပြီးပါပြီ။`);
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  return (
    <div className="flex flex-col md:flex-row w-full bg-gray-50 overflow-hidden print:block print:h-auto print:bg-white print:overflow-visible" style={{ height: '100dvh' }}>
      <div className="w-full md:w-64 md:h-full bg-gray-900 print:hidden flex-shrink-0 z-50 shadow-xl">
         <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
      </div>
      <main className="flex-1 h-full p-4 md:p-8 pt-6 overflow-y-auto overflow-x-hidden print:overflow-visible print:p-0 print:w-full print:h-auto pb-10 relative z-0">
        {activeTab === 'procurement' && <Procurement userRole={user.role} requests={purchaseRequests} setRequests={setPurchaseRequests} onComplete={handleProcurementComplete} />}
        {activeTab === 'inventory' && <Inventory userRole={user.role} userName={user.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
        {activeTab === 'production' && <Production userRole={user.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />}
        {activeTab === 'packaging' && <div className="p-6 bg-white rounded-2xl shadow font-bold text-gray-500">ထုပ်ပိုးမှု Module (Phase 2 တွင် ချိတ်ဆက်ပါမည်)</div>}
        {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
        {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'accounts' && <AccountManagement accounts={accounts} setAccounts={setAccounts} currentUserRole={user.role} />}
      </main>
    </div>
  );
}
