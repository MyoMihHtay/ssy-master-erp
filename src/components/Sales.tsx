import React, { useState } from 'react';
import type { FinishedGoodItem, SaleRecord, SaleItem, Customer } from '../App';

interface SalesProps {
  userRole: string;
  userName: string;
  finishedGoods: FinishedGoodItem[];
  sales: SaleRecord[];
  customers: Customer[];
  onCheckout: (sale: SaleRecord) => void;
  onMarkAsPaid: (saleId: string) => void;
  onDeleteSale: (saleId: string) => void;
}

// 🌟 Due Date တွက်ချက်ပေးမည့် Function 🌟
const calculateDueDate = (saleDateStr: string, terms: string | undefined) => {
  if (!terms) return '';
  const parts = saleDateStr.split('/');
  if (parts.length !== 3) return terms;
  const date = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
  
  let addDays = 0;
  if (terms.includes('1 Day')) addDays = 1;
  else if (terms.includes('3 Days')) addDays = 3;
  else if (terms.includes('7 Days')) addDays = 7;
  else if (terms.includes('15 Days')) addDays = 15;
  else if (terms.includes('1 Month')) addDays = 30;
  else {
    const match = terms.match(/(\d+)/);
    if (match) addDays = parseInt(match[0]);
  }

  date.setDate(date.getDate() + addDays);
  return date.toLocaleDateString('en-GB');
};

export const Sales: React.FC<SalesProps> = ({ userRole, userName, finishedGoods, sales, customers, onCheckout, onMarkAsPaid, onDeleteSale }) => {
  const [activeTab, setActiveTab] = useState<'pos' | 'records'>('pos');
  const [cart, setCart] = useState<SaleItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [displayLimit, setDisplayLimit] = useState(50);

  const [isCheckoutModalOpen, setIsCheckoutModalOpen] = useState(false);
  const [customerName, setCustomerName] = useState(''); 
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [phone, setPhone] = useState('');
  const [shopType, setShopType] = useState('Company (ကုမ္ပဏီ)'); 
  const [address, setAddress] = useState('');
  const [gpsLocation, setGpsLocation] = useState('');
  const [discountPercent, setDiscountPercent] = useState<number | ''>('');
  const [taxPercent, setTaxPercent] = useState<number | ''>('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [creditTerms, setCreditTerms] = useState('1 Day (၁ ရက်)');
  const [customCreditDays, setCustomCreditDays] = useState(''); 

  // 🌟 Print Modal အတွက် State များ 🌟
  const [selectedSaleForPrint, setSelectedSaleForPrint] = useState<SaleRecord | null>(null);
  const [printType, setPrintType] = useState<'A4' | 'THERMAL'>('A4');

  const isManager = userRole === 'manager' || userRole === 'md';
  const isMDOnly = userRole === 'md';

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
    }).filter(item => item.quantity > 0)); 
  };

  const removeFromCart = (productId: number) => setCart(cart.filter(item => item.product.id !== productId));

  const fetchLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => { setGpsLocation(`${position.coords.latitude}, ${position.coords.longitude}`); },
        (error) => { alert("GPS location ရယူ၍မရပါ။"); }
      );
    } else { alert("သင့်စက်တွင် GPS မပါဝင်ပါ။"); }
  };

  const totalAmount = cart.reduce((sum, item) => sum + item.subtotal, 0);
  const discountAmount = (totalAmount * Number(discountPercent || 0)) / 100;
  const taxableAmount = totalAmount - discountAmount;
  const taxAmount = (taxableAmount * Number(taxPercent || 0)) / 100;
  const finalAmount = Math.round(taxableAmount + taxAmount);

  const handleCheckoutSubmit = () => {
    if (!customerName) return alert("ဝယ်သူအမည် ထည့်သွင်းပါ။");
    if (paymentMethod === 'CREDIT' && creditTerms === 'Custom' && !customCreditDays) return alert("စိတ်ကြိုက်ရက် ထည့်ပါ။");
    
    const finalCreditTerms = paymentMethod === 'CREDIT' ? (creditTerms === 'Custom' ? `${customCreditDays} Days (စိတ်ကြိုက်)` : creditTerms) : undefined;

    const newSale: SaleRecord = {
      id: `INV-${Date.now().toString().slice(-6)}`, date: new Date().toLocaleDateString('en-GB'),
      customerName, phone, salespersonName: userName, shopType, address, gps: gpsLocation,
      items: cart, totalAmount, finalAmount, discountPercent: Number(discountPercent || 0), taxPercent: Number(taxPercent || 0),
      paymentMethod, creditTerms: finalCreditTerms, isPaid: paymentMethod !== 'CREDIT'
    };

    onCheckout(newSale); setCart([]); setIsCheckoutModalOpen(false);
    setCustomerName(''); setPhone(''); setAddress(''); setGpsLocation('');
    alert('✅ အရောင်းစာရင်း အောင်မြင်စွာ သိမ်းဆည်းပြီးပါပြီ။');
    setActiveTab('records');
  };

  const openPrintModal = (sale: SaleRecord) => {
    setSelectedSaleForPrint(sale);
  };

  const handlePrint = (type: 'A4' | 'THERMAL') => {
    setPrintType(type);
    setTimeout(() => { window.print(); }, 300);
  };

  const filteredSales = sales.filter(sale => String(sale?.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(sale?.id || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleSalesToRender = filteredSales.slice(0, displayLimit);

  return (
    <div className="p-1 md:p-6 h-full overflow-y-auto print:p-0 print:overflow-visible">
      {/* 🌟 ပုံမှန် UI များကို Print ထုတ်ချိန်တွင် ဖျောက်ထားမည် (print:hidden) 🌟 */}
      <div className="print:hidden">
        {/* Header Area */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 md:mb-6 border-b-2 pb-2 md:pb-4 border-amber-200 gap-2 md:gap-4">
          <h2 className="text-lg md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-1.5 md:gap-2"><span className="text-xl md:text-4xl">💰</span> အရောင်းပိုင်း (POS)</h2>
          <div className="flex gap-1.5 md:gap-2 bg-white p-1 rounded-lg md:rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
            <button onClick={() => setActiveTab('pos')} className={`flex-1 md:flex-none px-3 py-1.5 md:px-6 md:py-2.5 rounded-md md:rounded-lg font-bold text-[10px] md:text-base ${activeTab === 'pos' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>🛒 ဘောက်ချာဖြတ်မည်</button>
            <button onClick={() => setActiveTab('records')} className={`flex-1 md:flex-none px-3 py-1.5 md:px-6 md:py-2.5 rounded-md md:rounded-lg font-bold text-[10px] md:text-base ${activeTab === 'records' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>📜 မှတ်တမ်းများ</button>
          </div>
        </div>

        {activeTab === 'pos' && (
          <div className="flex flex-col lg:flex-row gap-2 md:gap-6">
            <div className="flex-[2] bg-white p-2 md:p-6 rounded-xl md:rounded-[2rem] shadow-sm border border-slate-200">
              <h3 className="text-xs md:text-xl font-bold text-slate-800 mb-2 md:mb-6">ရောင်းရန်အသင့်ရှိသော ကုန်ချောများ</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 md:gap-4">
                {finishedGoods.map(fg => (
                  <div key={fg.id} onClick={() => handleAddToCart(fg)} className={`relative p-1.5 md:p-4 rounded-lg md:rounded-xl border hover:border-amber-400 cursor-pointer transition-all active:scale-95 ${fg.stockQty > 0 ? 'bg-white border-slate-200 shadow-sm hover:shadow-md' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                    <div className="absolute top-1 right-1 md:top-2 md:right-2 text-[8px] md:text-xs font-black px-1 py-0.5 md:px-2 md:py-1 rounded bg-slate-800 text-white">Stock: {fg.stockQty}</div>
                    <div className="mt-3 md:mt-5 text-[9px] md:text-sm font-bold text-slate-500 truncate">{fg.category}</div>
                    <div className="text-xs md:text-lg font-black text-slate-800 leading-tight truncate">{fg.taste} <span className="text-amber-600 text-[8px] md:text-sm">({fg.gram}g)</span></div>
                    <div className="mt-1 md:mt-3 text-emerald-600 font-black text-xs md:text-xl">{fg.price.toLocaleString()} Ks</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex-1 bg-white p-2 md:p-6 rounded-xl md:rounded-[2rem] shadow-xl border border-slate-200 flex flex-col h-full sticky top-1 md:top-4">
              <div className="flex justify-between items-center border-b pb-1.5 md:pb-4 mb-2 md:mb-4">
                 <h3 className="text-sm md:text-xl font-black text-slate-800">🛒 စာရင်း</h3>
                 <span className="text-[10px] md:text-sm font-bold text-slate-400">{cart.length} မျိုး</span>
              </div>

              <div className="flex-1 overflow-y-auto mb-2 md:mb-6 space-y-1.5 md:space-y-3 min-h-[150px] md:min-h-[300px]">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex flex-col bg-slate-50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-slate-200">
                    <div className="flex justify-between items-center mb-1 md:mb-2 border-b border-slate-200/50 pb-1 md:pb-2">
                      <span className="font-bold text-slate-800 text-[9px] md:text-sm truncate mr-1.5">{item.product.category} ({item.product.taste}) {item.product.gram}g</span>
                      <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500 font-bold text-[10px] md:text-base">✕</button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-amber-700 font-black text-[10px] md:text-base">{item.product.price.toLocaleString()} Ks</span>
                      <div className="flex items-center gap-0.5 md:gap-1 bg-white border border-slate-200 rounded-md md:rounded-lg px-1 md:px-2 py-0.5 md:py-1 shadow-sm">
                        <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity - 1).toString())} className="w-4 md:w-6 font-black text-slate-600 hover:text-amber-600">-</button>
                        <input type="number" value={item.quantity || ''} onChange={(e) => handleUpdateCartQty(item.product.id, e.target.value)} className="w-6 md:w-10 text-center font-black outline-none bg-transparent text-[10px] md:text-base" />
                        <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity + 1).toString())} className="w-4 md:w-6 font-black text-slate-600 hover:text-amber-600">+</button>
                      </div>
                    </div>
                  </div>
                ))}
                {cart.length === 0 && <div className="text-center text-slate-400 font-bold mt-4 md:mt-10 text-[10px] md:text-base">ပစ္စည်းများ ရွေးချယ်ပါ</div>}
              </div>

              <div className="border-t border-dashed border-slate-200 pt-2 md:pt-4 space-y-2 md:space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-slate-500 font-bold text-[10px] md:text-base">စုစုပေါင်း</span>
                  <span className="text-base md:text-2xl font-black text-emerald-600">{totalAmount.toLocaleString()} Ks</span>
                </div>
                <button onClick={() => { if(cart.length > 0) setIsCheckoutModalOpen(true); else alert("ပစ္စည်းထည့်ပါ"); }} className="w-full bg-emerald-500 text-white py-2 md:py-4 rounded-lg md:rounded-xl font-black text-xs md:text-lg shadow-md hover:bg-emerald-600 active:scale-95 transition-all">
                  ငွေရှင်းမည်
                </button>
              </div>
            </div>
          </div>
        )}

        {isCheckoutModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 md:p-4 backdrop-blur-sm">
            <div className="bg-white rounded-xl md:rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
              <div className="bg-slate-800 p-2 md:p-4 flex justify-between items-center shrink-0">
                <h3 className="text-white font-black text-sm md:text-xl flex items-center gap-1.5 md:gap-2"><span>🧾</span> ငွေရှင်းရန်</h3>
                <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-300 hover:text-white font-bold text-base md:text-xl px-2">✕</button>
              </div>
              
              <div className="p-3 md:p-6 overflow-y-auto space-y-3 md:space-y-5">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 md:gap-4">
                  <div className="relative">
                    <label className="block text-[9px] md:text-xs font-bold text-slate-500 mb-0.5 md:mb-1">ဝယ်သူအမည် *</label>
                    <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full bg-slate-50 border border-slate-200 p-1.5 md:p-3 rounded-md md:rounded-lg outline-none focus:border-emerald-500 font-bold text-[10px] md:text-sm" placeholder="အမည်ရိုက်ထည့်ပါ..." />
                    {showSuggestions && customerName && (
                      <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                        {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).map(c => (
                          <li key={c.id} onMouseDown={(e) => { e.preventDefault(); setCustomerName(c.name); setPhone(c.phone); setShopType(c.shopType || 'Company (ကုမ္ပဏီ)'); setAddress(c.address); setGpsLocation(c.gpsLocation); setShowSuggestions(false); }} className="p-1.5 md:p-3 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0">
                            <div className="font-bold text-slate-800 text-[10px] md:text-sm">{c.name}</div>
                            <div className="text-[8px] md:text-xs text-slate-500">{c.phone} | {c.shopType}</div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                  <div><label className="block text-[9px] md:text-xs font-bold text-slate-500 mb-0.5 md:mb-1">ဆိုင်အမျိုးအစား</label><input type="text" list="shop-types" value={shopType} onChange={e => setShopType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-1.5 md:p-3 rounded-md md:rounded-lg outline-none focus:border-emerald-500 font-bold text-slate-700 text-[10px] md:text-sm" placeholder="ရွေးချယ်ပါ..." />
                    <datalist id="shop-types"><option value="Company (ကုမ္ပဏီ)" /><option value="Distribution (ဖြန့်ချိရေး)" /><option value="ကျောင်းဈေးဆိုင်" /><option value="လက်လီဆိုင်" /><option value="လက်ကားဆိုင်" /></datalist>
                  </div>
                  <div><label className="block text-[9px] md:text-xs font-bold text-slate-500 mb-0.5 md:mb-1">ဖုန်းနံပါတ်</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09..." className="w-full bg-slate-50 border border-slate-200 p-1.5 md:p-3 rounded-md md:rounded-lg outline-none focus:border-emerald-500 text-[10px] md:text-sm" /></div>
                  <div><label className="block text-[9px] md:text-xs font-bold text-slate-500 mb-0.5 md:mb-1">လိပ်စာ</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-1.5 md:p-3 rounded-md md:rounded-lg outline-none focus:border-emerald-500 text-[10px] md:text-sm" /></div>
                </div>

                <div className="grid grid-cols-2 gap-2 md:gap-4">
                  <div className="bg-emerald-50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-emerald-100"><label className="block text-[9px] md:text-xs font-black text-emerald-600 mb-0.5 md:mb-1">လျှော့ဈေး (%)</label><input type="number" step="0.01" value={discountPercent} onChange={e => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-emerald-700 text-xs md:text-lg" placeholder="0.0" /></div>
                  <div className="bg-rose-50 p-1.5 md:p-3 rounded-lg md:rounded-xl border border-rose-100"><label className="block text-[9px] md:text-xs font-black text-rose-600 mb-0.5 md:mb-1">အခွန် (%)</label><input type="number" step="0.01" value={taxPercent} onChange={e => setTaxPercent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-rose-700 text-xs md:text-lg" placeholder="0.0" /></div>
                </div>

                <div>
                  <label className="block text-[9px] md:text-xs font-bold text-slate-500 mb-1 uppercase tracking-wider">Payment Method</label>
                  <div className="grid grid-cols-3 gap-1 md:gap-2">
                    {['CASH', 'KPAY', 'WAVE PAY', 'UAB PAY', 'AYA PAY', 'CREDIT'].map(method => (
                      <button key={method} onClick={() => setPaymentMethod(method)} className={`p-1 md:p-2 rounded-md md:rounded-lg font-bold text-[8px] md:text-xs border transition-all ${paymentMethod === method ? 'border-emerald-500 text-emerald-700 bg-emerald-50 shadow-sm' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{method}</button>
                    ))}
                  </div>
                </div>

                {paymentMethod === 'CREDIT' && (
                  <div className="bg-amber-50 p-2 md:p-4 rounded-lg md:rounded-xl border border-amber-200">
                    <label className="block text-[9px] md:text-xs font-black text-amber-700 mb-1">⏳ အကြွေးသက်တမ်း:</label>
                    <select value={creditTerms} onChange={e => setCreditTerms(e.target.value)} className="w-full p-1.5 md:p-2.5 rounded-md md:rounded-lg border border-amber-300 outline-none font-bold text-amber-900 mb-1.5 bg-white text-[10px] md:text-sm">
                      <option value="1 Day (၁ ရက်)">1 Day (၁ ရက်)</option><option value="3 Days (၃ ရက်)">3 Days (၃ ရက်)</option><option value="7 Days (၇ ရက်)">7 Days (၇ ရက်)</option><option value="15 Days (၁5 ရက်)">15 Days (၁5 ရက်)</option><option value="1 Month (၁ လ)">1 Month (၁ လ)</option><option value="Custom">Custom (စိတ်ကြိုက်)</option>
                    </select>
                    {creditTerms === 'Custom' && (
                       <div className="flex items-center gap-1.5 md:gap-2"><input type="number" placeholder="ဥပမာ - 8" value={customCreditDays} onChange={e => setCustomCreditDays(e.target.value)} className="w-full p-1.5 md:p-2.5 rounded-md md:rounded-lg border border-amber-300 outline-none font-black text-amber-900 bg-white text-[10px] md:text-sm" /><span className="font-bold text-amber-800 text-[10px] md:text-sm">ရက်</span></div>
                    )}
                  </div>
                )}

                <div className="bg-slate-50 p-2 md:p-4 rounded-lg md:rounded-xl border border-slate-200 flex justify-between items-center"><span className="font-bold text-slate-600 text-[10px] md:text-base">ကျသင့်ငွေ:</span><span className="text-lg md:text-3xl font-black text-slate-800">{finalAmount.toLocaleString()} Ks</span></div>
              </div>

              <div className="p-2 md:p-4 bg-white border-t flex gap-1.5 md:gap-3 shrink-0">
                <button onClick={() => setIsCheckoutModalOpen(false)} className="flex-1 py-1.5 md:py-3 rounded-lg md:rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-xs md:text-base">Cancel</button>
                <button onClick={handleCheckoutSubmit} className="flex-[2] py-1.5 md:py-3 rounded-lg md:rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-md active:scale-95 transition-all text-xs md:text-base">အတည်ပြုမည်</button>
              </div>
            </div>
          </div>
        )}

        {/* မှတ်တမ်း UI နှင့် Print ခလုတ်အသစ် */}
        {activeTab === 'records' && (
          <div className="space-y-2 md:space-y-6">
             <div className="relative w-full md:max-w-sm"><span className="absolute left-2.5 top-1.5 md:top-3 text-slate-400 text-xs md:text-base">🔍</span><input type="text" className="w-full pl-7 pr-3 py-1.5 md:py-3 bg-white border border-slate-200 rounded-lg md:rounded-xl shadow-sm outline-none focus:border-amber-500 text-[10px] md:text-base" placeholder="ဘောက်ချာ / အမည် ရှာရန်..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(50); }} /></div>
             <div className="grid gap-2 md:gap-4">
              {visibleSalesToRender.map(sale => (
                <div key={sale.id} className="bg-white p-2 md:p-5 rounded-lg md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-1.5 md:gap-4 hover:shadow-md transition-shadow">
                  <div className="w-full md:w-auto">
                    <div className="flex justify-between md:justify-start gap-1.5 items-center mb-0.5 md:mb-1">
                      <div className="flex gap-1.5 items-center">
                        <span className="text-[8px] md:text-xs font-black bg-slate-100 px-1 md:px-1.5 py-0.5 rounded text-slate-600">#{sale.id}</span>
                        <span className={`text-[8px] md:text-xs font-black px-1 md:px-1.5 py-0.5 rounded border ${sale.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{sale.isPaid ? `✅ ${sale.paymentMethod}` : `⏳ အကြွေး (${sale.creditTerms})`}</span>
                      </div>
                      <div className="text-xs font-black text-amber-600 md:hidden">{sale.finalAmount.toLocaleString()} Ks</div>
                    </div>
                    <h3 className="text-xs md:text-lg font-black text-slate-800">👤 {sale.customerName} <span className="text-[9px] md:text-sm font-medium text-slate-500">({sale.phone})</span></h3>
                    
                    <div className="text-[9px] md:text-xs text-slate-500 font-bold mt-0.5 md:mt-1 leading-relaxed">
                      📅 {sale.date} | 🏷️ {sale.salespersonName} <br/>
                      🏢 {sale.shopType} {sale.address ? `| 🏠 ${sale.address}` : ''}
                    </div>
                  </div>
                  
                  <div className="text-right w-full md:w-auto border-t border-slate-100 md:border-0 pt-1.5 md:pt-0 mt-1 md:mt-0 flex justify-between md:flex-col items-center md:items-end">
                    <div className="text-2xl font-black text-amber-600 mb-2 hidden md:block">{sale.finalAmount.toLocaleString()} Ks</div>
                    <div className="flex gap-1 md:gap-2 justify-end w-full md:w-auto">
                       {!sale.isPaid && isManager && <button onClick={() => { if(window.confirm('ငွေလက်ခံရရှိပြီလား?')) onMarkAsPaid(sale.id); }} className="px-1.5 py-1 md:px-3 md:py-1.5 bg-emerald-500 text-white font-bold rounded-md md:rounded-lg text-[9px] md:text-xs hover:bg-emerald-600">ငွေရှင်းမည်</button>}
                       
                       {/* 🌟 ဤနေရာတွင် Print Modal ကို ခေါ်မည့် ခလုတ် ပြောင်းထားသည် 🌟 */}
                       <button onClick={() => openPrintModal(sale)} className="px-1.5 py-1 md:px-3 md:py-1.5 bg-indigo-50 text-indigo-700 font-bold rounded-md md:rounded-lg text-[9px] md:text-xs border border-indigo-200 hover:bg-indigo-600 hover:text-white transition-colors">🖨️ ဘောက်ချာထုတ်မည်</button>
                       
                       {isMDOnly && <button onClick={() => { if(window.confirm('ဖျက်ရန် သေချာပါသလား?')) onDeleteSale(sale.id); }} className="px-1.5 py-1 md:px-3 md:py-1.5 bg-red-50 text-red-600 font-bold rounded-md md:rounded-lg text-[9px] md:text-xs hover:bg-red-500 hover:text-white transition-colors">ဖျက်မည်</button>}
                    </div>
                  </div>
                </div>
              ))}
              {visibleSalesToRender.length === 0 && <div className="p-4 md:p-8 text-center text-slate-400 font-bold bg-white rounded-xl md:rounded-2xl border border-dashed text-[10px] md:text-base">မှတ်တမ်း မရှိသေးပါ။</div>}
            </div>
        </div>
        )}
      </div>

      {/* 🌟 🌟 🌟 PRINT MODAL (ရွေးချယ်ရန်) 🌟 🌟 🌟 */}
      {selectedSaleForPrint && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 p-4 print:hidden backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-500 to-emerald-600 p-4 flex justify-between items-center">
               <h3 className="text-white font-black text-lg flex items-center gap-2"><span>🖨️</span> ဘောက်ချာ အကြမ်းဖျင်း</h3>
               <button onClick={() => setSelectedSaleForPrint(null)} className="text-white/80 hover:text-white font-bold text-xl">✕</button>
            </div>
            <div className="p-6 bg-slate-50">
               <div className="text-center mb-6">
                 <h4 className="font-black text-slate-800 text-xl">SSY Master</h4>
                 <p className="text-xs text-slate-500 font-bold">INV: #{selectedSaleForPrint.id}</p>
               </div>
               
               <div className="space-y-2 mb-6 bg-white p-4 rounded-xl border border-slate-200 shadow-sm text-sm">
                 <div className="flex justify-between"><span className="text-slate-500 font-bold">ဝယ်သူ:</span><span className="font-black text-slate-800">{selectedSaleForPrint.customerName}</span></div>
                 <div className="flex justify-between"><span className="text-slate-500 font-bold">ငွေချေစနစ်:</span><span className={`font-black ${selectedSaleForPrint.isPaid ? 'text-emerald-600' : 'text-rose-600'}`}>{selectedSaleForPrint.paymentMethod}</span></div>
                 {!selectedSaleForPrint.isPaid && selectedSaleForPrint.creditTerms && (
                   <div className="flex justify-between bg-rose-50 p-2 rounded border border-rose-100 mt-2"><span className="text-rose-600 font-bold">🗓️ Due Date:</span><span className="font-black text-rose-700">{calculateDueDate(selectedSaleForPrint.date, selectedSaleForPrint.creditTerms)}</span></div>
                 )}
               </div>

               <div className="flex justify-between items-end border-t-2 border-dashed border-slate-300 pt-4">
                 <span className="text-slate-600 font-bold text-lg">Total:</span>
                 <span className="text-3xl font-black text-emerald-600">{selectedSaleForPrint.finalAmount.toLocaleString()} Ks</span>
               </div>
            </div>
            <div className="p-4 bg-white border-t flex flex-wrap gap-2">
               <button onClick={() => setSelectedSaleForPrint(null)} className="flex-1 py-3 bg-slate-100 text-slate-600 font-bold rounded-xl hover:bg-slate-200 text-sm">ပိတ်မည်</button>
               <button onClick={() => handlePrint('A4')} className="flex-1 py-3 bg-indigo-600 text-white font-black rounded-xl hover:bg-indigo-700 shadow-md text-sm">📄 A4 ထုတ်မည် / PDF</button>
               <button onClick={() => handlePrint('THERMAL')} className="flex-1 py-3 bg-orange-500 text-white font-black rounded-xl hover:bg-orange-600 shadow-md text-sm">🖨️ BT Printer</button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 🌟 🌟 PRINT TEMPLATES (ဖျောက်ထားပြီး Print နှိပ်မှသာ ပေါ်မည်) 🌟 🌟 🌟 */}
      {selectedSaleForPrint && (
        <div className="hidden print:block bg-white text-black print:w-full print:m-0 print:p-0 absolute top-0 left-0 w-full h-full z-[9999]">
          
          {/* ----- A4 TEMPLATE ----- */}
          {printType === 'A4' && (
            <div className="max-w-[800px] mx-auto p-10 bg-white">
              {/* Header Section */}
              <div className="flex flex-col items-center text-center border-b-2 border-black pb-6 mb-6">
                <img src="/logo.png" alt="SSY Logo" className="w-24 h-24 object-contain mb-2 grayscale" />
                <h1 className="text-3xl font-black mb-1 tracking-wider uppercase">စက်စက်ယို စားသောက်ကုန်</h1>
                <p className="text-sm font-bold text-gray-600">No.(TaTa 43/32), 54 B, 124x125, PyigyiTagon, Mandalay.</p>
                <p className="text-sm font-bold text-gray-600">Ph: 09-455557980</p>
                
                {/* Barcode Generated via TEC-IT free API */}
                <div className="mt-4">
                  <img src={`https://barcode.tec-it.com/barcode.ashx?data=${selectedSaleForPrint.id}&code=Code128&dpi=96&dataseparator=`} alt="Barcode" className="h-12" />
                </div>
              </div>

              {/* Info Section */}
              <div className="flex justify-between mb-8 text-sm font-bold">
                <div className="space-y-2">
                  <div><span className="w-32 inline-block text-gray-600">Invoice No:</span> <span className="font-black">#{selectedSaleForPrint.id}</span></div>
                  <div><span className="w-32 inline-block text-gray-600">Date:</span> <span>{selectedSaleForPrint.date}</span></div>
                  <div><span className="w-32 inline-block text-gray-600">Customer Name:</span> <span className="font-black text-base">{selectedSaleForPrint.customerName}</span></div>
                  <div><span className="w-32 inline-block text-gray-600">Address:</span> <span>{selectedSaleForPrint.address || '-'}</span></div>
                  <div><span className="w-32 inline-block text-gray-600">Phone:</span> <span>{selectedSaleForPrint.phone || '-'}</span></div>
                </div>
                <div className="space-y-2 text-right">
                  <div><span className="text-gray-600 mr-2">Staff:</span> <span>{selectedSaleForPrint.salespersonName}</span></div>
                  <div><span className="text-gray-600 mr-2">Payment Method:</span> <span className="font-black uppercase">{selectedSaleForPrint.paymentMethod}</span></div>
                  {!selectedSaleForPrint.isPaid && selectedSaleForPrint.creditTerms && (
                    <div className="text-red-600 border border-red-600 px-2 py-1 rounded inline-block mt-1">
                      Due Date: <span className="font-black">{calculateDueDate(selectedSaleForPrint.date, selectedSaleForPrint.creditTerms)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Items Table */}
              <table className="w-full text-left mb-6 border-collapse">
                <thead>
                  <tr className="border-b-2 border-black">
                    <th className="py-2 font-bold w-12 text-center">No.</th>
                    <th className="py-2 font-bold">Description</th>
                    <th className="py-2 font-bold text-center w-24">Qty</th>
                    <th className="py-2 font-bold text-right w-32">Price (Ks)</th>
                    <th className="py-2 font-bold text-right w-32">Amount (Ks)</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedSaleForPrint.items.map((item, idx) => (
                    <tr key={idx} className="border-b border-gray-300">
                      <td className="py-3 text-center">{idx + 1}</td>
                      <td className="py-3 font-bold">{item.product.category} <span className="text-xs text-gray-500 block">{item.product.taste} ({item.product.gram}g)</span></td>
                      <td className="py-3 text-center font-black">{item.quantity}</td>
                      <td className="py-3 text-right">{item.product.price.toLocaleString()}</td>
                      <td className="py-3 text-right font-black">{item.subtotal.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Totals Section */}
              <div className="flex justify-end mb-16">
                <div className="w-72 space-y-2 text-sm font-bold">
                  <div className="flex justify-between border-b border-gray-200 pb-1">
                    <span className="text-gray-600">Subtotal:</span>
                    <span>{selectedSaleForPrint.totalAmount.toLocaleString()} Ks</span>
                  </div>
                  {Number(selectedSaleForPrint.discountPercent) > 0 && (
                     <div className="flex justify-between border-b border-gray-200 pb-1 text-red-600">
                       <span>Discount ({selectedSaleForPrint.discountPercent}%):</span>
                       <span>- {((selectedSaleForPrint.totalAmount * Number(selectedSaleForPrint.discountPercent)) / 100).toLocaleString()} Ks</span>
                     </div>
                  )}
                  {Number(selectedSaleForPrint.taxPercent) > 0 && (
                     <div className="flex justify-between border-b border-gray-200 pb-1 text-blue-600">
                       <span>Tax ({selectedSaleForPrint.taxPercent}%):</span>
                       <span>+ {(((selectedSaleForPrint.totalAmount - (selectedSaleForPrint.totalAmount * Number(selectedSaleForPrint.discountPercent||0))/100) * Number(selectedSaleForPrint.taxPercent)) / 100).toLocaleString()} Ks</span>
                     </div>
                  )}
                  <div className="flex justify-between pt-2">
                    <span className="text-xl font-black">Total Amount:</span>
                    <span className="text-xl font-black">{selectedSaleForPrint.finalAmount.toLocaleString()} Ks</span>
                  </div>
                </div>
              </div>

              {/* Signatures */}
              <div className="flex justify-between px-10">
                 <div className="text-center border-t border-black w-48 pt-2 font-bold text-sm">Customer Signature</div>
                 <div className="text-center border-t border-black w-48 pt-2 font-bold text-sm">Authorized Signature</div>
              </div>
            </div>
          )}

          {/* ----- THERMAL 80mm TEMPLATE ----- */}
          {printType === 'THERMAL' && (
            <div className="w-[80mm] mx-auto p-4 bg-white text-black font-sans text-xs">
              <div className="text-center mb-4 border-b-2 border-dashed border-black pb-4">
                <img src="/logo.png" alt="SSY Logo" className="w-16 h-16 object-contain mx-auto mb-1 grayscale" />
                <h2 className="text-lg font-black uppercase tracking-wider mb-1">စက်စက်ယို စားသောက်ကုန်</h2>
                <p className="text-[10px] leading-tight">No. 54 B, 124x125, PyigyiTagon</p>
                <p className="text-[10px] leading-tight mb-2">Ph: 09-455557980</p>
                <img src={`https://barcode.tec-it.com/barcode.ashx?data=${selectedSaleForPrint.id}&code=Code128&dpi=96&dataseparator=`} alt="Barcode" className="h-8 mx-auto" />
              </div>

              <div className="mb-3 text-[11px] font-bold space-y-1 border-b-2 border-dashed border-black pb-3">
                <div className="flex justify-between"><span>Inv:</span> <span>#{selectedSaleForPrint.id}</span></div>
                <div className="flex justify-between"><span>Date:</span> <span>{selectedSaleForPrint.date}</span></div>
                <div className="flex justify-between"><span>Cust:</span> <span className="uppercase">{selectedSaleForPrint.customerName}</span></div>
                <div className="flex justify-between"><span>Pay:</span> <span className="uppercase">{selectedSaleForPrint.paymentMethod}</span></div>
                {!selectedSaleForPrint.isPaid && selectedSaleForPrint.creditTerms && (
                  <div className="flex justify-between text-black border border-black p-1 mt-1 text-center font-black">
                    DUE DATE: {calculateDueDate(selectedSaleForPrint.date, selectedSaleForPrint.creditTerms)}
                  </div>
                )}
              </div>

              <div className="mb-3 border-b-2 border-dashed border-black pb-3">
                <div className="flex justify-between font-black border-b border-black pb-1 mb-2 text-[11px]">
                  <span className="w-2/3">Description</span>
                  <span className="w-1/3 text-right">Amount</span>
                </div>
                {selectedSaleForPrint.items.map((item, idx) => (
                  <div key={idx} className="mb-2 text-[11px]">
                    <div className="font-bold">{item.product.category} ({item.product.gram}g)</div>
                    <div className="flex justify-between text-[10px]">
                      <span>{item.quantity} x {item.product.price}</span>
                      <span className="font-black">{item.subtotal.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
              </div>

              <div className="space-y-1 text-[11px] font-bold border-b-2 border-dashed border-black pb-3 mb-4">
                <div className="flex justify-between"><span>Subtotal:</span> <span>{selectedSaleForPrint.totalAmount.toLocaleString()}</span></div>
                {Number(selectedSaleForPrint.discountPercent) > 0 && (
                  <div className="flex justify-between"><span>Discount ({selectedSaleForPrint.discountPercent}%):</span> <span>- {((selectedSaleForPrint.totalAmount * Number(selectedSaleForPrint.discountPercent)) / 100).toLocaleString()}</span></div>
                )}
                {Number(selectedSaleForPrint.taxPercent) > 0 && (
                  <div className="flex justify-between"><span>Tax ({selectedSaleForPrint.taxPercent}%):</span> <span>+ {(((selectedSaleForPrint.totalAmount - (selectedSaleForPrint.totalAmount * Number(selectedSaleForPrint.discountPercent||0))/100) * Number(selectedSaleForPrint.taxPercent)) / 100).toLocaleString()}</span></div>
                )}
                <div className="flex justify-between text-sm font-black pt-1 mt-1 border-t border-black">
                  <span>TOTAL:</span> <span>{selectedSaleForPrint.finalAmount.toLocaleString()} Ks</span>
                </div>
              </div>

              <div className="text-center text-[10px] font-bold">
                <p>Thank you for your business!</p>
                <p>--- SSY ERP ---</p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
