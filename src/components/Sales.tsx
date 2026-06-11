import React, { useState } from 'react';
import type { FinishedGoodItem, SaleRecord, SaleItem } from '../App';

interface SalesProps {
  userRole: string;
  userName: string;
  finishedGoods: FinishedGoodItem[];
  sales: SaleRecord[];
  onCheckout: (sale: SaleRecord) => void;
  onMarkAsPaid: (saleId: string) => void;
  onDeleteSale: (saleId: string) => void;
}

export const Sales: React.FC<SalesProps> = ({ userRole, userName, finishedGoods, sales, onCheckout, onMarkAsPaid, onDeleteSale }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'records'>('pos');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [isPaid, setIsPaid] = useState(true);

  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);

  const isManager = userRole === 'manager' || userRole === 'md';

  // --- POS (အရောင်းပိုင်း) Functions ---
  const handleAddToCart = (product: FinishedGoodItem) => {
    if (product.stockQty <= 0) return alert('❌ ဤကုန်ချော လက်ကျန် ပြတ်နေပါသည်။ ထုပ်ပိုးမှု (Packaging) မှ ထပ်မံဖြည့်တင်းပါ။');
    
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) {
          alert('❌ လက်ကျန်အရေအတွက်ထက် ပိုရောင်း၍မရပါ။'); return prev;
        }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * product.price } : item);
      } else {
        return [...prev, { product, quantity: 1, subtotal: product.price }];
      }
    });
  };

  const removeFromCart = (productId: number) => {
    setCart(cart.filter(item => item.product.id !== productId));
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);

  const handleCheckout = () => {
    if (cart.length === 0 || !customerName) return alert("ဝယ်သူအမည် နှင့် ပစ္စည်းများကို ထည့်သွင်းပါ။");
    
    const newSale: SaleRecord = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('en-GB'),
      customerName, phone, salespersonName: userName,
      items: cart, totalAmount, finalAmount: totalAmount,
      paymentMethod, isPaid
    };

    onCheckout(newSale);
    setCart([]); setCustomerName(''); setPhone('');
    alert('✅ အရောင်းစာရင်း နှင့် ဘောက်ချာ အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    setActiveTab('records');
  };

  // --- မှတ်တမ်းပိုင်း Functions ---
  const filteredSales = sales.filter(sale => 
    String(sale?.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    String(sale?.id || '').toLowerCase().includes(searchTerm.toLowerCase())
  );
  const visibleSalesToRender = filteredSales.slice(0, displayLimit);

  return (
    <div className="p-2 md:p-6 h-full overflow-y-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 border-b-2 pb-4 border-amber-200 gap-4">
        <h2 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span className="text-4xl">💰</span> အရောင်း နှင့် ငွေတောင်းခံလွှာ (POS)</h2>
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200">
          <button onClick={() => setActiveTab('pos')} className={`px-6 py-2.5 rounded-lg font-bold ${activeTab === 'pos' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>🛒 ဘောက်ချာဖြတ်မည်</button>
          <button onClick={() => setActiveTab('records')} className={`px-6 py-2.5 rounded-lg font-bold ${activeTab === 'records' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>📜 အရောင်းမှတ်တမ်းများ</button>
        </div>
      </div>

      {activeTab === 'pos' && (
        <div className="flex flex-col lg:flex-row gap-6">
          {/* ဘယ်ဘက် - ကုန်ချောများ ရွေးချယ်ရန် */}
          <div className="flex-[2] bg-white p-6 rounded-[2rem] shadow-sm border border-slate-200">
            <h3 className="text-xl font-bold text-slate-800 mb-6">ရောင်းရန်အသင့်ရှိသော ကုန်ချောများ</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
              {finishedGoods.map(fg => (
                <div key={fg.id} onClick={() => handleAddToCart(fg)} className={`relative p-4 rounded-2xl border-2 cursor-pointer transition-all active:scale-95 ${fg.stockQty > 0 ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                  <div className="absolute top-2 right-2 text-xs font-black px-2 py-1 rounded-md bg-slate-800 text-white">Stock: {fg.stockQty}</div>
                  <div className="mt-4 text-sm font-bold text-slate-500">{fg.category}</div>
                  <div className="text-lg font-black text-slate-800 leading-tight">{fg.taste} <span className="text-amber-600">({fg.gram}g)</span></div>
                  <div className="mt-3 text-emerald-600 font-black text-xl">{fg.price.toLocaleString()} Ks</div>
                </div>
              ))}
              {finishedGoods.length === 0 && <div className="col-span-full text-center p-8 text-slate-400 font-bold">ဂိုထောင်ထဲတွင် ကုန်ချောမရှိသေးပါ။</div>}
            </div>
          </div>

          {/* ညာဘက် - ဘောက်ချာဖြတ်ပိုင်း (Cart) */}
          <div className="flex-1 bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col h-full sticky top-4">
            <h3 className="text-xl font-black text-slate-800 mb-4 border-b pb-4">🧾 လက်ရှိ ဘောက်ချာ</h3>
            
            <div className="space-y-4 mb-6">
              <div><input type="text" placeholder="ဝယ်သူအမည်" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-amber-500 font-bold" /></div>
              <div><input type="text" placeholder="ဖုန်းနံပါတ် (Optional)" value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-xl outline-none focus:border-amber-500" /></div>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 space-y-3 min-h-[200px]">
              {cart.map((item, idx) => (
                <div key={idx} className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div>
                    <div className="font-bold text-slate-800 text-sm">{item.product.category} ({item.product.taste})</div>
                    <div className="text-xs text-slate-500 font-bold">{item.product.price.toLocaleString()} Ks x <span className="text-amber-600">{item.quantity}</span></div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-black text-slate-800">{item.subtotal.toLocaleString()} Ks</span>
                    <button onClick={() => removeFromCart(item.product.id)} className="w-6 h-6 flex items-center justify-center bg-red-100 text-red-600 rounded-md font-bold hover:bg-red-500 hover:text-white">✕</button>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div className="text-center text-slate-400 font-bold mt-10">ပစ္စည်းများ ရွေးချယ်ပါ</div>}
            </div>

            <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">စုစုပေါင်း (Total)</span>
                <span className="text-3xl font-black text-emerald-600">{totalAmount.toLocaleString()} Ks</span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)} className="bg-slate-100 p-3 rounded-xl font-bold outline-none text-sm">
                   <option value="Cash">💵 Cash</option><option value="KPay">📱 KPay</option><option value="Wave">🌊 WavePay</option>
                </select>
                <button onClick={() => setIsPaid(!isPaid)} className={`p-3 rounded-xl font-bold text-sm ${isPaid ? 'bg-emerald-100 text-emerald-700 border border-emerald-300' : 'bg-rose-100 text-rose-700 border border-rose-300'}`}>
                  {isPaid ? '✅ ချက်ချင်းငွေရှင်း' : '⏳ အကြွေးထားမည်'}
                </button>
              </div>
              <button onClick={handleCheckout} className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-lg shadow-lg hover:bg-slate-800 active:scale-95 transition-all">
                အရောင်းစာရင်း သွင်းမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 အရောင်းမှတ်တမ်းများ 🌟 */}
      {activeTab === 'records' && (
        <div className="space-y-6">
           <div className="relative w-full max-w-sm">
             <span className="absolute left-3 top-3 text-slate-400">🔍</span>
             <input type="text" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-amber-500" placeholder="ဘောက်ချာ / ဝယ်သူအမည် ရှာရန်..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(50); }} />
           </div>

           <div className="grid gap-6">
            {visibleSalesToRender.map(sale => (
              <div key={sale.id} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm">
                <div className="flex flex-col md:flex-row justify-between items-start gap-4">
                  <div className="space-y-3">
                    <div className="flex gap-3 items-center">
                      <span className="text-xs font-black bg-slate-100 px-3 py-1 rounded-full text-slate-600">#{sale.id}</span>
                      <span className={`text-xs font-black px-3 py-1 rounded-full border ${sale.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>
                        {sale.isPaid ? `✅ ${sale.paymentMethod} (Paid)` : '⏳ အကြွေး (Unpaid)'}
                      </span>
                      {!sale.isPaid && isManager && (
                        <button onClick={() => { if(window.confirm('ငွေလက်ခံရရှိပြီးဖြစ်ကြောင်း အတည်ပြုပါသလား?')) onMarkAsPaid(sale.id); }} className="text-xs font-black bg-emerald-500 text-white px-3 py-1 rounded-full hover:bg-emerald-600 shadow-sm active:scale-95 transition-all">
                          ငွေရှင်းမည်
                        </button>
                      )}
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-800 flex items-center gap-2"><span>👤</span> {sale.customerName}</h3>
                      <div className="text-xs text-slate-500 font-bold mt-1">📅 {sale.date} | 🏷️ ရောင်းချသူ: {sale.salespersonName}</div>
                    </div>
                    {/* ဘောက်ချာ အသေးစိတ် */}
                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                      {sale.items.map((i, idx) => (
                        <div key={idx} className="flex justify-between text-xs font-bold text-slate-600 mb-1 border-b border-slate-200/50 pb-1">
                          <span>{i.product.category} ({i.product.taste}) x {i.quantity}</span>
                          <span>{i.subtotal.toLocaleString()} Ks</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="text-right space-y-4 w-full md:w-auto mt-4 md:mt-0">
                    <div className="text-3xl font-black text-amber-600">{sale.finalAmount.toLocaleString()} Ks</div>
                    <div className="flex gap-2 justify-end">
                      <button onClick={() => window.print()} className="px-4 py-2 bg-slate-100 text-slate-600 hover:bg-slate-200 font-bold rounded-xl text-sm border border-slate-300">🖨️ Print</button>
                      {isManager && <button onClick={() => { if(window.confirm('ဖျက်ရန် သေချာပါသလား?')) onDeleteSale(sale.id); }} className="px-4 py-2 bg-red-50 text-red-600 hover:bg-red-500 hover:text-white font-bold rounded-xl text-sm border border-red-200 transition-colors">ဖျက်မည်</button>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            {visibleSalesToRender.length === 0 && <div className="p-8 text-center text-slate-400 font-bold bg-white rounded-3xl border border-dashed">မှတ်တမ်း မရှိသေးပါ။</div>}
          </div>
        </div>
      )}
    </div>
  );
};
