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

export default function App() {
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);
  // ... (ကျန်တဲ့ state များနှင့် logic အဟောင်းများ) ...
  
  return (
    <div className="flex min-h-screen bg-gray-100">
       {/* Sidebar နှင့် အခြား UI များ */}
       <main className="flex-1 p-8 overflow-y-auto">
         {/* ... */}
         {/* Procurement ကို ခေါ်သုံးထားသည့် နေရာ */}
         <Procurement userRole={'md'} requests={purchaseRequests} setRequests={setPurchaseRequests} />
       </main>
    </div>
  );
}
