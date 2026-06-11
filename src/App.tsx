import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Sales } from './components/Sales';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';
import { Procurement } from './components/Procurement';

export interface AccountItem { id: number; username: string; password?: string; role: string; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; warehouse?: 'RM' | 'SFG' | 'PKG' | 'FG'; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; voucherNo?: string; receiptImage?: string; type?: 'expense' | 'income'; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }
export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }
export interface PackageRecipe { id: string; skuName: string; category: string; taste: string; gram: number; price: number; ingredients: RecipeIngredient[]; }
export interface AttachedFile { name: string; dataUrl: string; type: string; }
export interface SupplierOption { id: string; name: string; price: number; qualityDesc: string; analysisNote: string; productFiles?: AttachedFile[]; quotationFiles?: AttachedFile[]; }
export interface PRItem { itemName: string; requestedQty: number; unit: string; targetWarehouse: 'RM' | 'SFG' | 'PKG'; }

export interface PurchaseRequest { 
  id: number; date: string; 
  items?: PRItem[]; itemName?: string; requestedQty?: number; unit?: string; targetWarehouse?: 'RM' | 'SFG' | 'PKG';
  suppliers: SupplierOption[]; selectedSupplierId?: string; 
  status: 'Pending' | 'QC_Approved' | 'Finance_Approved' | 'MD_Approved' | 'Purchased' | 'QC_Received' | 'Store_Received' | 'Completed' | 'Rejected'; 
  rejectReason?: string; qcSelectedSupplierId?: string; qcRemark?: string; financeSelectedSupplierId?: string; financeRemark?: string; storeRemark?: string;
}

export interface SaleItem { product: FinishedGoodItem; quantity: number; subtotal: number; }
export interface SaleRecord { 
  id: string; date: string; customerName: string; phone?: string; salespersonName: string; 
  shopType?: string; address?: string; gps?: string;
  items: SaleItem[]; totalAmount: number; finalAmount: number; 
  discountPercent?: number; taxPercent?: number; 
  paymentMethod: string; creditTerms?: string; isPaid: boolean; 
}

// 🌟 Customer Database (CRM) အတွက် Interface အသစ် 🌟
export interface Customer {
  id: string;
  name: string;
  phone: string;
  shopType: string;
  address: string;
  gpsLocation: string;
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
    { id: 7, username: 'sale', password: '123', role: 'sales', displayName: 'Sales Person' },
  ]);

  const [inventoryItems, setInventoryItems] = useLocalStorage<InventoryItem[]>('ssy_inventory', [
    { id: 1, code: 'RM-001', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500, warehouse: 'RM' },
    { id: 3, code: 'PK-001', name: 'ပလက်စတစ်အိတ် (၇x၅)', category: 'Packaging', unit: 'ခု', inStock: 5000, warehouse: 'PKG' },
  ]);

  const [finishedGoods, setFinishedGoods] = useLocalStorage<FinishedGoodItem[]>('ssy_finished_goods', [
    { id: 101, category: 'ငါးရေခွံကြော်', taste: 'Normal', gram: 35, price: 1500, stockQty: 50 },
  ]);

  const [salesRecords, setSalesRecords] = useLocalStorage<SaleRecord[]>('ssy_sales_records', []); 
  const [expenses, setExpenses] = useLocalStorage<ExpenseItem[]>('ssy_expenses', []);
  const [purchaseRequests, setPurchaseRequests] = useLocalStorage<PurchaseRequest[]>('ssy_pr', []);
  const [user, setUser] = useLocalStorage<UserSession | null>('ssy_user', null);
  const [activeTab, setActiveTab] = useState<string>('sales');

  const [recipes, setRecipes] = useLocalStorage<Recipe[]>('ssy_recipes', []);
  const [packageRecipes, setPackageRecipes] = useLocalStorage<PackageRecipe[]>('ssy_pkg_recipes', []);
  
  // 🌟 ဖောက်သည်စာရင်း (Customers Database) 🌟
  const [customers, setCustomers] = useLocalStorage<Customer[]>('ssy_customers', []);

  const handleStockInAndExpense = () => { };
  const handleConfirmProduction = () => { };
  const handleConfirmPackaging = () => { };
  const handleProcurementComplete = () => { };

  const handleCheckoutSale = (newSale: SaleRecord) => {
    // 1. FG မှ နှုတ်မည်
    setFinishedGoods(prev => {
       let updated = [...prev];
       newSale.items.forEach(saleItem => {
          const idx = updated.findIndex(fg => fg.id === saleItem.product.id);
          if (idx !== -1) {
             updated[idx] = { ...updated[idx], stockQty: updated[idx].stockQty - saleItem.quantity };
          }
       });
       return updated;
    });

    // 2. ဝင်ငွေ ပေါင်းထည့်မည်
    if (newSale.isPaid) {
      setExpenses(prev => [...prev, {
        id: Date.now(), date: newSale.date, category: 'အရောင်းဝင်ငွေ (Sales Revenue)', description: `Invoice: #${newSale.id} - ${newSale.customerName}`, amount: newSale.finalAmount, type: 'income'
      }]);
    }

    // 🌟 3. ဖောက်သည်အချက်အလက်များကို Database သို့ Auto-Save သို့မဟုတ် Update လုပ်မည် 🌟
    setCustomers(prev => {
      const existingIdx = prev.findIndex(c => c.name.toLowerCase() === newSale.customerName.toLowerCase());
      const customerData: Customer = {
        id: existingIdx !== -1 ? prev[existingIdx].id : `CUST-${Date.now()}`,
        name: newSale.customerName,
        phone: newSale.phone || '',
        shopType: newSale.shopType || '',
        address: newSale.address || '',
        gpsLocation: newSale.gps || ''
      };
      if (existingIdx !== -1) {
        const updated = [...prev];
        updated[existingIdx] = customerData;
        return updated;
      } else {
        return [...prev, customerData];
      }
    });

    setSalesRecords([newSale, ...salesRecords]);
  };

  const handleMarkAsPaid = (saleId: string) => {
    const saleToUpdate = salesRecords.find(s => s.id === saleId);
    if (saleToUpdate && !saleToUpdate.isPaid) {
      setSalesRecords(salesRecords.map(s => s.id === saleId ? { ...s, isPaid: true } : s));
      setExpenses(prev => [...prev, {
        id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'အကြွေးရငွေ (Credit Collected)', description: `Invoice: #${saleToUpdate.id} - ${saleToUpdate.customerName}`, amount: saleToUpdate.finalAmount, type: 'income'
      }]);
      alert("✅ ငွေလက်ခံရရှိကြောင်း အတည်ပြုပြီး Finance စာရင်းသို့ ဝင်ငွေပေါင်းထည့်ပြီးပါပြီ။");
    }
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  return (
    <div className="flex flex-col md:flex-row w-full bg-gray-50 overflow-hidden print:block print:h-auto print:bg-white print:overflow-visible" style={{ height: '100dvh' }}>
      <div className="w-full md:w-64 md:h-full bg-gray-900 print:hidden flex-shrink-0 z-50 shadow-xl">
         <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
      </div>
      <main className="flex-1 h-full p-4 md:p-8 pt-6 overflow-y-auto overflow-x-hidden print:overflow-visible print:p-0 print:w-full print:h-auto pb-10 relative z-0">
        {/* 🌟 Sales ကို Customers Data ပါ ထည့်သွင်းပေးလိုက်ပါပြီ 🌟 */}
        {activeTab === 'sales' && <Sales userRole={user.role} userName={user.name} finishedGoods={finishedGoods} sales={salesRecords} customers={customers} onCheckout={handleCheckoutSale} onMarkAsPaid={handleMarkAsPaid} onDeleteSale={(id) => setSalesRecords(salesRecords.filter(s => s.id !== id))} />}
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
