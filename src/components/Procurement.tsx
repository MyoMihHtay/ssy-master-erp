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
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-bold border border-orange-200 shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">⏳ Pending (QC စစ်ဆေးရန်)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold border border-blue-200 shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">🔬 QC Pass (Finance စစ်ဆေးရန်)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold border border-purple-200 shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">💰 Finance Pass (MD အတည်ပြုရန်)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-bold border border-green-200 shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">✅ MD ခွင့်ပြုပြီး</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold border border-red-200 shadow-sm print:border-black print:bg-white print:text-black print:shadow-none">❌ ပယ်ချထားသည်</span>;
      default: return null;
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-6">
      
      {/* Header */}
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span>
        <div>
          <h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် အဆင့်ဆင့် အတည်ပြုစနစ် (Procurement)</h2>
        </div>
      </div>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-indigo-600 print:hidden">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span>📝</span> ဝယ်ယူခွင့် တောင်းခံလွှာ အသစ် (PR)</h3>
             <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold hover:bg-indigo-100 border border-indigo-200">+ Supplier ထပ်ထည့်မည်</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ပစ္စည်းအမည်</label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">အရေအတွက်</label>
              <input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 outline-none" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">ယူနစ် (Unit)</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl focus:border-indigo-500 outline-none" />
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-5 rounded-2xl bg-white">
                <h4 className="font-extrabold text-indigo-800 mb-4 border-b pb-2 text-lg">Supplier {idx + 1}</h4>
                <div className="space-y-4">
                  <input type="text" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border-b-2 border-gray-200 p-2 font-bold text-gray-800 outline-none" placeholder="ဆိုင်အမည်" />
                  <input type="number" value={sup.price || ''} onChange={e => handleSupplierChange(idx, 'price', Number(e.target.value))} required className="w-full border-b-2 border-gray-200 p-2 font-black text-red-600 outline-none" placeholder="ဈေးနှုန်း Ks" />
                  <textarea value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border-2 p-3 rounded-xl text-sm h-20 bg-gray-50 outline-none" placeholder="အရည်အသွေး ဖော်ပြချက်" />
                  <textarea value={sup.analysisNote} onChange={e => handleSupplierChange(idx, 'analysisNote', e.target.value)} className="w-full border-2 p-3 rounded-xl text-sm h-20 bg-gray-50 outline-none" placeholder="နှိုင်းယှဉ်သုံးသပ်ချက်" />
                  
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <label className="cursor-pointer bg-white border-2 border-gray-200 p-2 rounded-xl text-center text-xs font-bold flex flex-col items-center">
                      <span className="text-lg">📸</span> <span>Take Photo</span>
                      <input type="file" accept="image/*" capture="environment" onChange={(e) => handleImageUpload(idx, 'photo', e)} className="hidden" />
                    </label>
                    <label className="cursor-pointer bg-white border-2 border-gray-200 p-2 rounded-xl text-center text-xs font-bold flex flex-col items-center">
                      <span className="text-lg">📄</span> <span>Quotation ပုံ</span>
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, 'quotationImage', e)} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 text-lg">
            အတည်ပြုချက် တောင်းခံမည်
          </button>
        </form>
      )}

      {/* Approval Board (Print area) */}
      <div className="space-y-8 print:space-y-12">
        <h3 className="text-2xl font-black text-gray-800 border-l-4 border-indigo-600 pl-4 print:hidden">တင်ပြထားသော ဝယ်ယူခွင့်များ</h3>
        
        {requests.map(req => (
          // break-inside-avoid ကို ထည့်သွင်းထားသောကြောင့် Print ထုတ်ချိန် Box တစ်ခုထဲ ထက်ပိုင်းမပြတ်ပါ
          <div key={req.id} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 break-inside-avoid print:shadow-none print:border-gray-800 print:mb-10">
            
            <div className="bg-gray-800 p-6 flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800 print:p-4">
              <div>
                <div className="flex items-center gap-3 mb-2">
                   <span className="text-xs font-bold text-gray-400 uppercase tracking-widest print:text-black">PR Date: {req.date}</span>
                   {getStatusBadge(req.status)}
                </div>
                <h4 className="text-3xl font-black text-white flex items-center gap-3 print:text-black">
                  {req.itemName}
                  <span className="bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xl border border-indigo-400 print:bg-white print:text-black print:border-black">
                    {req.requestedQty.toLocaleString()} <span className="text-base font-medium">{req.unit}</span>
                  </span>
                </h4>
              </div>
              <button onClick={() => window.print()} className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-xl font-bold print:hidden">
                🖨️ Print
              </button>
            </div>

            {req.status === 'Rejected' && req.rejectReason && (
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3 print:border-b-2 print:border-black">
                 <span className="text-2xl print:hidden">⚠️</span>
                 <div>
                    <h5 className="font-bold text-red-800 text-sm uppercase">ပယ်ချရသည့် အကြောင်းရင်း</h5>
                    <p className="text-red-600 font-medium print:text-black">{req.rejectReason}</p>
                 </div>
              </div>
            )}

            {/* Print တွင် Column ၃ ခု အတိအကျဖြစ်ရန် print:grid-cols-3 နှင့် print:p-4 ထည့်ထားပါသည် */}
            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-gray-50 print:bg-white print:grid-cols-3 print:gap-4 print:p-4">
              {req.suppliers.map((sup) => (
                // Supplier တစ်ခုချင်းစီကိုလည်း Page Break မဖြစ်အောင် ထိန်းထားပါသည်
                <div key={sup.id} className={`border-2 p-6 rounded-2xl relative break-inside-avoid bg-white ${req.selectedSupplierId === sup.id ? 'border-green-500 shadow-xl print:border-green-800 print:border-4' : 'border-gray-200 print:border-gray-500'}`}>
                  {req.selectedSupplierId === sup.id && (
                    <div className="absolute -top-4 -right-4 bg-green-500 text-white w-10 h-10 flex justify-center items-center rounded-full font-black shadow-lg border-4 border-white print:border-green-800 print:text-black print:bg-white">✓</div>
                  )}
                  
                  <h5 className="font-black text-xl text-gray-800 mb-2">{sup.name}</h5>
                  <div className="text-red-600 font-black text-3xl mb-6 print:text-black">{sup.price.toLocaleString()} <span className="text-base text-gray-500">Ks</span></div>
                  
                  <div className="space-y-4 mb-6">
                     <div>
                       <div className="text-xs font-bold text-gray-400 uppercase mb-1.5 print:text-gray-800">အရည်အသွေး (Quality)</div>
                       <p className="text-sm text-gray-700 bg-gray-50 p-3 rounded-xl border border-gray-100 print:border-gray-400 print:bg-white">{sup.qualityDesc}</p>
                     </div>
                     {sup.analysisNote && (
                       <div>
                         <div className="text-xs font-bold text-blue-400 uppercase mb-1.5 print:text-gray-800">သုံးသပ်ချက် (Note)</div>
                         <p className="text-sm text-blue-800 bg-blue-50 p-3 rounded-xl border border-blue-100 font-medium print:border-gray-400 print:bg-white print:text-black">{sup.analysisNote}</p>
                       </div>
                     )}
                  </div>

                  <div className="flex gap-3 mt-4 print:hidden">
                    {sup.photo ? (
                       <button onClick={() => setPreviewImage(sup.photo!)} className="flex-1 text-left group">
                          <div className="text-xs font-bold text-gray-500 mb-1">ပစ္စည်းပုံ</div>
                          <img src={sup.photo} alt="P" className="w-full h-24 object-cover rounded-xl border-2 border-gray-200 group-hover:border-indigo-400" />
                       </button>
                    ) : null}
                    
                    {sup.quotationImage ? (
                       <button onClick={() => setPreviewImage(sup.quotationImage!)} className="flex-1 text-left group">
                          <div className="text-xs font-bold text-gray-500 mb-1">Quotation</div>
                          <img src={sup.quotationImage} alt="Q" className="w-full h-24 object-cover rounded-xl border-2 border-gray-200 group-hover:border-indigo-400" />
                       </button>
                    ) : null}
                  </div>

                  {(req.status === 'Finance_Approved' || req.status === 'Pending' || req.status === 'QC_Approved') && isMDorManager && req.status !== 'MD_Approved' && req.status !== 'Rejected' && (
                    <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="mt-6 w-full bg-green-600 text-white font-bold py-3.5 rounded-xl print:hidden">
                      <span className="text-xl">👑</span> ဤ ဆိုင်မှ ဝယ်မည်
                    </button>
                  )}
                </div>
              ))}
            </div>

            {req.status !== 'MD_Approved' && req.status !== 'Rejected' && (
              <div className="bg-gray-100 p-6 flex flex-wrap justify-end gap-3 items-center print:hidden border-t">
                <span className="text-sm font-bold text-gray-500 mr-auto uppercase">လုပ်ဆောင်ရန်</span>
                {req.status === 'Pending' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">🔬 အရည်အသွေး မှန်ကန်သည်</button>}
                {req.status === 'QC_Approved' && isFinance && <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold">💰 ဈေးနှုန်း မှန်ကန်သည်</button>}
                {(isQC || isFinance || isMDorManager) && <button onClick={() => handleReject(req.id)} className="bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold">❌ ပယ်ချမည်</button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Lightbox Modal (Print ထုတ်ချိန်တွင် အလိုအလျောက် ပျောက်နေပါမည်) */}
      {previewImage && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 p-4 print:hidden" onClick={() => setPreviewImage(null)}>
          <div className="relative max-w-4xl w-full flex justify-center">
             <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
             <button onClick={() => setPreviewImage(null)} className="absolute -top-4 -right-4 bg-red-600 text-white w-10 h-10 rounded-full font-bold text-xl flex items-center justify-center">✕</button>
          </div>
        </div>
      )}

    </div>
  );
};
