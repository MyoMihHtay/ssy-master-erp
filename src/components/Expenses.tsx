import React, { useState, useMemo } from 'react';
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

  // မူလသတ်မှတ်ထားသော အသုံးစရိတ် ခေါင်းစဉ်များ
  const predefinedCategories = [
    'ထုတ်လုပ်မှုစရိတ်',
    'စက်ရုံလည်ပတ်မှုစရိတ်',
    'ရုံးပိုင်းဆိုင်ရာစရိတ်',
    'သယ်ယူပို့ဆောင်ရေး',
    'ဝန်ထမ်းရေးရာ',
    'ရှင်းလင်းရေးနှင့် အထွေထွေ',
    'ကုန်ကြမ်းဝယ်ယူစရိတ်'
  ];

  // မူလခေါင်းစဉ်များနှင့် အသစ်ရိုက်ထည့်ထားသော ခေါင်းစဉ်များကို ပေါင်းစပ်ပေးခြင်း
  const uniqueCategories = useMemo(() => {
    const cats = new Set(predefinedCategories);
    expenses.forEach(e => cats.add(e.category));
    return Array.from(cats);
  }, [expenses]);

  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!category || !description || !amount) return;

    const newExpense: ExpenseItem = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-CA'), // YYYY-MM-DD format
      category,
      description,
      amount: Number(amount),
      updatedBy: userName,
    };

    setExpenses([...expenses, newExpense]);
    setCategory('');
    setDescription('');
    setAmount('');
    alert('✅ အသုံးစရိတ် အောင်မြင်စွာ မှတ်တမ်းတင်ပြီးပါပြီ။');
  };

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  // စာရင်းဖျက်ရန် (MD နှင့် Finance Manager သာ ဖျက်ခွင့်ရှိသည်)
  const handleDelete = (id: number) => {
    if (userRole !== 'md' && userRole !== 'finance') {
      alert('⚠️ MD နှင့် Finance Manager သာလျှင် စာရင်းဖျက်ခွင့်ရှိပါသည်။');
      return;
    }
    if (window.confirm('ဤစာရင်းကို ဖျက်ရန် သေချာပါသလား?')) {
      setExpenses(expenses.filter(e => e.id !== id));
    }
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold text-red-700 border-b-2 border-red-200 pb-3 flex items-center gap-3">
        <span>💸</span> စက်ရုံ အသုံးစရိတ် စီမံခန့်ခွဲမှု
      </h2>

      <div className="bg-white shadow-xl p-6 rounded-2xl border-t-4 border-red-500">
        <form onSubmit={handleAddExpense} className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-bold text-gray-700 mb-1">အုပ်စု (Category)</label>
            {/* HTML5 Datalist အသုံးပြုထားသဖြင့် ရွေးချယ်နိုင်သလို အသစ်လည်း ရိုက်ထည့်နိုင်ပါသည် */}
            <input
              list="expense-categories"
              value={category}
              onChange={e => setCategory(e.target.value)}
              className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0 font-semibold text-gray-800"
              placeholder="ရွေးချယ်ပါ (သို့) အသစ်ရိုက်ထည့်ပါ"
              required
            />
            <datalist id="expense-categories">
              {uniqueCategories.map((cat, idx) => (
                <option key={idx} value={cat} />
              ))}
            </datalist>
          </div>

          <div className="flex-[2] min-w-[250px]">
            <label className="block text-sm font-bold text-gray-700 mb-1">အသေးစိတ်ဖော်ပြချက် (Description)</label>
            <input
              type="text"
              value={description}
              onChange={e => setDescription(e.target.value)}
              className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0"
              placeholder="ဥပမာ - စက်အပိုပစ္စည်း (ပလပ်) ဝယ်ခြင်း"
              required
            />
          </div>

          <div className="flex-1 min-w-[150px]">
            <label className="block text-sm font-bold text-gray-700 mb-1">ငွေပမာဏ (Ks)</label>
            <input
              type="number"
              value={amount}
              onChange={e => setAmount(Number(e.target.value))}
              className="border-2 border-gray-200 p-2.5 rounded-xl w-full focus:border-red-500 focus:ring-0 font-bold text-red-600"
              placeholder="၀၀"
              required
            />
          </div>

          <button type="submit" className="bg-red-600 text-white px-8 py-3 rounded-xl font-bold shadow-md hover:bg-red-700 transition-colors h-[48px] flex items-center justify-center">
            စာရင်းသွင်းမည်
          </button>
        </form>
      </div>

      <div className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-100">
        <div className="bg-gray-800 text-white p-5 flex justify-between items-center">
          <span className="font-bold text-lg">စုစုပေါင်း အသုံးစရိတ်</span>
          <span className="text-2xl font-black text-red-400">{totalExpense.toLocaleString()} Ks</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left whitespace-nowrap">
            <thead className="bg-red-50 text-red-900 border-b-2 border-red-100">
              <tr>
                <th className="p-4 font-bold">ရက်စွဲ</th>
                <th className="p-4 font-bold">အုပ်စု (Category)</th>
                <th className="p-4 font-bold">အသေးစိတ်</th>
                <th className="p-4 font-bold text-right">ငွေပမာဏ</th>
                <th className="p-4 font-bold text-center">လုပ်ဆောင်ချက်</th>
              </tr>
            </thead>
            <tbody>
              {expenses.length === 0 ? (
                <tr><td colSpan={5} className="p-6 text-center text-gray-500 font-medium italic">အသုံးစရိတ် မှတ်တမ်း မရှိသေးပါ။</td></tr>
              ) : expenses.map((exp) => (
                <tr key={exp.id} className="border-b hover:bg-red-50/50 transition-colors">
                  <td className="p-4 text-gray-600 font-medium">{exp.date}</td>
                  <td className="p-4 font-bold text-red-600">{exp.category}</td>
                  <td className="p-4 text-gray-800 font-medium">{exp.description}</td>
                  <td className="p-4 text-right font-bold text-gray-900">{exp.amount.toLocaleString()} Ks</td>
                  <td className="p-4 text-center">
                    <button
                      onClick={() => handleDelete(exp.id)}
                      className="text-sm bg-red-100 text-red-700 px-4 py-1.5 rounded-lg font-bold hover:bg-red-600 hover:text-white transition-colors shadow-sm"
                    >
                      ဖျက်မည်
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
