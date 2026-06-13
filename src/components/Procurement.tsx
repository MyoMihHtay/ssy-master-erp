import React, { useState } from 'react';
import type { PurchaseRequest, SupplierOption, AttachedFile, PRItem } from '../App';

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
  const [requestItems, setRequestItems] = useState<PRItem[]>([{ id: Date.now().toString(), itemName: '', requestedQty: 0, unit: '', targetWarehouse: 'RM' }]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([{ id: '1', name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [], itemUnitPrices: {} }]);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [displayLimit, setDisplayLimit] = useState(50);
  const [syncPaymentMethod, setSyncPaymentMethod] = useState('CASH (လက်ငင်း)');

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md' || userRole === 'manager';
  const isFinance = userRole === 'finance' || userRole === 'md' || userRole === 'manager';
  const isStoreKeeper = userRole === 'storekeeper' || userRole === 'md' || userRole === 'manager';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleAddPRItem = () => setRequestItems([...requestItems, { id: Date.now().toString() + Math.random(), itemName: '', requestedQty: 0, unit: '', targetWarehouse: 'RM' }]);
  
  const handlePRItemChange = (index: number, field: keyof PRItem, value: any) => { 
    const updatedItems = [...requestItems]; 
    updatedItems[index] = { ...updatedItems[index], [field]: value }; 
    setRequestItems(updatedItems); 

    if (field === 'requestedQty') {
        const updatedSups = suppliers.map(sup => {
           let total = 0;
           updatedItems.forEach(item => {
              total += (sup.itemUnitPrices?.[item.id!] || 0) * (item.requestedQty || 0);
           });
           return { ...sup, price: total };
        });
        setSuppliers(updatedSups);
    }
  };

  const handleRemovePRItem = (index: number) => { if (requestItems.length > 1) setRequestItems(requestItems.filter((_, i) => i !== index)); };

  const handleAddSupplier = () => { if (suppliers.length < 3) setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [], itemUnitPrices: {} }]); else alert('အများဆုံး ၃ ခုသာ ရွေးချယ်ခွင့်ရှိသည်။'); };
  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => { const updated = [...suppliers]; updated[index] = { ...updated[index], [field]: value }; setSuppliers(updated); };

  const handleItemPriceChange = (supIndex: number, itemId: string, price: number) => {
      const updated = [...suppliers];
      const sup = updated[supIndex];
      sup.itemUnitPrices = { ...sup.itemUnitPrices, [itemId]: price };
      
      let total = 0;
      requestItems.forEach(item => {
        const qty = item.requestedQty || 0;
        const uPrice = sup.itemUnitPrices?.[item.id!] || 0;
        total += (qty * uPrice);
      });
      sup.price = total;
      setSuppliers(updated);
  };

  const handleCameraCapture = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      const compressedDataUrl = await compressImage(file);
      const newFile: AttachedFile = { name: `Camera_${Date.now()}.jpg`, dataUrl: compressedDataUrl, type: 'image/jpeg' };
      const updated = [...suppliers]; updated[index][field] = [...(updated[index][field] || []), newFile]; setSuppliers(updated);
    } catch (error) { alert("ဓာတ်ပုံသိမ်းဆည်းမှု မအောင်မြင်ပါ။"); } e.target.value = '';
  };

  const handleMultipleFilesSelect = async (index: number, field: 'productFiles' | 'quotationFiles', e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []); if (files.length === 0) return;
    const newAttachments = await Promise.all(files.map(async (file) => {
      if (file.type.startsWith('image/')) {
        try { const compressedDataUrl = await compressImage(file); return { name: file.name, dataUrl: compressedDataUrl, type: 'image/jpeg' }; } 
        catch { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); }
      } else { return new Promise<AttachedFile>((res) => { const r = new FileReader(); r.onloadend = () => res({ name: file.name, dataUrl: r.result as string, type: file.type }); r.readAsDataURL(file); }); }
    }));
    const updated = [...suppliers]; updated[index][field] = [...(updated[index][field] || []), ...newAttachments]; setSuppliers(updated); e.target.value = '';
  };

  const removeFile = (supIndex: number, field: 'productFiles' | 'quotationFiles', fileIndex: number) => {
    const updated = [...suppliers]; const files = [...(updated[supIndex][field] || [])]; files.splice(fileIndex, 1); updated[supIndex][field] = files; setSuppliers(updated);
  };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    const hasEmptyItem = requestItems.some(item => !item.itemName || !item.requestedQty || !item.unit);
    if (hasEmptyItem || suppliers.length === 0) return alert('ပစ္စည်းအချက်အလက်များကို အပြည့်အစုံ ဖြည့်ပါ။');

    const newPR: PurchaseRequest = { id: Date.now(), date: new Date().toLocaleDateString('en-GB'), items: requestItems, suppliers, status: 'Pending' };
    setRequests([newPR, ...requests]);
    setRequestItems([{ id: Date.now().toString(), itemName: '', requestedQty: 0, unit: '', targetWarehouse: 'RM' }]);
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', analysisNote: '', productFiles: [], quotationFiles: [], itemUnitPrices: {} }]);
    alert('✅ ဝယ်ယူခွင့် တင်ပြခြင်း အောင်မြင်ပါသည်။'); setDisplayLimit(50);
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string, reason?: string, roleData?: any) => {
    let targetPR: PurchaseRequest | null = null;
    setRequests(prevRequests => {
      return prevRequests.map(r => {
        if (r.id === id) {
          const updatedRequest: PurchaseRequest = { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId, rejectReason: reason || r.rejectReason, ...roleData };
          targetPR = updatedRequest; return updatedRequest;
        }
        return r;
      });
    });
    if (newStatus === 'Completed' && targetPR) { onComplete(targetPR); }
  };

  const handleQCRecommend = (reqId: number, supId: string) => {
    const remark = window.prompt("QC ထောက်ခံရသည့် အကြောင်းရင်းကို ရေးပါ :");
    if (remark) updateStatus(reqId, 'QC_Approved', undefined, undefined, { qcSelectedSupplierId: supId, qcRemark: remark });
  };

  const handleFinanceRecommend = (reqId: number, supId: string) => {
    const remark = window.prompt("Finance ထောက်ခံရသည့် အကြောင်းရင်းကို ရေးပါ :");
    if (remark) updateStatus(reqId, 'Finance_Approved', undefined, undefined, { financeSelectedSupplierId: supId, financeRemark: remark });
  };

  const handleStoreReceive = (reqId: number) => {
    const remark = window.prompt("ပစ္စည်းလက်ခံရရှိမှု အခြေအနေ မှတ်ချက်ရေးပါ :");
    if (remark) updateStatus(reqId, 'Store_Received', undefined, undefined, { storeRemark: remark });
  };

  const handleReject = (id: number) => {
    const reason = window.prompt("ပယ်ချရသည့် အကြောင်းရင်းကို ရေးပါ -");
    if (reason) updateStatus(id, 'Rejected', undefined, reason);
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-orange-200">⏳ Pending (QC)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-blue-200">🔬 QC Pass (Finance)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-purple-200">💰 Finance Pass (MD)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-green-200">✅ MD Approved</span>;
      case 'Purchased': return <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-yellow-300">🛒 Purchased</span>;
      case 'QC_Received': return <span className="bg-cyan-100 text-cyan-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-cyan-200">🔍 QC Received</span>;
      case 'Store_Received': return <span className="bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-indigo-200">📦 Store Received</span>;
      case 'Completed': return <span className="bg-teal-600 text-white px-3 py-1 rounded-full text-xs font-bold shadow-md">🎯 Completed (Auto-Synced)</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm border border-red-200">❌ Rejected</span>;
      default: return null;
    }
  };

  const visibleRequests = requests?.slice(0, displayLimit) || [];

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-8 print:p-0 print:space-y-4">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4 print:hidden">
        <span className="text-4xl">🛒</span><h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် ပစ္စည်းလက်ခံစနစ်</h2>
      </div>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-lg p-6 md:p-8 rounded-2xl border-t-4 border-indigo-600 print:hidden">
           <div className="flex justify-between items-center mb-6 border-b border-indigo-100 pb-4">
             <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2"><span>📝</span> ဝယ်ယူခွင့် တောင်းခံလွှာ</h3>
             <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 px-5 py-2.5 rounded-xl font-bold border border-indigo-200 hover:bg-indigo-100 transition-colors">+ Supplier ထပ်ထည့်မည်</button>
          </div>
          <div className="mb-8">
            <div className="space-y-3">
              {requestItems.map((item, idx) => (
                <div key={item.id} className="flex flex-wrap md:flex-nowrap gap-3 items-center bg-indigo-50/50 p-4 rounded-xl border border-indigo-100">
                  <div className="w-full md:flex-1"><label className="block text-xs font-bold text-gray-500 mb-1">ပစ္စည်းအမည်</label><input type="text" value={item.itemName} onChange={e => handlePRItemChange(idx, 'itemName', e.target.value)} required className="w-full border-2 border-white shadow-sm p-2.5 rounded-lg outline-none focus:border-indigo-400" placeholder="ဥပမာ - အာလူးကြော် (ဇကာစပ်)" /></div>
                  <div className="w-full md:w-28"><label className="block text-xs font-bold text-gray-500 mb-1">အရေအတွက်</label><input type="number" value={item.requestedQty || ''} onChange={e => handlePRItemChange(idx, 'requestedQty', Number(e.target.value))} required className="w-full border-2 border-white shadow-sm p-2.5 rounded-lg outline-none focus:border-indigo-400" /></div>
                  <div className="w-full md:w-28"><label className="block text-xs font-bold text-gray-500 mb-1">ယူနစ်</label><input type="text" value={item.unit} onChange={e => handlePRItemChange(idx, 'unit', e.target.value)} required className="w-full border-2 border-white shadow-sm p-2.5 rounded-lg outline-none focus:border-indigo-400" placeholder="ပိဿာ / ထုပ်" /></div>
                  <div className="w-full md:w-48">
                    <label className="block text-xs font-bold text-indigo-800 mb-1">ဝင်မည့် ဂိုထောင်</label>
                    <select value={item.targetWarehouse} onChange={e => handlePRItemChange(idx, 'targetWarehouse', e.target.value)} className="w-full border-2 border-white shadow-sm bg-indigo-100 p-2.5 rounded-lg outline-none font-bold text-indigo-900">
                      <option value="RM">📦 RM (ကုန်ကြမ်း)</option><option value="SFG">🍳 SFG (ကုန်ပိုင်း)</option><option value="PKG">🏷️ PKG (ထုပ်ပိုးမှု)</option>
                    </select>
                  </div>
                  {requestItems.length > 1 && (
                    <button type="button" onClick={() => handleRemovePRItem(idx)} className="mt-5 bg-red-100 text-red-600 px-3 py-2.5 rounded-lg font-bold">✕</button>
                  )}
                </div>
              ))}
            </div>
            <button type="button" onClick={handleAddPRItem} className="mt-4 bg-white border-2 border-dashed border-indigo-300 text-indigo-600 w-full py-3 rounded-xl font-bold hover:bg-indigo-50">+ ပစ္စည်းအမျိုးအစား ထပ်ထည့်မည်</button>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-5 rounded-2xl bg-white shadow-sm">
                <h4 className="font-extrabold text-indigo-800 mb-4 border-b pb-2 text-lg flex items-center justify-between">Supplier {idx + 1}</h4>
                <div className="space-y-4">
                  <input type="text" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border-b-2 border-gray-200 p-2 font-bold outline-none focus:border-indigo-500 mb-2" placeholder="ဆိုင်အမည်" />
                  
                  <div className="bg-indigo-50/50 p-3 rounded-xl border border-indigo-100">
                    <h5 className="text-xs font-bold text-indigo-800 mb-3 border-b border-indigo-100 pb-1">ပစ္စည်းတစ်ခုချင်းစီ၏ ဈေးနှုန်း (Unit Price)</h5>
                    {requestItems.map((reqItem) => (
                       <div key={reqItem.id} className="flex flex-col gap-1 mb-3">
                          <span className="text-xs font-bold text-gray-700 truncate w-full">
                             {reqItem.itemName || 'ပစ္စည်းအမည်မသိ'} <span className="text-indigo-600">({reqItem.requestedQty || 0} {reqItem.unit})</span>
                          </span>
                          <div className="flex items-center gap-2">
                              <input
                                 type="number"
                                 value={sup.itemUnitPrices?.[reqItem.id!] || ''}
                                 onChange={e => handleItemPriceChange(idx, reqItem.id!, Number(e.target.value))}
                                 placeholder="1 ယူနစ် ဈေးနှုန်း..."
                                 required
                                 className="flex-1 p-2 border border-white shadow-sm rounded-lg text-right font-bold text-sm outline-none focus:border-indigo-500"
                              />
                              <span className="text-xs font-bold text-gray-500 w-6">Ks</span>
                          </div>
                       </div>
                    ))}
                    <div className="flex justify-between items-center mt-3 pt-3 border-t-2 border-dashed border-indigo-200">
                       <span className="font-bold text-indigo-900 text-sm">စုစုပေါင်း ကျသင့်ငွေ</span>
                       <span className="font-black text-red-600 text-lg">{sup.price.toLocaleString()} Ks</span>
                    </div>
                  </div>

                  <textarea value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border-2 border-gray-200 p-3 rounded-xl text-sm h-16 bg-gray-50 outline-none focus:border-indigo-500" placeholder="အရည်အသွေး သုံးသပ်ချက်" />
                  
                  <div className="space-y-3 mt-4">
                    <div>
                        <div className="text-[11px] font-bold text-gray-700 mb-2">သက်သေခံ ဘောက်ချာ/ပုံများ</div>
                        <div className="flex gap-2">
                           <label className="flex-1 cursor-pointer bg-blue-50 border border-blue-200 p-2.5 rounded-lg text-center text-xs font-bold hover:bg-blue-100 text-blue-700 transition-colors shadow-sm">
                             📸 ကင်မရာ 
                             <input type="file" accept="image/*" capture="environment" onChange={(e) => handleCameraCapture(idx, 'productFiles', e)} className="sr-only" />
                           </label>
                           <label className="flex-1 cursor-pointer bg-gray-50 border border-gray-300 p-2.5 rounded-lg text-center text-xs font-bold hover:bg-gray-100 transition-colors shadow-sm">
                             📂 ဖိုင်အစုံရွေးရန် 
                             <input type="file" multiple accept="image/*,.pdf,.doc,.docx,.xls,.xlsx" onChange={(e) => handleMultipleFilesSelect(idx, 'productFiles', e)} className="sr-only" />
                           </label>
                        </div>
                        <div className="flex flex-wrap gap-2 mt-3">
                           {sup.productFiles?.map((file, i) => (
                             <div key={i} className="relative group w-14 h-14 border-2 border-gray-200 rounded-lg bg-gray-50 flex items-center justify-center overflow-hidden shadow-sm">
                               {file.type?.startsWith('image/') ? <img src={file.dataUrl} className="w-full h-full object-cover"/> : <span className="text-2xl font-bold text-indigo-600">📄</span>}
                               <button type="button" onClick={() => removeFile(idx, 'productFiles', i)} className="absolute inset-0 bg-red-500/90 text-white text-[10px] flex items-center justify-center font-bold opacity-0 group-hover:opacity-100 transition-opacity">✕ ဖျက်မည်</button>
                             </div>
                           ))}
                        </div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-indigo-600 text-white font-black py-4 rounded-xl shadow-lg hover:bg-indigo-700 transition-transform active:scale-95 text-lg tracking-wide">ဝယ်ယူခွင့် တင်ပြမည် (Submit PR)</button>
        </form>
      )}

      {/* Approval Board */}
      <div className="space-y-8 print:space-y-6">
        {visibleRequests.map(req => {
          const itemsToDisplay = req.items && req.items.length > 0 
            ? req.items : [{ id: 'old', itemName: req.itemName || '', requestedQty: req.requestedQty || 0, unit: req.unit || '', targetWarehouse: req.targetWarehouse || 'RM' }];

          return (
          <div key={req.id} className="bg-white shadow-2xl rounded-3xl overflow-hidden border border-gray-200 break-inside-avoid print:border-gray-400 print:shadow-none">
            <div className="bg-gradient-to-r from-gray-900 to-gray-800 p-6 print:bg-white print:border-b-2 print:border-gray-800 print:p-2">
              <div className="flex justify-between items-start">
                <div className="w-full">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-bold text-gray-400 print:text-black">PR Date: {req.date}</span>
                    <div className="flex gap-2 items-center">
                       {getStatusBadge(req.status)}
                    </div>
                  </div>
                  <div className="bg-white/5 border border-white/10 rounded-xl p-4 print:bg-gray-50 print:border-gray-300">
                     <h4 className="text-sm font-bold text-gray-300 mb-3 print:text-gray-700">ဝယ်ယူမည့် ပစ္စည်းစာရင်း ({itemsToDisplay.length} မျိုး)</h4>
                     <ul className="space-y-2">
                       {itemsToDisplay.map((item, i) => (
                         <li key={i} className="flex justify-between items-center border-b border-white/10 pb-2 print:border-gray-200">
                           <span className="text-white font-black text-lg print:text-black">{item.itemName}</span>
                           <div className="flex items-center gap-3">
                             <span className="text-indigo-300 font-bold print:text-indigo-700">{item.requestedQty?.toLocaleString()} {item.unit}</span>
                             <span className="bg-gray-700 text-gray-300 text-[10px] px-2 py-1 rounded print:border print:bg-white print:text-black">ဂိုထောင်: {item.targetWarehouse}</span>
                           </div>
                         </li>
                       ))}
                     </ul>
                  </div>
                </div>
              </div>
            </div>

            <div className="p-4 md:p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 bg-gray-50">
              {req.suppliers?.map((sup) => (
                <div key={sup.id} className={`border-2 p-5 rounded-2xl relative bg-white ${req.selectedSupplierId === sup.id ? 'border-green-500 shadow-lg ring-4 ring-green-50' : 'border-gray-200'}`}>
                  {req.selectedSupplierId === sup.id && <div className="absolute -top-3 -right-3 bg-green-500 text-white w-8 h-8 flex justify-center items-center rounded-full font-black shadow print:hidden">✓</div>}
                  <h5 className="font-black text-lg text-gray-800 mb-1">{sup.name}</h5>
                  <div className="text-red-600 font-black text-2xl mb-3 print:text-black">{sup.price?.toLocaleString()} Ks</div>
                  
                  <div className="bg-gray-100 p-3 rounded-lg mb-4 space-y-2 border border-gray-200">
                     <h6 className="text-[10px] font-bold text-gray-500 uppercase">ပစ္စည်းအလိုက် ဈေးနှုန်းများ</h6>
                     {itemsToDisplay.map(item => (
                        <div key={item.id} className="flex justify-between text-xs text-gray-700 font-bold border-b border-gray-200 pb-1 last:border-0 last:pb-0">
                           <span className="truncate w-1/2">{item.itemName}:</span>
                           <span className="text-indigo-700">{(sup.itemUnitPrices?.[item.id!] || 0).toLocaleString()} Ks / {item.unit}</span>
                        </div>
                     ))}
                  </div>

                  <div className="text-xs font-medium text-gray-700 bg-gray-50 p-3 rounded-xl border mb-4 print:bg-white">{sup.qualityDesc}</div>
                  
                  {/* 🌟 🌟 🌟 QC & Finance ၏ သဘောထားမှတ်ချက်များ ပြန်လည်ထည့်သွင်းခြင်း 🌟 🌟 🌟 */}
                  <div className="space-y-2 my-4">
                     {req.qcSelectedSupplierId === sup.id && (
                        <div className="bg-blue-50 border border-blue-200 p-3 rounded-xl print:border-none shadow-sm">
                          <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider flex items-center gap-1 mb-1"><span>🔬</span> QC ရွေးချယ်ထောက်ခံထားသောဆိုင်</span>
                          <span className="text-sm text-blue-900 font-bold">"{req.qcRemark}"</span>
                        </div>
                     )}
                     {req.financeSelectedSupplierId === sup.id && (
                        <div className="bg-purple-50 border border-purple-200 p-3 rounded-xl print:border-none shadow-sm">
                          <span className="text-[10px] font-bold text-purple-600 uppercase tracking-wider flex items-center gap-1 mb-1"><span>💰</span> Finance ရွေးချယ်ထောက်ခံထားသောဆိုင်</span>
                          <span className="text-sm text-purple-900 font-bold">"{req.financeRemark}"</span>
                        </div>
                     )}
                  </div>
                  
                  <div className="mt-4 print:hidden space-y-2">
                    {req.status === 'Pending' && isQC && <button onClick={() => handleQCRecommend(req.id, sup.id)} className="w-full bg-blue-100 hover:bg-blue-600 hover:text-white text-blue-700 border border-blue-300 font-bold py-2.5 rounded-xl transition-colors">🔬 QC ထောက်ခံမည်</button>}
                    {req.status === 'QC_Approved' && isFinance && <button onClick={() => handleFinanceRecommend(req.id, sup.id)} className="w-full bg-purple-100 hover:bg-purple-600 hover:text-white text-purple-700 border border-purple-300 font-bold py-2.5 rounded-xl transition-colors">💰 Finance ထောက်ခံမည်</button>}
                    {req.status === 'Finance_Approved' && isMDorManager && !req.selectedSupplierId && (
                      <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="w-full bg-green-600 text-white font-black py-3 shadow-md rounded-xl hover:bg-green-700 transition-transform active:scale-95 text-sm uppercase tracking-wide">👑 ဤဆိုင်မှ ဝယ်မည်</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {req.status !== 'Completed' && req.status !== 'Rejected' && (
              <div className="bg-indigo-50/50 p-5 flex flex-wrap justify-end gap-3 items-center print:hidden border-t">
                <span className="text-xs font-black text-indigo-800/50 mr-auto uppercase tracking-widest">Next Action</span>
                {req.status === 'MD_Approved' && isPurchasing && <button onClick={() => updateStatus(req.id, 'Purchased')} className="bg-yellow-500 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md hover:bg-yellow-600">🛒 ဝယ်ယူလိုက်ပါပြီ</button>}
                {req.status === 'Purchased' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Received')} className="bg-cyan-600 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md hover:bg-cyan-700">🔬 ပစ္စည်းရောက်/စစ်ပြီး</button>}
                {req.status === 'QC_Received' && isStoreKeeper && <button onClick={() => handleStoreReceive(req.id)} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-sm shadow-md hover:bg-indigo-700">📦 ဂိုထောင်လက်ခံမည်</button>}
                
                {req.status === 'Store_Received' && isFinance && (
                   <div className="flex gap-2 items-center bg-white p-2 rounded-xl border border-teal-200 shadow-sm flex-wrap">
                      <select value={syncPaymentMethod} onChange={(e) => setSyncPaymentMethod(e.target.value)} className="bg-teal-50 text-teal-800 font-bold p-2.5 rounded-lg outline-none border border-teal-100 text-sm">
                        <option value="CASH (လက်ငင်း)">CASH (လက်ငင်း)</option>
                        <option value="BANK TRANSFER">BANK TRANSFER</option>
                        <option value="CREDIT (အကြွေး)">CREDIT (အကြွေးဝယ်)</option>
                      </select>
                      <button onClick={() => updateStatus(req.id, 'Completed', undefined, undefined, { paymentMethod: syncPaymentMethod })} className="bg-teal-600 text-white px-6 py-2.5 rounded-lg font-black shadow hover:bg-teal-700 animate-pulse whitespace-nowrap">
                        ✅ စာရင်းသွင်းမည် (Auto +)
                      </button>
                   </div>
                )}
                
                {(isQC || isFinance || isMDorManager) && req.status !== 'Purchased' && req.status !== 'QC_Received' && req.status !== 'Store_Received' && (
                   <button onClick={() => handleReject(req.id)} className="bg-white border-2 border-red-200 text-red-600 px-6 py-2.5 rounded-xl font-bold ml-4 hover:bg-red-50">❌ ပယ်ချမည်</button>
                )}
              </div>
            )}
          </div>
        );})}
      </div>

      {previewImage && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 print:hidden" onClick={() => setPreviewImage(null)}>
          <img src={previewImage} alt="Preview" className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl" />
          <button onClick={() => setPreviewImage(null)} className="absolute top-6 right-6 bg-red-600 text-white w-12 h-12 rounded-full font-bold text-2xl shadow-lg hover:bg-red-700 transition-transform hover:scale-110">✕</button>
        </div>
      )}
    </div>
  );
};
