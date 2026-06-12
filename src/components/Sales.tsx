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

  const filteredSales = sales.filter(sale => String(sale?.customerName || '').toLowerCase().includes(searchTerm.toLowerCase()) || String(sale?.id || '').toLowerCase().includes(searchTerm.toLowerCase()));
  const visibleSalesToRender = filteredSales.slice(0, displayLimit);

  return (
    <div className="p-2 md:p-6 h-full overflow-y-auto">
      {/* Header Area - Mobile မှာ ပိုကျစ်လျစ်အောင် ပြင်ထားသည် */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 md:mb-6 border-b-2 pb-3 md:pb-4 border-amber-200 gap-3 md:gap-4">
        <h2 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-2"><span className="text-2xl md:text-4xl">💰</span> အရောင်းပိုင်း (POS)</h2>
        <div className="flex gap-2 bg-white p-1 rounded-xl shadow-sm border border-slate-200 w-full md:w-auto">
          <button onClick={() => setActiveTab('pos')} className={`flex-1 md:flex-none px-4 py-2 md:px-6 md:py-2.5 rounded-lg font-bold text-xs md:text-base ${activeTab === 'pos' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>🛒 ဘောက်ချာဖြတ်မည်</button>
          <button onClick={() => setActiveTab('records')} className={`flex-1 md:flex-none px-4 py-2 md:px-6 md:py-2.5 rounded-lg font-bold text-xs md:text-base ${activeTab === 'records' ? 'bg-amber-500 text-white shadow-md' : 'text-slate-600 hover:bg-slate-100'}`}>📜 မှတ်တမ်းများ</button>
        </div>
      </div>

      {activeTab === 'pos' && (
        <div className="flex flex-col lg:flex-row gap-4 md:gap-6">
          {/* ကုန်ချောပစ္စည်းများ ရွေးချယ်ရန် နေရာ */}
          <div className="flex-[2] bg-white p-3 md:p-6 rounded-2xl md:rounded-[2rem] shadow-sm border border-slate-200">
            <h3 className="text-sm md:text-xl font-bold text-slate-800 mb-3 md:mb-6">ရောင်းရန်အသင့်ရှိသော ကုန်ချောများ</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2 md:gap-4">
              {finishedGoods.map(fg => (
                <div key={fg.id} onClick={() => handleAddToCart(fg)} className={`relative p-2.5 md:p-4 rounded-xl border-2 cursor-pointer transition-all active:scale-95 ${fg.stockQty > 0 ? 'bg-white border-slate-200 hover:border-amber-400 hover:shadow-md' : 'bg-slate-100 border-slate-200 opacity-60'}`}>
                  <div className="absolute top-1.5 right-1.5 md:top-2 md:right-2 text-[9px] md:text-xs font-black px-1.5 py-0.5 md:px-2 md:py-1 rounded bg-slate-800 text-white">Stock: {fg.stockQty}</div>
                  <div className="mt-4 md:mt-5 text-[10px] md:text-sm font-bold text-slate-500 truncate">{fg.category}</div>
                  <div className="text-sm md:text-lg font-black text-slate-800 leading-tight truncate">{fg.taste} <span className="text-amber-600 text-[10px] md:text-sm">({fg.gram}g)</span></div>
                  <div className="mt-1.5 md:mt-3 text-emerald-600 font-black text-sm md:text-xl">{fg.price.toLocaleString()} Ks</div>
                </div>
              ))}
            </div>
          </div>

          {/* Cart စာရင်း နေရာ */}
          <div className="flex-1 bg-white p-3 md:p-6 rounded-2xl md:rounded-[2rem] shadow-xl border border-slate-200 flex flex-col h-full sticky top-2 md:top-4">
            <div className="flex justify-between items-center border-b pb-2 md:pb-4 mb-3 md:mb-4">
               <h3 className="text-base md:text-xl font-black text-slate-800">🛒 စာရင်း</h3>
               <span className="text-xs md:text-sm font-bold text-slate-400">{cart.length} မျိုး</span>
            </div>

            <div className="flex-1 overflow-y-auto mb-4 md:mb-6 space-y-2 md:space-y-3 min-h-[200px] md:min-h-[300px]">
              {cart.map((item, idx) => (
                <div key={idx} className="flex flex-col bg-slate-50 p-2 md:p-3 rounded-xl border border-slate-200">
                  <div className="flex justify-between items-center mb-1.5 md:mb-2 border-b border-slate-200/50 pb-1.5 md:pb-2">
                    <span className="font-bold text-slate-800 text-[11px] md:text-sm truncate mr-2">{item.product.category} ({item.product.taste}) {item.product.gram}g</span>
                    <button onClick={() => removeFromCart(item.product.id)} className="text-slate-400 hover:text-red-500 font-bold text-xs md:text-base">✕</button>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-amber-700 font-black text-xs md:text-base">{item.product.price.toLocaleString()} Ks</span>
                    <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg px-1.5 py-0.5 md:px-2 md:py-1 shadow-sm">
                      <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity - 1).toString())} className="w-5 md:w-6 font-black text-slate-600 hover:text-amber-600">-</button>
                      <input type="number" value={item.quantity || ''} onChange={(e) => handleUpdateCartQty(item.product.id, e.target.value)} className="w-8 md:w-10 text-center font-black outline-none bg-transparent text-xs md:text-base" />
                      <button onClick={() => handleUpdateCartQty(item.product.id, (item.quantity + 1).toString())} className="w-5 md:w-6 font-black text-slate-600 hover:text-amber-600">+</button>
                    </div>
                  </div>
                </div>
              ))}
              {cart.length === 0 && <div className="text-center text-slate-400 font-bold mt-6 md:mt-10 text-xs md:text-base">ပစ္စည်းများ ရွေးချယ်ပါ</div>}
            </div>

            <div className="border-t-2 border-dashed border-slate-200 pt-3 md:pt-4 space-y-3 md:space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-slate-500 font-bold text-xs md:text-base">စုစုပေါင်း</span>
                <span className="text-lg md:text-2xl font-black text-emerald-600">{totalAmount.toLocaleString()} Ks</span>
              </div>
              <button onClick={() => { if(cart.length > 0) setIsCheckoutModalOpen(true); else alert("ပစ္စည်းထည့်ပါ"); }} className="w-full bg-emerald-500 text-white py-3 md:py-4 rounded-xl font-black text-sm md:text-lg shadow-md hover:bg-emerald-600 active:scale-95 transition-all">
                ငွေရှင်းမည်
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Checkout Modal - Mobile အတွက် ကျစ်လျစ်အောင် ပြင်ထားသည် */}
      {isCheckoutModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 p-2 md:p-4 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[95vh] md:max-h-[90vh]">
            <div className="bg-slate-800 p-3 md:p-4 flex justify-between items-center shrink-0">
              <h3 className="text-white font-black text-base md:text-xl flex items-center gap-2"><span>🧾</span> ငွေရှင်းရန်</h3>
              <button onClick={() => setIsCheckoutModalOpen(false)} className="text-slate-300 hover:text-white font-bold text-lg md:text-xl px-2">✕</button>
            </div>
            
            <div className="p-4 md:p-6 overflow-y-auto space-y-4 md:space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                <div className="relative">
                  <label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">ဝယ်သူအမည် *</label>
                  <input type="text" value={customerName} onChange={e => { setCustomerName(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 200)} className="w-full bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-lg outline-none focus:border-emerald-500 font-bold text-sm" placeholder="အမည်ရိုက်ထည့်ပါ..." />
                  {showSuggestions && customerName && (
                    <ul className="absolute z-50 w-full bg-white border border-slate-200 rounded-lg shadow-xl mt-1 max-h-48 overflow-y-auto">
                      {customers.filter(c => c.name.toLowerCase().includes(customerName.toLowerCase())).map(c => (
                        <li key={c.id} onMouseDown={(e) => { e.preventDefault(); setCustomerName(c.name); setPhone(c.phone); setShopType(c.shopType || 'Company (ကုမ္ပဏီ)'); setAddress(c.address); setGpsLocation(c.gpsLocation); setShowSuggestions(false); }} className="p-2 md:p-3 hover:bg-emerald-50 cursor-pointer border-b last:border-b-0">
                          <div className="font-bold text-slate-800 text-xs md:text-sm">{c.name}</div>
                          <div className="text-[10px] md:text-xs text-slate-500">{c.phone} | {c.shopType}</div>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div><label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">ဆိုင်အမျိုးအစား</label><input type="text" list="shop-types" value={shopType} onChange={e => setShopType(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-lg outline-none focus:border-emerald-500 font-bold text-slate-700 text-sm" placeholder="ရွေးချယ်ပါ..." />
                  <datalist id="shop-types"><option value="Company (ကုမ္ပဏီ)" /><option value="Distribution (ဖြန့်ချိရေး)" /><option value="ကျောင်းဈေးဆိုင်" /><option value="လက်လီဆိုင်" /><option value="လက်ကားဆိုင်" /></datalist>
                </div>
                <div><label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">ဖုန်းနံပါတ်</label><input type="text" value={phone} onChange={e => setPhone(e.target.value)} placeholder="09..." className="w-full bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-lg outline-none focus:border-emerald-500 text-sm" /></div>
                <div><label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">လိပ်စာ</label><input type="text" value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-slate-50 border border-slate-200 p-2.5 md:p-3 rounded-lg outline-none focus:border-emerald-500 text-sm" /></div>
                <div className="md:col-span-2"><label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1">GPS (Location ဆွဲယူရန် 📍 ကို နှိပ်ပါ)</label><div className="relative"><input type="text" value={gpsLocation} onChange={e => setGpsLocation(e.target.value)} placeholder="Latitude, Longitude" className="w-full bg-slate-50 border border-slate-200 p-2.5 md:p-3 pr-10 rounded-lg outline-none focus:border-emerald-500 text-sm" /><button type="button" onClick={fetchLocation} title="Get Current Location" className="absolute right-3 top-1/2 -translate-y-1/2 text-rose-500 font-bold text-lg hover:scale-125 transition-transform active:scale-95">📍</button></div></div>
              </div>

              <div className="grid grid-cols-2 gap-3 md:gap-4">
                <div className="bg-emerald-50 p-2.5 md:p-3 rounded-xl border border-emerald-100"><label className="block text-[10px] md:text-xs font-black text-emerald-600 mb-1">လျှော့ဈေး (%)</label><input type="number" step="0.01" value={discountPercent} onChange={e => setDiscountPercent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-emerald-700 text-base md:text-lg" placeholder="0.0" /></div>
                <div className="bg-rose-50 p-2.5 md:p-3 rounded-xl border border-rose-100"><label className="block text-[10px] md:text-xs font-black text-rose-600 mb-1">အခွန် (%)</label><input type="number" step="0.01" value={taxPercent} onChange={e => setTaxPercent(e.target.value === '' ? '' : Number(e.target.value))} className="w-full bg-transparent outline-none font-black text-rose-700 text-base md:text-lg" placeholder="0.0" /></div>
              </div>

              <div>
                <label className="block text-[10px] md:text-xs font-bold text-slate-500 mb-1.5 uppercase tracking-wider">Payment Method</label>
                <div className="grid grid-cols-3 gap-1.5 md:gap-2">
                  {['CASH', 'KPAY', 'WAVE PAY', 'UAB PAY', 'AYA PAY', 'CREDIT'].map(method => (
                    <button key={method} onClick={() => setPaymentMethod(method)} className={`p-1.5 md:p-2 rounded-lg font-bold text-[10px] md:text-xs border-2 transition-all ${paymentMethod === method ? 'border-emerald-500 text-emerald-700 bg-emerald-50' : 'border-slate-200 text-slate-500 hover:bg-slate-50'}`}>{method}</button>
                  ))}
                </div>
              </div>

              {paymentMethod === 'CREDIT' && (
                <div className="bg-amber-50 p-3 md:p-4 rounded-xl border border-amber-200">
                  <label className="block text-[10px] md:text-xs font-black text-amber-700 mb-1.5">⏳ အကြွေးသက်တမ်း:</label>
                  <select value={creditTerms} onChange={e => setCreditTerms(e.target.value)} className="w-full p-2 md:p-2.5 rounded-lg border border-amber-300 outline-none font-bold text-amber-900 mb-2 bg-white text-xs md:text-sm">
                    <option value="1 Day (၁ ရက်)">1 Day (၁ ရက်)</option><option value="3 Days (၃ ရက်)">3 Days (၃ ရက်)</option><option value="7 Days (၇ ရက်)">7 Days (၇ ရက်)</option><option value="15 Days (၁၅ ရက်)">15 Days (၁၅ ရက်)</option><option value="1 Month (၁ လ)">1 Month (၁ လ)</option><option value="Custom">Custom (စိတ်ကြိုက်ရက်)</option>
                  </select>
                  {creditTerms === 'Custom' && (
                     <div className="flex items-center gap-2"><input type="number" placeholder="ဥပမာ - 8" value={customCreditDays} onChange={e => setCustomCreditDays(e.target.value)} className="w-full p-2 md:p-2.5 rounded-lg border border-amber-300 outline-none font-black text-amber-900 bg-white text-xs md:text-sm" /><span className="font-bold text-amber-800 text-xs md:text-sm">ရက် (Days)</span></div>
                  )}
                </div>
              )}

              <div className="bg-slate-50 p-3 md:p-4 rounded-xl border border-slate-200 flex justify-between items-center"><span className="font-bold text-slate-600 text-xs md:text-base">ကျသင့်ငွေ:</span><span className="text-xl md:text-3xl font-black text-slate-800">{finalAmount.toLocaleString()} Ks</span></div>
            </div>

            <div className="p-3 md:p-4 bg-white border-t flex gap-2 md:gap-3 shrink-0">
              <button onClick={() => setIsCheckoutModalOpen(false)} className="flex-1 py-2 md:py-3 rounded-xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-colors text-sm md:text-base">Cancel</button>
              <button onClick={handleCheckoutSubmit} className="flex-[2] py-2 md:py-3 rounded-xl font-black text-white bg-emerald-500 hover:bg-emerald-600 shadow-md active:scale-95 transition-all text-sm md:text-base">အတည်ပြုမည်</button>
            </div>
          </div>
        </div>
      )}

      {/* မှတ်တမ်း UI - Mobile တွင် ကျစ်လျစ်အောင် ပြင်ထားသည် */}
      {activeTab === 'records' && (
        <div className="space-y-4 md:space-y-6">
           <div className="relative w-full md:max-w-sm"><span className="absolute left-3 top-2.5 md:top-3 text-slate-400">🔍</span><input type="text" className="w-full pl-9 pr-4 py-2 md:py-3 bg-white border border-slate-200 rounded-xl shadow-sm outline-none focus:border-amber-500 text-sm md:text-base" placeholder="ဘောက်ချာ / အမည် ရှာရန်..." value={searchTerm} onChange={e => { setSearchTerm(e.target.value); setDisplayLimit(50); }} /></div>
           <div className="grid gap-3 md:gap-4">
            {visibleSalesToRender.map(sale => (
              <div key={sale.id} className="bg-white p-3 md:p-5 rounded-xl md:rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-2 md:gap-4 hover:shadow-md transition-shadow">
                <div className="w-full md:w-auto">
                  <div className="flex justify-between md:justify-start gap-2 items-center mb-1">
                    <div className="flex gap-2 items-center">
                      <span className="text-[10px] md:text-xs font-black bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">#{sale.id}</span>
                      <span className={`text-[10px] md:text-xs font-black px-1.5 py-0.5 rounded border ${sale.isPaid ? 'bg-emerald-50 text-emerald-600 border-emerald-200' : 'bg-rose-50 text-rose-600 border-rose-200'}`}>{sale.isPaid ? `✅ ${sale.paymentMethod}` : `⏳ အကြွေး (${sale.creditTerms})`}</span>
                    </div>
                    {/* Mobile တွင် ဈေးနှုန်းကို ညာဘက်အပေါ်သို့ ရွှေ့ပြသမည် */}
                    <div className="text-sm font-black text-amber-600 md:hidden">{sale.finalAmount.toLocaleString()} Ks</div>
                  </div>
                  <h3 className="text-sm md:text-lg font-black text-slate-800">👤 {sale.customerName} <span className="text-[10px] md:text-sm font-medium text-slate-500">({sale.phone})</span></h3>
                  
                  <div className="text-[10px] md:text-xs text-slate-500 font-bold mt-1 leading-relaxed">
                    📅 {sale.date} | 🏷️ {sale.salespersonName} <br/>
                    🏢 {sale.shopType} {sale.address ? `| 🏠 ${sale.address}` : ''}
                    {sale.gps && (
                      <a href={`http://googleusercontent.com/maps.google.com/?q=${sale.gps}`} target="_blank" rel="noreferrer" className="text-blue-500 hover:text-blue-700 hover:underline ml-2 inline-flex items-center gap-1">📍 မြေပုံကြည့်ရန်</a>
                    )}
                  </div>
                </div>
                
                <div className="text-right w-full md:w-auto border-t border-slate-100 md:border-0 pt-2 md:pt-0 mt-1 md:mt-0 flex justify-between md:flex-col items-center md:items-end">
                  <div className="text-2xl font-black text-amber-600 mb-2 hidden md:block">{sale.finalAmount.toLocaleString()} Ks</div>
                  <div className="flex gap-1.5 md:gap-2 justify-end w-full md:w-auto">
                     {!sale.isPaid && isManager && <button onClick={() => { if(window.confirm('ငွေလက်ခံရရှိပြီလား?')) onMarkAsPaid(sale.id); }} className="px-2 py-1 md:px-3 md:py-1.5 bg-emerald-500 text-white font-bold rounded-lg text-[10px] md:text-xs hover:bg-emerald-600">ငွေရှင်းမည်</button>}
                     <button onClick={() => window.print()} className="px-2 py-1 md:px-3 md:py-1.5 bg-slate-100 text-slate-600 font-bold rounded-lg text-[10px] md:text-xs hover:bg-slate-200">🖨️ Print</button>
                     {isMDOnly && <button onClick={() => { if(window.confirm('ဖျက်ရန် သေချာပါသလား?')) onDeleteSale(sale.id); }} className="px-2 py-1 md:px-3 md:py-1.5 bg-red-50 text-red-600 font-bold rounded-lg text-[10px] md:text-xs hover:bg-red-500 hover:text-white transition-colors">ဖျက်မည်</button>}
                  </div>
                </div>
              </div>
            ))}
            {visibleSalesToRender.length === 0 && <div className="p-6 md:p-8 text-center text-slate-400 font-bold bg-white rounded-2xl border border-dashed text-xs md:text-base">မှတ်တမ်း မရှိသေးပါ။</div>}
          </div>
        </div>
      )}
    </div>
  );
};
