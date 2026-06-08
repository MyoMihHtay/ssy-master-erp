import React, { useState } from 'react';
import type { ExpenseItem } from '../App';

interface ExpensesProps {
  userRole: string;
  userName: string;
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

export const Expenses: React.FC<ExpensesProps> = ({ userRole, userName, expenses, setExpenses }) => {
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState<number | ''>('');
  const [voucherNo, setVoucherNo] = useState('');
  const [receiptImage, setReceiptImage] = useState<string>('');

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description || !amount) {
      alert('လိုအပ်သော အချက်အလက်များကို ဖြည့်ပါ။'); return;
    }

    const newExpense: ExpenseItem = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-GB'),
      category,
      description,
      amount: Number(amount),
      voucherNo: voucherNo || '-',
      receiptImage: receiptImage || undefined,
    };

    setExpenses([...expenses, newExpense]);
    setCategory(''); setDescription(''); setAmount(''); setVoucherNo(''); setReceiptImage('');
    alert('✅ အသုံးစရိတ် မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const handleDelete = (id: number) => {
    if (window.confirm('ဤအသုံးစရိတ်ကို ဖျက်ရန် သေချာပါသလား?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-red-700 border-b-2 border-red-200 pb-3 flex items-center gap-2">
        <span>💸</span> စက်ရုံသုံးစရိတ် နှင့် ဘောက်ချာ မှတ်တမ်း
      </h2>

      <div className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-red-500">
        <form onSubmit={handleSave} className="grid grid-cols-1 md:grid-cols-3 gap-6 items-end">
          
          <div className="md:col-span-1">
            <label className="block text-sm font-bold text-gray-700 mb-1">အသုံးစရိတ် ခေါင်းစဉ်</label>
            {/* ဤနေရာတွင် Dropdown အစား DataList ဖြင့် ပြောင်းထားပါသည် */}
            <input 
              type="text" 
              list="expense-categories"
              value={category} 
              onChange={e => setCategory(e.target.value)} 
              className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-red-500 focus:ring-0 font-semibold" 
              required 
              placeholder="ရွေးချယ်ပါ (သို့) အသစ်ရိုက်ထည့်ပါ"
            />
            <datalist id="expense-categories">
              <option value="ကုန်ကြမ်းဝယ်ယူမှု" />
              <option value="စက်ရုံသုံးပစ္စည်း" />
              <option value="ဝန်ထမ်းစရိတ် / လစာ" />
              <option value="ပြုပြင်ထိန်းသိမ်းစရိတ်" />
              <option value="အထွေထွေ" />
            </datalist>
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-bold text-gray-700 mb-1">အသေးစိတ် ဖော်ပြချက်</label>
            <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-red-500 focus:ring-0" required placeholder="ဥပမာ - ကြက်သွန် ၅၀ ပိဿာ ဝယ်ယူခြင်း" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ဘောက်ချာနံပါတ် (မဖြစ်မနေမလို)</label>
            <input type="text" value={voucherNo} onChange={e => setVoucherNo(e.target.value)} className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-red-500 focus:ring-0" placeholder="ဥပမာ - V-00123" />
          </div>

          <div>
            <label className="block text-sm font-bold text-gray-700 mb-1">ကုန်ကျငွေ (Ks)</label>
            <input type="number" value={amount} onChange={e => setAmount(Number(e.target.value))} className="border-2 border-gray-200 p-3 rounded-xl w-full focus:border-red-500 focus:ring-0 font-bold text-red-600" required placeholder="ဥပမာ - 50000" />
          </div>

          <div className="flex flex-col gap-1">
            <label className="block text-sm font-bold text-gray-700">ဘောက်ချာ ဓာတ်ပုံ</label>
            <div className="flex gap-2 items-center">
              <label className="cursor-pointer bg-gray-100 hover:bg-gray-200 border-2 border-dashed border-gray-300 text-gray-700 px-4 py-2.5 rounded-xl font-bold transition-colors w-full text-center flex items-center justify-center gap-2">
                <span>📸</span> ဓာတ်ပုံရိုက်မည် / ရွေးမည်
                <input type="file" accept="image/*" capture="environment" onChange={handleImageUpload} className="hidden" />
              </label>
            </div>
          </div>

          {receiptImage && (
            <div className="md:col-span-3 flex justify-start items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-200">
              <img src={receiptImage} alt="Voucher Preview" className="h-16 w-16 object-cover rounded-lg border border-gray-300 shadow-sm" />
              <div className="text-sm text-green-600 font-bold flex-1">ဓာတ်ပုံ ထည့်သွင်းပြီးပါပြီ 📸</div>
              <button type="button" onClick={() => setReceiptImage('')} className="text-red-500 hover:text-red-700 font-bold px-3 py-1 bg-red-100 rounded-lg">ဖျက်မည်</button>
            </div>
          )}

          <div className="md:col-span-3 flex justify-end mt-2">
            <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-lg hover:bg-red-700 transition-colors">
              စာရင်းသွင်းမည်
            </button>
          </div>
        </form>
      </div>

      <div className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200">
        <div className="p-4 bg-gray-800 text-white font-bold flex justify-between items-center">
          <span>ယခုလ အသုံးစရိတ် မှတ်တမ်းများ</span>
          <span className="text-yellow-400 text-lg">စုစုပေါင်း - {totalExpense.toLocaleString()} Ks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-gray-100 text-gray-700 border-b-2 border-gray-200">
              <tr>
                <th className="p-4 font-bold">ရက်စွဲ</th>
                <th className="p-4 font-bold">ဘောက်ချာ No.</th>
                <th className="p-4 font-bold">ခေါင်းစဉ်</th>
                <th className="p-4 font-bold">အသေးစိတ်</th>
                <th className="p-4 font-bold text-center">ဓာတ်ပုံ</th>
                <th className="p-4 font-bold text-right">ငွေပမာဏ (Ks)</th>
                <th className="p-4 font-bold text-center">လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-gray-500 font-medium">အသုံးစရိတ် မှတ်တမ်း မရှိသေးပါ။</td></tr>
              ) : (
                expenses.map((exp) => (
                  <tr key={exp.id} className="border-b hover:bg-red-50 transition-colors">
                    <td className="p-4 text-gray-600 font-medium">{exp.date}</td>
                    <td className="p-4 font-bold text-gray-800">{exp.voucherNo}</td>
                    <td className="p-4 font-semibold text-red-600">{exp.category}</td>
                    <td className="p-4 text-gray-700">{exp.description}</td>
                    <td className="p-4 text-center">
                      {exp.receiptImage ? (
                        <a href={exp.receiptImage} target="_blank" rel="noreferrer" className="inline-block border border-gray-300 rounded hover:shadow-md transition-shadow">
                          <img src={exp.receiptImage} alt="Voucher" className="h-
