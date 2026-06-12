import React, { useState } from 'react';
import type { ExpenseItem } from '../App';

interface ExpensesProps {
  userRole: string;
  userName: string;
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

export const Expenses: React.FC<ExpensesProps> = ({ userRole, userName, expenses, setExpenses }) => {
  const [date, setDate] = useState(new Date().toLocaleDateString('en-GB'));
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [voucherNo, setVoucherNo] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [isFormOpen, setIsFormOpen] = useState(false);

  const predefinedCategories = [
    "ကုန်ကြမ်းဝယ်ယူမှု",
    "လစာနှင့် လုပ်အားခ",
    "စက်ရုံ လျှပ်စစ်/ရေ/မီတာ",
    "သယ်ယူပို့ဆောင်ရေး",
    "ထုပ်ပိုးပစ္စည်း",
    "အထွေထွေ",
    "အခြား"
  ];

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReceiptImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSaveExpense = () => {
    if (!category || !description || !amount) return alert('ကျေးဇူးပြု၍ အချက်အလက်များ ပြည့်စုံစွာ ထည့်ပါ။');
    
    const newRecord: ExpenseItem = {
      id: Date.now(),
      date,
      category,
      description,
      amount: Number(amount),
      voucherNo,
      receiptImage,
      type
    };

    setExpenses([newRecord, ...expenses]);
    
    // Reset form
    setCategory('');
    setDescription('');
    setAmount('');
    setVoucherNo('');
    setReceiptImage('');
    setIsFormOpen(false);
    alert('✅ စာရင်းမှတ်တမ်း အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('ဤမှတ်တမ်းကို ဖျက်ရန် သေချာပါသလား?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  // 🌟 အရှုံး/အမြတ် တွက်ချက်ခြင်း 🌟
  const totalIncome = expenses.filter(e => e.type === 'income').reduce((sum, e) => sum + e.amount, 0);
  const totalExpense = expenses.filter(e => e.type === 'expense').reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalIncome - totalExpense;

  return (
    <div className="p-4 md:p-8">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4 border-b-2 border-slate-200 pb-4">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">📊 ဘဏ္ဍာရေးနှင့် စာရင်း</h2>
        <button onClick={() => setIsFormOpen(true)} className="w-full md:w-auto px-6 py-3 bg-slate-800 text-white font-bold rounded-xl shadow-lg hover:bg-slate-700 active:scale-95 transition-transform flex items-center justify-center gap-2">
          <span>+</span> စာရင်းအသစ်သွင်းမည်
        </button>
      </div>

      {/* 🌟 P&L Dashboard (အရှုံးအမြတ် တွက်ချက်မှု) 🌟 */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-emerald-50 border border-emerald-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-emerald-800 font-bold mb-2">စုစုပေါင်း ဝင်ငွေ (Income)</h3>
          <p className="text-2xl md:text-3xl font-black text-emerald-600">{totalIncome.toLocaleString()} Ks</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 p-6 rounded-2xl shadow-sm">
          <h3 className="text-rose-800 font-bold mb-2">စုစုပေါင်း ထွက်ငွေ (Expense)</h3>
          <p className="text-2xl md:text-3xl font-black text-rose-600">{totalExpense.toLocaleString()} Ks</p>
        </div>
        <div className={`${netProfit >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border p-6 rounded-2xl shadow-sm`}>
          <h3 className={`${netProfit >= 0 ? 'text-blue-800' : 'text-orange-800'} font-bold mb-2`}>အသားတင် {netProfit >= 0 ? 'အမြတ်' : 'အရှုံး'} (Net Profit/Loss)</h3>
          <p className={`text-2xl md:text-3xl font-black ${netProfit >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            {netProfit.toLocaleString()} Ks
          </p>
        </div>
      </div>

      {/* 🌟 စာရင်းသွင်း Form Modal 🌟 */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 p-4 flex justify-between items-center">
              <h3 className="text-white font-black text-lg">📝 စာရင်းအသစ်သွင်းမည်</h3>
              <button onClick={() => setIsFormOpen(false)} className="text-slate-300 hover:text-white font-bold text-xl">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4 bg-slate-50 p-1 rounded-xl mb-2">
                <button onClick={() => setType('expense')} className={`py-2 rounded-lg font-bold text-sm transition-all ${type === 'expense' ? 'bg-rose-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>ထွက်ငွေ (Expense)</button>
                <button onClick={() => setType('income')} className={`py-2 rounded-lg font-bold text-sm transition-all ${type === 'income' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-500 hover:bg-slate-200'}`}>ဝင်ငွေ (Income)</button>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ရက်စွဲ *</label>
                <input type="text" value={date} onChange={e => setDate(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-slate-500 font-bold" />
              </div>

              {/* 🌟 Category ကို Custom ရိုက်ထည့်၍ရအောင် datalist ဖြင့် ပြောင်းထားသည် 🌟 */}
              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ခေါင်းစဉ် (Category) *</label>
                <input 
                  type="text" 
                  list="expense-categories" 
                  value={category} 
                  onChange={e => setCategory(e.target.value)} 
                  className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-slate-500 font-bold" 
                  placeholder="ရွေးချယ်ပါ သို့မဟုတ် ကိုယ်တိုင်ရိုက်ထည့်ပါ..." 
                />
                <datalist id="expense-categories">
                  {predefinedCategories.map(cat => <option key={cat} value={cat} />)}
                </datalist>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">အကြောင်းအရာ အသေးစိတ် *</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-slate-500 font-bold" rows={3} placeholder="ဘာအတွက်သုံးတာလဲ..." />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-1">ပမာဏ (Ks) *</label>
                <input type="number" value={amount} onChange={e => setAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-slate-500 font-black text-lg text-slate-800" placeholder="0" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ဘောက်ချာနံပါတ် (ရှိလျှင်)</label>
                  <input type="text" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} className="w-full border border-slate-300 p-3 rounded-xl outline-none focus:border-slate-500 font-bold text-sm" placeholder="e.g., V-1024" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-500 mb-1">ဘောက်ချာဓာတ်ပုံ (ရှိလျှင်)</label>
                  <label className="flex items-center justify-center w-full h-[46px] border-2 border-dashed border-slate-300 rounded-xl cursor-pointer hover:bg-slate-50 transition-colors">
                    <span className="text-xs font-bold text-slate-500">{receiptImage ? '✅ ပုံတင်ပြီးပါပြီ' : '📷 ပုံရွေးမည်'}</span>
                    <input type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
                  </label>
                </div>
              </div>
            </div>

            <div className="p-4 border-t border-slate-100 flex gap-3 bg-white">
              <button onClick={() => setIsFormOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">ပိတ်မည်</button>
              <button onClick={handleSaveExpense} className={`flex-[2] py-3 rounded-xl font-black text-white shadow-md active:scale-95 transition-transform ${type === 'expense' ? 'bg-rose-500 hover:bg-rose-600' : 'bg-emerald-500 hover:bg-emerald-600'}`}>
                {type === 'expense' ? 'ထွက်ငွေစာရင်း သွင်းမည်' : 'ဝင်ငွေစာရင်း သွင်းမည်'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 မှတ်တမ်းများ 🌟 */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[800px]">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs text-slate-500">
                <th className="p-4 font-bold">ရက်စွဲ</th>
                <th className="p-4 font-bold">ခေါင်းစဉ် / အမျိုးအစား</th>
                <th className="p-4 font-bold">အကြောင်းအရာ</th>
                <th className="p-4 font-bold text-right">ငွေပမာဏ (Ks)</th>
                <th className="p-4 font-bold text-center">မှတ်တမ်း</th>
                <th className="p-4 font-bold text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {expenses.map((expense) => (
                <tr key={expense.id} className="border-b border-slate-100 hover:bg-slate-50 transition-colors">
                  <td className="p-4 text-xs font-bold text-slate-600 whitespace-nowrap">{expense.date}</td>
                  <td className="p-4">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${expense.type === 'income' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                      {expense.category}
                    </span>
                  </td>
                  <td className="p-4">
                    <div className="font-bold text-slate-800 text-sm">{expense.description}</div>
                    {expense.voucherNo && <div className="text-xs text-slate-400 mt-1">Voucher: {expense.voucherNo}</div>}
                  </td>
                  <td className={`p-4 text-right font-black text-lg whitespace-nowrap ${expense.type === 'income' ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {expense.type === 'income' ? '+' : '-'} {expense.amount.toLocaleString()} Ks
                  </td>
                  <td className="p-4 text-center">
                    {expense.receiptImage ? (
                      <a href={expense.receiptImage} target="_blank" rel="noreferrer" className="text-blue-500 hover:underline text-xs font-bold">🖼️ ကြည့်မည်</a>
                    ) : <span className="text-slate-300">-</span>}
                  </td>
                  <td className="p-4 text-center">
                    {userRole === 'md' && (
                      <button onClick={() => handleDelete(expense.id)} className="text-slate-400 hover:text-rose-500 hover:bg-rose-50 p-2 rounded-lg transition-colors font-bold text-xs">
                        ဖျက်မည်
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {expenses.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-slate-400 font-bold">ဘဏ္ဍာရေး မှတ်တမ်း မရှိသေးပါ။</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
