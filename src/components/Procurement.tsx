import React, { useState } from 'react';
import type { PurchaseRequest, SupplierOption, AttachedFile } from '../App';

interface ProcurementProps { userRole: string; requests: PurchaseRequest[]; setRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>; onComplete: (pr: PurchaseRequest) => void; }

const compressImage = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader(); reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image(); img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width; let height = img.height;
        if (width > height) { if (width > 600) { height *= 600 / width; width = 600; } } 
        else { if (height > 600) { width *= 600 / height; height = 600; } }
        canvas.width = width; canvas.height = height;
        const ctx = canvas.getContext('2d'); ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.5)); 
      };
      img.onerror = reject;
    };
    reader.onerror = reject;
  });
};

export const Procurement: React.FC<ProcurementProps> = ({ userRole, requests, setRequests, onComplete }) => {
  const [itemName, setItemName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [unit, setUnit] = useState('');
  const [targetWH, setTargetWH] = useState<'RM' | 'SFG' | 'PKG'>('RM');
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
    } else { alert('အများဆုံး ၃ ခုသာ ရွေးချယ်ခွင့်ရှိသည်။'); }
  };

  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => {
    const updated = [...suppliers]; updated[index] = { ...updated[index], [field]: value }; setSuppliers(updated);
  };

  const handleCameraCapture = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      const newFile: AttachedFile = { name: `Camera_${Date.now()}.jpg`, dataUrl: compressedDataUrl, type: 'image/jpeg' };
      const updated = [...suppliers];
      updated[index][field] = [...(updated[index][field] || []), newFile];
      setSuppliers(updated);
    } catch (error) { alert("ဓာတ်ပုံသိမ်းဆည်းမှု မအောင်မြင်ပါ။"); }
    e.target.value = '';
  };

  const handleMultipleFilesSelect = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (files.length === 0) return;
    const newAttachments = await Promise.all(files.map(async (file) => {
      if (file.type.startsWith('image/')) {
        try { const compressedDataUrl = await compressImage(file); return { name: file.name, dataUrl: compressedDataUrl, type: 'image/jpeg' }; } 
        catch { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); }
      } else {
        return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); });
      }
    }));
    const updated = [...suppliers]; updated[index][field] = [...(updated[index][field] || []), ...newAttachments]; setSuppliers(updated);
    e.target.value = '';
  };

  const removeFile = (supIndex: number, field: 'productFiles' | 'quotationFiles', fileIndex: number) => {
    const updated = [...suppliers]; const files = [...(updated[supIndex][field] || [])];
    files.splice(fileIndex, 1); updated[supIndex][field] = files; setSuppliers(updated);
  };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty || !unit || suppliers.length === 0) return alert('အချက်အလက် ဖြည့်ပါ။');
    const newPR: PurchaseRequest = { id: Date.now(), date: new Date().toLocaleDateString('en-GB'), itemName, requestedQty: Number(requestedQty), unit, suppliers, status: 'Pending', targetWarehouse: targetWH };
    setRequests([newPR, ...requests]);
    setItemName(''); setRequestedQty(''); setUnit(''); setTargetWH('RM');
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]);
    alert('✅ ဝယ်ယူခွင့် တင်ပြခြင်း အောင်မြင်ပါသည်။');
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string, reason?: string, roleData?: any) => {
    let targetPR: PurchaseRequest | null = null;
    setRequests(prevRequests => {
      return prevRequests.map(r => {
        if (r.id === id) {
          const updatedRequest: PurchaseRequest = { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId, rejectReason: reason || r.rejectReason, ...roleData };
          targetPR = updatedRequest;
          return updatedRequest;
        }
        return r;
      });
    });
    if (newStatus === 'Completed' && targetPR) {
      onComplete(targetPR);
    }
  };

  const handleStoreReceive = (reqId: number) => {
    const remark = window.prompt("ပစ္စည်းလက်ခံရရှိမှု အခြေအနေ မှတ်ချက်ရေးပါ :");
    if (remark) updateStatus(reqId, 'Store_Received', undefined, undefined, { storeRem: remark });
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">⏳ Pending (QC စစ်ဆေးရန်)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">🔬 QC Pass (Finance)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">💰 Finance Pass (MD)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">✅ MD ခွင့်ပြုပြီး</span>;
      case 'Purchased': return <span className="bg-yellow-100 text-yellow-800 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">🛒 ဝယ်ယူပြီး</span>;
      case 'QC_Received': return <span className="bg-cyan-100 text-cyan-800 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">🔍 ပစ္စည်းရောက် (QC)</span>;
      case 'Store_Received': return <span className="bg-blue-200 text-blue-900 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">📦 ဂိုထောင်ရောက်</span>;
      case 'Completed': return <span className="bg-teal-600 text-white px-4 py-1.5 rounded-full text-xs font-bold shadow-md">🎯 ပြီးစီး (Inventory ဝင်ပါပြီ)</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-4 py-1.5 rounded-full text-xs font-bold shadow-sm">❌ ပယ်ချထားသည်</span>;
      default: return null;
    }
  };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-4">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span><h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် ပစ္စည်းလက်ခံစနစ်</h2>
      </div>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-indigo-600 print:hidden">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
             <h3 className="text-xl font-bold text-gray-800">📝 ဝယ်ယူခွင့် တောင်းခံလွှာ</h3>
             <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold border border-indigo-200">+ Supplier ထပ်ထည့်မည်</button>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ပစ္စည်းအမည်</label><input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">အရေအတွက်</label><input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ယူနစ်</label><input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div>
              <label className="block text-sm font-bold text-indigo-800 mb-2">ဝင်မည့် ဂိုထောင်</label>
              <select value={targetWH} onChange={e => setTargetWH(e.target.value as any)} className="w-full border-2 border-indigo-300 bg-indigo-50 p-3 rounded-xl outline-none font-bold text-indigo-900">
                <option value="RM">📦 RM ဂိုထောင် (ကုန်ကြမ်း)</option>
                <option value="SFG">🍳 SFG ဂိုထောင် (ကုန်ပိုင်း)</option>
                <option value="PKG">🏷️ PKG ဂိုထောင် (ထုပ်ပိုးမှု)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-5 rounded-2xl bg-white">
                <h4 className="font-extrabold text-indigo-800 mb-4 border-b pb-2 text-lg">Supplier {idx + 1}</h4>
                <div className="space-y-4">
                  <input type="text" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border-b-2 p-2 font-bold outline-none" placeholder="ဆိုင်အမည်" />
                  <input type="number" value={sup.price || ''} onChange={e => handleSupplierChange(idx, 'price', Number(e.target.value))} required className="w-full border-b-2 p-2 font-black text-red-600 outline-none" placeholder="ဈေးနှုန်း Ks" />
                  <textarea value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border-2 p-3 rounded-xl text-sm h-16 bg-gray-50 outline-none" placeholder="အရည်အသွေး" />
                  
                  <div className="space-y-3 mt-4">
                    <div>
                        <div className="text-[11px] font-bold text-gray-700 mb-1">ပစ္စည်းပုံနှင့် ဘောက်ချာဖိုင်များ</div>
                        <div className="flex gap-2">
                           <label className="flex-1 cursor-pointer bg-blue-50 border border-blue-200 p-2 rounded-lg text-center text-xs font-bold">📸 ကင်မရာ <input type="file" accept="image/*" capture="environment" onChange={(e) => handleCameraCapture(idx, 'productFiles', e)} className="sr-only" /></label>
                           <label className="flex-1 cursor-pointer bg-gray-50 border border-gray-200 p-2 rounded-lg text-center text-xs font-bold">📂 ဖိုင်အစုံရွေးရန် <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleMultipleFilesSelect(idx, 'productFiles', e)} className="sr-only" /></label>
                        </div>
                        <div className="flex flex-wrap gap-1 mt-2">
                           {sup.productFiles?.map((file, i) => (
                             <div key={i} className="relative group w-10 h-10 border rounded bg-gray-50 flex items-center justify-center overflow-hidden">
                               {file.type?.startsWith('image/') ? <img src={file.dataUrl} className="w-full h-full object-cover"/> : <span className="text-[10px]">📄</span>}
                               <button type="button" onClick={() => removeFile(idx, 'productFiles', i)} className="absolute inset-0 bg-red-500 text-white text-[10px] flex items-center justify-center font-bold">✕</button>
                             </div>
                           ))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg">ဝယ်ယူခွင့် တင်ပြမည်</button>
        </form>
      )}

      <div className="space-y-8 print:space-y-4">
        {requests?.map(req => (
          <div key={req.id} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200 break-inside-avoid print:border-gray-400 print:shadow-none">
            <div className="bg-gray-800 p-6 flex justify-between items-center print:bg-white print:border-b-2 print:border-gray-800 print:p-2">
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1 print:text-black">PR Date: {req.date}</div>
                <h4 className="text-2xl font-black text-white flex flex-wrap items-center gap-2 print:text-black">
                  {req.itemName} <span className="bg-indigo-500 text-white px-3 py-1 rounded-lg text-lg print:border print:text-black print:bg-white">{req.requestedQty?.toLocaleString()} {req.unit}</span>
                  <span className="bg-yellow-500 text-yellow-900 px-3 py-1 rounded-lg text-xs print:border print:text-black print:bg-white">ဂိုထောင်: {req.targetWarehouse || 'RM'}</span>
                  {getStatusBadge(req.status)}
                </h4>
              </div>
              <button onClick={() => window.print()} className="bg-white/10 text-white border border-white/20 px-4 py-2 rounded-xl font-bold print:hidden">🖨️ Print / Save</button>
            </div>

            <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-50 print:bg-white print:grid-cols-3 print:gap-2 print:p-2">
              {req.suppliers?.map((sup) => (
                <div key={sup.id} className={`border-2 p-4 rounded-2xl relative bg-white ${req.selectedSupplierId === sup.id ? 'border-green-500 shadow-md ring-2 ring-green-50 print:border-green-700' : 'border-gray-200'}`}>
                  {req.selectedSupplierId === sup.id && <div className="absolute -top-3 -right-3 bg-green-500 text-white w-8 h-8 flex justify-center items-center rounded-full font-black shadow print:hidden">✓</div>}
                  <h5 className="font-black text-lg text-gray-800 mb-1">{sup.name}</h5>
                  <div className="text-red-600 font-black text-2xl mb-3 print:text-black">{sup.price?.toLocaleString()} Ks</div>
                  <div className="text-xs text-gray-700 bg-gray-50 p-2 rounded-xl border mb-3 print:bg-white">{sup.qualityDesc}</div>

                  {sup.productFiles && sup.productFiles.length > 0 && (
                    <div className="mt-3 pt-2 border-t border-dashed">
                      <div className="text-[10px] font-bold text-gray-400 uppercase mb-1 print:text-black">သက်သေခံ ဖိုင်/ပုံများ:</div>
                      <div className="flex flex-wrap gap-1.5">
                        {sup.productFiles.map((file, i) => (
                          file?.dataUrl ? (
                            file.type?.startsWith('image/') ? (
                               <img key={i} onClick={() => setPreviewImage(file.dataUrl)} src={file.dataUrl} className="w-12 h-12 object-cover rounded border border-gray-300 cursor-pointer print:w-16 print:h-16 print:object-contain" />
                            ) : (
                               <a key={i} href={file.dataUrl} download={file.name} className="w-12 h-12 flex flex-col items-center justify-center border rounded bg-gray-50 text-[8px] p-1 truncate text-indigo-700 font-bold print:border-black">
                                 <span className="text-sm">📄</span>
                                 <span className="truncate w-full text-center">{file.name?.slice(0,5)}</span>
                               </a>
                            )
                          ) : null
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3 print:hidden">
                    {req.status === 'Finance_Approved' && isMDorManager && !req.selectedSupplierId && (
                      <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="w-full bg-green-600 text-white font-bold py-2 rounded-xl shadow-sm text-sm">👑 ဤဆိုင်မှ ဝယ်မည်</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {req.status !== 'Completed' && req.status !== 'Rejected' && (
              <div className="bg-indigo-50 p-4 flex flex-wrap justify-end gap-3 items-center print:hidden border-t">
                <span className="text-sm font-black text-indigo-800 mr-auto">⚙️ Next Action</span>
                {req.status === 'Pending' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-5 py-2 rounded-xl font-bold text-sm">🔬 QC အတည်ပြုမည်</button>}
                {req.status === 'QC_Approved' && isFinance && <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-5 py-2 rounded-xl font-bold text-sm">💰 Finance အတည်ပြုမည်</button>}
                {req.status === 'MD_Approved' && isPurchasing && <button onClick={() => updateStatus(req.id, 'Purchased')} className="bg-yellow-500 text-white px-6 py-2.5 rounded-xl font-black text-sm">🛒 ဝယ်ယူလိုက်ပါပြီ</button>}
                {req.status === 'Purchased' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Received')} className="bg-cyan-600 text-white px-6 py-2.5 rounded-xl font-black text-sm">🔬 ပစ္စည်းရောက်/စစ်ပြီး</button>}
                {req.status === 'QC_Received' && isStoreKeeper && <button onClick={() => handleStoreReceive(req.id)} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-black text-sm">📦 ဂိုထောင်လက်ခံမည်</button>}
                {req.status === 'Store_Received' && isFinance && <button onClick={() => updateStatus(req.id, 'Completed')} className="bg-teal-600 text-white px-6 py-2.5 rounded-xl font-black text-sm animate-pulse">✅ စာရင်းသွင်းမည် (Auto +)</button>}
              </div>
            )}
          </div>
        ))}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 print:hidden" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg" />
          <button onClick={() => setPreviewImage(null)} className="absolute top-4 right-4 bg-red-600 text-white w-10 h-10 rounded-full font-bold text-xl">✕</button>
        </div>
      )}
    </div>
  );
};
