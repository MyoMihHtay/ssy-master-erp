import React, { useState } from 'react';

export interface SupplierOption {
  id: string;
  name: string;
  price: number;
  qualityDesc: string;
  photo?: string;
}

export interface PurchaseRequest {
  id: number;
  date: string;
  itemName: string;
  requestedQty: number;
  unit: string;
  suppliers: SupplierOption[];
  selectedSupplierId?: string;
  status: 'Pending' | 'QC_Approved' | 'Finance_Approved' | 'MD_Approved' | 'Rejected';
}

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
    { id: '1', name: '', price: 0, qualityDesc: '', photo: '' }
  ]);

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md';
  const isFinance = userRole === 'finance' || userRole === 'md';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleAddSupplier = () => {
    if (suppliers.length < 3) {
      setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', photo: '' }]);
    } else {
      alert('အများဆုံး Supplier ၃ ခုသာ ယှဉ်ပြနိုင်ပါသည်။');
    }
  };

  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => {
    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: value };
    setSuppliers(updated);
  };

  const handleImageUpload = (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        handleSupplierChange(index, 'photo', reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty || suppliers.length === 0) return alert('အချက်အလက် ပြည့်စုံစွာ ဖြည့်ပါ။');
    
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
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', photo: '' }]);
    alert('✅ ဝယ်ယူခွင့် (PR) တင်ပြခြင်း အောင်မြင်ပါသည်။ (QC သို့ ရောက်ရှိသွားပါပြီ)');
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId } : r));
  };

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'Pending': return <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">⏳ Pending (စောင့်ဆိုင်းဆဲ)</span>;
      case 'QC_Approved': return <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">🔬 QC မှန်ကန်သည် (Finance သို့ပို့ထားသည်)</span>;
      case 'Finance_Approved': return <span className="bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">💰 Finance မှန်ကန်သည် (MD သို့ပို့ထားသည်)</span>;
      case 'MD_Approved': return <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">✅ MD ခွင့်ပြုပြီး (ဝယ်ယူရန်)</span>;
      case 'Rejected': return <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-bold shadow-sm">❌ ငြင်းပယ်သည်</span>;
      default: return null;
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <div className="flex items-center gap-3 border-b-2 border-indigo-200 pb-4">
        <span className="text-4xl">🛒</span>
        <div>
          <h2 className="text-2xl font-extrabold text-indigo-900">ဝယ်ယူရေးနှင့် အဆင့်ဆင့် အတည်ပြုစနစ် (Procurement & Tender)</h2>
          <p className="text-sm text-gray-500 font-medium mt-1">Purchasing ➔ QC ➔ Finance ➔ MD</p>
        </div>
      </div>

      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-xl p-6 rounded-2xl border-t-4 border-orange-500">
          <h3 className="text-lg font-bold text-gray-800 mb-4 flex justify-between">
            <span>📝 ဝယ်ယူခွင့် တောင်းခံလွှာ အသစ် (PR)</span>
            <button type="button" onClick={handleAddSupplier} className="bg-indigo-50 text-indigo-700 text-sm px-3 py-1 rounded-lg font-bold hover:bg-indigo-100">+ Supplier ထပ်ထည့်မည်</button>
          </h3>
          <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl border border-gray-200">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ဝယ်ယူမည့် ပစ္စည်းအမည်</label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg focus:border-indigo-500" placeholder="ဥပမာ - ကြက်သွန်နီ" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ပမာဏ</label>
              <input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg focus:border-indigo-500" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ယူနစ်</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg focus:border-indigo-500" placeholder="ပိဿာ / ခု" />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            {suppliers.map((sup, idx) => (
              <div key={sup.id} className="border-2 border-dashed border-gray-300 p-4 rounded-xl bg-white hover:border-indigo-400 transition-colors">
                <h4 className="font-bold text-indigo-700 mb-3 border-b pb-2">Supplier {idx + 1}</h4>
                <div className="space-y-3">
                  <input type="text" placeholder="ဆိုင်အမည် / ပွဲရုံ" value={sup.name} onChange={e => handleSupplierChange(idx, 'name', e.target.value)} required className="w-full border p-2 rounded-lg" />
                  <input type="number" placeholder="ဈေးနှုန်း (Ks)" value={sup.price || ''} onChange={e => handleSupplierChange(idx, 'price', Number(e.target.value))} required className="w-full border p-2 rounded-lg font-bold text-red-600" />
                  <textarea placeholder="အရည်အသွေး၊ အရောင်၊ အနံ့" value={sup.qualityDesc} onChange={e => handleSupplierChange(idx, 'qualityDesc', e.target.value)} required className="w-full border p-2 rounded-lg text-sm h-16" />
                  <div className="flex gap-2 items-center">
                    <label className="flex-1 cursor-pointer bg-gray-100 border p-2 rounded-lg text-center text-sm font-bold hover:bg-gray-200">
                      📸 ပုံထည့်မည်
                      <input type="file" accept="image/*" onChange={(e) => handleImageUpload(idx, e)} className="hidden" />
                    </label>
                    {sup.photo && <img src={sup.photo} alt="Sup" className="w-10 h-10 object-cover rounded-md border" />}
                  </div>
                </div>
              </div>
            ))}
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl shadow-lg hover:bg-orange-700 transition-colors text-lg">
            အတည်ပြုချက် တောင်းခံမည် 🚀
          </button>
        </form>
      )}

      {/* Approval Board */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800 border-l-4 border-indigo-500 pl-3">တင်ပြထားသော ဝယ်ယူခွင့်များ (Approval Board)</h3>
        {requests.length === 0 ? <p className="text-gray-500">တင်ပြထားသော စာရင်းမရှိသေးပါ။</p> : requests.map(req => (
          <div key={req.id} className="bg-white shadow-lg rounded-2xl overflow-hidden border border-gray-200">
            <div className="bg-gray-50 p-4 border-b flex justify-between items-center">
              <div>
                <span className="text-sm text-gray-500">{req.date}</span>
                <h4 className="text-xl font-black text-gray-800">{req.itemName} <span className="text-indigo-600 text-base">({req.requestedQty} {req.unit})</span></h4>
              </div>
              <div>{getStatusBadge(req.status)}</div>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-6">
              {req.suppliers.map((sup, idx) => (
                <div key={sup.id} className={`border-2 p-4 rounded-xl relative ${req.selectedSupplierId === sup.id ? 'border-green-500 bg-green-50 shadow-md' : 'border-gray-200 bg-white'}`}>
                  {req.selectedSupplierId === sup.id && <div className="absolute -top-3 -right-3 bg-green-500 text-white w-8 h-8 flex justify-center items-center rounded-full font-bold shadow-lg">✓</div>}
                  <h5 className="font-bold text-lg text-gray-800">{sup.name}</h5>
                  <div className="text-red-600 font-black text-xl my-2">{sup.price.toLocaleString()} Ks</div>
                  <p className="text-sm text-gray-600 mb-3 bg-gray-50 p-2 rounded border leading-relaxed">{sup.qualityDesc}</p>
                  {sup.photo ? <img src={sup.photo} alt="quality" className="w-full h-32 object-cover rounded-lg shadow-sm" /> : <div className="w-full h-32 bg-gray-100 flex items-center justify-center text-gray-400 text-sm rounded-lg border">ဓာတ်ပုံမပါပါ</div>}
                  
                  {/* Final Approval Button for MD/Manager */}
                  {req.status === 'Finance_Approved' && isMDorManager && (
                    <button onClick={() => updateStatus(req.id, 'MD_Approved', sup.id)} className="mt-4 w-full bg-green-600 hover:bg-green-700 text-white font-bold py-2 rounded-lg transition-colors shadow-md">
                      👑 ဤ Supplier ထံမှ ဝယ်မည်
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Action Bar */}
            <div className="bg-gray-100 p-4 border-t flex justify-end gap-3">
              {req.status === 'Pending' && isQC && (
                <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-blue-700">🔬 အရည်အသွေး မှန်ကန်သည် (QC Approve)</button>
              )}
              {req.status === 'QC_Approved' && isFinance && (
                <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-6 py-2 rounded-xl font-bold shadow-md hover:bg-purple-700">💰 ဈေးနှုန်း မှန်ကန်သည် (Finance Approve)</button>
              )}
              {req.status !== 'MD_Approved' && req.status !== 'Rejected' && isMDorManager && (
                 <button onClick={() => updateStatus(req.id, 'Rejected')} className="bg-red-100 text-red-600 px-6 py-2 rounded-xl font-bold hover:bg-red-200">❌ ပယ်ချမည်</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
