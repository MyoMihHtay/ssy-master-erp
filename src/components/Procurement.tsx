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
        handleSupplierChange(index, 'photo', reader.result as string);
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
    alert('✅ ဝယ်ယူခွင့် (PR) တင်ပြခြင်း အောင်မြင်ပါသည်။');
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId } : r));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-8">
      <h2 className="text-2xl font-extrabold text-indigo-900">🛒 ဝယ်ယူရေးနှင့် အဆင့်ဆင့် အတည်ပြုစနစ် (Procurement)</h2>
      
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white shadow-xl p-6 rounded-2xl border-t-4 border-orange-500">
          <div className="grid grid-cols-3 gap-4 mb-6 bg-gray-50 p-4 rounded-xl">
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ဝယ်ယူမည့် ပစ္စည်းအမည်</label>
              <input type="text" value={itemName} onChange={e => setItemName(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ပမာဏ</label>
              <input type="number" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" />
            </div>
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-1">ယူနစ်</label>
              <input type="text" value={unit} onChange={e => setUnit(e.target.value)} required className="w-full border-2 p-2.5 rounded-lg" />
            </div>
          </div>
          <button type="submit" className="w-full bg-orange-600 text-white font-bold py-3 rounded-xl">အတည်ပြုချက် တောင်းခံမည်</button>
        </form>
      )}

      <div className="space-y-6">
        <h3 className="text-xl font-bold text-gray-800">တင်ပြထားသော ဝယ်ယူခွင့်များ</h3>
        {requests.map(req => (
          <div key={req.id} className="bg-white shadow-lg rounded-2xl p-4 border">
            <h4 className="text-xl font-black">{req.itemName} ({req.requestedQty} {req.unit})</h4>
            <p className="text-gray-600 mb-4">Status: {req.status}</p>
            <div className="flex gap-3">
              {req.status === 'Pending' && isQC && (
                <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-600 text-white px-4 py-2 rounded-xl">QC Approve</button>
              )}
              {req.status === 'QC_Approved' && isFinance && (
                <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-600 text-white px-4 py-2 rounded-xl">Finance Approve</button>
              )}
              {req.status === 'Finance_Approved' && isMDorManager && (
                 <button onClick={() => updateStatus(req.id, 'MD_Approved')} className="bg-green-600 text-white px-4 py-2 rounded-xl">MD Approve</button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
