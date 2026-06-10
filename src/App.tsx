import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';
import { Procurement } from './components/Procurement';

export interface AccountItem { id: number; username: string; password?: string; role: string; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; voucherNo?: string; receiptImage?: string; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }
export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }
export interface PackageRecipe { id: string; skuName: string; category: string; taste: string; gram: number; price: number; ingredients: RecipeIngredient[]; }
export interface AttachedFile { name: string; dataUrl: string; type: string; }
export interface SupplierOption { id: string; name: string; price: number; qualityDesc: string; analysisNote: string; productFiles?: AttachedFile[]; quotationFiles?: AttachedFile[]; }

// QC နှင့် Finance ထောက်ခံချက်များ မှတ်သားရန် တိုးထားပါသည်
export interface PurchaseRequest { 
  id: number; date: string; itemName: string; requestedQty: number; unit: string; suppliers: SupplierOption[]; selectedSupplierId?: string; 
  status: 'Pending' | 'QC_Approved' | 'Finance_Approved' | 'MD_Approved' | 'Purchased' | 'QC_Received' | 'Store_Received' | 'Completed' | 'Rejected'; 
  rejectReason?: string;
  qcSelectedSupplierId?: string;
  qcRemark?: string;
  financeSelectedSupplierId?: string;
  financeRemark?: string;
}

// 🌟 App ပိတ်သွားလည်း Data မပျောက်စေရန် Local Storage ထဲ သိမ်းပေးမည့် Hook 🌟
function useLocalStorage<T>(key: string, initialValue: T) {
  const [storedValue, setStoredValue] = useState<T>(() => {
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      window.localStorage.setItem(key, JSON.stringify(valueToStore));
    } catch (error) {
      console.error(error);
      alert("⚠️ ဖုန်း Storage ပြည့်နေပါသည်။ ဓာတ်ပုံများလွန်းနေနိုင်ပါသည်။");
    }
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
    { id: 7, username: 'maint', password: '123', role: 'maintenance', displayName: 'Maintenance' },
    { id: 8, username: 'staff', password: '123', role: 'staff', displayName: 'Production Staff' },
  ]);

  const [inventoryItems, setInventoryItems] = useLocalStorage<InventoryItem[]>('ssy_inventory', [
    { id: 1, code: 'RM-001', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500 },
    { id: 2, code: 'RM-002', name: 'ကြက်သွန်ကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 300 },
    { id: 3, code: 'RM-003', name: 'အာလူးကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 400 },
    { id: 4, code: 'PK-001', name: '၇x၅ ပလပ်စတစ်အိတ်', category: 'Packaging', unit: 'ခု', inStock: 5000 },
  ]);

  const [finishedGoods, setFinishedGoods] = useLocalStorage<FinishedGoodItem[]>('ssy_finished_goods', []);
  const [expenses, setExpenses] = useLocalStorage<ExpenseItem[]>('ssy_expenses', []);
  const [purchaseRequests, setPurchaseRequests] = useLocalStorage<PurchaseRequest[]>('ssy_pr', []);
  
  // User Login State ကိုပါ သိမ်းထားပါမည်
  const [user, setUser] = useLocalStorage<UserSession | null>('ssy_user', null);
  const [activeTab, setActiveTab] = useState<string>('procurement');

  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('ssy_recipes', [
    { id: 'F-001', name: 'ငါးရေခွံကြော်', outputCategory: 'ငါးရေခွံကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1.4, ingredients: [{ itemName: 'ငါးရေခွံကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 35000 }] },
    { id: 'F-002', name: 'ကြက်သွန်ပေါင်းကြော်', outputCategory: 'ကြက်သွန်ပေါင်းကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1, ingredients: [{ itemName: 'ကြက်သွန်ကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 15000 }] },
    { id: 'F-003', name: 'အာလူးပေါင်းကြော်', outputCategory: 'အာလူးပေါင်းကြော်', outputUnit: 'ပိဿာ', outputQtyPerBatch: 1, ingredients: [{ itemName: 'အာလူးကုန်ကြမ်း', requiredQty: 1, unit: 'ပိဿာ', defaultCost: 12000 }] },
  ]);

  const [packageRecipes, setPackageRecipes] = useLocalStorage<PackageRecipe[]>('ssy_pkg_recipes', [
    { id: 'PK-001', skuName: 'ငါးရေခွံကြော် ၃၅g', category: 'ငါးရေခွံကြော်', taste: 'Normal', gram: 35, price: 1500, ingredients: [{ itemName: 'ငါးရေခွံကြော်', requiredQty: 0.021, unit: 'ပိဿာ', defaultCost: 650 }] },
    { id: 'PK-002', skuName: 'အာလူးကြော် ၃၅g', category: 'အာလူးပေါင်းကြော်', taste: 'Normal', gram: 35, price: 1000, ingredients: [{ itemName: 'အာလူးပေါင်းကြော်', requiredQty: 0.021, unit: 'ပိဿာ', defaultCost: 400 }] },
  ]);

  const handleStockInAndExpense = (itemName: string, qty: number, totalCost: number) => { };

  const handleConfirmProduction = (cat: string, t: string, g: number, qty: number, bom: BOMResult[]) => {
      setInventoryItems(prev => prev.map(inv => {
          const match = bom.find(b => b.itemName === inv.name);
          return match ? { ...inv, inStock: inv.inStock - match.amount } : inv;
      }));
  };

  const handleConfirmPackaging = (recipe: PackageRecipe, outputQty: number, bom: BOMResult[]) => {
      setInventoryItems(prev => prev.map(inv => {
          const match = bom.find(b => b.itemName === inv.name);
          return match ? { ...inv, inStock: inv.inStock - match.amount } : inv;
      }));
      setFinishedGoods(prev => [...prev, { id: Date.now(), category: recipe.category, taste: recipe.taste, gram: recipe.gram, price: recipe.price, stockQty: outputQty }]);
  };

  const handleProcurementComplete = (pr: PurchaseRequest) => {
    setInventoryItems(prev => {
      const existingItem = prev.find(item => item.name === pr.itemName);
      if (existingItem) {
        return prev.map(item => item.id === existingItem.id ? { ...item, inStock: item.inStock + pr.requestedQty } : item);
      } else {
        const newItem: InventoryItem = { id: Date.now(), code: `NEW-${Date.now().toString().slice(-4)}`, name: pr.itemName, category: 'Purchased Items', unit: pr.unit, inStock: pr.requestedQty };
        return [...prev, newItem];
      }
    });
    alert(`✅ ${pr.itemName} (${pr.requestedQty} ${pr.unit}) အား ကုန်လှောင်ရုံစာရင်းသို့ အလိုအလျောက် ပေါင်းထည့်ပြီးပါပြီ။`);
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  return (
    <div className="flex flex-col md:flex-row w-full bg-gray-50 overflow-hidden print:block print:h-auto print:bg-white print:overflow-visible" style={{ height: '100dvh' }}>
      <div className="w-full md:w-64 md:h-full bg-gray-900 print:hidden flex-shrink-0 z-50 shadow-xl">
         <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
      </div>
      <main className="flex-1 h-full p-4 md:p-8 pt-6 overflow-y-auto overflow-x-hidden print:overflow-visible print:p-0 print:w-full print:h-auto pb-10">
        {activeTab === 'procurement' && <Procurement userRole={user.role} requests={purchaseRequests} setRequests={setPurchaseRequests} onComplete={handleProcurementComplete} />}
        {activeTab === 'inventory' && <Inventory userRole={user.role} userName={user.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
        {activeTab === 'production' && <Production userRole={user.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />}
        {activeTab === 'packaging' && <Packaging userRole={user.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />}
        {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
        {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'accounts' && <AccountManagement accounts={accounts} setAccounts={setAccounts} currentUserRole={user.role} />}
      </main>
    </div>
  );
}
