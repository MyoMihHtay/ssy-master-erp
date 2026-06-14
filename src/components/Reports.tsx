import React, { useState, useMemo } from 'react';
import type { SaleRecord, InventoryItem, FinishedGoodItem, ExpenseItem, PurchaseRequest, Recipe, PackageRecipe } from '../App';
import { Download, Printer, BarChart3, Package, ShoppingCart, DollarSign, AlertTriangle, Filter, ClipboardList } from 'lucide-react';

interface ReportsProps {
  sales: SaleRecord[];
  inventory: InventoryItem[];
  finishedGoods: FinishedGoodItem[];
  expenses: ExpenseItem[];
  purchaseRequests: PurchaseRequest[];
  recipes: Recipe[]; // 🌟 အသစ်တိုးထားသည်
  packageRecipes: PackageRecipe[]; // 🌟 အသစ်တိုးထားသည်
  setActiveTab: (tab: string) => void; // 🌟 Action link များနှိပ်လျှင် သွားရန်
}

const formatKyat = (amount: number) => amount?.toLocaleString() + ' Ks';

const parseDate = (dStr: string) => {
  if (!dStr) return new Date();
  const parts = dStr.split('/');
  if (parts.length === 3) return new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  return new Date(dStr);
};

export const Reports: React.FC<ReportsProps> = ({ 
  sales = [], inventory = [], finishedGoods = [], expenses = [], purchaseRequests = [], recipes = [], packageRecipes = [], setActiveTab 
}) => {
  
  // 🌟 'production' Tab အသစ် ထပ်တိုးထားသည် 🌟
  const [activeTab, setReportTab] = useState<'sales' | 'inventory' | 'procurement' | 'production' | 'finance' | 'alarms'>('sales');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month' | 'custom'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const isDateInRange = (dateStr: string) => {
    if (dateFilter === 'all') return true;
    
    const now = new Date();
    let start = new Date(now);
    let end = new Date(now);
    end.setHours(23, 59, 59, 999);

    if (dateFilter === 'today') {
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'week') {
      start.setDate(now.getDate() - now.getDay());
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'month') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      start.setHours(0, 0, 0, 0);
    } else if (dateFilter === 'custom') {
      start = startDate ? new Date(startDate) : new Date(0);
      start.setHours(0, 0, 0, 0);
      end = endDate ? new Date(endDate) : new Date('2100-01-01');
      end.setHours(23, 59, 59, 999);
    }

    const itemDate = parseDate(dateStr);
    return itemDate >= start && itemDate <= end;
  };

  const filteredSales = useMemo(() => sales.filter(s => isDateInRange(s.date)), [sales, dateFilter, startDate, endDate]);
  const filteredExpenses = useMemo(() => expenses.filter(e => isDateInRange(e.date)), [expenses, dateFilter, startDate, endDate]);
  const filteredPRs = useMemo(() => purchaseRequests.filter(pr => isDateInRange(pr.date)), [purchaseRequests, dateFilter, startDate, endDate]);

  const lowStockRM = inventory.filter(i => i.inStock <= 50);
  const lowStockFG = finishedGoods.filter(fg => fg.stockQty <= 100);
  const unpaidSales = sales.filter(s => !s.isPaid);
  const unpaidPRs = purchaseRequests.filter(pr => pr.paymentMethod === 'CREDIT (အကြွေး)' && !pr.isCreditPaid && pr.status === 'Completed');

  const totalIncome = filteredExpenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = filteredExpenses.filter(e => e.type === 'expense' || !e.type).reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpense;

  const handleExportExcel = () => {
    let data: any[] = [];
    let fileName = '';

    if (activeTab === 'sales') {
      data = filteredSales.map(s => ({
        'ရက်စွဲ': s.date,
        'ဝယ်သူအမည်': s.customerName,
        'အရောင်းဝန်ထမ်း': s.salespersonName,
        'ကုန်ပစ္စည်းများ': s.items.map(i => `${i.product.category} (${i.quantity})`).join(', '),
        'ငွေချေစနစ်': s.paymentMethod,
        'ကျသင့်ငွေ': s.finalAmount,
        'Status': s.isPaid ? 'Paid' : 'Unpaid'
      }));
      fileName = 'ERP_Sales_Report';
    } else if (activeTab === 'inventory') {
      data = [
        ...inventory.map(i => ({ 'အမျိုးအစား': 'ကုန်ကြမ်း/ထုပ်ပိုး (RM/PKG)', 'ပစ္စည်းအမည်': i.name, 'လက်ကျန်': `${i.inStock} ${i.unit}`, 'တန်ဖိုး': (i.inStock * (i.lastPurchasePrice || 0)) })),
        ...finishedGoods.map(fg => ({ 'အမျိုးအစား': 'ကုန်ချော (FG)', 'ပစ္စည်းအမည်': `${fg.category} - ${fg.taste} (${fg.gram}g)`, 'လက်ကျန်': `${fg.stockQty} ထုပ်`, 'တန်ဖိုး': (fg.stockQty * fg.price) }))
      ];
      fileName = 'ERP_Inventory_Report';
    } else if (activeTab === 'procurement') {
      data = filteredPRs.map(pr => ({
        'PR No.': `PR-${pr.id}`,
        'ရက်စွဲ': pr.date,
        'ပစ္စည်းအမည်': pr.itemName || pr.items?.map(i => i.itemName).join(', '),
        'အရေအတွက်': pr.requestedQty || pr.items?.reduce((acc, i) => acc + i.requestedQty, 0),
        'ပေးချေမှု': pr.paymentMethod,
        'Status': pr.status
      }));
      fileName = 'ERP_Procurement_Report';
    } else if (activeTab === 'production') {
      data = [
        ...recipes.map(r => ({ 'ထုတ်လုပ်မှု အမျိုးအစား': 'ကုန်ကြမ်းမှ ကုန်ပိုင်း (SFG)', 'အမည်': r.name, 'ထွက်ရှိမှု': `${r.outputQtyPerBatch} ${r.outputUnit}`, 'ပါဝင်ပစ္စည်းများ': r.ingredients.map(i => `${i.itemName} (${i.requiredQty})`).join(' + ') })),
        ...packageRecipes.map(pr => ({ 'ထုတ်လုပ်မှု အမျိုးအစား': 'ထုပ်ပိုးမှု (FG)', 'အမည်': pr.skuName, 'ထွက်ရှိမှု': '၁ ထုပ်', 'ပါဝင်ပစ္စည်းများ': pr.ingredients.map(i => `${i.itemName} (${i.requiredQty})`).join(' + ') }))
      ];
      fileName = 'ERP_Production_Recipes_Report';
    } else if (activeTab === 'finance') {
      data = filteredExpenses.map(e => ({
        'ရက်စွဲ': e.date,
        'ခေါင်းစဉ်': e.category,
        'အကြောင်းအရာ': e.description,
        'အမျိုးအစား': e.type === 'income' ? 'ဝင်ငွေ' : 'ထွက်ငွေ',
        'ပမာဏ': e.amount
      }));
      fileName = 'ERP_Finance_Report';
    } else if (activeTab === 'alarms') {
      data = [
        ...lowStockRM.map(i => ({ 'အမျိုးအစား': 'ကုန်ကြမ်း ပြတ်လုနီးပါး', 'အကြောင်းအရာ': i.name, 'မှတ်ချက်': `လက်ကျန်: ${i.inStock} ${i.unit}` })),
        ...lowStockFG.map(f => ({ 'အမျိုးအစား': 'ကုန်ချော ပြတ်လုနီးပါး', 'အကြောင်းအရာ': `${f.category} (${f.gram}g)`, 'မှတ်ချက်': `လက်ကျန်: ${f.stockQty} ထုပ်` })),
        ...unpaidSales.map(s => ({ 'အမျိုးအစား': 'ရစရာရှိသော အကြွေး', 'အကြောင်းအရာ': `${s.customerName} (${s.id})`, 'မှတ်ချက်': `ပမာဏ: ${s.finalAmount} Ks` })),
        ...unpaidPRs.map(p => ({ 'အမျိုးအစား': 'ပေးရန်ရှိသော အကြွေး', 'အကြောင်းအရာ': `PR-${p.id}`, 'မှတ်ချက်': `Supplier အား ပေးရန်ကျန်` }))
      ];
      fileName = 'ERP_Alarms_Report';
    }

    if (data.length === 0) return alert('ထုတ်ယူရန် အချက်အလက် မရှိသေးပါဗျ။');
    const headers = Object.keys(data[0]).join(',');
    const rows = data.map(obj => Object.values(obj).map(val => `"${val}"`).join(',')).join('\n');
    const csvContent = "data:text/csv;charset=utf-8,\uFEFF" + headers + "\n" + rows;
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = `SSY_${fileName}_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
  };

  return (
    <div className="p-4 md:p-6 h-full flex flex-col overflow-y-auto bg-slate-50 print-section">
      <style>{`
        @media print {
          body * { visibility: hidden; }
          .print-section, .print-section * { visibility: visible; }
          .print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; margin: 0 !important; background: white !important; }
          html, body, #root, main, .h-full, .overflow-y-auto { height: auto !important; overflow: visible !important; }
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
          .report-table { width: 100% !important; border-collapse: collapse !important; border: 1px solid #333 !important; }
          .report-table th, .report-table td { border: 1px solid #333 !important; padding: 8px !important; font-size: 11px !important; color: black !important; }
          .report-table th { background-color: #eee !important; font-weight: bold; }
          .print-header-only { display: block !important; text-align: center; margin-bottom: 20px; border-bottom: 2px solid #000; padding-bottom: 10px; }
        }
        .print-header-only { display: none; }
      `}</style>

      <div className="print-header-only">
        <h1 className="text-2xl font-black text-indigo-900">SSY Master ERP</h1>
        <p className="text-lg font-bold uppercase">{activeTab} Report</p>
        <p className="text-sm">Printed on: {new Date().toLocaleString('en-GB')}</p>
      </div>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 no-print gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-800 tracking-tight flex items-center gap-2">📑 လုပ်ငန်း အစီရင်ခံစာများ (ERP Reports)</h1>
          <p className="text-slate-500 font-bold text-sm mt-1">ဌာနအလိုက် လုပ်ငန်းအခြေအနေများကို စစ်ဆေးပြီး Print / Excel ထုတ်ယူပါ</p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <button onClick={handleExportExcel} className="flex-1 md:flex-none px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 shadow-md">
            <Download size={18} /> Excel ထုတ်မည်
          </button>
          <button onClick={() => window.print()} className="flex-1 md:flex-none px-4 py-2.5 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 rounded-xl text-sm font-bold transition-all flex justify-center items-center gap-2 shadow-sm">
            <Printer size={18} /> Print ထုတ်မည်
          </button>
        </div>
      </div>

      <div className="bg-white p-4 rounded-2xl shadow-sm border border-slate-200 mb-6 flex flex-wrap items-center gap-4 no-print">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <Filter size={18} className="text-indigo-500" />
          <select value={dateFilter} onChange={(e) => setDateFilter(e.target.value as any)} className="p-2 border border-slate-200 rounded-lg outline-none text-sm bg-slate-50 font-bold flex-1 md:flex-none">
            <option value="all">ရက်စွဲအားလုံး (All Time)</option>
            <option value="today">ယနေ့ (Today)</option>
            <option value="week">ယခုအပတ် (This Week)</option>
            <option value="month">ယခုလ (This Month)</option>
            <option value="custom">စိတ်ကြိုက်ရက်စွဲ (Custom)</option>
          </select>
          {dateFilter === 'custom' && (
            <div className="flex items-center gap-2">
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="p-1.5 border rounded text-sm font-bold" />
              <span className="text-slate-400 font-bold">-</span>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="p-1.5 border rounded text-sm font-bold" />
            </div>
          )}
        </div>
      </div>

      <div className="flex flex-wrap gap-2 mb-4 bg-slate-200 p-1 rounded-xl w-fit no-print">
        <TabBtn active={activeTab === 'sales'} onClick={() => setReportTab('sales')} label="အရောင်း (Sales)" icon={<BarChart3 size={14}/>} />
        <TabBtn active={activeTab === 'inventory'} onClick={() => setReportTab('inventory')} label="ကုန်လှောင်ရုံ (Inventory)" icon={<Package size={14}/>} />
        <TabBtn active={activeTab === 'procurement'} onClick={() => setReportTab('procurement')} label="ဝယ်ယူရေး (Procurement)" icon={<ShoppingCart size={14}/>} />
        <TabBtn active={activeTab === 'production'} onClick={() => setReportTab('production')} label="ထုတ်လုပ်မှု (Production)" icon={<ClipboardList size={14}/>} />
        <TabBtn active={activeTab === 'finance'} onClick={() => setReportTab('finance')} label="ဘဏ္ဍာရေး (Finance)" icon={<DollarSign size={14}/>} />
        <TabBtn active={activeTab === 'alarms'} onClick={() => setReportTab('alarms')} label="သတိပေးချက် (Alarms)" icon={<AlertTriangle size={14} className={activeTab === 'alarms' ? 'text-red-500' : ''}/>} />
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 flex-1 flex flex-col overflow-hidden print:overflow-visible print:border-none">
        
        {activeTab === 'finance' && (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 border-b bg-slate-50 no-print">
              <div className="bg-white p-4 rounded-xl border-l-4 border-l-emerald-500 shadow-sm"><p className="text-[10px] font-bold text-slate-500 uppercase">စုစုပေါင်း ဝင်ငွေ (Income)</p><p className="text-xl font-black text-emerald-600">{formatKyat(totalIncome)}</p></div>
              <div className="bg-white p-4 rounded-xl border-l-4 border-l-rose-500 shadow-sm"><p className="text-[10px] font-bold text-slate-500 uppercase">စုစုပေါင်း ထွက်ငွေ (Expense)</p><p className="text-xl font-black text-rose-600">{formatKyat(totalExpense)}</p></div>
              <div className={`bg-white p-4 rounded-xl border-l-4 shadow-sm ${netProfit >= 0 ? 'border-l-blue-500' : 'border-l-red-500'}`}><p className="text-[10px] font-bold text-slate-500 uppercase">အသားတင် (Net Profit)</p><p className={`text-xl font-black ${netProfit >= 0 ? 'text-blue-600' : 'text-red-600'}`}>{formatKyat(netProfit)}</p></div>
           </div>
        )}

        <div className="overflow-x-auto print:overflow-visible flex-1 p-0">
          <table className="w-full text-left report-table whitespace-nowrap md:whitespace-normal">
            <thead className="bg-slate-800 text-white sticky top-0">
              {activeTab === 'sales' && (
                <tr><th className="p-3">ရက်စွဲ</th><th className="p-3">ဝယ်သူအမည်</th><th className="p-3">အရောင်းဝန်ထမ်း</th><th className="p-3">ကုန်ပစ္စည်းများ</th><th className="p-3 text-center">Status</th><th className="p-3 text-right">ကျသင့်ငွေ</th></tr>
              )}
              {activeTab === 'inventory' && (
                <tr><th className="p-3">အမျိုးအစား</th><th className="p-3">ပစ္စည်းအမည်</th><th className="p-3 text-right">လက်ကျန်</th><th className="p-3 text-right">တန်ဖိုး (ခန့်မှန်း)</th></tr>
              )}
              {activeTab === 'procurement' && (
                <tr><th className="p-3">PR No.</th><th className="p-3">ရက်စွဲ</th><th className="p-3">ပစ္စည်းအမည်</th><th className="p-3 text-center">အရေအတွက်</th><th className="p-3 text-center">ငွေချေစနစ်</th><th className="p-3 text-right">Status</th></tr>
              )}
              {activeTab === 'finance' && (
                <tr><th className="p-3">ရက်စွဲ</th><th className="p-3">ခေါင်းစဉ်</th><th className="p-3">အကြောင်းအရာ</th><th className="p-3 text-center">အမျိုးအစား</th><th className="p-3 text-right">ပမာဏ</th></tr>
              )}
              {/* 🌟 ထုတ်လုပ်မှု Tab Header 🌟 */}
              {activeTab === 'production' && (
                <tr><th className="p-3">ထုတ်လုပ်မှု အမျိုးအစား</th><th className="p-3">ကုန်ပစ္စည်း အမည်</th><th className="p-3 text-center">ထွက်ရှိမည့် ပမာဏ</th><th className="p-3">လိုအပ်သော ပါဝင်ပစ္စည်းများ (BOM)</th></tr>
              )}
              {activeTab === 'alarms' && (
                <tr><th className="p-3">သတိပေးချက် အမျိုးအစား</th><th className="p-3">အကြောင်းအရာ</th><th className="p-3">မှတ်ချက် / အခြေအနေ</th><th className="p-3 text-center">Action</th></tr>
              )}
            </thead>
            <tbody className="divide-y divide-slate-100">
              
              {activeTab === 'sales' && filteredSales.map(s => (
                <tr key={s.id} className="text-sm hover:bg-slate-50">
                  <td className="p-3">{s.date}</td>
                  <td className="p-3 font-bold">{s.customerName}</td>
                  <td className="p-3 text-blue-600 font-bold">👤 {s.salespersonName}</td>
                  <td className="p-3 text-xs">{s.items.map(item => `${item.product.category} (${item.quantity})`).join(', ')}</td>
                  <td className="p-3 text-center">{s.isPaid ? <span className="text-emerald-600 font-bold bg-emerald-50 px-2 py-1 rounded">Paid</span> : <span className="text-rose-600 font-bold bg-rose-50 px-2 py-1 rounded">Credit</span>}</td>
                  <td className="p-3 font-black text-right text-slate-800">{formatKyat(s.finalAmount)}</td>
                </tr>
              ))}

              {activeTab === 'inventory' && (
                <>
                  {inventory.map(i => (
                    <tr key={i.id} className="text-sm hover:bg-slate-50">
                      <td className="p-3 text-xs font-bold text-amber-600 uppercase bg-amber-50/50">ကုန်ကြမ်း (RM/PKG)</td>
                      <td className="p-3 font-bold">{i.name}</td>
                      <td className="p-3 text-right font-black">{i.inStock} {i.unit}</td>
                      <td className="p-3 text-right font-bold text-slate-500">{formatKyat(i.inStock * (i.lastPurchasePrice || 0))}</td>
                    </tr>
                  ))}
                  {finishedGoods.map(fg => (
                    <tr key={fg.id} className="text-sm hover:bg-slate-50">
                      <td className="p-3 text-xs font-bold text-indigo-600 uppercase bg-indigo-50/50">ကုန်ချော (FG)</td>
                      <td className="p-3 font-bold">{fg.category} - {fg.taste} ({fg.gram}g)</td>
                      <td className="p-3 text-right font-black text-indigo-700">{fg.stockQty} ထုပ်</td>
                      <td className="p-3 text-right font-bold text-slate-500">{formatKyat(fg.stockQty * fg.price)}</td>
                    </tr>
                  ))}
                </>
              )}

              {activeTab === 'procurement' && filteredPRs.map(pr => (
                <tr key={pr.id} className="text-sm hover:bg-slate-50">
                  <td className="p-3 text-xs text-slate-400 font-bold">PR-{pr.id}</td>
                  <td className="p-3">{pr.date}</td>
                  <td className="p-3 font-bold">{pr.itemName || pr.items?.map(i => i.itemName).join(', ')}</td>
                  <td className="p-3 text-center font-black">{pr.requestedQty || pr.items?.reduce((acc, i) => acc + i.requestedQty, 0)}</td>
                  <td className="p-3 text-center text-xs font-bold text-slate-600">{pr.paymentMethod || 'Cash'}</td>
                  <td className="p-3 text-right"><span className="bg-slate-100 text-slate-700 px-2 py-1 rounded text-xs font-bold">{pr.status}</span></td>
                </tr>
              ))}

              {/* 🌟 ထုတ်လုပ်မှု Recipes Data Render 🌟 */}
              {activeTab === 'production' && (
                <>
                  {recipes.map(r => (
                    <tr key={`r-${r.id}`} className="text-sm hover:bg-slate-50">
                      <td className="p-3 text-xs font-bold text-emerald-600 bg-emerald-50/50 uppercase">ချက်ပြုတ်မှု (RM ➡ SFG)</td>
                      <td className="p-3 font-bold text-slate-800">{r.name}</td>
                      <td className="p-3 text-center font-black text-emerald-700">{r.outputQtyPerBatch} {r.outputUnit}</td>
                      <td className="p-3 text-xs text-slate-600 font-medium">{r.ingredients.map(i => `${i.itemName} (${i.requiredQty} ${i.unit})`).join(' + ')}</td>
                    </tr>
                  ))}
                  {packageRecipes.map(pr => (
                    <tr key={`pr-${pr.id}`} className="text-sm hover:bg-slate-50">
                      <td className="p-3 text-xs font-bold text-blue-600 bg-blue-50/50 uppercase">ထုပ်ပိုးမှု (SFG + PKG ➡ FG)</td>
                      <td className="p-3 font-bold text-slate-800">{pr.skuName}</td>
                      <td className="p-3 text-center font-black text-blue-700">၁ ထုပ်</td>
                      <td className="p-3 text-xs text-slate-600 font-medium">{pr.ingredients.map(i => `${i.itemName} (${i.requiredQty} ${i.unit})`).join(' + ')}</td>
                    </tr>
                  ))}
                </>
              )}

              {activeTab === 'finance' && filteredExpenses.map(e => (
                <tr key={e.id} className="text-sm hover:bg-slate-50">
                  <td className="p-3">{e.date}</td>
                  <td className="p-3 font-bold">{e.category}</td>
                  <td className="p-3 text-xs text-slate-500">{e.description}</td>
                  <td className="p-3 text-center">{e.type === 'income' ? <span className="text-emerald-600 font-bold">ဝင်ငွေ</span> : <span className="text-rose-600 font-bold">ထွက်ငွေ</span>}</td>
                  <td className={`p-3 text-right font-black ${e.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>{formatKyat(e.amount)}</td>
                </tr>
              ))}

              {/* 🚨 Alarms Actions တိုက်ရိုက်သွားမည့်စနစ် 🚨 */}
              {activeTab === 'alarms' && (
                <>
                  {lowStockRM.map(i => (
                    <tr key={`rm-${i.id}`} className="text-sm bg-amber-50 border-b border-amber-100">
                      <td className="p-3 font-black text-amber-600 flex items-center gap-2"><AlertTriangle size={16}/> ကုန်ကြမ်း ပြတ်လုနီးပါး</td>
                      <td className="p-3 font-bold text-slate-800">{i.name}</td>
                      <td className="p-3 text-amber-700 font-bold">လက်ကျန်: {i.inStock} {i.unit} သာ ကျန်ပါတော့သည်</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setActiveTab('procurement')} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all bg-white px-3 py-1 rounded shadow-sm border border-blue-200">
                          ဝယ်ယူရန် (PR) တင်မည်
                        </button>
                      </td>
                    </tr>
                  ))}
                  {lowStockFG.map(f => (
                    <tr key={`fg-${f.id}`} className="text-sm bg-orange-50 border-b border-orange-100">
                      <td className="p-3 font-black text-orange-600 flex items-center gap-2"><Package size={16}/> ကုန်ချော ပြတ်လုနီးပါး</td>
                      <td className="p-3 font-bold text-slate-800">{f.category} ({f.gram}g)</td>
                      <td className="p-3 text-orange-700 font-bold">လက်ကျန်: {f.stockQty} ထုပ် သာ ကျန်ပါတော့သည်</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setActiveTab('packaging')} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all bg-white px-3 py-1 rounded shadow-sm border border-blue-200">
                          ထုပ်ပိုးမှု ပြုလုပ်မည်
                        </button>
                      </td>
                    </tr>
                  ))}
                  {unpaidSales.map(s => (
                    <tr key={`us-${s.id}`} className="text-sm bg-rose-50 border-b border-rose-100">
                      <td className="p-3 font-black text-rose-600 flex items-center gap-2"><DollarSign size={16}/> ရစရာရှိသော အကြွေး</td>
                      <td className="p-3 font-bold text-slate-800">{s.customerName}</td>
                      <td className="p-3 text-rose-700 font-bold">ပမာဏ: {formatKyat(s.finalAmount)}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setActiveTab('sales')} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all bg-white px-3 py-1 rounded shadow-sm border border-blue-200">
                          အရောင်းစာရင်း စစ်မည်
                        </button>
                      </td>
                    </tr>
                  ))}
                  {unpaidPRs.map(p => (
                    <tr key={`up-${p.id}`} className="text-sm bg-rose-50 border-b border-rose-100">
                      <td className="p-3 font-black text-rose-600 flex items-center gap-2"><ShoppingCart size={16}/> ပေးရန်ရှိသော အကြွေး</td>
                      <td className="p-3 font-bold text-slate-800">PR-{p.id}</td>
                      <td className="p-3 text-rose-700 font-bold">Supplier အား ငွေချေရန် ကျန်ရှိနေပါသည်</td>
                      <td className="p-3 text-center">
                        <button onClick={() => setActiveTab('procurement')} className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline transition-all bg-white px-3 py-1 rounded shadow-sm border border-blue-200">
                          ဝယ်ယူရေး စစ်ဆေးမည်
                        </button>
                      </td>
                    </tr>
                  ))}
                  
                  {(lowStockRM.length === 0 && lowStockFG.length === 0 && unpaidSales.length === 0 && unpaidPRs.length === 0) && (
                    <tr><td colSpan={4} className="p-10 text-center font-bold text-emerald-500">✅ လက်ရှိတွင် သတိပေးချက်များ (Alarms) မရှိပါ။ လုပ်ငန်းလည်ပတ်မှု ပုံမှန်ဖြစ်ပါသည်။</td></tr>
                  )}
                </>
              )}

            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

const TabBtn = ({ active, label, icon, onClick }: any) => (
  <button onClick={onClick} className={`px-3 py-2 rounded-lg text-[11px] md:text-sm font-bold transition-all flex items-center gap-1.5 ${active ? 'bg-white text-indigo-700 shadow-sm' : 'text-slate-600 hover:bg-slate-300/50'}`}>
    {icon} <span className="hidden sm:inline">{label}</span>
  </button>
);
