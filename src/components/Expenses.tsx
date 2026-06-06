import React, { useState } from 'react';
import type { ExpenseItem } from '../App';

interface ExpensesProps {
  userRole: string;
  userName: string;
  expenses: ExpenseItem[];
  setExpenses: React.Dispatch<React.SetStateAction<ExpenseItem[]>>;
}

export const Expenses: React.FC<ExpensesProps> = ({ userRole, userName, expenses, setExpenses }) => {
  const [category, setCategory] = useState('ထုတ်လုပ်မှုစရိတ်');
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');

  // Edit အတွက် State များ
  const [editingExpense, setEditingExpense] = useState<ExpenseItem | null>(null);
  const [editCategory, setEditCategory] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editAmount, setEditAmount] = useState('');

  const isManager = (userRole || '').toLowerCase() === 'manager';

  const categories = [
    'ထုတ်လုပ်မှုစရိတ်', 'စက်ရုံလည်ပတ်မှုစရိတ်', 'ရုံးပိုင်းဆိုင်ရာစရိတ်', 
    'သယ်ယူပို့ဆောင်ရေး', 'ဝန်ထမ်းရေးရာ', 'ရင်းနှီးမြှုပ်နှံမှု/အထွေထွေ', 'ကုန်ကြမ်းဝယ်ယူစရိတ်'
  ];

  // အသစ်ထည့်ရန်
  const handleAddExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!description || !amount) return;
    setExpenses([...expenses, { 
      id: Date.now(), 
      date: new Date().toLocaleDateString('en-GB'), 
      category, 
      description, 
      amount: Number(amount) 
    }]);
    setDescription(''); setAmount('');
  };

  // ဖျက်ရန် (Manager Only)
  const handleDelete = (id: number, desc: string) => {
    if (window.confirm(`⚠️ "${desc}" စရိတ်ကို စာရင်းမှ ပယ်ဖျက်ရန် သေချာပါသလား?`)) {
      setExpenses(expenses.filter(exp => exp.id !== id));
    }
  };

  // ပြင်ရန် Form ဖွင့်ရန်
  const handleEditClick = (exp: ExpenseItem) => {
    setEditingExpense(exp);
    setEditCategory(exp.category);
    setEditDescription(exp.description);
    setEditAmount(exp.amount.toString());
  };

  // ပြင်ဆင်ချက်ကို သိမ်းဆည်းရန်
  const handleUpdateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingExpense) return;
    setExpenses(expenses.map(exp => 
      exp.id === editingExpense.id 
        ? { 
            ...exp, 
            category: editCategory, 
            description: editDescription, 
            amount: Number(editAmount),
            updatedBy: userName, // ဘယ်သူပြင်လဲ မှတ်ရန်
            updatedAt: new Date().toLocaleString('en-GB') // ဘယ်အချိန်ပြင်လဲ မှတ်ရန်
          } 
        : exp
    ));
    setEditingExpense(null);
  };

  const totalExpense = expenses.reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="p-6 max-w-6xl mx-auto relative">
      <h2 className="text-2xl font-bold mb-6 text-red-700 border-b pb-2">💸 စက်ရုံ အသုံးစရိတ် စီမံခန့်ခွဲမှု</h2>
      
      <form onSubmit={handleAddExpense} className="bg-white shadow-lg p-6 rounded-xl mb-8 border-t-4 border-red-500 flex flex-wrap gap-4 items-end">
        <div className="w-64">
          <label className="block text-sm font-bold text-gray-700">အုပ်စု (Category)</label>
          <select value={category} onChange={e => setCategory(e.target.value)} className="border p-2.5 rounded-lg w-full mt-1 bg-gray-50 focus:ring-2 focus:ring-red-500 outline-none">
            {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="flex-1 min-w-[250px]">
          <label className="block text-sm font-bold text-gray-700">အသေးစိတ်ဖော်ပြချက် (Description)</label>
          <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="border p-2.5 rounded-lg w-full mt-1 focus:ring-2 focus:ring-red-500 outline-none" placeholder="ဥပမာ - စက်အပိုပစ္စည်း (ပလပ်) ဝယ်ခြင်း" required />
        </div>
        <div className="w-40">
          <label className="block text-sm font-bold text-gray-700">ငွေပမာဏ (Ks)</label>
          <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="border p-2.5 rounded-lg w-full mt-1 focus:ring-2 focus:ring-red-500 outline-none" placeholder="၀၀" required />
        </div>
        <button type="submit" className="bg-red-600 text-white px-8 py-2.5 rounded-lg font-bold hover:bg-red-700 shadow-md">စာရင်းသွင်းမည်</button>
      </form>

      {/* Edit Modal Popup */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white p-6 rounded-xl shadow-2xl w-96 border-t-4 border-red-500">
            <h3 className="text-xl font-bold mb-4 text-gray-800">အသုံးစရိတ် ပြင်ဆင်ရန်</h3>
            <form onSubmit={handleUpdateExpense} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">အုပ်စု</label>
                <select value={editCategory} onChange={e => setEditCategory(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-red-500 outline-none">
                  {categories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">အသေးစိတ်ဖော်ပြချက်</label>
                <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-red-500 outline-none" required />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">ငွေပမာဏ (Ks)</label>
                <input type="number" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="border border-gray-300 p-2.5 rounded-lg w-full focus:ring-2 focus:ring-red-500 outline-none" required />
              </div>
              <div className="flex justify-end gap-2 mt-6">
                <button type="button" onClick={() => setEditingExpense(null)} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg font-bold hover:bg-gray-300">ပယ်ဖျက်မည်</button>
                <button type="submit" className="px-4 py-2 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 shadow-md">သိမ်းဆည်းမည်</button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="bg-white shadow-md rounded-xl overflow-hidden border">
        <div className="p-4 bg-gray-800 text-white font-bold text-right text-xl">စုစုပေါင်း အသုံးစရိတ် - {totalExpense.toLocaleString()} Ks</div>
        <table className="w-full text-left">
          <thead className="bg-gray-100 text-gray-700">
            <tr>
              <th className="p-4">ရက်စွဲ</th>
              <th className="p-4">အုပ်စု</th>
              <th className="p-4">အသေးစိတ်</th>
              <th className="p-4 text-right">ငွေပမာဏ</th>
              {isManager && <th className="p-4 text-center">လုပ်ဆောင်ချက်</th>}
            </tr>
          </thead>
          <tbody>
            {expenses.map(exp => (
              <tr key={exp.id} className="border-b hover:bg-red-50 transition-colors">
                <td className="p-4 text-gray-600 whitespace-nowrap">{exp.date}</td>
                <td className="p-4 font-semibold text-red-700">{exp.category}</td>
                <td className="p-4">
                  <div className="text-gray-800 font-medium">{exp.description}</div>
                  {/* Audit Trail (ဘယ်သူပြင်လဲ ပြပေးမည့်နေရာ) */}
                  {exp.updatedBy && (
                    <div className="text-[11px] text-gray-400 mt-0.5">
                      Edited by {exp.updatedBy} ({exp.updatedAt})
                    </div>
                  )}
                </td>
                <td className="p-4 text-right font-bold text-red-600">{exp.amount.toLocaleString()} Ks</td>
                
                {/* Manager ဖြစ်မှသာ ပြင်မည်/ဖျက်မည် ပေါ်မည် */}
                {isManager && (
                  <td className="p-4 text-center whitespace-nowrap">
                    <button onClick={() => handleEditClick(exp)} className="text-blue-600 hover:text-blue-800 font-bold mx-1 px-2 py-1 bg-blue-50 rounded-md transition-colors">ပြင်မည်</button>
                    <button onClick={() => handleDelete(exp.id, exp.description)} className="text-red-600 hover:text-red-800 font-bold mx-1 px-2 py-1 bg-red-50 rounded-md transition-colors">ဖျက်မည်</button>
                  </td>
                )}
              </tr>
            ))}
            {expenses.length === 0 && (
              <tr>
                <td colSpan={isManager ? 5 : 4} className="p-6 text-center text-gray-500 font-medium">
                  အသုံးစရိတ် မှတ်တမ်း မရှိသေးပါ။
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};