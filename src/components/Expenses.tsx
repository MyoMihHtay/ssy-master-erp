import React, { useState } from 'react';
import type { ExpenseItem } from '../App';

interface ExpensesProps {
  userRole: string;
  userName: string;
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

const defaultCategories = ['ကုန်ကြမ်းဝယ်ယူမှု', 'လစာနှင့် လုပ်အားခ', 'စက်ရုံသုံးစရိတ်', 'သယ်ယူပို့ဆောင်ရေး', 'အထွေထွေ', 'အခြား'];

export const Expenses: React.FC<ExpensesProps> = ({ userRole, userName, expenses, setExpenses }) => {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState(defaultCategories[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [voucherNo, setVoucherNo] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isFinanceOrMD = userRole === 'finance' || userRole === 'md' || userRole === 'manager';

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => setReceiptImage(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;

    const finalCategory = category === 'အခြား' && customCategory ? customCategory : category;

    const newExpense: ExpenseItem = {
      id: Date.now(),
      date: new Date(date).toLocaleDateString('en-GB'),
      category: finalCategory,
      description,
      amount: Number(amount),
      voucherNo,
      receiptImage
    };

    setExpenses([newExpense, ...expenses]);
    setDescription(''); setAmount(''); setVoucherNo(''); setReceiptImage(''); setCustomCategory('');
    alert('✅ အသုံးစရိတ် အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('⚠️ ဤစာရင်းကို ဖျက်ရန် သေချာပါသလား?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const totalExpenses = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-2 md:p-6 max-w-6xl mx-auto space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b-2 border-red-200 pb-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl md:text-4xl">💰</span>
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-800">အသုံးစရိတ် စီမံခန့်ခွဲမှု</h2>
        </div>
        <div className="bg-red-50 px-4 py-2 md:px-6 md:py-3 rounded-xl border border-red-200 text-center md:text-right">
          <div className="text-xs md:text-sm font-bold text-red-500 uppercase tracking-wider">စုစုပေါင်း အသုံးစရိတ်</div>
          <div className="text-2xl md:text-3xl font-black text-red-700">{totalExpenses.toLocaleString()} <span className="text-base text-red-500">Ks</span></div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8">
        {/* Expense Form */}
        <div className="lg:col-span-1">
          <form onSubmit={handleSubmit} className="bg-white shadow-xl rounded-2xl p-5 md:p-6 border-t-4 border-red-500 sticky top-4">
            <h3 className="text-lg font-bold text-gray-800 mb-5 border-b pb-2">စာရင်းအသစ်သွင်းရန်</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">ရက်စွဲ</label>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} required className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none font-medium" />
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">အမျိုးအစား (Category)</label>
                <select value={category} onChange={e => setCategory(e.target.value)} className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none font-bold text-gray-700 bg-gray-50">
                  {defaultCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
                {category === 'အခြား' && (
                  <input type="text" placeholder="အမျိုးအစား ရိုက်ထည့်ပါ..." value={customCategory} onChange={e => setCustomCategory(e.target.value)} required className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none mt-2 text-sm" />
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">အကြောင်းအရာ / ဖော်ပြချက်</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)} required className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none h-20 resize-none text-sm" placeholder="ဘာအတွက် သုံးသည်..." />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">ကုန်ကျငွေ (Ks)</label>
                  <input type="number" value={amount} onChange={e => setAmount(e.target.value)} required className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none font-black text-red-600 text-lg" placeholder="0" />
                </div>
                <div className="col-span-2">
                  <label className="block text-xs font-bold text-gray-600 mb-1 uppercase tracking-wide">ဘောက်ချာ / ပြေစာ အမှတ် (ရှိလျှင်)</label>
                  <input type="text" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} className="w-full border-2 border-gray-200 p-2.5 rounded-xl focus:border-red-500 outline-none text-sm font-bold" placeholder="ဥပမာ - V-00123" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 mb-2 uppercase tracking-wide">ဘောက်ချာ ဓာတ်ပုံ / ဖိုင်</label>
                
                {/* 🌟 ခလုတ် (၂) ခု ခွဲထုတ်လိုက်သော နေရာ (Android / iOS အဆင်ပြေစေရန်) 🌟 */}
                <div className="flex gap-2">
                  <label className="flex-1 cursor-pointer bg-blue-50 border-2 border-blue-200 p-3 rounded-xl text-center hover:bg-blue-100 transition flex flex-col items-center justify-center shadow-sm">
                    <span className="text-2xl mb-1">📸</span>
                    <span className="text-[10px] md:text-xs font-bold text-blue-800 leading-tight">ကင်မရာဖြင့်<br/>ရိုက်မည်</span>
                    <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="sr-only" />
                  </label>
                  
                  <label className="flex-1 cursor-pointer bg-gray-50 border-2 border-gray-200 p-3 rounded-xl text-center hover:bg-gray-100 transition flex flex-col items-center justify-center shadow-sm">
                    <span className="text-2xl mb-1">📂</span>
                    <span className="text-[10px] md:text-xs font-bold text-gray-700 leading-tight">ဖိုင် / ပုံ<br/>ရွေးမည်</span>
                    <input type="file" accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={handleImageUpload} className="sr-only" />
                  </label>
                </div>

                {receiptImage && (
                  <div className="mt-3 relative inline-block">
                    {receiptImage.startsWith('data:image') ? (
                       <img src={receiptImage} alt="Receipt" className="h-20 object-contain rounded-lg border-2 border-green-400 shadow-sm" />
                    ) : (
                       <div className="h-16 px-4 bg-gray-100 border-2 border-green-400 rounded-lg flex items-center justify-center text-sm font-bold text-gray-600 shadow-sm">📄 ဖိုင်ရွေးချယ်ပြီးပါပြီ</div>
                    )}
                    <button type="button" onClick={() => setReceiptImage('')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-6 h-6 flex items-center justify-center text-xs font-bold shadow-md">✕</button>
                  </div>
                )}
              </div>

              <button type="submit" className="w-full bg-red-600 hover:bg-red-700 text-white font-black py-4 rounded-xl shadow-lg transition-colors text-lg tracking-wider mt-4">
                စာရင်းသွင်းမည်
              </button>
            </div>
          </form>
        </div>

        {/* Expense List */}
        <div className="lg:col-span-2">
          <div className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200">
            <div className="bg-gray-800 p-4 md:p-5 border-b border-gray-700">
              <h3 className="text-lg font-bold text-white flex items-center gap-2"><span>📜</span> အသုံးစရိတ် မှတ်တမ်းများ</h3>
            </div>
            
            {/* ဇယားကို Mobile တွင် ဘယ်ညာပွတ်ဆွဲနိုင်ရန် overflow-x-auto ခံထားပါသည် */}
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[700px]">
                <thead className="bg-gray-50 border-b-2 border-gray-200">
                  <tr>
                    <th className="p-4 font-bold text-gray-600 text-sm uppercase whitespace-nowrap">ရက်စွဲ</th>
                    <th className="p-4 font-bold text-gray-600 text-sm uppercase whitespace-nowrap">အကြောင်းအရာ</th>
                    <th className="p-4 font-bold text-gray-600 text-sm uppercase text-right whitespace-nowrap">ကုန်ကျငွေ (Ks)</th>
                    <th className="p-4 font-bold text-gray-600 text-sm uppercase text-center whitespace-nowrap">ဘောက်ချာ</th>
                    {isFinanceOrMD && <th className="p-4 font-bold text-gray-600 text-sm uppercase text-center whitespace-nowrap">Actions</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {expenses.length > 0 ? expenses.map(exp => (
                    <tr key={exp.id} className="hover:bg-red-50/30 transition-colors">
                      <td className="p-4 text-sm text-gray-500 font-medium whitespace-nowrap">{exp.date}</td>
                      <td className="p-4">
                        <div className="font-bold text-gray-800 text-sm md:text-base">{exp.description}</div>
                        <div className="text-[11px] text-gray-400 font-bold bg-gray-100 inline-block px-2 py-0.5 rounded mt-1">{exp.category}</div>
                      </td>
                      <td className="p-4 text-right font-black text-red-600 text-base md:text-lg whitespace-nowrap">
                        {exp.amount.toLocaleString()}
                      </td>
                      <td className="p-4 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center gap-1">
                          {exp.voucherNo && <span className="text-[10px] font-bold text-gray-500 bg-gray-100 px-2 py-0.5 rounded border"># {exp.voucherNo}</span>}
                          {exp.receiptImage ? (
                            exp.receiptImage.startsWith('data:image') ? (
                              <button onClick={() => setPreviewImage(exp.receiptImage!)} className="w-10 h-10 rounded-lg overflow-hidden border-2 border-gray-200 hover:border-red-400 transition shadow-sm mt-1">
                                <img src={exp.receiptImage} alt="Receipt" className="w-full h-full object-cover" />
                              </button>
                            ) : (
                              <a href={exp.receiptImage} download={`Voucher_${exp.date}`} className="w-10 h-10 flex items-center justify-center bg-gray-100 border-2 border-gray-200 rounded-lg hover:bg-gray-200 transition mt-1 text-sm shadow-sm" title="ဒေါင်းလုတ်ဆွဲရန်">📄</a>
                            )
                          ) : <span className="text-xs text-gray-300">-</span>}
                        </div>
                      </td>
                      {isFinanceOrMD && (
                        <td className="p-4 text-center whitespace-nowrap">
                          <button onClick={() => handleDelete(exp.id)} className="bg-red-50 text-red-500 hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border border-red-100 shadow-sm">
                            ဖျက်မည်
                          </button>
                        </td>
                      )}
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-gray-400 font-bold">
                        <span className="text-4xl block mb-2">📋</span>
                        လက်ရှိတွင် အသုံးစရိတ် မှတ်တမ်း မရှိသေးပါ။
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>

      {/* 🌟 ဓာတ်ပုံ အကြီးချဲ့ကြည့်သည့် Lightbox Modal 🌟 */}
      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full flex justify-center">
             <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
             <button onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 bg-red-600 hover:bg-red-700 text-white w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center border-2 border-white shadow-lg transition-transform active:scale-95">✕</button>
          </div>
        </div>
      )}

    </div>
  );
};
