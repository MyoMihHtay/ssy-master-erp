import React, { useState } from 'react';
import type { PurchaseRequest, SupplierOption } from '../App';

interface ProcurementProps {
  userRole: string;
  requests: PurchaseRequest[];
  setRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
}

export const Procurement: React.FC<ProcurementProps> = ({ userRole, requests, setRequests }) => {
  const [itemName, setItemName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [unit, setUnit] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([
    { id: '1', name: '', price: 0, qualityDesc: '', analysisNote: '', photo: '', quotationImage: '' }
  ]);
  
  // ပုံအကြီးပြရန်အတွက် State
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md' || userRole === 'manager';
  const isFinance = userRole === 'finance' || userRole === 'md' || userRole === 'manager';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleAddSupplier = () => {
    if (suppliers.length < 3) {
      setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', photo: '', quotationImage: '' }]);
    } else {
      alert('အများဆုံး Supplier ၃ ခုသာ ယှဉ်ပြနိုင်ပါသည်။');
    }
  };

  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => {
    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: value };
    setSuppliers(updated);
  };

  const handleImageUpload = (index: number, field: 'photo' | 'quotationImage', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSupplierChange(index, field, reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty || !unit || suppliers.length === 0) return alert('အချက်အလက် ပြည့်စုံစွာ ဖြည့်ပါ။');
    
    const newPR: PurchaseRequest = {
      id: Date.now(),
      date: new Date().toLocaleDateString('en-GB'),
      itemName,
      requestedQty: Number(requestedQty),
      unit,
      suppliers,
      status: 'Pending'
    };
    setRequests([newPR, ...requests]);
    setItemName(''); setRequestedQty(''); setUnit(''); 
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', photo: '', quotationImage: '' }]);
    alert('✅ ဝယ်ယူခွင့် တင်ပြခြင်း အောင်မြင်ပါသည်။');
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string, reason?: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId, rejectReason: reason || r.rejectReason } : r));
  };

  const handleReject = (id: number) => {
    const reason = window.prompt("ပယ်ချရသည့် အကြောင်းရင်းကို ရေးပါ -");
    if (reason) {
      updateStatus(id, 'Rejected', undefined, reason);
    }
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-bold border border-orange-200 shadow-sm print:border-none print:shadow-none">⏳ Pending (QC စစ်ဆေးရန်)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-200 shadow-sm print:border-none print:shadow-none">🔬 QC Pass (Finance စစ်ဆေးရန်)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold border border-purple-200 shadow-sm print:border-none print:shadow-none">💰 Finance Pass (MD အတည်ပြုရန်)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-bold border border-green-200 shadow-sm print:border-none print:shadow-none">✅ MD ခွင့်ပြုပြီး</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold border border-red-200 shadow-sm print:border-none print:shadow-none">❌ ပယ်ချထားသည်</span>;
      default: return null;
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span>
        <div>
          <h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် အဆင့်ဆင့် အတည်ပြုစနစ် (Procurement & Tender)</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Purchasing ➔ QC ➔ Finance ➔ MD / Manager</p>
        </div>
      </div>
      
      {/* Form (Print ထုတ်လျှင် ဖျောက်ထားမည်) */}
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-indigo-600 print:hidden">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span>📝</span> ဝယ်ယူခွင့် တောင်းခံလွှာ အသစ် (PR)</h3>
             <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 transition shadow-sm border border-indigo-200">+ Supplier နှိုင်းယှဉ်ရန် ထပ်ထည့်မည်</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ဝယ်ယူမည့် ပစ္စည်းအမည်</label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 transition-colors outline-none" placeholder="ဥပမာ - ကြက်သွန်နီ" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">အရေအတွက် (Quantity)</label>
              <input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 transition-colors outline-none" placeholder="ဥပမာ - ၁၀၀" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ယူနစ် (Unit)</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 transition-colors outline-none" placeholder="ဥပမာ - ပိဿာ / ခု / ပုလင်း" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-5 rounded-2xl bg-white hover:border-indigo-400 transition-colors shadow-sm">
                <h4 className="font-extrabold text-indigo-800 mb-4 border-b pb-2 text-lg">Supplier {idx + 1}</h4>
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">ဆိုင်အမည် / ပွဲရုံ</label>
                    <input type="text" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border-b-2 border-gray-200 p-2 focus:border-indigo-500 outline-none text-base font-bold text-gray-800" placeholder="ဆိုင်အမည်" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">ဈေးနှုန်း (Ks)</label>
                    <input type="number" value={sup.price || ''} onChange={e => handleSupplierChange(idx, 'price', Number(e.target.value))} required className="w-full border-b-2 border-gray-200 p-2 focus:border-indigo-500 outline-none text-lg font-black text-red-600" placeholder="0" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">အရည်အသွေး (Quality & Taste)</label>
                    <textarea value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border-2 border-gray-100 p-3 rounded-xl text-sm h-20 focus:border-indigo-500 outline-none bg-gray-50" placeholder="အရည်အသွေး၊ အရောင်၊ အနံ့" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-gray-500 uppercase tracking-wide">နှိုင်းယှဉ်သုံးသပ်ချက် (Analysis Note)</label>
                    <textarea value={sup.analysisNote} onChange={e => handleSupplierChange(idx, 'analysisNote', e.target.value)} className="w-full border-2 border-gray-100 p-3 rounded-xl text-sm h-20 focus:border-indigo-500 outline-none bg-gray-50" placeholder="အခြားဆိုင်နှင့်စာလျှင် အားသာချက်/အားနည်းချက်" />
                  </div>
                  
                  {/* Photo Uploads */}
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <label className="cursor-pointer bg-white border-2 border-gray-200 p-3 rounded-xl text-center text-xs font-bold hover:bg-gray-50 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-1 shadow-sm">
                      <span className="text-lg">📸</span> 
                      <span>Take Photo (ပုံရိုက်မည်)</span>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(idx, 'photo', e)} className="hidden" />
                      {sup.photo && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded mt-1">✓ ထည့်ပြီးပါပြီ</span>}
                    </label>
                    <label className="cursor-pointer bg-white border-2 border-gray-200 p-3 rounded-xl text-center text-xs font-bold hover:bg-gray-50 hover:border-indigo-300 transition-all flex flex-col items-center justify-center gap-1 shadow-sm">
                      <span className="text-lg">📄</span> 
                      <span>Quotation ပုံထည့်မည်</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, 'quotationImage', e)} className="hidden" />
                      {sup.quotationImage && <span className="text-green-600 bg-green-50 px-2 py-0.5 rounded mt-1">✓ ထည့်ပြီးပါပြီ</span>}
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-colors text-lg tracking-wider">
            အတည်ပြုချက် စတင်တောင်းခံမည် 🚀
          </button>
        </form>
      )}

      {/* Approval Board */}
      <div className="space-y-8">
        <h3 className="text-2xl font-black text-gray-800 border-l-4 border-indigo-600 pl-4 print:hidden">တင်ပြထားသော ဝယ်ယူခွင့်များ (Approval Board)</h3>
        {requests.map(req => (
          <div key={req.id} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 print:shadow-none print:border-gray-400 print:mb-8">
            {/* Card Header */}
            <div className="bg-gray-800 p-6 flex flex-col md:flex-row justify-between md:items-center gap-4 print:bg-gray-100 print:border-b print:border-gray-400">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <span className="text-xs font-bold text-gray-400 bg-gray-700 px-3 py-1 rounded-full uppercase tracking-widest print:text-gray-600 print:bg-transparent print:p-0">PR Date: {req.date}</span>
                   {getStatusBadge(req.status)}
                </div>
                <h4 className="text-3xl font-black text-white flex items-center gap-3 print:text-black">
                  {req.itemName}
                  <span className="bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xl border border-indigo-400 shadow-inner print:bg-white print:text-black print:border-gray-400">
                    {req.requestedQty.toLocaleString()} <span className="text-base font-medium">{req.unit}</span>
                  </span>
                </h4>
              </div>
              <div className="flex flex-col items-end gap-2">
                 {/* Print Button */}
                 <button onClick={() => window.print()} className="bg-white/10 hover:bg-white/20 text-white border border-white/20 px-4 py-2 rounded-xl font-bold transition flex items-center gap-2 print:hidden">
                   🖨️ Print ထုတ်မည်
                 </button>
              </div>
            </div>

            {/* Reject Reason Display */}
            {req.status === 'Rejected' && req.rejectReason && (
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3">
                 <span className="text-2xl">⚠️</span>
                 <div>
                    <h5 className="font-bold text-red-800 text-sm uppercase tracking-wide">ပယ်ချရသည့် အကြောင်းရင်း</h5>
                    <p className="text-red-600 font-medium">{req.rejectReason}</p>
                 </div>
              </div>
            )}

            {/* Suppliers Grid */}
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-gray-50 print:bg-white">
              {req.suppliers.map((sup) => (
                <div key={sup.id} className={`border-2 p-6 rounded-2xl relative transition-all bg-white ${req.selectedSupplierId === sup.id ? 'border-green-500 shadow-xl ring-4 ring-green-50 transform scale-[1.02] print:border-green-600 print:ring-0 print:scale-100' : 'border-gray-200'}`}>
                  {req.selectedSupplierId === sup.id && (
                    <div className="absolute -top-4 -right-4 bg-green-500 text-white w-10 h-10 flex justify-center items-center rounded-full font-black shadow-lg border-4 border-white print:border-gray-400">✓</div>
                  )}
                  
                  <h5 className="font-black text-xl text-gray-800 mb-2">{sup.name}</h5>
                  <div className="text-red-600 font-black text-3xl mb-6">{sup.price.toLocaleString()} <span className="text-base text-gray-500">Ks</span></div>
                  
                  <div className="space-y-4 mb-6">
                     <div>
                       <div className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5">အရည်အသွေး (Quality & Taste)</div>
                       <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 leading-relaxed print:border-gray-300">{sup.qualityDesc}</p>
                     </div>
                     {sup.analysisNote && (
                       <div>
                         <div className="text-xs font-bold text-blue-400 uppercase tracking-widest mb-1.5">သုံးသပ်ချက် (Analysis Note)</div>
                         <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-xl border border-blue-100 leading-relaxed font-medium print:border-gray-300 print:text-black">{sup.analysisNote}</p>
                       </div>
                     )}
                  </div>

                  {/* Images with Lightbox trigger */}
                  <div className="flex gap-3 mt-4 print:hidden">
                    {sup.photo ? (
                       <button onClick={() => setPreviewImage(sup.photo!)} className="flex-1 text-left group">
                          <div className="text-xs font-bold text-gray-500 mb-1">ပစ္စည်းပုံ</div>
                          <img src={sup.photo} alt="Product" className="w-full h-24 object-cover rounded-xl border-2 border-gray-200 group-hover:border-indigo-400 transition" title="အကြီးကြည့်ရန်နှိပ်ပါ" />
                       </button>
                    ) : <div className="flex-1 flex flex-col justify-end"><div className="h-24 bg-gray-50 flex items-center justify-center text-gray-400 text-xs rounded-xl border border-dashed">ပစ္စည်းပုံ မပါပါ</div></div>}
                    
                    {sup.quotationImage ? (
                       <button onClick={() => setPreviewImage(sup.quotationImage!)} className="flex-1 text-left group">
                          <div className="text-xs font-bold text-gray-500 mb-1">Quotation</div>
                          <img src={sup.quotationImage} alt="Quotation" className="w-full h-24 object-cover rounded-xl border-2 border-gray-200 group-hover:border-indigo-400 transition" title="အကြီးကြည့်ရန်နှိပ်ပါ" />
                       </button>
                    ) : <div className="flex-1 flex flex-col justify-end"><div className="h-24 bg-gray-50 flex items-center justify-center text-gray-400 text-xs rounded-xl border border-dashed">ဘောက်ချာ မပါပါ</div></div>}
                  </div>

                  {/* Final Approval Button for MD/Manager */}
                  {(req.status === 'Finance_Approved' || req.status === 'Pending' || req.status === 'QC_Approved') && isMDorManager && req.status !== 'MD_Approved' && req.status !== 'Rejected' && (
                    <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="mt-6 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-3.5 rounded-xl transition-colors shadow-md flex justify-center items-center gap-2 print:hidden">
                      <span className="text-xl">👑</span> ဤ ဆိုင်မှ ဝယ်မည်
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Action Bar based on Roles */}
            {req.status !== 'MD_Approved' && req.status !== 'Rejected' && (
              <div className="bg-gray-100 p-6 flex flex-wrap justify-end gap-3 items-center print:hidden border-t">
                <span className="text-sm font-bold text-gray-500 mr-auto uppercase tracking-widest">လုပ်ဆောင်ရန် (Actions)</span>
                
                {req.status === 'Pending' && isQC && (
                  <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-blue-700 transition">🔬 အရည်အသွေး မှန်ကန်သည် (Approve)</button>
                )}
                
                {req.status === 'QC_Approved' && isFinance && (
                  <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold shadow-md hover:bg-purple-700 transition">💰 ဈေးနှုန်း မှန်ကန်သည် (Approve)</button>
                )}
                
                {(isQC || isFinance || isMDorManager) && (
                   <button onClick={() => handleReject(req.id)} className="bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-50 transition shadow-sm">❌ ပယ်ချမည် (Reject)</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Image Preview Modal (Lightbox) */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 print:hidden" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full flex justify-center">
             <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
             <button onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 bg-red-600 hover:bg-red-700 text-white w-10 h-10 rounded-full font-bold text-xl shadow-lg border-2 border-white flex items-center justify-center">
               ✕
             </button>
          </div>
          <p className="absolute bottom-6 text-white/70 font-medium text-sm bg-black/50 px-4 py-2 rounded-full">ပုံကိုပိတ်ရန် နေရာလွတ်တစ်ခုခုကို နှိပ်ပါ</p>
        </div>
      )}

    </div>
  );
};
