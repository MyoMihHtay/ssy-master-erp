import React, { useState } from 'react';
import type { PurchaseRequest, SupplierOption, AttachedFile } from '../App';

interface ProcurementProps { userRole: string; requests: PurchaseRequest[]; setRequests: React.Dispatch<React.SetStateAction<PurchaseRequest[]>>; onComplete: (pr: PurchaseRequest) => void; }

const compressImage = (file: File): Promise<string> => { /* ... (အရင်အတိုင်း) ... */ return new Promise((res, rej) => { const r = new FileReader(); r.readAsDataURL(file); r.onload = (e) => { const i = new Image(); i.src = e.target?.result as string; i.onload = () => { const c = document.createElement('canvas'); let w = i.width; let h = i.height; if (w > h) { if (w > 1024) { h *= 1024 / w; w = 1024; } } else { if (h > 1024) { w *= 1024 / h; h = 1024; } } c.width = w; c.height = h; const ctx = c.getContext('2d'); ctx?.drawImage(i, 0, 0, w, h); res(c.toDataURL('image/jpeg', 0.7)); }; i.onerror = rej; }; r.onerror = rej; }); };

export const Procurement: React.FC<ProcurementProps> = ({ userRole, requests, setRequests, onComplete }) => {
  const [itemName, setItemName] = useState('');
  const [requestedQty, setRequestedQty] = useState('');
  const [unit, setUnit] = useState('');
  const [targetWH, setTargetWH] = useState<'RM' | 'SFG'>('RM'); // 🌟 Target Warehouse Selection
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([{ id: '1', name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]);
  
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md' || userRole === 'manager';
  const isFinance = userRole === 'finance' || userRole === 'md' || userRole === 'manager';
  const isStoreKeeper = userRole === 'storekeeper' || userRole === 'md' || userRole === 'manager';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleAddSupplier = () => { if (suppliers.length < 3) { setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]); } else { alert('အများဆုံး ၃ ခုသာ ရမည်'); } };
  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => { const updated = [...suppliers]; updated[index] = { ...updated[index], [field]: value }; setSuppliers(updated); };

  const handleCameraCapture = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => { const file = e.target.files?.[0]; if (!file) return; try { const compressedDataUrl = await compressImage(file); const updated = [...suppliers]; updated[index] = { ...updated[index], [field]: [...(updated[index][field] || []), { name: `Camera_${Date.now()}.jpg`, dataUrl: compressedDataUrl, type: 'image/jpeg' }] }; setSuppliers(updated); } catch (error) { alert("Error"); } e.target.value = ''; };
  const handleMultipleFilesSelect = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => { const files = Array.from(e.target.files || []); if (files.length === 0) return; const newAttachments = await Promise.all(files.map(async (file) => { if (file.type.startsWith('image/')) { try { const compressedDataUrl = await compressImage(file); return { name: file.name, dataUrl: compressedDataUrl, type: 'image/jpeg' }; } catch { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); } } else { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); } })); const updated = [...suppliers]; updated[index] = { ...updated[index], [field]: [...(updated[index][field] || []), ...newAttachments] }; setSuppliers(updated); e.target.value = ''; };
  const removeFile = (supIndex: number, field: 'productFiles' | 'quotationFiles', fileIndex: number) => { const updated = [...suppliers]; const files = [...(updated[supIndex][field] || [])]; files.splice(fileIndex, 1); updated[supIndex] = { ...updated[supIndex], [field]: files }; setSuppliers(updated); };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty || !unit || suppliers.length === 0) return alert('အချက်အလက် ဖြည့်ပါ။');
    const newPR: PurchaseRequest = { id: Date.now(), date: new Date().toLocaleDateString('en-GB'), itemName, requestedQty: Number(requestedQty), unit, suppliers, status: 'Pending', targetWarehouse: targetWH };
    setRequests([newPR, ...requests]);
    setItemName(''); setRequestedQty(''); setUnit(''); setTargetWH('RM'); setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [] }]);
    alert('✅ ဝယ်ယူခွင့် တင်ပြခြင်း အောင်မြင်ပါသည်။');
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string, reason?: string, roleData?: any) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId, rejectReason: reason || r.rejectReason, ...roleData } : r));
    if (newStatus === 'Completed') { const completedPR = requests.find(r => r.id === id); if (completedPR) onComplete({...completedPR, targetWarehouse: completedPR.targetWarehouse || 'RM'}); }
  };

  const handleReject = (id: number) => { const reason = window.prompt("ပယ်ချရသည့် အကြောင်းရင်း -"); if (reason) updateStatus(id, 'Rejected', undefined, reason); };

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-6">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span><div><h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် ပစ္စည်းလက်ခံစနစ်</h2></div>
      </div>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 rounded-2xl border-t-4 border-indigo-600 print:hidden">
          <div className="flex justify-between items-center mb-6 border-b pb-4"><h3 className="text-xl font-bold text-gray-800">📝 ဝယ်ယူခွင့် တောင်းခံလွှာ</h3><button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold border border-indigo-200">+ Supplier ထပ်ထည့်မည်</button></div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8 bg-indigo-50/50 p-6 rounded-xl border border-indigo-100">
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ပစ္စည်းအမည်</label><input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">အရေအတွက်</label><input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            <div><label className="block text-sm font-bold text-gray-700 mb-2">ယူနစ်</label><input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl outline-none" /></div>
            {/* 🌟 Target Warehouse Selection */}
            <div>
              <label className="block text-sm font-bold text-indigo-800 mb-2">ဝင်မည့် ဂိုထောင်</label>
              <select value={targetWH} onChange={e => setTargetWH(e.target.value as 'RM'|'SFG')} className="w-full border-2 border-indigo-300 bg-indigo-50 p-3 rounded-xl outline-none font-bold text-indigo-900">
                <option value="RM">📦 RM (ကုန်ကြမ်း)</option>
                <option value="SFG">🍳 SFG (တစ်ပိုင်းတစ်စ)</option>
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
                  <div className="flex gap-2">
                     <label className="flex-1 cursor-pointer bg-blue-50 border p-2 text-center rounded-lg text-sm">📸 ဓာတ်ပုံ <input type="file" accept="image/*" capture="environment" onChange={(e) => handleCameraCapture(idx, 'productFiles', e)} className="sr-only" /></label>
                     <label className="flex-1 cursor-pointer bg-gray-50 border p-2 text-center rounded-lg text-sm">📂 ဖိုင် <input type="file" multiple accept="image/*,.pdf" onChange={(e) => handleMultipleFilesSelect(idx, 'productFiles', e)} className="sr-only" /></label>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg">အတည်ပြုချက် တောင်းခံမည်</button>
        </form>
      )}

      {/* Approval Board */}
      <div className="space-y-8">
        {requests.map(req => (
          <div key={req.id} className="bg-white shadow-xl rounded-2xl overflow-hidden border border-gray-200">
            <div className="bg-gray-800 p-6 flex justify-between items-center">
              <div>
                <div className="text-xs font-bold text-gray-400 mb-2">PR Date: {req.date}</div>
                <h4 className="text-3xl font-black text-white flex items-center gap-3">
                  {req.itemName} <span className="bg-indigo-500 text-white px-4 py-1 rounded-lg text-xl">{req.requestedQty} {req.unit}</span>
                  <span className="bg-yellow-500 text-yellow-900 px-3 py-1 rounded-lg text-sm ml-2">ဝင်မည့်ဂိုထောင်: {req.targetWarehouse || 'RM'}</span>
                </h4>
              </div>
            </div>
            
            {/* Same Action Board Logic as before ... */}
            {req.status !== 'Completed' && req.status !== 'Rejected' && (
              <div className="bg-indigo-50 p-6 flex flex-wrap justify-end gap-3 items-center print:hidden border-t border-indigo-100">
                <span className="text-sm font-black text-indigo-800 mr-auto"><span>⚙️</span> Next Action</span>
                {req.status === 'Pending' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-6 py-3 rounded-xl font-bold">🔬 QC အတည်ပြုမည်</button>}
                {req.status === 'QC_Approved' && isFinance && <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-6 py-3 rounded-xl font-bold">💰 Finance အတည်ပြုမည်</button>}
                {req.status === 'Finance_Approved' && isMDorManager && <button onClick={() => updateStatus(req.id, 'MD_Approved')} className="bg-green-600 text-white px-6 py-3 rounded-xl font-bold">👑 MD ခွင့်ပြုမည်</button>}
                {req.status === 'MD_Approved' && isPurchasing && <button onClick={() => updateStatus(req.id, 'Purchased')} className="bg-yellow-500 text-white px-8 py-3 rounded-xl font-black">🛒 ဝယ်ယူလိုက်ပါပြီ</button>}
                {req.status === 'Purchased' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Received')} className="bg-cyan-600 text-white px-8 py-3 rounded-xl font-black">🔬 ပစ္စည်းရောက်/စစ်ဆေးပြီး</button>}
                {req.status === 'QC_Received' && isStoreKeeper && <button onClick={() => updateStatus(req.id, 'Store_Received')} className="bg-blue-600 text-white px-8 py-3 rounded-xl font-black">📦 ဂိုထောင်လက်ခံပြီး</button>}
                {req.status === 'Store_Received' && isFinance && <button onClick={() => updateStatus(req.id, 'Completed')} className="bg-teal-600 text-white px-8 py-3 rounded-xl font-black">✅ စာရင်းသွင်းမည် (Auto +)</button>}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
