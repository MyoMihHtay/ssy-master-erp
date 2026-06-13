import React from 'react';
import type { SaleRecord, ExpenseItem, FinishedGoodItem, InventoryItem, Employee } from '../App';

interface DashboardProps {
  sales: SaleRecord[];
  expenses: ExpenseItem[];
  finishedGoods: FinishedGoodItem[];
  inventory: InventoryItem[];
  employees: Employee[];
}

export const Dashboard: React.FC<DashboardProps> = ({ sales, expenses, finishedGoods, inventory, employees }) => {
  const today = new Date();
  const currentMonth = today.getMonth();
  const currentYear = today.getFullYear();

  // Date Check Helper (DD/MM/YYYY format)
  const isThisMonth = (dateStr: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split('/');
    if (parts.length === 3) {
      const m = parseInt(parts[1]) - 1;
      const y = parseInt(parts[2]);
      return m === currentMonth && y === currentYear;
    }
    const d = new Date(dateStr);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  };

  // 🌟 1. Financial KPIs Calculation 🌟
  const monthlySales = sales.filter(s => isThisMonth(s.date));
  const totalSalesAmount = monthlySales.reduce((sum, s) => sum + s.finalAmount, 0);

  const monthlyExpenses = expenses.filter(e => isThisMonth(e.date));
  const totalExpenseAmount = monthlyExpenses.filter(e => e.type === 'expense' || !e.type).reduce((sum, e) => sum + e.amount, 0);
  const totalIncomeAmount = monthlyExpenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  
  const netProfit = (totalSalesAmount + totalIncomeAmount) - totalExpenseAmount;
  
  const activeEmployeesCount = employees.filter(e => e.status === 'Active').length;

  // 🌟 2. Top Selling Products 🌟
  const productSalesCount: Record<string, number> = {};
  monthlySales.forEach(sale => {
    sale.items.forEach(item => {
      const pName = `${item.product.category} - ${item.product.taste} (${item.product.gram}g)`;
      productSalesCount[pName] = (productSalesCount[pName] || 0) + item.quantity;
    });
  });

  const topProducts = Object.entries(productSalesCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  
  const maxSaleQty = topProducts.length > 0 ? topProducts[0][1] : 1;

  // 🌟 3. Low Stock Alerts 🌟
  const lowStockRM = inventory.filter(i => (i.warehouse === 'RM' || i.warehouse === 'PKG') && i.inStock > 0 && i.inStock <= 50); // Threshold 50
  const lowStockFG = finishedGoods.filter(fg => fg.stockQty > 0 && fg.stockQty <= 100); // Threshold 100

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-8 print:hidden">
      <div className="flex items-center gap-3 border-b-2 border-slate-200 pb-4">
        <span className="text-4xl">📊</span>
        <div>
           <h2 className="text-2xl font-extrabold text-slate-900">လုပ်ငန်းအကျဉ်းချုပ် (Dashboard)</h2>
           <p className="text-sm font-bold text-slate-500">ယခုလ ({today.toLocaleString('en-US', { month: 'long', year: 'numeric' })}) အတွက် စာရင်းချုပ်</p>
        </div>
      </div>

      {/* 💳 KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-blue-100 flex flex-col relative overflow-hidden">
           <div className="absolute -right-6 -top-6 text-6xl opacity-10">💰</div>
           <span className="text-sm font-bold text-blue-500 mb-1">ယခုလ အရောင်းရငွေ</span>
           <span className="text-3xl font-black text-slate-800">{totalSalesAmount.toLocaleString()} Ks</span>
        </div>
        
        <div className="bg-white p-6 rounded-3xl shadow-lg border border-rose-100 flex flex-col relative overflow-hidden">
           <div className="absolute -right-6 -top-6 text-6xl opacity-10">💸</div>
           <span className="text-sm font-bold text-rose-500 mb-1">ယခုလ ထွက်ငွေစုစုပေါင်း</span>
           <span className="text-3xl font-black text-slate-800">{totalExpenseAmount.toLocaleString()} Ks</span>
        </div>

        <div className={`p-6 rounded-3xl shadow-lg border flex flex-col relative overflow-hidden ${netProfit >= 0 ? 'bg-gradient-to-br from-emerald-500 to-emerald-700 text-white border-emerald-600' : 'bg-gradient-to-br from-rose-500 to-rose-700 text-white border-rose-600'}`}>
           <div className="absolute -right-6 -top-6 text-6xl opacity-20">📈</div>
           <span className="text-sm font-bold opacity-90 mb-1">အသားတင် အမြတ်ငွေ (Net Profit)</span>
           <span className="text-3xl font-black">{netProfit.toLocaleString()} Ks</span>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-lg border border-indigo-100 flex flex-col relative overflow-hidden">
           <div className="absolute -right-6 -top-6 text-6xl opacity-10">👥</div>
           <span className="text-sm font-bold text-indigo-500 mb-1">လက်ရှိ ဝန်ထမ်းအင်အား</span>
           <span className="text-3xl font-black text-slate-800">{activeEmployeesCount} ဦး</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
         {/* 🏆 Top Selling Products Chart */}
         <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><span>🏆</span> ရောင်းအားအကောင်းဆုံး ပစ္စည်းများ (Top 5)</h3>
            <div className="space-y-5">
               {topProducts.length > 0 ? topProducts.map(([name, qty], idx) => (
                 <div key={name}>
                    <div className="flex justify-between text-sm font-bold text-slate-700 mb-1">
                       <span>{idx + 1}. {name}</span>
                       <span className="text-blue-600">{qty.toLocaleString()} ခု</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-3 overflow-hidden">
                       <div className="bg-gradient-to-r from-blue-400 to-blue-600 h-3 rounded-full transition-all duration-1000" style={{ width: `${(qty / maxSaleQty) * 100}%` }}></div>
                    </div>
                 </div>
               )) : (
                 <div className="text-center text-slate-400 font-bold py-10">ယခုလအတွင်း အရောင်းမှတ်တမ်း မရှိသေးပါ</div>
               )}
            </div>
         </div>

         {/* ⚠️ Low Stock Alerts */}
         <div className="bg-white p-6 rounded-3xl shadow-md border border-slate-100 flex flex-col">
            <h3 className="text-lg font-black text-slate-800 mb-6 flex items-center gap-2"><span>⚠️</span> ကုန်လက်ကျန် သတိပေးချက်</h3>
            
            <div className="flex-1 overflow-y-auto space-y-4 pr-2">
               {lowStockFG.length > 0 && (
                  <div>
                     <h4 className="text-xs font-bold text-rose-500 uppercase mb-2">ကုန်ချော ပြတ်လုနီးပါး (Finished Goods)</h4>
                     {lowStockFG.map(fg => (
                        <div key={fg.id} className="flex justify-between items-center bg-rose-50 p-3 rounded-xl border border-rose-100 mb-2">
                           <span className="font-bold text-sm text-slate-700">{fg.category} - {fg.taste} ({fg.gram}g)</span>
                           <span className="font-black text-rose-600">{fg.stockQty} ထုပ်</span>
                        </div>
                     ))}
                  </div>
               )}

               {lowStockRM.length > 0 && (
                  <div className="mt-4">
                     <h4 className="text-xs font-bold text-amber-500 uppercase mb-2">ကုန်ကြမ်း ပြတ်လုနီးပါး (Raw Materials)</h4>
                     {lowStockRM.map(rm => (
                        <div key={rm.id} className="flex justify-between items-center bg-amber-50 p-3 rounded-xl border border-amber-100 mb-2">
                           <span className="font-bold text-sm text-slate-700">{rm.name}</span>
                           <span className="font-black text-amber-600">{rm.inStock} {rm.unit}</span>
                        </div>
                     ))}
                  </div>
               )}

               {lowStockFG.length === 0 && lowStockRM.length === 0 && (
                  <div className="text-center text-emerald-500 font-bold py-10 flex flex-col items-center">
                     <span className="text-4xl mb-2">✅</span>
                     ကုန်လက်ကျန် အားလုံး လုံလောက်မှုရှိပါသည်
                  </div>
               )}
            </div>
         </div>
      </div>
      
    </div>
  );
};
