import React, { useState } from 'react';

// အပြင်က App.tsx က ခေါ်သုံးလို့ရအောင် export ကို ထည့်ပေးထားပါတယ်
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
  // Procurement logic များ
  return (
    <div className="p-6">
      <h2 className="text-2xl font-bold">ဝယ်ယူရေးနှင့် တင်ဒါစနစ်</h2>
      {/* ဒီနေရာမှာ MD ကြီး၏ Procurement UI များ ရှိပါမည် */}
    </div>
  );
};
