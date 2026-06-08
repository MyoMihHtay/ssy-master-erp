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

// ... (Interface အဟောင်းများ အတိုင်းထားပါ) ...

export default function App() {
  // ... (State အဟောင်းများ အတိုင်းထားပါ) ...
  const [purchaseRequests, setPurchaseRequests] = useState<PurchaseRequest[]>([]);

  // ... (Return အပိုင်းတွင်) ...
  return (
    <div className="flex min-h-screen bg-gray-100">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userName={user?.name || ''} userRole={user?.role || ''} onLogout={() => setUser(null)} />
      <main className="flex-1 p-8 overflow-y-auto">
        {activeTab === 'inventory' && <Inventory userRole={user!.role} userName={user!.name} items={inventoryItems} setItems={setInventoryItems} onStockIn={handleStockInAndExpense} />}
        {activeTab === 'production' && <Production userRole={user!.role} inventoryItems={inventoryItems} recipes={recipes} setRecipes={setRecipes} onProductionConfirm={handleConfirmProduction} />}
        {activeTab === 'packaging' && <Packaging userRole={user!.role} inventoryItems={inventoryItems} packageRecipes={packageRecipes} setPackageRecipes={setPackageRecipes} onPackagingConfirm={handleConfirmPackaging} />}
        {activeTab === 'finished_goods' && <FinishedGoods userRole={user!.role} products={finishedGoods} setProducts={setFinishedGoods} />}
        {activeTab === 'procurement' && <Procurement userRole={user!.role} requests={purchaseRequests} setRequests={setPurchaseRequests} />}
        {activeTab === 'expenses' && <Expenses userRole={user!.role} userName={user!.name} expenses={expenses} setExpenses={setExpenses} />}
        {activeTab === 'accounts' && <AccountManagement accounts={accounts} setAccounts={setAccounts} currentUserRole={user!.role} />}
      </main>
    </div>
  );
}
