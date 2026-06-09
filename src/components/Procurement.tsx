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
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([{ id: '1', name: '', price: 0, qualityDesc: '', photo: '' }]);

  const isPurchasing = userRole === 'purchasing' || userRole === 'md' || userRole === 'manager';
  const isQC = userRole === 'qc' || userRole === 'md';
  const isFinance = userRole === 'finance' || userRole === 'md';
  const isMDorManager = userRole === 'md' || userRole === 'manager';

  const handleSubmitPR = (e: React.FormEvent) => {
    e.preventDefault();
    if (!itemName || !requestedQty) return;
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
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId } : r));
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h2 className="text-2xl font-bold mb-6 text-indigo-900">🛒 ဝယ်ယူရေးနှင့် တင်ဒါစနစ်</h2>
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white p-6 rounded-xl shadow-lg border border-indigo-100 mb-8">
           <input type="text" placeholder="ပစ္စည်းအမည်" value={itemName} onChange={e => setItemName(e.target.value)} className="border p-2 mr-2 rounded" required />
           <input type="number" placeholder="ပမာဏ" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} className="border p-2 mr-2 rounded" required />
           <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">အတည်ပြုချက် တောင်းခံမည်</button>
        </form>
      )}
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="bg-white p-4 rounded shadow border border-gray-200">
            <h3 className="font-bold text-lg">{req.itemName}</h3>
            <p className="text-sm text-gray-600">Status: {req.status}</p>
            <div className="mt-2 flex gap-2">
              {req.status === 'Pending' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-blue-500 text-white px-3 py-1 rounded">QC Approve</button>}
              {req.status === 'QC_Approved' && isFinance && <button onClick={() => updateStatus(req.id, 'Finance_Approved')} className="bg-purple-500 text-white px-3 py-1 rounded">Finance Approve</button>}
              {req.status === 'Finance_Approved' && isMDorManager && <button onClick={() => updateStatus(req.id, 'MD_Approved')} className="bg-green-500 text-white px-3 py-1 rounded">MD Approve</button>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};