import React, { useState, useEffect } from 'react';
import { supabase } from './supabase'; 
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

import { HR } from './components/HR'; 
import { Dashboard } from './components/Dashboard';
import { Workspace } from './components/Workspace';
import { Reports } from './components/Reports';

export interface AccountItem { id: number; username: string; password?: string; role: string; displayName: string; }
export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; warehouse?: 'RM' | 'SFG' | 'PKG' | 'FG'; lastPurchasePrice?: number; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; cogs?: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; voucherNo?: string; receiptImage?: string; type?: 'expense' | 'income'; }
export interface UserSession { name: string; role: string; }
export interface BOMResult { itemName: string; amount: number; }
export interface RecipeIngredient { itemName: string; requiredQty: number; unit: string; defaultCost: number; }
export interface Recipe { id: string; name: string; outputCategory: string; outputUnit: string; outputQtyPerBatch: number; ingredients: RecipeIngredient[]; }
export interface PackageRecipe { id: string; skuName: string; category: string; taste: string; gram: number; price: number; ingredients: RecipeIngredient[]; }
export interface AttachedFile { name: string; dataUrl: string; type: string; }
export interface SupplierOption { id: string; name: string; price: number; qualityDesc: string; analysisNote: string; productFiles?: AttachedFile[]; quotationFiles?: AttachedFile[]; itemUnitPrices?: Record<string, number>; }
export interface PRItem { id?: string; itemName: string; requestedQty: number; unit: string; targetWarehouse: 'RM' | 'SFG' | 'PKG'; }

export interface PurchaseRequest { 
  id: number; date: string; 
  items?: PRItem[]; itemName?: string; requestedQty?: number; unit?: string; targetWarehouse?: 'RM' | 'SFG' | 'PKG';
  suppliers: SupplierOption[]; selectedSupplierId?: string; 
  status: 'Pending' | 'QC_Approved' | 'Finance_Approved' | 'MD_Approved' | 'Purchased' | 'QC_Received' | 'Store_Received' | 'Completed' | 'Rejected'; 
  rejectReason?: string; qcSelectedSupplierId?: string; qcRemark?: string; financeSelectedSupplierId?: string; financeRemark?: string; storeRemark?: string;
  paymentMethod?: string;
  isCreditPaid?: boolean;
}

export interface SaleItem { product: FinishedGoodItem; quantity: number; subtotal: number; }
export interface SaleRecord { 
  id: string; date: string; customerName: string; phone?: string; salespersonName: string; 
  shopType?: string; address?: string; gps?: string;
  items: SaleItem[]; totalAmount: number; finalAmount: number; 
  discountPercent?: number; taxPercent?: number; 
  paymentMethod: string; creditTerms?: string; isPaid: boolean; 
}

export interface Customer { id: string; name: string; phone: string; shopType: string; address: string; gpsLocation: string; }

// HR Interfaces
export interface Employee { id: string; name: string; position: string; department: string; basicSalary: number; joinedDate: string; phone: string; status: string; }
export interface Attendance { id: number; employeeId: string; date: string; checkInTime?: string; checkOutTime?: string; status: string; checkInGps?: string; checkOutGps?: string; }
export interface Advance { id: number; employeeId: string; date: string; amount: number; reason: string; status: string; deducted: boolean; }
export interface Leave { id: number; employeeId: string; startDate: string; endDate: string; leaveType: string; reason: string; status: 'Pending' | 'Approved' | 'Rejected'; }
export interface LateRule { id: number; startMin: number; endMin: number; deduction: number; type: 'amount' | 'half_day' | 'full_day'; }
export interface HRSetting { 
  id: string; officeLatitude: number; officeLongitude: number; allowedRadius: number; 
  officeStartTime: string; officeEndTime: string; 
  punctualityBonus: number; perfectAttendanceBonus: number; 
  lateRules: LateRule[]; 
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

function useSupabaseTable<T extends { id: any }>(tableName: string, initialValue: T[]) {
  const [storedValue, setStoredValue] = useState<T[]>(initialValue);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.from(tableName).select('*').order('id', { ascending: true });
        if (error) { console.error(`Error loading ${tableName}:`, error); }
        else if (data && data.length > 0) { setStoredValue(data as T[]); } 
        else if (initialValue.length > 0) { await supabase.from(tableName).insert(initialValue); setStoredValue(initialValue); }
      } catch (err) {
        console.error("Supabase load error:", err);
      } finally {
        setIsLoading(false); 
      }
    };
    loadData();
  }, [tableName]);

  const setValue = async (value: T[] | ((val: T[]) => T[])) => {
    try {
      const valueToStore = value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore); 
      const { error } = await supabase.from(tableName).upsert(valueToStore);
      if (error) console.error("Supabase Sync Error:", error);
    } catch (error) { console.error(error); }
  };
  
  return [storedValue, setValue, isLoading] as const;
}

export default function App() {
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false); 

  const [accounts, setAccounts] = useLocalStorage<AccountItem[]>('ssy_accounts', [
    { id: 1, username: 'md', password: '123', role: 'md', displayName: 'Managing Director (MD)' },
    { id: 2, username: 'manager', password: '123', role: 'manager', displayName: 'စက်ရုံမှူး (Manager)' },
    { id: 3, username: 'finance', password: '123', role: 'finance', displayName: 'Finance Manager' },
    { id: 4, username: 'qc', password: '123', role: 'qc', displayName: 'QC / QA' },
    { id: 5, username: 'purchasing', password: '123', role: 'purchasing', displayName: 'Purchasing Officer' },
    { id: 6, username: 'store', password: '123', role: 'storekeeper', displayName: 'Store Keeper' },
    { id: 7, username: 'sale', password: '123', role: 'sales', displayName: 'Sales Person' },
    { id: 8, username: 'hr', password: '123', role: 'hr', displayName: 'HR Manager' },
  ]);

  const [inventoryItems, setInventoryItems, invLoading] = useSupabaseTable<InventoryItem>('ssy_inventory', [
    { id: 1, code: 'RM-001', name: 'ငါးရေခွံကုန်ကြမ်း', category: 'Raw Materials', unit: 'ပိဿာ', inStock: 500, warehouse: 'RM', lastPurchasePrice: 15000 },
  ]);

  const [finishedGoods, setFinishedGoods, fgLoading] = useSupabaseTable<FinishedGoodItem>('ssy_finished_goods', []);
  const [salesRecords, setSalesRecords, salesLoading] = useSupabaseTable<SaleRecord>('ssy_sales_records', []); 
  const [expenses, setExpenses, expLoading] = useSupabaseTable<ExpenseItem>('ssy_expenses', []);
  const [customers, setCustomers, custLoading] = useSupabaseTable<Customer>('ssy_customers', []);
  
  const [purchaseRequests, setPurchaseRequests, prLoading] = useSupabaseTable<PurchaseRequest>('ssy_purchase_requests', []);
  const [recipes, setRecipes, recLoading] = useSupabaseTable<Recipe>('ssy_recipes', []);
  const [packageRecipes, setPackageRecipes, pkgRecLoading] = useSupabaseTable<PackageRecipe>('ssy_pkg_recipes', []);

  // HR Cloud Database ချိတ်ဆက်မှုများ
  const [employees, setEmployees, empLoading] = useSupabaseTable<Employee>('ssy_employees', []);
  const [attendance, setAttendance, attLoading] = useSupabaseTable<Attendance>('ssy_attendance', []);
  const [advances, setAdvances, advLoading] = useSupabaseTable<Advance>('ssy_advances', []);
  const [leaves, setLeaves, leaveLoading] = useSupabaseTable<Leave>('ssy_leaves', []);
  const [hrSettings, setHrSettings, hrsLoading] = useSupabaseTable<HRSetting>('ssy_hr_settings', []);

  const [user, setUser] = useLocalStorage<UserSession | null>('ssy_user', null);
  
  const [activeTab, setActiveTab] = useState<string>('dashboard');

  useEffect(() => {
    const testSupabaseConnection = async () => {
      try {
        const { error } = await supabase.from('ssy_inventory').select('id').limit(1);
        if (!error) setIsCloudConnected(true); 
      } catch (err) { console.error("Connection failed", err); }
    };
    testSupabaseConnection();
  }, []);

  const handleStockInAndExpense = () => { };

  const handleConfirmProduction = (recipe: Recipe, producedQty: number, totalCost: number, consumedItems: BOMResult[]) => {
    const unitSfgCost = totalCost / producedQty;
    
    setInventoryItems(prev => {
      let updated = [...prev];
      consumedItems.forEach(consumed => {
         const idx = updated.findIndex(i => {
           let actualWarehouse = i.warehouse;
           if (!actualWarehouse) {
             if (i.code?.startsWith('PK') || i.category === 'Packaging') actualWarehouse = 'PKG';
             else if (i.code?.startsWith('SFG')) actualWarehouse = 'SFG';
             else actualWarehouse = 'RM';
           }
           return i.name === consumed.itemName && actualWarehouse === 'RM';
         });
         
         if (idx !== -1) {
           updated[idx] = { ...updated[idx], inStock: updated[idx].inStock - consumed.amount };
         }
      });

      const sfgIdx = updated.findIndex(i => i.name === recipe.name && (i.warehouse === 'SFG' || i.code?.startsWith('SFG')));
      if (sfgIdx !== -1) {
         updated[sfgIdx] = { 
           ...updated[sfgIdx], 
           inStock: updated[sfgIdx].inStock + producedQty,
           lastPurchasePrice: unitSfgCost 
         };
      } else {
         updated.push({
           id: Date.now(), code: `SFG-${Date.now().toString().slice(-4)}`,
           name: recipe.name, category: recipe.outputCategory, unit: recipe.outputUnit,
           inStock: producedQty, warehouse: 'SFG',
           lastPurchasePrice: unitSfgCost
         });
      }
      return updated;
    });

    alert(`✅ ${recipe.name} (${producedQty} ${recipe.outputUnit}) ထုတ်လုပ်မှု အောင်မြင်ပြီး SFG ဂိုထောင်သို့ အရင်းဈေး ${unitSfgCost.toLocaleString()} Ks ဖြင့် ပေါင်းထည့်ပြီးပါပြီ။`);
  };

  const handleConfirmPackaging = (recipe: PackageRecipe, packQty: number, totalCost: number, consumedSFG: BOMResult[], consumedPKG: BOMResult[]) => {
    const unitFgCogs = totalCost / packQty;
    
    setInventoryItems(prev => {
      let updated = [...prev];
      [...consumedSFG, ...consumedPKG].forEach(consumed => {
         const idx = updated.findIndex(i => i.name === consumed.itemName && (i.warehouse === 'SFG' || i.warehouse === 'PKG'));
         if (idx !== -1) {
           updated[idx] = { ...updated[idx], inStock: updated[idx].inStock - consumed.amount };
         }
      });
      return updated;
    });

    setFinishedGoods(prev => {
       let updated = [...prev];
       const fgIdx = updated.findIndex(fg => fg.category === recipe.category && fg.taste === recipe.taste && fg.gram === recipe.gram);
       
       if (fgIdx !== -1) {
         updated[fgIdx] = { 
           ...updated[fgIdx], 
           stockQty: updated[fgIdx].stockQty + packQty,
           cogs: unitFgCogs,
           price: recipe.price 
         };
       } else {
         updated.push({
           id: Date.now(), category: recipe.category, taste: recipe.taste, gram: recipe.gram,
           price: recipe.price, stockQty: packQty, cogs: unitFgCogs
         });
       }
       return updated;
    });

    alert(`✅ ${recipe.skuName} (${packQty} ထုပ်) ထုပ်ပိုးမှု အောင်မြင်ပြီး အရောင်းစာရင်းသို့ COGS ${unitFgCogs.toLocaleString()} Ks ဖြင့် ရောင်းရန်အသင့် ပေါင်းထည့်ပြီးပါပြီ။`);
  };

  const handleProcurementComplete = (pr: PurchaseRequest) => {
    const selectedSupplier = pr.suppliers.find(s => s.id === pr.selectedSupplierId);
    if (!selectedSupplier) return;
    const totalCost = selectedSupplier.price || 0;
    
    setInventoryItems(prevItems => {
      let newItems = [...prevItems];
      const itemsToProcess = pr.items || [];

      itemsToProcess.forEach((prItem) => {
        if (!prItem.itemName) return;
        const existingIdx = newItems.findIndex(i => i.name.toLowerCase() === prItem.itemName.toLowerCase() && i.warehouse === prItem.targetWarehouse);
        
        let exactUnitPrice = selectedSupplier.itemUnitPrices?.[prItem.id || ''] || 0;
        if (!exactUnitPrice && totalCost > 0) {
            exactUnitPrice = totalCost / (itemsToProcess.length * (prItem.requestedQty || 1));
        }

        if (existingIdx >= 0) {
          newItems[existingIdx] = {
            ...newItems[existingIdx],
            inStock: newItems[existingIdx].inStock + (prItem.requestedQty || 0),
            lastPurchasePrice: exactUnitPrice
          };
        } else {
          newItems.push({
            id: Date.now() + Math.random(),
            code: `NEW-${Date.now().toString().slice(-4)}`,
            name: prItem.itemName,
            category: prItem.targetWarehouse === 'RM' ? 'Raw Materials' : prItem.targetWarehouse === 'SFG' ? 'Semi-Finished Goods' : 'Packaging',
            unit: prItem.unit || 'ခု',
            inStock: prItem.requestedQty || 0,
            warehouse: prItem.targetWarehouse as 'RM' | 'SFG' | 'PKG',
            lastPurchasePrice: exactUnitPrice
          });
        }
      });
      return newItems;
    });

    if (pr.paymentMethod !== 'CREDIT (အကြွေး)') {
      setExpenses(prev => [{
        id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'ကုန်ကြမ်းဝယ်ယူမှု', description: `Auto-Sync: ဝယ်ယူရေး PR #${pr.id} (${selectedSupplier.name}) - ${pr.paymentMethod || 'CASH'}`, amount: totalCost, voucherNo: `PR-${pr.id}`, type: 'expense'
      }, ...prev]);
      alert(`✅ ဂိုထောင်စာရင်းထဲသို့ ပစ္စည်းများရောက်ရှိသွားပြီး၊ ငွေကျပ် ${totalCost.toLocaleString()} အား ဘဏ္ဍာရေးစာရင်းသို့ (အော်တို) သွင်းပေးလိုက်ပါပြီ။`);
    } else {
      alert(`📌 အကြွေးဝယ်ယူမှုဖြစ်သဖြင့် Finance စာရင်းထဲသို့ ထွက်ငွေ (Auto-Sync) မဝင်ပါ။ \nအကြွေးဆပ်သည့်အခါမှသာ MD အကောင့်ဖြင့် Finance ထဲသို့ သွင်းပေးနိုင်ပါသည်။`);
    }
  };

  const handleCreditPayment = (pr: PurchaseRequest) => {
    const selectedSupplier = pr.suppliers.find(s => s.id === pr.selectedSupplierId);
    if (!selectedSupplier) return;

    setExpenses(prev => [{
      id: Date.now(), 
      date: new Date().toLocaleDateString('en-GB'), 
      category: 'ကုန်ကြမ်းဝယ်ယူမှု (အကြွေးဆပ်)', 
      description: `Credit Payment: ဝယ်ယူရေး PR #${pr.id} (${selectedSupplier.name})`, 
      amount: selectedSupplier.price || 0, 
      voucherNo: `PR-${pr.id}`, 
      type: 'expense'
    }, ...prev]);

    setPurchaseRequests(prev => prev.map(r => r.id === pr.id ? { ...r, isCreditPaid: true } : r));
  };

  const handleCheckoutSale = (newSale: SaleRecord) => {
    setFinishedGoods(prev => {
       let updated = [...prev];
       newSale.items.forEach(saleItem => {
          const idx = updated.findIndex(fg => fg.id === saleItem.product.id);
          if (idx !== -1) updated[idx] = { ...updated[idx], stockQty: updated[idx].stockQty - saleItem.quantity };
       });
       return updated;
    });

    if (newSale.isPaid) {
      setExpenses(prev => [...prev, {
        id: Date.now(), date: newSale.date, category: 'အရောင်းဝင်ငွေ', description: `Invoice: #${newSale.id} - ${newSale.customerName}`, amount: newSale.finalAmount, type: 'income'
      }]);
    }

    setCustomers(prev => {
      const existingIdx = prev.findIndex(c => c.name.toLowerCase() === newSale.customerName.toLowerCase());
      const customerData: Customer = {
        id: existingIdx !== -1 ? prev[existingIdx].id : `CUST-${Date.now()}`,
        name: newSale.customerName, phone: newSale.phone || '', shopType: newSale.shopType || '',
        address: newSale.address || '', gpsLocation: newSale.gps || ''
      };
      if (existingIdx !== -1) {
        const updated = [...prev]; updated[existingIdx] = customerData; return updated;
      } else return [...prev, customerData];
    });

    setSalesRecords([newSale, ...salesRecords]);
  };

  const handleMarkAsPaid = (saleId: string) => {
    const saleToUpdate = salesRecords.find(s => s.id === saleId);
    if (saleToUpdate && !saleToUpdate.isPaid) {
      setSalesRecords(salesRecords.map(s => s.id === saleId ? { ...s, isPaid: true } : s));
      setExpenses(prev => [...prev, {
        id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'အကြွေးရငွေ', description: `Invoice: #${saleToUpdate.id} - ${saleToUpdate.customerName}`, amount: saleToUpdate.finalAmount, type: 'income'
      }]);
      alert("✅ ငွေလက်ခံရရှိကြောင်း အတည်ပြုပြီး Finance စာရင်းသို့ ဝင်ငွေပေါင်းထည့်ပြီးပါပြီ။");
    }
  };

  if (!user) return <Login onLogin={(name, role) => setUser({ name, role })} accounts={accounts} />;

  const isAnyLoading = invLoading || fgLoading || salesLoading || expLoading || custLoading || prLoading || recLoading || pkgRecLoading || empLoading || attLoading || advLoading || leaveLoading || hrsLoading;
  
  if (isAnyLoading) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-gray-50 flex-col gap-4">
         <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="font-bold text-slate-500">Cloud Data ချိတ်ဆက်နေပါသည်...</p>
      </div>
    );
  }

  return (
    <div className="flex w-full h-[100dvh] bg-gray-50 overflow-hidden print:block print:h-auto print:bg-white print:overflow-visible relative">
      
      <div className="md:hidden fixed top-0 left-0 w-full bg-gray-900 text-white z-50 p-4 flex justify-between items-center shadow-md print:hidden">
        <h1 className="font-black text-xl tracking-wider">SSY <span className="text-emerald-400">ERP</span></h1>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-white text-3xl font-black focus:outline-none">☰</button>
      </div>

      <div className={`fixed md:relative top-0 left-0 h-full bg-gray-900 print:hidden flex-shrink-0 z-[100] shadow-2xl flex flex-col transition-transform duration-300 transform md:translate-x-0 w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="md:hidden p-4 text-right">
           <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
         </div>
         <div className="flex-1 overflow-y-auto">
           <div onClick={() => setIsMobileMenuOpen(false)}>
             <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={() => setUser(null)} />
           </div>
         </div>
         <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
           {isCloudConnected ? (
             <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 py-2 rounded-lg border border-emerald-400/20">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>☁️ Cloud ချိတ်ဆက်ထားသည်
             </div>
           ) : (
             <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 py-2 rounded-lg border border-amber-500/20">
               <div className="w-2 h-2 bg-amber-500 rounded-full"></div>ချိတ်ဆက်မှု စစ်ဆေးနေပါသည်...
             </div>
           )}
         </div>
      </div>

      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 z-[90] md:hidden backdrop-blur-sm print:hidden"></div>
      )}
      
      <main className="flex-1 w-full h-full p-2 md:p-8 pt-20 md:pt-6 overflow-y-auto print:overflow-visible print:p-0 print:w-full print:h-auto pb-10 relative z-0">
        
        {activeTab === 'dashboard' && <Dashboard sales={salesRecords} expenses={expenses} finishedGoods={finishedGoods} inventory={inventoryItems} employees={employees} />}
        {activeTab === 'workspace' && <Workspace userName={user.name} userRole={user.role} />}
        
        {/* 🌟 Reports Component တွင် props များ အပြည့်အစုံ Pass လုပ်ပေးထားပါသည် 🌟 */}
        {activeTab === 'reports' && (
           <Reports 
             sales={salesRecords} 
             inventory={inventoryItems} 
             finishedGoods={finishedGoods} 
             expenses={expenses} 
             purchaseRequests={purchaseRequests}
             recipes={recipes}
             packageRecipes={packageRecipes}
             setActiveTab={setActiveTab} 
           />
        )}

        {activeTab === 'sales' && <Sales userRole={user.role} userName={user.name} finishedGoods={finishedGoods} sales={salesRecords} customers={customers} onCheckout={handleCheckoutSale} onMarkAsPaid={handleMarkAsPaid} onDeleteSale={(id) => setSalesRecords(salesRecords.filter(s => s.id !== id))} />}
        {activeTab === 'procurement' && <Procurement userRole={user.role} requests={purchaseRequests} setRequests={setPurchaseRequests} onComplete={handleProcurementComplete} onCreditPayment={handleCreditPayment} />}
        {activeTab === 'inventory' && <Inventory userRole={user.role} userName={user.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
        {activeTab === 'production' && <Production userRole={user.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />}
        {activeTab === 'packaging' && <Packaging userRole={user.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />}
        {activeTab === 'finished_goods' && <FinishedGoods userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
        {activeTab === 'expenses' && <Expenses userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}
        
        {activeTab === 'hr' && (
           <HR 
             userRole={user.role} userName={user.name} 
             employees={employees} setEmployees={setEmployees} 
             attendance={attendance} setAttendance={setAttendance} 
             advances={advances} setAdvances={setAdvances} 
             leaves={leaves} setLeaves={setLeaves}
             hrSettings={hrSettings} setHrSettings={setHrSettings} 
             setExpenses={setExpenses} accounts={accounts} 
           />
        )}
        
        {activeTab === 'accounts' && <AccountManagement accounts={accounts} setAccounts={setAccounts} currentUserRole={user.role} />}
      </main>
    </div>
  );
}
