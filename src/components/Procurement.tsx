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
    setSuppliers([...suppliers, { id: Date.now().toString(), name: '', price: 0, qualityDesc: '', photo: '' }]);
  };

  const handleSupplierChange = (index: number, field: keyof SupplierOption, value: any) => {
    const updated = [...suppliers];
    updated[index] = { ...updated[index], [field]: value };
    setSuppliers(updated);
  };

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
    setSuppliers([{ id: Date.now().toString(), name: '', price: 0, qualityDesc: '', photo: '' }]);
  };

  const updateStatus = (id: number, newStatus: PurchaseRequest['status'], selectedId?: string) => {
    setRequests(requests.map(r => r.id === id ? { ...r, status: newStatus, selectedSupplierId: selectedId || r.selectedSupplierId } : r));
  };

  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold mb-4">ဝယ်ယူရေးနှင့် တင်ဒါစနစ်</h2>
      {isPurchasing && (
        <form onSubmit={handleSubmitPR} className="bg-white p-6 rounded-xl shadow mb-6">
          <input type="text" placeholder="ပစ္စည်းအမည်" value={itemName} onChange={e => setItemName(e.target.value)} className="border p-2 mr-2" />
          <input type="number" placeholder="ပမာဏ" value={requestedQty} onChange={e => setRequestedQty(e.target.value)} className="border p-2 mr-2" />
          <button type="submit" className="bg-blue-600 text-white px-4 py-2 rounded">တင်ပြမည်</button>
        </form>
      )}
      <div className="space-y-4">
        {requests.map(req => (
          <div key={req.id} className="bg-white p-4 rounded shadow border">
            <h3 className="font-bold">{req.itemName} - {req.status}</h3>
            {req.status === 'Pending' && isQC && <button onClick={() => updateStatus(req.id, 'QC_Approved')} className="bg-green-500 text-white px-2 py-1 rounded">QC Approve</button>}
          </div>
        ))}
      </div>
    </div>
  );
};
