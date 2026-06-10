import React, { useState } from 'react';
import type { PurchaseRequest, SupplierOption, AttachedFile } from '../App';

interface ProcurementProps {
  userRole: string;
  requests: PurchaseRequest[];
  setRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>;
  onComplete: (pr: PurchaseRequest) => void; 
}

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width; let height = img.height;
        if (width > height) { if (width > 1024) { height *= 1024 / width; width = 1024; } } 
        else { if (height > 1024) { width *= 1024 / height; height = 1024; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7)); 
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

export const Procurement: React.FC<ProcurementProps> = ({ userRole, requests, setRequests, onComplete }) => {
  const [itemName, setItemName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [unit, setUnit] = useState('');
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([
    { id: '1', name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }
  ]);
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md' || userRole === 'manager';
  const isFinance = userRole === 'finance' || userRole === 'md' || userRole === 'manager';
  const isStoreKeeper = userRole === 'storekeeper' || userRole === 'md' || userRole === 'manager';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleAddSupplier = () => {
    if (suppliers.length < 3) {
      setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]);
    } else {
      alert('အများဆုံး Supplier ၃ ခုသာ ယှဉ်ပြနိုင်ပါသည်။');
    }
  };

  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => {
    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: value };
    setSuppliers(updated);
  };

  const handleCameraCapture = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      const newFile: AttachedFile = { name: `Camera_${Date.now()}.jpg`, dataUrl: compressedDataUrl, type: 'image/jpeg' };
      const updated = [...suppliers];
      updated[index] = { ...updated[index], [field]: [...(updated[index][field] || []), newFile] };
      setSuppliers(updated);
    } catch (error) { alert("ဓာတ်ပုံသိမ်းဆည်းမှု မအောင်မြင်ပါ။"); }
    e.target.value = '';
  };

  const handleMultipleFilesSelect = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    const newAttachments = await Promise.all(files.map(async (file) => {
      if (file.type.startsWith('image/')) {
        try {
          const compressedDataUrl = await compressImage(file);
          return { name: file.name, dataUrl: compressedDataUrl, type: 'image/jpeg' };
        } catch { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); }
      } else {
        return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); });
      }
    }));
    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: [...(updated[index][field] || []), ...newAttachments] };
    setSuppliers(updated);
    e.target.value = '';
  };

  const removeFile = (supIndex: number, field: 'productFiles' | 'quotationFiles', fileIndex: number) => {
    const updated = [...suppliers];
    const files = [...(updated[supIndex][field] || [])];
    files.splice(fileIndex, 1);
    updated[supIndex] = { ...updated[supIndex], [field]: files };
    setSuppliers(updated);
  };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty || !unit || suppliers.length === 0) return alert('အချက်အလက် ပြည့်စုံစွာ ဖြည့်ပါ။');
    
    const newPR: PurchaseRequest = {
      id: Date.now(), date: new Date().toLocaleDateString('en-GB'), itemName, requestedQty: Number(requestedQty), unit, suppliers, status: 'Pending'
    };
    setRequests([newPR, ...requests]);
    setItemName(''); setRequestedQty(''); setUnit(''); 
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]);
    alert('✅ ဝယ်ယူခွင့် တင်ပြခြင်း အောင်မြင်ပါသည်။');
  };

  const updateStatus = (
    id: number, 
    newStatus: PurchaseRequest['status'], 
    selectedId?: string, 
    reason?: string,
    roleData?: { qcSupId?: string; qcRem?: string; finSupId?: string; finRem?: string; storeRem?: string }
  ) => {
    setRequests(requests.map(r => r.id === id ? { 
      ...r, 
      status: newStatus, 
      selectedSupplierId: selectedId || r.selectedSupplierId, 
      rejectReason: reason || r.rejectReason,
      qcSelectedSupplierId: roleData?.qcSupId || r.qcSelectedSupplierId,
      qcRemark: roleData?.qcRem || r.qcRemark,
      financeSelectedSupplierId: roleData?.finSupId || r.financeSelectedSupplierId,
      financeRemark: roleData?.finRem || r.financeRemark,
      storeRemark: roleData?.storeRem || r.storeRemark // Store Keeper ၏ မှတ်ချက်
    } : r));
    
    if (newStatus === 'Completed') {
      const completedPR = requests.find(r => r.id === id);
      if (completedPR) onComplete(completedPR);
    }
  };

  const handleQCRecommend = (reqId: number, supId: string) => {
    const remark = window.prompt("QC ထောက်ခံရသည့် အကြောင်းရင်းကို ရေးပါ (ဥပမာ - အရည်အသွေးအကောင်းဆုံးဖြစ်သည်) :");
    if (remark) updateStatus(reqId, 'QC_Approved', undefined, undefined, { qcSupId: supId, qcRem: remark });
  };

  const handleFinanceRecommend = (reqId: number, supId: string) => {
    const remark = window.prompt("Finance ထောက်ခံရသည့် အကြောင်းရင်းကို ရေးပါ (ဥပမာ - ဈေးအသက်သာဆုံးဖြစ်သည်) :");
    if (remark) updateStatus(reqId, 'Finance_Approved', undefined, undefined, { finSupId: supId, finRem: remark });
  };

  // 🌟 ဂိုထောင်မှူး (Store Keeper) မှ ပစ္စည်းစစ်ဆေးပြီး မှတ်ချက်ရေးရန် Function 🌟
  const handleStoreReceive = (reqId: number) => {
    const remark = window.prompt("ပစ္စည်းလက်ခံရရှိမှု အခြေအနေကို မှတ်ချက်ရေးပါ\n(ဥပမာ - အားလုံးကောင်းမွန်သည်၊ အရေအတွက်ပြည့်မီသည်၊ သို့မဟုတ် ၂ ခု ပျက်စီးနေသည်) :");
    if (remark) {
      updateStatus(reqId, 'Store_Received', undefined, undefined, { storeRem: remark });
    }
  };

  const handleReject = (id: number) => {
    const reason = window.prompt("ပယ်ချရသည့် အကြောင်းရင်းကို ရေးပါ -");
    if (reason) updateStatus(id, 'Rejected', undefined, reason);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">⏳ Pending (QC စစ်ဆေးရန်)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🔬 QC Pass (Finance သို့)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">💰 Finance Pass (MD သို့)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">✅ MD ခွင့်ပြုပြီး (ဝယ်ယူရန်)</span>;
      case 'Purchased': return <span className="bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🛒 ဝယ်ယူပြီး (ပစ္စည်းရောက်ရန်စောင့်ဆိုင်း)</span>;
      case 'QC_Received': return <span className="bg-cyan-100 text-cyan-800 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">🔍 ပစ္စည်းရောက် (QC မှန်ကန်)</span>;
      case 'Store_Received': return <span className="bg-blue-200 text-blue-900 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">📦 ဂိုထောင်လက်ခံပြီး (Finance စစ်ရန်)</span>;
      case 'Completed': return <span className="bg-teal-600 text-white px-4 py-1.5 rounded-full text-sm font-bold shadow-md">🎯 ပြီးစီး (Inventory ဝင်ပါပြီ)</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-sm font-bold shadow-sm">❌ ပယ်ချထားသည်</span>;
      default: return null;
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-6">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span>
        <div><h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် ပစ္စည်းလက်ခံစနစ် (Maker-Checker Flow)</h2></div>
      </div>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-indigo-600 print:hidden">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
             <h3 className="text-xl font-bold text-gray-800">📝 ဝယ်ယူခွင့် တောင်းခံလွှာ</h3>
             <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold border border-indigo-200">+ Supplier ထပ်ထည့်မည်</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ပစ္စည်းအမည်</label><input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">အရေအတွက်</label><input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ယူနစ်</label><input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-5 rounded-2xl bg-white">
                <h4 className="font-extrabold text-indigo-800 mb-4 border-b pb-2 text-lg">Supplier {idx + 1}</h4>
                <div className="space-y-4">
                  <input type="text" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border-b-2 p-2 font-bold outline-none" placeholder="ဆိုင်အမည်" />
                  <input type="number" value={sup.price || ''} onChange={e => handleSupplierChange(idx, 'price', Number(e.target.value))} required className="w-full border-b-2 p-2 font-black text-red-600 outline-none" placeholder="ဈေးနှုန်း Ks" />
                  <textarea value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border-2 p-3 rounded-xl text-sm h-16 bg-gray-50 outline-none" placeholder="အရည်အသွေး" />
                  <textarea value={sup.analysisNote} onChange={e => handleSupplierChange(idx, 'analysisNote', e.target.value)} className="w-full border-2 p-3 rounded-xl text-sm h-16 bg-gray-50 outline-none" placeholder="နှိုင်းယှဉ်သုံးသပ်ချက်" />
                  
                  <div className="space-y-3 mt-4">
                    <div>
                        <div className="text-[11px] font-bold text-gray-700 mb-1">ပစ္စည်းပုံ (Product)</div>
                        <div className="flex gap-2">
                           <label className="flex-1 cursor-pointer bg-blue-50 border p-2.5 rounded-xl text-center"><span className="text-base">📸 ကင်မရာ</span><input type="file" accept="image/*" capture="environment" onChange={(e) => handleCameraCapture(idx, 'productFiles', e)} className="sr-only" /></label>
                           <label className="flex-1 cursor-pointer bg-gray-50 border p-2.5 rounded-xl text-center"><span className="text-base">📂 ဖိုင်ရွေးမည်</span><input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleMultipleFilesSelect(idx, 'productFiles', e)} className="sr-only" /></label>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {sup.productFiles?.map((file, i) => (
                             <div key={i} className="relative group w-10 h-10 border rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                               {file.type.startsWith('image/') ? <img src={file.dataUrl} className="w-full h-full object-cover"/> : <span className="text-[10px]">📄</span>}
                               <button type="button" onClick={() => removeFile(idx, 'productFiles', i)} className="absolute inset-0 bg-red-500/90 text-white text-[10px] hidden group-hover:flex items-center justify-center">✕</button>
                             </div>
                           ))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg">အတည်ပြုချက် တောင်းခံမည်</button>
        </form>
      )}

      {/* Approval Board */}
      <div className="space-y-8 print:space-y-12">
        <h3 className="text-2xl font-black text-gray-800 border-l-4 border-indigo-600 pl-4 print:hidden">တင်ပြထားသော / ဝယ်ယူဆဲ စာရင်းများ</h3>
        
        {requests.map(req => (
          <div key={req.id} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 break-inside-avoid print:shadow-none print:border-gray-800 print:mb-10">
            <div className="bg-gray-800 p-6 flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800 print:p-4">
              <div>
                <div className="flex items-center gap-3 mb-2"><span className="text-xs font-bold text-gray-400 uppercase print:text-black">PR Date: {req.date}</span>{getStatusBadge(req.status)}</div>
                <h4 className="text-3xl font-black text-white flex items-center gap-3 print:text-black">{req.itemName}
                  <span className="bg-indigo-500 text-white px-4 py-1.5 rounded-lg text-xl border border-indigo-400 print:bg-white print:text-black print:border-black">
                    {req.requestedQty.toLocaleString()} <span className="text-base font-medium">{req.unit}</span>
                  </span>
                </h4>
              </div>
            </div>

            {req.status === 'Rejected' && req.rejectReason && (
              <div className="bg-red-50 p-4 border-b border-red-100 flex items-start gap-3 print:border-b-2 print:border-black">
                 <span className="text-2xl print:hidden">⚠️</span>
                 <div><h5 className="font-bold text-red-800 text-sm uppercase">ပယ်ချရသည့် အကြောင်းရင်း</h5><p className="text-red-600 font-medium print:text-black">{req.rejectReason}</p></div>
              </div>
            )}

            <div className="p-6 md:p-8 grid grid-cols-1 lg:grid-cols-3 gap-8 bg-gray-50 print:bg-white print:grid-cols-3 print:gap-4 print:p-4">
              {req.suppliers.map((sup) => (
                <div key={sup.id} className={`border-2 p-6 rounded-2xl relative break-inside-avoid bg-white ${req.selectedSupplierId === sup.id ? 'border-green-500 shadow-xl ring-4 ring-green-50' : 'border-gray-200 print:border-gray-500'}`}>
                  {req.selectedSupplierId === sup.id && <div className="absolute -top-4 -right-4 bg-green-500 text-white w-10 h-10 flex justify-center items-center rounded-full font-black shadow-lg">✓</div>}
                  <h5 className="font-black text-xl text-gray-800 mb-2">{sup.name}</h5>
                  <div className="text-red-600 font-black text-3xl mb-4">{sup.price.toLocaleString()} Ks</div>
                  <div className="space-y-4 mb-4">
                     <div><div className="text-[10px] font-bold text-gray-400 uppercase mb-1">အရည်အသွေး</div><p className="text-sm text-gray-700 bg-gray-50 p-2.5 rounded-xl border">{sup.qualityDesc}</p></div>
                     {sup.analysisNote && <div><div className="text-[10px] font-bold text-blue-400 uppercase mb-1">သုံးသပ်ချက်</div><p className="text-sm text-blue-800 bg-blue-50 p-2.5 rounded-xl border">{sup.analysisNote}</p></div>}
                  </div>

                  <div className="space-y-2 mb-4">
                     {req.qcSelectedSupplierId === sup.id && (
                        <div className="bg-blue-100 border border-blue-300 p-3 rounded-xl shadow-inner">
                          <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block mb-1">🔬 QC ထောက်ခံထားသည်</span>
                          <span className="text-sm text-blue-900 font-medium leading-tight">{req.qcRemark}</span>
                        </div>
                     )}
                     {req.financeSelectedSupplierId === sup.id && (
                        <div className="bg-purple-100 border border-purple-300 p-3 rounded-xl shadow-inner">
                          <span className="text-[10px] font-bold text-purple-800 uppercase tracking-wider block mb-1">💰 Finance ထောက်ခံထားသည်</span>
                          <span className="text-sm text-purple-900 font-medium leading-tight">{req.financeRemark}</span>
                        </div>
                     )}
                  </div>

                  <div className="mt-4 print:hidden space-y-2">
                    {req.status === 'Pending' && isQC && <button onClick={() => handleQCRecommend(req.id, sup.id)} className="w-full bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-300 font-bold py-2.5 rounded-xl transition-colors">🔬 QC ထောက်ခံမည်</button>}
                    {req.status === 'QC_Approved' && isFinance && <button onClick={() => handleFinanceRecommend(req.id, sup.id)} className="w-full bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-300 font-bold py-2.5 rounded-xl transition-colors">💰 Finance ထောက်ခံမည်</button>}
                    {req.status === 'Finance_Approved' && isMDorManager && !req.selectedSupplierId && <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md"><span className="text-xl">👑</span> ဤဆိုင်မှ ဝယ်မည် (Approve)</button>}
                  </div>

                </div>
              ))}
            </div>

            {/* 🌟 ဤနေရာတွင် Store Keeper ၏ မှတ်ချက်ကို ပြသပါမည် 🌟 */}
            {req.storeRemark && (
              <div className="mx-6 md:mx-8 mb-6 bg-orange-50 border-l-4 border-orange-400 p-4 rounded-r-xl">
                 <h5 className="text-[11px] font-bold text-orange-600 uppercase tracking-widest mb-1 flex items-center gap-2">📦 ဂိုထောင်မှူး၏ လက်ခံရရှိမှု မှတ်ချက်</h5>
                 <p className="text-sm font-bold text-orange-900">{req.storeRemark}</p>
              </div>
            )}

            {req.status !== 'Completed' && req.status !== 'Rejected' && (
              <div className="bg-indigo-50 p-6 flex flex-wrap justify-end gap-3 items-center print:hidden border-t border-indigo-100">
                <span className="text-sm font-black text-indigo-800 mr-auto"><span>⚙️</span> Next Action</span>
                
                {/* 🌟 အဆင့်ဆင့် တာဝန်ယူမှု အပြည့်အစုံ (Purchasing -> QC -> Store Keeper -> Finance -> Inventory) 🌟 */}
                {req.status === 'MD_Approved' && isPurchasing && <button onClick={() => updateStatus(req.id, 'Purchased')} className="bg-yellow-500 hover:bg-yellow-600 text-white px-8 py-3 rounded-xl font-black shadow-lg">🛒 ဝယ်ယူလိုက်ပါပြီ</button>}
                {req.status === 'Purchased' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Received')} className="bg-cyan-600 hover:bg-cyan-700 text-white px-8 py-3 rounded-xl font-black shadow-lg">🔬 ပစ္စည်းရောက်/အရည်အသွေးမှန်ကန်သည်</button>}
                
                {/* Store Keeper မှ လက်ခံပြီး မှတ်ချက်ပေးမည့် နေရာ */}
                {req.status === 'QC_Received' && isStoreKeeper && (
                   <button onClick={() => handleStoreReceive(req.id)} className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 rounded-xl font-black shadow-lg border-2 border-blue-700">📦 ဂိုထောင်သို့ လက်ခံရရှိကြောင်း မှတ်ချက်ရေးမည်</button>
                )}
                
                {/* Finance မှ Store Keeper ၏ မှတ်ချက်ကို ဖတ်ပြီးမှ အပြီးသတ် စာရင်းသွင်းမည် */}
                {req.status === 'Store_Received' && isFinance && (
                   <button onClick={() => updateStatus(req.id, 'Completed')} className="bg-teal-600 hover:bg-teal-700 text-white px-8 py-3 rounded-xl font-black shadow-lg border-2 border-teal-700 animate-pulse">✅ ဘဏ္ဍာရေးမှူးမှ အပြီးသတ် စာရင်းသွင်းမည် (Auto Inventory +)</button>
                )}
                
                {(isQC || isFinance || isMDorManager) && req.status !== 'Purchased' && req.status !== 'QC_Received' && req.status !== 'Store_Received' && (
                   <button onClick={() => handleReject(req.id)} className="bg-white border-2 border-red-200 text-red-600 px-6 py-3 rounded-xl font-bold ml-4">❌ ပယ်ချမည်</button>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
