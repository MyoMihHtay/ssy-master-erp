import React, { useState, useEffect } from 'react';
import { legacySupabase } from './legacySupabase';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { MavoraInventory } from './components/MavoraInventory';
import { MavoraProduction } from './components/MavoraProduction';
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Sales } from './components/Sales';
import { Expenses } from './components/Expenses';
import { Procurement } from './components/Procurement';

import { HR } from './components/HR';
import { Dashboard } from './components/Dashboard';
import { Workspace } from './components/Workspace';
import { Reports } from './components/Reports';
import { LANGUAGE_STORAGE_KEY, tr, type AppLanguage } from './i18n';
import {
  restoreMavoraSession,
  signOutMavora,
  type MavoraUserSession,
} from './auth/mavoraAuth';

export interface InventoryItem { id: number; code: string; name: string; category: string; unit: string; inStock: number; updatedBy?: string; updatedAt?: string; warehouse?: 'RM' | 'SFG' | 'PKG' | 'FG'; lastPurchasePrice?: number; }
export interface FinishedGoodItem { id: number; category: string; taste: string; gram: number; price: number; stockQty: number; cogs?: number; }
export interface ExpenseItem { id: number; date: string; category: string; description: string; amount: number; voucherNo?: string; receiptImage?: string; type?: 'expense' | 'income'; }
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
  // 🌟 Return & Exchange မှတ်တမ်း သိမ်းရန် field များ 🌟
  status?: 'Normal' | 'Returned';
  returnDetails?: { type: 'refund' | 'exchange'; totalRefund: number; note: string; date: string; items: { category: string; taste: string; quantity: number; }[] };
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
        const { data, error } = await legacySupabase.from(tableName).select('*').order('id', { ascending: true });
        if (error) { console.error(`Error loading ${tableName}:`, error); }
        else if (data && data.length > 0) { setStoredValue(data as T[]); }
        else if (initialValue.length > 0) { await legacySupabase.from(tableName).insert(initialValue); setStoredValue(initialValue); }
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
      const { error } = await legacySupabase.from(tableName).upsert(valueToStore);
      if (error) console.error("Supabase Sync Error:", error);
    } catch (error) { console.error(error); }
  };

  return [storedValue, setValue, isLoading] as const;
}

export default function App() {
  const [isCloudConnected, setIsCloudConnected] = useState<boolean>(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState<boolean>(false);


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

  const [employees, setEmployees, empLoading] = useSupabaseTable<Employee>('ssy_employees', []);
  const [attendance, setAttendance, attLoading] = useSupabaseTable<Attendance>('ssy_attendance', []);
  const [advances, setAdvances, advLoading] = useSupabaseTable<Advance>('ssy_advances', []);
  const [leaves, setLeaves, leaveLoading] = useSupabaseTable<Leave>('ssy_leaves', []);
  const [hrSettings, setHrSettings, hrsLoading] = useSupabaseTable<HRSetting>('ssy_hr_settings', []);

  const [user, setUser] = useState<MavoraUserSession | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);
  const [language, setLanguage] = useLocalStorage<AppLanguage>(
    LANGUAGE_STORAGE_KEY,
    'my'
  );
  const [activeTab, setActiveTab] = useState<string>('dashboard');
  const [highlightSaleId, setHighlightSaleId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    // Remove obsolete browser-only authentication state.
    window.localStorage.removeItem('ssy_user');
    window.localStorage.removeItem('ssy_accounts');

    const restoreAuth = async () => {
      try {
        const restoredUser = await restoreMavoraSession();

        if (!cancelled) {
          setUser(restoredUser);
        }
      } catch (error) {
        console.error('MAVORA session restore failed:', error);

        if (!cancelled) {
          setUser(null);
        }
      } finally {
        if (!cancelled) {
          setAuthLoading(false);
        }
      }
    };

    restoreAuth();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOutMavora();
    } catch (error) {
      console.error('MAVORA sign out failed:', error);
    } finally {
      setUser(null);
      setActiveTab('dashboard');
    }
  };

  useEffect(() => {
    const testSupabaseConnection = async () => {
      try {
        const { error } = await legacySupabase.from('ssy_inventory').select('id').limit(1);
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

    alert(
      tr(language, 'appProductionCompleteSuccess')
        .replace('{name}', recipe.name)
        .replace('{qty}', producedQty.toLocaleString())
        .replace('{unit}', recipe.outputUnit)
        .replace('{cost}', unitSfgCost.toLocaleString())
    );
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

    alert(
      tr(language, 'appPackagingCompleteSuccess')
        .replace('{sku}', recipe.skuName)
        .replace('{qty}', packQty.toLocaleString())
        .replace('{cost}', unitFgCogs.toLocaleString())
    );
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
          newItems[existingIdx] = { ...newItems[existingIdx], inStock: newItems[existingIdx].inStock + (prItem.requestedQty || 0), lastPurchasePrice: exactUnitPrice };
        } else {
          newItems.push({ id: Date.now() + Math.random(), code: `NEW-${Date.now().toString().slice(-4)}`, name: prItem.itemName, category: prItem.targetWarehouse === 'RM' ? 'Raw Materials' : prItem.targetWarehouse === 'SFG' ? 'Semi-Finished Goods' : 'Packaging', unit: prItem.unit || 'ခု', inStock: prItem.requestedQty || 0, warehouse: prItem.targetWarehouse as 'RM' | 'SFG' | 'PKG', lastPurchasePrice: exactUnitPrice });
        }
      });
      return newItems;
    });

    if (pr.paymentMethod !== 'CREDIT (အကြွေး)') {
      setExpenses(prev => [{ id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'ကုန်ကြမ်းဝယ်ယူမှု', description: `Auto-Sync: ဝယ်ယူရေး PR #${pr.id} (${selectedSupplier.name}) - ${pr.paymentMethod || 'CASH'}`, amount: totalCost, voucherNo: `PR-${pr.id}`, type: 'expense' }, ...prev]);
      alert(
        tr(language, 'appProcurementCashComplete')
          .replace('{amount}', totalCost.toLocaleString())
      );
    } else {
      alert(tr(language, 'appProcurementCreditNotice'));
    }
  };

  const handleCreditPayment = (pr: PurchaseRequest) => {
    const selectedSupplier = pr.suppliers.find(s => s.id === pr.selectedSupplierId);
    if (!selectedSupplier) return;

    setExpenses(prev => [{
      id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'ကုန်ကြမ်းဝယ်ယူမှု (အကြွေးဆပ်)', description: `Credit Payment: ဝယ်ယူရေး PR #${pr.id} (${selectedSupplier.name})`, amount: selectedSupplier.price || 0, voucherNo: `PR-${pr.id}`, type: 'expense'
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
      setExpenses(prev => [...prev, { id: Date.now(), date: newSale.date, category: 'အရောင်းဝင်ငွေ', description: `Invoice: #${newSale.id} - ${newSale.customerName}`, amount: newSale.finalAmount, type: 'income' }]);
    }

    setCustomers(prev => {
      const existingIdx = prev.findIndex(c => c.name.toLowerCase() === newSale.customerName.toLowerCase());
      const customerData: Customer = { id: existingIdx !== -1 ? prev[existingIdx].id : `CUST-${Date.now()}`, name: newSale.customerName, phone: newSale.phone || '', shopType: newSale.shopType || '', address: newSale.address || '', gpsLocation: newSale.gps || '' };
      if (existingIdx !== -1) { const updated = [...prev]; updated[existingIdx] = customerData; return updated; } else return [...prev, customerData];
    });

    setSalesRecords([newSale, ...salesRecords]);
  };

  const handleMarkAsPaid = (saleId: string) => {
    const saleToUpdate = salesRecords.find(s => s.id === saleId);
    if (saleToUpdate && !saleToUpdate.isPaid) {
      setSalesRecords(salesRecords.map(s => s.id === saleId ? { ...s, isPaid: true } : s));
      setExpenses(prev => [...prev, { id: Date.now(), date: new Date().toLocaleDateString('en-GB'), category: 'အကြွေးရငွေ', description: `Invoice: #${saleToUpdate.id} - ${saleToUpdate.customerName}`, amount: saleToUpdate.finalAmount, type: 'income' }]);
      alert(tr(language, 'appSalePaymentReceived'));
    }
  };

  // 🌟 (အသစ်) ပစ္စည်းပြန်အပ်/အလဲအလှယ် စနစ်အတွက် အဓိက စာရင်းညှိနှိုင်းပေးမည့် Function 🌟
  const handleReturnSale = (saleId: string, returnedItems: { product: FinishedGoodItem; quantity: number }[], returnType: 'refund' | 'exchange', note: string, totalRefund: number) => {
    // ၁။ ကုန်ချောစတော့ကို ပြန်တိုးပေးခြင်း
    setFinishedGoods(prev => {
      let updated = [...prev];
      returnedItems.forEach(item => {
        const idx = updated.findIndex(fg => fg.id === item.product.id);
        if (idx !== -1) {
          updated[idx] = { ...updated[idx], stockQty: updated[idx].stockQty + item.quantity };
        }
      });
      return updated;
    });

    // ၂။ အမ်းငွေရှိပါက ဘဏ္ဍာရေးစာရင်းထဲ ထွက်ငွေ (Expense) အဖြစ် (Auto-Sync) သွင်းပေးခြင်း
    if (totalRefund > 0) {
      setExpenses(prev => [{
        id: Date.now(),
        date: new Date().toLocaleDateString('en-GB'),
        category: returnType === 'refund' ? 'အရောင်းပြန်အမ်းငွေ' : 'အလဲအလှယ်ညှိနှိုင်းငွေ',
        description: `Voucher #${saleId} အတွက် ပစ္စည်းပြန်အပ်အမ်းငွေ - ${note}`,
        amount: totalRefund,
        type: 'expense'
      }, ...prev]);
    }

    // ၃။ အရောင်းမှတ်တမ်း (Invoice) ထဲမှာ Status ကို ပြောင်းလဲသိမ်းဆည်းခြင်း
    setSalesRecords(prev => prev.map(s => {
      if (s.id === saleId) {
        return {
          ...s,
          status: 'Returned',
          returnDetails: {
            type: returnType,
            totalRefund,
            note,
            date: new Date().toLocaleDateString('en-GB'),
            items: returnedItems.map(i => ({ category: i.product.category, taste: i.product.taste, quantity: i.quantity }))
          }
        };
      }
      return s;
    }));
  };

  if (authLoading) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-gray-50 flex-col gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="font-bold text-slate-500">
          {language === 'my'
            ? 'အကောင့် လုံခြုံရေး စစ်ဆေးနေပါသည်...'
            : 'Checking secure session...'}
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        language={language}
        setLanguage={setLanguage}
        onLogin={setUser}
      />
    );
  }

  const isAnyLoading = invLoading || fgLoading || salesLoading || expLoading || custLoading || prLoading || recLoading || pkgRecLoading || empLoading || attLoading || advLoading || leaveLoading || hrsLoading;

  if (isAnyLoading) {
    return (
      <div className="flex w-full h-screen items-center justify-center bg-gray-50 flex-col gap-4">
         <div className="w-12 h-12 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
         <p className="font-bold text-slate-500">
            {language === 'my'
              ? 'Cloud Data ချိတ်ဆက်နေပါသည်...'
              : 'Connecting to cloud data...'}
          </p>
      </div>
    );
  }

  return (
    <div className="flex w-full h-[100dvh] bg-gray-50 overflow-hidden print:block print:h-auto print:bg-white print:overflow-visible relative">
      <div className="md:hidden fixed top-0 left-0 w-full bg-gray-900 text-white z-50 p-4 flex justify-between items-center shadow-md print:hidden">
        <h1 className="font-black text-xl tracking-wider">MAVORA <span className="text-emerald-400">ERP</span></h1>
        <button onClick={() => setIsMobileMenuOpen(true)} className="text-white text-3xl font-black focus:outline-none">☰</button>
      </div>

      <div className={`fixed md:relative top-0 left-0 h-full bg-gray-900 print:hidden flex-shrink-0 z-[100] shadow-2xl flex flex-col transition-transform duration-300 transform md:translate-x-0 w-64 ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
         <div className="md:hidden p-4 text-right">
           <button onClick={() => setIsMobileMenuOpen(false)} className="text-slate-400 hover:text-white text-2xl font-black">✕</button>
         </div>
         <div className="flex-1 overflow-y-auto">
           <div onClick={() => setIsMobileMenuOpen(false)}>
             <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user.name} userRole={user.role} onLogout={handleLogout} language={language} setLanguage={setLanguage} />
           </div>
         </div>
         <div className="p-4 border-t border-gray-800 bg-gray-900 shrink-0">
           {isCloudConnected ? (
             <div className="flex items-center justify-center gap-2 text-xs font-bold text-emerald-400 bg-emerald-400/10 py-2 rounded-lg border border-emerald-400/20">
               <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse"></div>
                {language === 'my'
                  ? '☁️ Cloud ချိတ်ဆက်ထားသည်'
                  : '☁️ Cloud Connected'}
             </div>
           ) : (
             <div className="flex items-center justify-center gap-2 text-xs font-bold text-amber-500 bg-amber-500/10 py-2 rounded-lg border border-amber-500/20">
               <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
                {language === 'my'
                  ? 'ချိတ်ဆက်မှု စစ်ဆေးနေပါသည်...'
                  : 'Checking connection...'}
             </div>
           )}
         </div>
      </div>

      {isMobileMenuOpen && (
        <div onClick={() => setIsMobileMenuOpen(false)} className="fixed inset-0 bg-black/60 z-[90] md:hidden backdrop-blur-sm print:hidden"></div>
      )}

      <main className="flex-1 w-full h-full p-2 md:p-8 pt-20 md:pt-6 overflow-y-auto print:overflow-visible print:p-0 print:w-full print:h-auto pb-10 relative z-0">
        {activeTab === 'dashboard' && <Dashboard language={language} sales={salesRecords} expenses={expenses} finishedGoods={finishedGoods} inventory={inventoryItems} employees={employees} />}
        {activeTab === 'workspace' && <Workspace language={language} userName={user.name} userRole={user.role} />}

        {activeTab === 'reports' && (
           <Reports
             language={language}
             sales={salesRecords}
             inventory={inventoryItems}
             finishedGoods={finishedGoods}
             expenses={expenses}
             purchaseRequests={purchaseRequests}
             recipes={recipes}
             packageRecipes={packageRecipes}
             setActiveTab={setActiveTab}
             setHighlightSaleId={setHighlightSaleId}
           />
        )}

        {/* 🌟 Sales Component သို့ handleReturnSale ခေါ်ယူမှုကို ပို့ပေးထားပါသည် 🌟 */}
        {activeTab === 'sales' && (
          <Sales
            language={language}
            userRole={user.role}
            userName={user.name}
            finishedGoods={finishedGoods}
            sales={salesRecords}
            customers={customers}
            onCheckout={handleCheckoutSale}
            onMarkAsPaid={handleMarkAsPaid}
            onDeleteSale={(id) => setSalesRecords(salesRecords.filter(s => s.id !== id))}
            highlightSaleId={highlightSaleId}
            setHighlightSaleId={setHighlightSaleId}
            onReturnSale={handleReturnSale}
          />
        )}

        {activeTab === 'procurement' && <Procurement language={language} userRole={user.role} requests={purchaseRequests} setRequests={setPurchaseRequests} onComplete={handleProcurementComplete} onCreditPayment={handleCreditPayment} />}
        {activeTab === 'inventory' && (
          <MavoraInventory
            language={language}
            tenantId={user.tenantId}
          />
        )}
        {activeTab === 'production' && (
          <MavoraProduction
            language={language}
            tenantId={user.tenantId}
          />
        )}
        {activeTab === 'packaging' && <Packaging language={language} userRole={user.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />}
        {finishedGoods && activeTab === 'finished_goods' && <FinishedGoods language={language} userRole={user.role} products={finishedGoods} setProducts={setFinishedGoods} />}
        {activeTab === 'expenses' && <Expenses language={language} userRole={user.role} userName={user.name} expenses={expenses} setExpenses={setExpenses} />}

        {activeTab === 'hr' && (
           <HR
             language={language}
             userRole={user.role} userName={user.name}
             employees={employees} setEmployees={setEmployees}
             attendance={attendance} setAttendance={setAttendance}
             advances={advances} setAdvances={setAdvances}
             leaves={leaves} setLeaves={setLeaves}
             hrSettings={hrSettings} setHrSettings={setHrSettings}
             setExpenses={setExpenses}
           />
        )}
      </main>
    </div>
  );
}
