import React, { useState } from 'react';
import { Sidebar } from './components/Sidebar';
import { Login } from './components/Login';
import { Inventory } from './components/Inventory';
import { Production } from './components/Production';
import { Packaging } from './components/Packaging';
import { FinishedGoods } from './components/FinishedGoods';
import { Expenses } from './components/Expenses';
import { AccountManagement } from './components/AccountManagement';
import { Procurement, PurchaseRequest } from './components/Procurement';

// ... (Interface အပိုင်းများကို မပြောင်းပါနှင့်) ...

export default function App() {
  // ... (State အဟောင်းများ) ...
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);

  // ... (return အပိုင်းတွင် Procurement ကို ထည့်ရန်) ...
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user?.name || ''} userRole={user?.role || ''} onLogout={() => setUser(null)} />
      <main className="flex-1 p-8 overflow-y-auto">
        {/* ... (အခြား Tab များ) ... */}
        {activeTab === 'procurement' && <Procurement userRole={user?.role || ''} requests={purchaseRequests} setRequests={setPurchaseRequests} />}
      </main>
    </div>
  );
}