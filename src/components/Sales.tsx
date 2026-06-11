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
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);

  // --- Checkout Modal States ---
  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState('U Myo Min Htay'); // Default name
  const [phone, setPhone] = useState('');
  const [shopType, setShopType] = useState('ကျောင်းဈေးဆိုင်');
  const [address, setAddress] = useState('');
  const [gpsLocation, setGpsLocation] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [taxPercent, setTaxPercent] = useState<number>(0);
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [creditTerms, setCreditTerms] = useState('1 Day (၁ ရက်)');

  const isManager = userRole === 'manager' || userRole === 'md';

  // --- POS Functions ---
  const handleAddToCart = (product: FinishedGoodItem) => {
    if (product.stockQty <= 0) return alert('❌ ဤကုန်ချော လက်ကျန် ပြတ်နေပါသည်။');
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stockQty) { alert('❌ လက်ကျန်အရေအတွက်ထက် ပိုရောင်း၍မရပါ။'); return prev; }
        return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1, subtotal: (item.quantity + 1) * product.price } : item);
      } else {
        return [...prev, { product, quantity: 1, subtotal: product.price }];
      }
    });
  };

  // 🌟 အရေအတွက်အား စိတ်ကြိုက်ရိုက်ထည့်နိုင်သော Function 🌟
  const handleUpdateCartQty = (productId: number, qtyString: string) => {
    const newQty = parseInt(qtyString) || 0;
    if (newQty < 0) return;
    const product = finishedGoods.find(fg => fg.id === productId);
    if (product && newQty > product.stockQty) return alert(`❌ လက်ကျန် (${product.stockQty}) ထက် ပိုရောင်း၍မရပါ။`);
    
    setCart(prev => prev.map(item => {
      if (item.product.id === productId) {
         return { ...item, quantity: newQty, subtotal: newQty * item.product.price };
      }
      return item;
    }).filter(item => item.quantity > 0)); // 0 ဆိုပါက ဖျက်မည်
  };

  const removeFromCart = (productId: number) => setCart(cart.filter(item => item.product.id !== productId));

  // --- တွက်ချက်မှုများ ---
  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = (totalAmount * discountPercent) / 100;
  const taxableAmount = totalAmount - discountAmount;
  const taxAmount = (taxableAmount * taxPercent) / 100;
  const finalAmount = Math.round(taxableAmount + taxAmount);

  const handleCheckoutSubmit = () => {
    if (!customerName) return alert("ဝယ်သူအမည် ထည့်သွင်းပါ။");
    
    const newSale: SaleRecord = {
      id: `INV-${Date.now().toString().slice(-6)}`,
      date: new Date().toLocaleDateString('en-GB'),
      customerName, phone, salespersonName: userName,
      shopType, address, gps: gpsLocation,
      items: cart, totalAmount, finalAmount,
      discountPercent, taxPercent,
      paymentMethod,
      creditTerms: paymentMethod === 'CREDIT' ? creditTerms : undefined,
      isPaid: paymentMethod !== 'CREDIT'
    };

    onCheckout(newSale);
    setCart([]); setIsCheckoutModalOpen(false);
    alert('✅ အရောင်းစာရင်း အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    setActiveTab('records');
  };

  const filteredSales = sales.filter(sale => String(sale?.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(sale?.id || '').toLowerCase().includes(searchTerm.toLowerCase()));
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
            </div>
          </div>

          <div className="flex-1 bg-white p-6 rounded-[2rem] shadow-xl border border-slate-200 flex flex-col h-full sticky top-4">
            <div className="flex justify-between items-center border-b pb-4 mb-4">
               <h3 className="text-xl font-black text-slate-800">🛒 စာရင်း</h3>
               <span className="text-sm font-bold text-slate-400">{cart.length} မျိုး</span>
            </div>

            <div className="flex-1 overflow-y-auto mb-6 space-y-3 min-h-[300px]">
              {cart.map((item, idx) => (
                <div key={idx} className="flex flex-col bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-2 border-b border-slate-200/50 pb-2">
                    <span className="font-bold text-slate-800 text-sm">{item.product.category} ({item.product.taste}) {item.product.gram}g</span>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500 font-bold">✕</button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-black">{item.product.price.toLocaleString()} ကျပ်</span>
                    {/* 🌟 အရေအတွက်အား စိတ်ကြိုက်ရိုက်ထည့်နိုင်သော UI 🌟 */}
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-2 py-1 shadow-sm">
                      <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity - 1).toString())} className="w-6 font-black text-slate-600 hover:text-amber-600">-</button>
                      <input type="number" value={item.quantity || ''} onChange={(e) => handleUpdateCartQty(item.product.id, e.target.value)} className="w-10 text-center font-black outline-none bg-transparent" />
                      <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity + 1).toString())} className="w-6 font-black text-slate-600 hover:text-amber-600">+</button>
                      <span className="text-xs font-bold text-slate-500 ml-1">ထုပ်</span>
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div className="text-center text-slate-400 font-bold mt-10">ပစ္စည်းများ ရွေးချယ်ပါ</div>}
            </div>

            <div className="border-t-2 border-dashed border-slate-200 pt-4 space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold">စုစုပေါင်း</span>
                <span className="text-2xl font-black text-emerald-600">{totalAmount.toLocaleString()} ကျပ်</span>
              </div>
              <button onClick={() => { if(cart.length > 0) setIsCheckoutModalOpen(true); else alert("ပစ္စည်းထည့်ပါ"); }} className="w-full bg-emerald-500 text-white py-4 rounded-xl font-black text-lg shadow-md hover:bg-emerald-600 active:scale-95 transition-all">
                ငွေရှင်းမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 Checkout Modal (MRS Style အတိအကျ) 🌟 */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="bg-slate-800 p-4 flex justify-between items-center">
              <h3 className="text-white font-black text-xl flex items-center gap-2"><span>🧾</span> ငွေရှင်းရန်</h3>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-300 hover:text-white font-bold text-xl">✕</button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div><label className="block text-xs font-bold text-slate-500 mb-1">ဝယ်သူအမည် *</label><input type="text" value={customerName} onChange={e => setCustomerName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none focus:border-emerald-500 font-bold" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">ဆိုင်အမျိုးအစား</label><select value={shopType} onChange={e => setShopType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none font-bold text-slate-700"><option value="ကျောင်းဈေးဆိုင်">ကျောင်းဈေးဆိုင်</option><option value="လက်လီဆိုင်">လက်လီဆိုင်</option><option value="လက်ကားဆိုင်">လက်ကားဆိုင်</option></select></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">ဖုန်းနံပါတ်</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09..." className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none focus:border-emerald-500" /></div>
                <div><label className="block text-xs font-bold text-slate-500 mb-1">လိပ်စာ</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 rounded-lg outline-none focus:border-emerald-500" /></div>
                <div className="md:col-span-2"><label className="block text-xs font-bold text-slate-500 mb-1">GPS LOCATION</label><div className="relative"><input type="text" value={gpsLocation} onChange={e => setGpsLocation(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-3 pr-10 rounded-lg outline-none" /><span className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 font-bold">📍</span></div></div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="bg-emerald-50 p-3 rounded-xl border border-emerald-100">
                  <label className="block text-xs font-black text-emerald-600 mb-1">လျှော့ဈေး (%)</label>
                  <input type="number" value={discountPercent || ''} onChange={e => setDiscountPercent(Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-emerald-700 text-lg" placeholder="0.0" />
                </div>
                <div className="bg-rose-50 p-3 rounded-xl border border-rose-100">
                  <label className="block text-xs font-black text-rose-600 mb-1">အခွန် (%)</label>
                  <input type="number" value={taxPercent || ''} onChange={e => setTaxPercent(Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-rose-700 text-lg" placeholder="0.0" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-500 mb-2 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-3 gap-2">
                  {['CASH', 'KPAY', 'WAVE PAY', 'UAB PAY', 'AYA PAY', 'CREDIT'].map(method => (
                    <button key={method} onClick={() => setPaymentMethod(method)} className={`p-2 rounded-lg font-bold text-xs border-2 transition-all ${paymentMethod === method ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>
                      {method}
                    </button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'CREDIT' && (
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-200">
                  <label className="block text-xs font-black text-amber-700 mb-2">⏳ အကြွေးဆပ်ရမည့် သက်တမ်း:</label>
                  <select value={creditTerms} onChange={e => setCreditTerms(e.target.value)} className="w-full p-2.5 rounded-lg border border-amber-300 outline-none font-bold text-amber-900">
                    <option value="1 Day (၁ ရက်)">1 Day (၁ ရက်)</option>
                    <option value="3 Days (၃ ရက်)">3 Days (၃ ရက်)</option>
                    <option value="7 Days (၇ ရက်)">7 Days (၇ ရက်)</option>
                    <option value="15 Days (၁၅ ရက်)">15 Days (၁၅ ရက်)</option>
                    <option value="1 Month (၁ လ)">1 Month (၁ လ)</option>
                    <option value="Custom">Custom (စိတ်ကြိုက်ရက်)</option>
                  </select>
                </div>
              )}

              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 flex justify-between items-center">
                <span className="font-bold text-slate-600">ကျသင့်ငွေ:</span>
                <span className="text-3xl font-black text-slate-800">{finalAmount.toLocaleString()} ကျပ်</span>
              </div>
            </div>

            <div className="p-4 bg-white border-t flex gap-3">
              <button onClick={() => setIsCheckoutModalOpen(false)} className="flex-1 py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200">Cancel</button>
              <button onClick={handleCheckoutSubmit} className="flex-[2] py-3 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-md">အတည်ပြုမည်</button>
            </div>
          </div>
        </div>
      )}

      {/* မှတ်တမ်း UI (အတိုချုံးပြသခြင်း) */}
      {activeTab === 'records' && (
        <div className="space-y-6">
           <div className="relative w-full max-w-sm"><span className="absolute left-3 top-3 text-slate-400">🔍</span><input type="text" className="w-full pl-10 pr-4 py-3 bg-white border border-slate-200 rounded-2xl shadow-sm outline-none focus:border-amber-500" placeholder="ဘောက်ချာ / ဝယ်သူအမည် ရှာရန်..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(50); }} /></div>
           <div className="grid gap-4">
            {visibleSalesToRender.map(sale => (
              <div key={sale.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                  <div className="flex gap-2 items-center mb-1">
                    <span className="text-xs font-black bg-slate-100 px-2 py-1 rounded text-slate-600">#{sale.id}</span>
                    <span className={`text-xs font-black px-2 py-1 rounded border ${sale.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{sale.isPaid ? `✅ ${sale.paymentMethod}` : `⏳ အကြွေး (${sale.creditTerms})`}</span>
                  </div>
                  <h3 className="text-lg font-black text-slate-800">👤 {sale.customerName}</h3>
                  <div className="text-xs text-slate-500 font-bold">📅 {sale.date} | 📍 {sale.shopType}</div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-amber-600 mb-2">{sale.finalAmount.toLocaleString()} Ks</div>
                  <div className="flex gap-2 justify-end">
                     {!sale.isPaid && isManager && <button onClick={() => { if(window.confirm('ငွေလက်ခံရရှိပြီလား?')) onMarkAsPaid(sale.id); }} className="px-3 py-1.5 bg-emerald-500 text-white font-bold rounded-lg text-xs">ငွေရှင်းမည်</button>}
                     <button onClick={() => window.print()} className="px-3 py-1.5 bg-slate-100 text-slate-600 font-bold rounded-lg text-xs">🖨️ Print</button>
                     {isManager && <button onClick={() => { if(window.confirm('ဖျက်ရန် သေချာပါသလား?')) onDeleteSale(sale.id); }} className="px-3 py-1.5 bg-red-50 text-red-600 font-bold rounded-lg text-xs">ဖျက်မည်</button>}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
