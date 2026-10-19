import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import { MavoraSimpleOperations } from './MavoraSimpleOperations';

import { MavoraLotManagement } from './MavoraLotManagement';

import {
  createInventoryPostingKey,
  createMavoraProduct,
  loadMavoraInventorySnapshot,
  postMavoraInventoryMovement,
  postMavoraInventoryTransfer,
  type MavoraInventorySnapshot,
  type MavoraMovementType,
  type MavoraProductType,
  type MavoraTrackingMode,
} from '../inventory/mavoraInventory';

interface MavoraInventoryProps {
  tenantId: string;
  language: AppLanguage;
}

type ViewTab =
  | 'operations'
  | 'overview'
  | 'products'
  | 'lots'
  | 'posting'
  | 'transfer'
  | 'ledger';

const EMPTY_SNAPSHOT: MavoraInventorySnapshot = {
  products: [],
  warehouses: [],
  units: [],
  categories: [],
  lots: [],
  balances: [],
  movements: [],
};

const numberValue = (value: unknown): number => {
  const result = Number(value ?? 0);
  return Number.isFinite(result) ? result : 0;
};

export const MavoraInventory: React.FC<
  MavoraInventoryProps
> = ({ tenantId, language }) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [activeView, setActiveView] =
    useState<ViewTab>('operations');

  const [showAdvanced, setShowAdvanced] =
    useState(false);

  const [snapshot, setSnapshot] =
    useState<MavoraInventorySnapshot>(EMPTY_SNAPSHOT);

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const [errorMessage, setErrorMessage] =
    useState<string>('');

  const [successMessage, setSuccessMessage] =
    useState<string>('');

  const [productForm, setProductForm] = useState({
    sku: '',
    name: '',
    productType: 'FG' as MavoraProductType,
    categoryId: '',
    baseUnitId: '',
    trackingMode: 'none' as MavoraTrackingMode,
  });

  const [movementForm, setMovementForm] = useState({
    productId: '',
    warehouseId: '',
    movementType: 'opening' as MavoraMovementType,
    lotId: '',
    quantity: '',
    unitCost: '',
    referenceId: '',
    reason: '',
  });

  const [movementPostingKey, setMovementPostingKey] =
    useState(() =>
      createInventoryPostingKey('ui-movement')
    );

  const [transferForm, setTransferForm] = useState({
    productId: '',
    lotId: '',
    sourceWarehouseId: '',
    destinationWarehouseId: '',
    quantity: '',
    referenceId: '',
    reason: '',
  });

  const [transferPostingKey, setTransferPostingKey] =
    useState(() =>
      createInventoryPostingKey('ui-transfer')
    );

  const refreshInventory = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data =
        await loadMavoraInventorySnapshot(tenantId);

      setSnapshot(data);

      setProductForm((current) => ({
        ...current,
        categoryId:
          current.categoryId ||
          data.categories.find(
            (item) => item.code === 'FG'
          )?.id ||
          data.categories[0]?.id ||
          '',
        baseUnitId:
          current.baseUnitId ||
          data.units.find(
            (item) => item.code === 'PCS'
          )?.id ||
          data.units[0]?.id ||
          '',
      }));

      setMovementForm((current) => ({
        ...current,
        productId:
          current.productId ||
          data.products[0]?.id ||
          '',
        warehouseId:
          current.warehouseId ||
          data.warehouses[0]?.id ||
          '',
      }));

      setTransferForm((current) => ({
        ...current,
        productId:
          current.productId ||
          data.products[0]?.id ||
          '',
        sourceWarehouseId:
          current.sourceWarehouseId ||
          data.warehouses[0]?.id ||
          '',
        destinationWarehouseId:
          current.destinationWarehouseId ||
          data.warehouses[1]?.id ||
          '',
      }));
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load MAVORA inventory'
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refreshInventory();
  }, [refreshInventory]);

  const productsById = useMemo(
    () =>
      new Map(
        snapshot.products.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.products]
  );

  const warehousesById = useMemo(
    () =>
      new Map(
        snapshot.warehouses.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.warehouses]
  );

  const lotsById = useMemo(
    () =>
      new Map(
        snapshot.lots.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.lots]
  );

  const unitsById = useMemo(
    () =>
      new Map(
        snapshot.units.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.units]
  );

  const categoriesById = useMemo(
    () =>
      new Map(
        snapshot.categories.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.categories]
  );

  const totalInventoryValue = useMemo(
    () =>
      snapshot.balances.reduce(
        (sum, item) =>
          sum +
          numberValue(item.quantity) *
            numberValue(item.average_unit_cost),
        0
      ),
    [snapshot.balances]
  );

  const selectedMovementProduct =
    productsById.get(movementForm.productId);

  const selectedTransferProduct =
    productsById.get(transferForm.productId);

  const movementNeedsReleasedLot =
    movementForm.movementType === 'issue' ||
    movementForm.movementType ===
      'production_consume' ||
    movementForm.movementType === 'return_out';

  const movementLots = useMemo(() => {
    if (
      !selectedMovementProduct ||
      selectedMovementProduct.tracking_mode === 'none'
    ) {
      return [];
    }

    return snapshot.lots.filter((lot) => {
      if (
        lot.product_id !== selectedMovementProduct.id ||
        lot.status === 'consumed'
      ) {
        return false;
      }

      if (movementNeedsReleasedLot) {
        return lot.status === 'released';
      }

      return true;
    });
  }, [
    snapshot.lots,
    selectedMovementProduct,
    movementNeedsReleasedLot,
  ]);

  const transferLots = useMemo(() => {
    if (
      !selectedTransferProduct ||
      selectedTransferProduct.tracking_mode === 'none'
    ) {
      return [];
    }

    return snapshot.lots.filter(
      (lot) =>
        lot.product_id === selectedTransferProduct.id &&
        lot.status === 'released'
    );
  }, [snapshot.lots, selectedTransferProduct]);

  useEffect(() => {
    setMovementForm((current) => {
      if (
        !selectedMovementProduct ||
        selectedMovementProduct.tracking_mode === 'none'
      ) {
        return current.lotId
          ? { ...current, lotId: '' }
          : current;
      }

      if (
        movementLots.some(
          (lot) => lot.id === current.lotId
        )
      ) {
        return current;
      }

      return {
        ...current,
        lotId: movementLots[0]?.id || '',
      };
    });
  }, [selectedMovementProduct, movementLots]);

  useEffect(() => {
    setTransferForm((current) => {
      if (
        !selectedTransferProduct ||
        selectedTransferProduct.tracking_mode === 'none'
      ) {
        return current.lotId
          ? { ...current, lotId: '' }
          : current;
      }

      if (
        transferLots.some(
          (lot) => lot.id === current.lotId
        )
      ) {
        return current;
      }

      return {
        ...current,
        lotId: transferLots[0]?.id || '',
      };
    });
  }, [selectedTransferProduct, transferLots]);

  const incomingMovement =
    movementForm.movementType === 'opening' ||
    movementForm.movementType === 'receipt' ||
    movementForm.movementType ===
      'adjustment_in' ||
    movementForm.movementType === 'return_in';

  const movementRequiresReason =
    movementForm.movementType === 'opening' ||
    movementForm.movementType ===
      'adjustment_in' ||
    movementForm.movementType ===
      'adjustment_out' ||
    movementForm.movementType === 'wastage';

  const handleCreateProduct = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    const selectedCategory =
      snapshot.categories.find(
        (category) =>
          category.id === productForm.categoryId
      );

    const categoryMustMatchType =
      [
        'RM',
        'SFG',
        'FG',
        'PKG',
        'SPARE',
        'CONSUMABLE',
      ].includes(productForm.productType);

    if (
      categoryMustMatchType &&
      (
        !selectedCategory ||
        selectedCategory.category_type !==
          productForm.productType
      )
    ) {
      setErrorMessage(
        t(
          'Product Type နှင့် Category ကိုက်ညီရပါမည်။',
          'Product Type and Category must match.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      await createMavoraProduct({
        tenantId,
        sku: productForm.sku,
        name: productForm.name,
        productType: productForm.productType,
        categoryId:
          productForm.categoryId || null,
        baseUnitId: productForm.baseUnitId,
        trackingMode:
          productForm.trackingMode,
      });

      setSuccessMessage(
        t(
          'ကုန်ပစ္စည်းအသစ်ကို MAVORA Product Master ထဲသို့ ထည့်ပြီးပါပြီ။',
          'Product created in MAVORA Product Master.'
        )
      );

      setProductForm((current) => ({
        ...current,
        sku: '',
        name: '',
      }));

      await refreshInventory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create product'
      );
    } finally {
      setWorking(false);
    }
  };

  const handlePostMovement = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const quantity = Number(
      movementForm.quantity
    );

    const unitCost =
      movementForm.unitCost.trim() === ''
        ? null
        : Number(movementForm.unitCost);

    if (!movementForm.productId) {
      setErrorMessage(
        t(
          'ကုန်ပစ္စည်းရွေးပါ။',
          'Select a product.'
        )
      );
      return;
    }

    if (!movementForm.warehouseId) {
      setErrorMessage(
        t(
          'Warehouse ရွေးပါ။',
          'Select a warehouse.'
        )
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage(
        t(
          'Quantity သည် 0 ထက်ကြီးရပါမည်။',
          'Quantity must be greater than zero.'
        )
      );
      return;
    }

    if (
      selectedMovementProduct?.tracking_mode !==
        'none' &&
      !movementForm.lotId
    ) {
      setErrorMessage(
        t(
          'ဤ Tracked Product အတွက် အသုံးပြုနိုင်သော Lot / Batch ကို ရွေးပါ။',
          'Select an available Lot / Batch for this tracked product.'
        )
      );
      return;
    }

    if (
      movementRequiresReason &&
      !movementForm.reason.trim()
    ) {
      setErrorMessage(
        t(
          'ဤ Movement အတွက် Reason ထည့်ရန်လိုအပ်ပါသည်။',
          'A reason is required for this movement.'
        )
      );
      return;
    }

    if (
      incomingMovement &&
      ['opening', 'receipt', 'adjustment_in'].includes(
        movementForm.movementType
      ) &&
      (unitCost === null ||
        !Number.isFinite(unitCost) ||
        unitCost < 0)
    ) {
      setErrorMessage(
        t(
          'Opening / Receipt / Adjustment In အတွက် Unit Cost ထည့်ပါ။',
          'Enter unit cost for Opening / Receipt / Adjustment In.'
        )
      );
      return;
    }

    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await postMavoraInventoryMovement({
        tenantId,
        warehouseId:
          movementForm.warehouseId,
        productId: movementForm.productId,
        movementType:
          movementForm.movementType,
        quantity,
        postingKey: movementPostingKey,
        lotId:
          selectedMovementProduct?.tracking_mode ===
          'none'
            ? null
            : movementForm.lotId,
        unitCost:
          incomingMovement ? unitCost : null,
        referenceType: 'inventory_ui',
        referenceId:
          movementForm.referenceId || null,
        reason: movementForm.reason || null,
      });

      setSuccessMessage(
        t(
          'Inventory Movement ကို အောင်မြင်စွာ Post လုပ်ပြီးပါပြီ။',
          'Inventory movement posted successfully.'
        )
      );

      setMovementForm((current) => ({
        ...current,
        quantity: '',
        unitCost: '',
        referenceId: '',
        reason: '',
      }));

      setMovementPostingKey(
        createInventoryPostingKey('ui-movement')
      );

      await refreshInventory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to post inventory movement'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleTransfer = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    const quantity = Number(
      transferForm.quantity
    );

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setErrorMessage(
        t(
          'Quantity သည် 0 ထက်ကြီးရပါမည်။',
          'Quantity must be greater than zero.'
        )
      );
      return;
    }

    if (
      !transferForm.sourceWarehouseId ||
      !transferForm.destinationWarehouseId
    ) {
      setErrorMessage(
        t(
          'Source နှင့် Destination Warehouse ရွေးပါ။',
          'Select source and destination warehouses.'
        )
      );
      return;
    }

    if (
      transferForm.sourceWarehouseId ===
      transferForm.destinationWarehouseId
    ) {
      setErrorMessage(
        t(
          'Source နှင့် Destination Warehouse မတူရပါမည်။',
          'Source and destination warehouses must be different.'
        )
      );
      return;
    }

    if (
      selectedTransferProduct?.tracking_mode !==
        'none' &&
      !transferForm.lotId
    ) {
      setErrorMessage(
        t(
          'Transfer အတွက် Released Lot / Batch ကို ရွေးပါ။',
          'Select a Released Lot / Batch for transfer.'
        )
      );
      return;
    }

    setWorking(true);
    setErrorMessage('');
    setSuccessMessage('');

    try {
      await postMavoraInventoryTransfer({
        tenantId,
        sourceWarehouseId:
          transferForm.sourceWarehouseId,
        destinationWarehouseId:
          transferForm.destinationWarehouseId,
        productId: transferForm.productId,
        quantity,
        postingKey: transferPostingKey,
        lotId:
          selectedTransferProduct?.tracking_mode ===
          'none'
            ? null
            : transferForm.lotId,
        referenceType: 'inventory_ui',
        referenceId:
          transferForm.referenceId || null,
        reason: transferForm.reason || null,
      });

      setSuccessMessage(
        t(
          'Warehouse Transfer ကို အောင်မြင်စွာ လုပ်ပြီးပါပြီ။',
          'Warehouse transfer completed successfully.'
        )
      );

      setTransferForm((current) => ({
        ...current,
        quantity: '',
        referenceId: '',
        reason: '',
      }));

      setTransferPostingKey(
        createInventoryPostingKey('ui-transfer')
      );

      await refreshInventory();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to transfer inventory'
      );
    } finally {
      setWorking(false);
    }
  };

  const tabs: {
    id: ViewTab;
    my: string;
    en: string;
  }[] = [
    {
      id: 'operations',
      my: 'နေ့စဉ်လုပ်ငန်း',
      en: 'Operations',
    },
    {
      id: 'overview',
      my: 'လက်ကျန်',
      en: 'Balances',
    },
    {
      id: 'products',
      my: 'ကုန်ပစ္စည်း',
      en: 'Products',
    },
    {
      id: 'lots',
      my: 'Lot / Batch',
      en: 'Lot / Batch',
    },
    {
      id: 'posting',
      my: 'Stock Post',
      en: 'Stock Post',
    },
    {
      id: 'transfer',
      my: 'Warehouse လွှဲ',
      en: 'Transfer',
    },
    {
      id: 'ledger',
      my: 'Ledger',
      en: 'Ledger',
    },
  ];

  const visibleTabs = showAdvanced
    ? tabs
    : tabs.filter(
        (tab) =>
          tab.id === 'operations' ||
          tab.id === 'overview'
      );

  if (loading) {
    return (
      <div className="p-8 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <div className="font-bold text-slate-500">
          {t(
            'MAVORA Inventory Data ရယူနေပါသည်...',
            'Loading MAVORA inventory...'
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b-2 border-blue-100 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <span className="text-4xl">📦</span>
            <div>
              <h2 className="text-2xl md:text-3xl font-black text-slate-800">
                MAVORA Inventory
              </h2>
              <p className="text-xs md:text-sm font-bold text-slate-500 mt-1">
                {showAdvanced
                  ? t(
                      'Atomic Ledger • Warehouse Control • Audit Ready',
                      'Atomic Ledger • Warehouse Control • Audit Ready'
                    )
                  : t(
                      'နေ့စဉ်ကုန်ပစ္စည်းလုပ်ငန်းများကို ရိုးရှင်းလွယ်ကူစွာ အသုံးပြုနိုင်ပါသည်။',
                      'Simple daily inventory operations'
                    )}
              </p>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={refreshInventory}
          disabled={working}
          className="px-4 py-2.5 rounded-xl bg-slate-900 text-white font-black hover:bg-slate-700 disabled:opacity-50"
        >
          🔄 {t('Refresh', 'Refresh')}
        </button>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-800">
        🛡️{' '}
        {showAdvanced
          ? t(
              'ဤ Screen သည် MAVORA DEV Database ကိုအသုံးပြုပါသည်။ Stock Balance/Ledger ကို Client မှ တိုက်ရိုက်ပြင်၍မရဘဲ Controlled RPC ဖြင့်သာ Post လုပ်ပါသည်။',
              'This screen uses the MAVORA DEV database. Stock balances and ledger rows are posted only through controlled RPCs.'
            )
          : t(
              'နေ့စဉ်အသုံးပြုမှုအတွက် ရိုးရှင်းသော Mode ဖြစ်ပါသည်။ လုံခြုံရေး၊ ကုန်လက်ကျန်စာရင်းနှင့် လုပ်ဆောင်မှုမှတ်တမ်းများကို MAVORA က နောက်ကွယ်မှ အလိုအလျောက်ထိန်းသိမ်းပေးပါသည်။',
              'Simple Mode for daily use. MAVORA handles security, stock records and audit history automatically.'
            )}
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      {successMessage && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 font-bold text-emerald-700">
          ✅ {successMessage}
        </div>
      )}

      {showAdvanced && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase">
              {t('Products', 'Products')}
            </p>
            <p className="text-3xl font-black text-blue-700 mt-2">
              {snapshot.products.length}
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase">
              {t('Warehouses', 'Warehouses')}
            </p>
            <p className="text-3xl font-black text-indigo-700 mt-2">
              {snapshot.warehouses.length}
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase">
              {t('Ledger Lines', 'Ledger Lines')}
            </p>
            <p className="text-3xl font-black text-violet-700 mt-2">
              {snapshot.movements.length}
            </p>
          </div>

          <div className="bg-white border rounded-2xl p-4 shadow-sm">
            <p className="text-xs font-black text-slate-400 uppercase">
              {t('Inventory Value', 'Inventory Value')}
            </p>
            <p className="text-xl md:text-2xl font-black text-emerald-700 mt-2">
              {totalInventoryValue.toLocaleString()} Ks
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-2 overflow-x-auto bg-white border rounded-2xl p-2 shadow-sm">
        {visibleTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveView(tab.id);
              setErrorMessage('');
              setSuccessMessage('');
            }}
            className={`px-4 py-3 rounded-xl font-black whitespace-nowrap transition ${
              activeView === tab.id
                ? 'bg-blue-600 text-white shadow'
                : 'text-slate-500 hover:bg-slate-100'
            }`}
          >
            {language === 'my' ? tab.my : tab.en}
          </button>
        ))}
      </div>

      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => {
            const next = !showAdvanced;
            setShowAdvanced(next);

            if (!next) {
              setActiveView('operations');
            }
          }}
          className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 font-black hover:bg-slate-200"
        >
          ⚙️{' '}
          {showAdvanced
            ? t(
                'ရိုးရှင်းသောအသုံးပြုမှု',
                'Simple Mode'
              )
            : t(
                'အဆင့်မြင့် (Advanced)',
                'Advanced'
              )}
        </button>
      </div>

      {activeView === 'operations' && (
        <MavoraSimpleOperations
          tenantId={tenantId}
          language={language}
          snapshot={snapshot}
          onChanged={refreshInventory}
        />
      )}

      {activeView === 'overview' && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-black text-slate-800">
              {t(
                'Warehouse Stock Balances',
                'Warehouse Stock Balances'
              )}
            </h3>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[950px] text-sm">
              <thead className="bg-slate-100 text-slate-600">
                <tr>
                  <th className="p-3 text-left">
                    SKU
                  </th>
                  <th className="p-3 text-left">
                    {t('ကုန်ပစ္စည်း', 'Product')}
                  </th>
                  <th className="p-3 text-left">
                    Warehouse
                  </th>
                  <th className="p-3 text-left">
                    Lot / Batch
                  </th>
                  <th className="p-3 text-right">
                    {t('လက်ကျန်', 'On Hand')}
                  </th>
                  <th className="p-3 text-right">
                    Reserved
                  </th>
                  <th className="p-3 text-right">
                    Available
                  </th>
                  <th className="p-3 text-right">
                    Avg Cost
                  </th>
                  <th className="p-3 text-right">
                    Value
                  </th>
                </tr>
              </thead>

              <tbody>
                {snapshot.balances.map((balance) => {
                  const product =
                    productsById.get(
                      balance.product_id
                    );

                  const warehouse =
                    warehousesById.get(
                      balance.warehouse_id
                    );

                  const qty = numberValue(
                    balance.quantity
                  );

                  const reserved = numberValue(
                    balance.reserved_quantity
                  );

                  const avg = numberValue(
                    balance.average_unit_cost
                  );

                  return (
                    <tr
                      key={balance.id}
                      className="border-t hover:bg-blue-50/40"
                    >
                      <td className="p-3 font-bold text-slate-500">
                        {product?.sku || '-'}
                      </td>

                      <td className="p-3 font-black text-slate-800">
                        {product?.name || '-'}
                      </td>

                      <td className="p-3">
                        <span className="font-black">
                          {warehouse?.code || '-'}
                        </span>
                        <span className="text-slate-400 ml-2">
                          {warehouse?.name}
                        </span>
                      </td>

                      <td className="p-3">
                        {balance.lot_id
                          ? (() => {
                              const lot =
                                lotsById.get(balance.lot_id);

                              return lot
                                ? `${lot.lot_no}${
                                    lot.batch_no
                                      ? ` / ${lot.batch_no}`
                                      : ''
                                  }`
                                : '-';
                            })()
                          : '-'}
                      </td>

                      <td className="p-3 text-right font-black text-blue-700">
                        {qty.toLocaleString()}
                      </td>

                      <td className="p-3 text-right">
                        {reserved.toLocaleString()}
                      </td>

                      <td className="p-3 text-right font-black text-emerald-700">
                        {(
                          qty - reserved
                        ).toLocaleString()}
                      </td>

                      <td className="p-3 text-right">
                        {avg.toLocaleString()} Ks
                      </td>

                      <td className="p-3 text-right font-black">
                        {(qty * avg).toLocaleString()} Ks
                      </td>
                    </tr>
                  );
                })}

                {snapshot.balances.length === 0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-10 text-center text-slate-400 font-bold"
                    >
                      {t(
                        'Stock Balance မရှိသေးပါ။ Product ဖန်တီးပြီး Opening Stock Post လုပ်နိုင်ပါသည်။',
                        'No stock balances yet. Create a product and post opening stock.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {activeView === 'products' && (
        <div className="grid lg:grid-cols-[380px_1fr] gap-5">
          <form
            onSubmit={handleCreateProduct}
            className="bg-white border rounded-2xl shadow-sm p-5 space-y-4 h-fit"
          >
            <h3 className="text-lg font-black text-slate-800">
              ➕{' '}
              {t(
                'Product Master အသစ်',
                'New Product Master'
              )}
            </h3>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                SKU *
              </label>
              <input
                required
                value={productForm.sku}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    sku: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
                placeholder="FG-001"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t('အမည်', 'Product Name')} *
              </label>
              <input
                required
                value={productForm.name}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    name: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold outline-none focus:border-blue-500"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Product Type
              </label>
              <select
                value={productForm.productType}
                onChange={(event) => {
                  const productType =
                    event.target
                      .value as MavoraProductType;

                  const matchingCategory =
                    snapshot.categories.find(
                      (category) =>
                        category.category_type ===
                        productType
                    );

                  setProductForm((current) => ({
                    ...current,
                    productType,
                    categoryId:
                      matchingCategory?.id ||
                      current.categoryId,
                  }));
                }}
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                {[
                  'RM',
                  'SFG',
                  'FG',
                  'PKG',
                  'SPARE',
                  'CONSUMABLE',
                  'OTHER',
                ].map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Category
              </label>
              <select
                value={productForm.categoryId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    categoryId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                {snapshot.categories.map(
                  (category) => (
                    <option
                      key={category.id}
                      value={category.id}
                    >
                      {category.code} —{' '}
                      {category.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Base Unit
              </label>
              <select
                value={productForm.baseUnitId}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    baseUnitId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                {snapshot.units.map((unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.code} — {unit.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Tracking
              </label>
              <select
                value={productForm.trackingMode}
                onChange={(event) =>
                  setProductForm((current) => ({
                    ...current,
                    trackingMode:
                      event.target
                        .value as MavoraTrackingMode,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="none">
                  None
                </option>
                <option value="lot">
                  Lot
                </option>
                <option value="batch">
                  Batch
                </option>
              </select>

              {productForm.trackingMode !==
                'none' && (
                <p className="text-xs font-bold text-amber-600 mt-2">
                  ⚠️{' '}
                  {t(
                    'Tracked Product များကို Receiving သို့မဟုတ် Lot / Batch workflow မှ စနစ်တကျ စီမံနိုင်ပါသည်။',
                    'Tracked products are managed through Receiving or the Lot / Batch workflow.'
                  )}
                </p>
              )}
            </div>

            <button
              disabled={
                working ||
                !productForm.baseUnitId
              }
              className="w-full bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-3 font-black disabled:opacity-50"
            >
              {working
                ? t(
                    'လုပ်ဆောင်နေသည်...',
                    'Working...'
                  )
                : t(
                    'Product သိမ်းမည်',
                    'Create Product'
                  )}
            </button>
          </form>

          <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
            <div className="p-4 bg-slate-50 border-b font-black text-slate-800">
              {t(
                'MAVORA Product Master',
                'MAVORA Product Master'
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[800px] text-sm">
                <thead className="bg-slate-100">
                  <tr>
                    <th className="p-3 text-left">
                      SKU
                    </th>
                    <th className="p-3 text-left">
                      {t('အမည်', 'Name')}
                    </th>
                    <th className="p-3 text-left">
                      Type
                    </th>
                    <th className="p-3 text-left">
                      Category
                    </th>
                    <th className="p-3 text-left">
                      Unit
                    </th>
                    <th className="p-3 text-left">
                      Tracking
                    </th>
                  </tr>
                </thead>

                <tbody>
                  {snapshot.products.map(
                    (product) => (
                      <tr
                        key={product.id}
                        className="border-t"
                      >
                        <td className="p-3 font-black text-blue-700">
                          {product.sku}
                        </td>
                        <td className="p-3 font-black">
                          {product.name}
                        </td>
                        <td className="p-3">
                          {product.product_type}
                        </td>
                        <td className="p-3">
                          {product.category_id
                            ? categoriesById.get(
                                product.category_id
                              )?.code || '-'
                            : '-'}
                        </td>
                        <td className="p-3">
                          {unitsById.get(
                            product.base_unit_id
                          )?.code || '-'}
                        </td>
                        <td className="p-3">
                          {product.tracking_mode}
                        </td>
                      </tr>
                    )
                  )}

                  {snapshot.products.length ===
                    0 && (
                    <tr>
                      <td
                        colSpan={6}
                        className="p-10 text-center text-slate-400 font-bold"
                      >
                        {t(
                          'Product မရှိသေးပါ။',
                          'No products yet.'
                        )}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeView === 'lots' && (
        <MavoraLotManagement
          tenantId={tenantId}
          language={language}
          snapshot={snapshot}
          onChanged={refreshInventory}
        />
      )}

      {activeView === 'posting' && (
        <form
          onSubmit={handlePostMovement}
          className="bg-white border rounded-2xl shadow-sm p-5 max-w-3xl space-y-4"
        >
          <h3 className="text-xl font-black text-slate-800">
            🧾{' '}
            {t(
              'Controlled Stock Posting',
              'Controlled Stock Posting'
            )}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Product
              </label>
              <select
                value={movementForm.productId}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    productId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="">
                  -- Select --
                </option>
                {snapshot.products.map(
                  (product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.sku} —{' '}
                      {product.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Warehouse
              </label>
              <select
                value={movementForm.warehouseId}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    warehouseId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="">
                  -- Select --
                </option>
                {snapshot.warehouses.map(
                  (warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.code} —{' '}
                      {warehouse.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {selectedMovementProduct &&
              selectedMovementProduct.tracking_mode !==
                'none' && (
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">
                    Lot / Batch *
                  </label>

                  <select
                    value={movementForm.lotId}
                    onChange={(event) =>
                      setMovementForm((current) => ({
                        ...current,
                        lotId: event.target.value,
                      }))
                    }
                    className="w-full border-2 rounded-xl p-3 font-bold"
                  >
                    <option value="">
                      -- Select Lot / Batch --
                    </option>

                    {movementLots.map((lot) => (
                      <option
                        key={lot.id}
                        value={lot.id}
                      >
                        {lot.lot_no}
                        {lot.batch_no
                          ? ` / ${lot.batch_no}`
                          : ''}{' '}
                        [{lot.status}]
                      </option>
                    ))}
                  </select>

                  {movementLots.length === 0 && (
                    <p className="text-xs font-bold text-amber-700 mt-1">
                      {t(
                        'အသုံးပြုနိုင်သော Lot / Batch မရှိသေးပါ။',
                        'No eligible Lot / Batch is available.'
                      )}
                    </p>
                  )}
                </div>
              )}

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Movement Type
              </label>
              <select
                value={movementForm.movementType}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    movementType:
                      event.target
                        .value as MavoraMovementType,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="opening">
                  Opening
                </option>
                <option value="receipt">
                  Receipt
                </option>
                <option value="issue">
                  Issue
                </option>
                <option value="adjustment_in">
                  Adjustment In
                </option>
                <option value="adjustment_out">
                  Adjustment Out
                </option>
                <option value="return_in">
                  Return In
                </option>
                <option value="return_out">
                  Return Out
                </option>
                <option value="wastage">
                  Wastage
                </option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={movementForm.quantity}
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    quantity:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>

            {incomingMovement && (
              <div>
                <label className="block text-xs font-black text-slate-500 mb-1">
                  Unit Cost (Ks)
                </label>
                <input
                  type="number"
                  step="0.000001"
                  min="0"
                  value={movementForm.unitCost}
                  onChange={(event) =>
                    setMovementForm(
                      (current) => ({
                        ...current,
                        unitCost:
                          event.target.value,
                      })
                    )
                  }
                  className="w-full border-2 rounded-xl p-3 font-bold"
                />
              </div>
            )}

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Reference
              </label>
              <input
                value={
                  movementForm.referenceId
                }
                onChange={(event) =>
                  setMovementForm((current) => ({
                    ...current,
                    referenceId:
                      event.target.value,
                  }))
                }
                placeholder="GRN-001 / ADJ-001"
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Reason{' '}
              {movementRequiresReason
                ? '*'
                : ''}
            </label>
            <textarea
              value={movementForm.reason}
              onChange={(event) =>
                setMovementForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold min-h-24"
            />
          </div>

          <div className="text-[11px] font-mono text-slate-400 break-all">
            Posting Key: {movementPostingKey}
          </div>

          <button
            disabled={
              working ||
              snapshot.products.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black disabled:opacity-50"
          >
            {working
              ? t(
                  'Post လုပ်နေသည်...',
                  'Posting...'
                )
              : t(
                  'Stock Movement Post လုပ်မည်',
                  'Post Stock Movement'
                )}
          </button>
        </form>
      )}

      {activeView === 'transfer' && (
        <form
          onSubmit={handleTransfer}
          className="bg-white border rounded-2xl shadow-sm p-5 max-w-3xl space-y-4"
        >
          <h3 className="text-xl font-black text-slate-800">
            🚚{' '}
            {t(
              'Atomic Warehouse Transfer',
              'Atomic Warehouse Transfer'
            )}
          </h3>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-black text-slate-500 mb-1">
                Product
              </label>
              <select
                value={transferForm.productId}
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    productId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="">
                  -- Select --
                </option>
                {snapshot.products.map(
                  (product) => (
                    <option
                      key={product.id}
                      value={product.id}
                    >
                      {product.sku} —{' '}
                      {product.name}
                    </option>
                  )
                )}
              </select>
            </div>

            {selectedTransferProduct &&
              selectedTransferProduct.tracking_mode !==
                'none' && (
                <div className="md:col-span-2">
                  <label className="block text-xs font-black text-slate-500 mb-1">
                    Released Lot / Batch *
                  </label>

                  <select
                    value={transferForm.lotId}
                    onChange={(event) =>
                      setTransferForm((current) => ({
                        ...current,
                        lotId: event.target.value,
                      }))
                    }
                    className="w-full border-2 rounded-xl p-3 font-bold"
                  >
                    <option value="">
                      -- Select Released Lot / Batch --
                    </option>

                    {transferLots.map((lot) => (
                      <option
                        key={lot.id}
                        value={lot.id}
                      >
                        {lot.lot_no}
                        {lot.batch_no
                          ? ` / ${lot.batch_no}`
                          : ''}{' '}
                        [released]
                      </option>
                    ))}
                  </select>

                  {transferLots.length === 0 && (
                    <p className="text-xs font-bold text-amber-700 mt-1">
                      {t(
                        'Released Lot / Batch မရှိသေးပါ။ QC Release အရင်လုပ်ပါ။',
                        'No Released Lot / Batch is available. Complete QC Release first.'
                      )}
                    </p>
                  )}
                </div>
              )}

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Source Warehouse
              </label>
              <select
                value={
                  transferForm.sourceWarehouseId
                }
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    sourceWarehouseId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="">
                  -- Select --
                </option>
                {snapshot.warehouses.map(
                  (warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.code} —{' '}
                      {warehouse.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Destination Warehouse
              </label>
              <select
                value={
                  transferForm.destinationWarehouseId
                }
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    destinationWarehouseId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                <option value="">
                  -- Select --
                </option>
                {snapshot.warehouses.map(
                  (warehouse) => (
                    <option
                      key={warehouse.id}
                      value={warehouse.id}
                    >
                      {warehouse.code} —{' '}
                      {warehouse.name}
                    </option>
                  )
                )}
              </select>
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Quantity
              </label>
              <input
                type="number"
                step="0.000001"
                min="0"
                value={transferForm.quantity}
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    quantity:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Reference
              </label>
              <input
                value={
                  transferForm.referenceId
                }
                onChange={(event) =>
                  setTransferForm((current) => ({
                    ...current,
                    referenceId:
                      event.target.value,
                  }))
                }
                placeholder="TRF-001"
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Reason
            </label>
            <textarea
              value={transferForm.reason}
              onChange={(event) =>
                setTransferForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold min-h-24"
            />
          </div>

          <div className="text-[11px] font-mono text-slate-400 break-all">
            Posting Key: {transferPostingKey}
          </div>

          <button
            disabled={
              working ||
              snapshot.products.length === 0 ||
              snapshot.warehouses.length < 2
            }
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl font-black disabled:opacity-50"
          >
            {working
              ? t(
                  'Transfer လုပ်နေသည်...',
                  'Transferring...'
                )
              : t(
                  'Warehouse Transfer လုပ်မည်',
                  'Post Warehouse Transfer'
                )}
          </button>
        </form>
      )}

      {activeView === 'ledger' && (
        <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-slate-50">
            <h3 className="font-black text-slate-800">
              📚{' '}
              {t(
                'Inventory Movement Ledger',
                'Inventory Movement Ledger'
              )}
            </h3>
            <p className="text-xs text-slate-400 font-bold mt-1">
              {t(
                'နောက်ဆုံး Movement 200 ခု',
                'Latest 200 movements'
              )}
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1100px] text-xs">
              <thead className="bg-slate-100">
                <tr>
                  <th className="p-3 text-left">
                    Date
                  </th>
                  <th className="p-3 text-left">
                    Type
                  </th>
                  <th className="p-3 text-left">
                    SKU
                  </th>
                  <th className="p-3 text-left">
                    Product
                  </th>
                  <th className="p-3 text-left">
                    Warehouse
                  </th>
                  <th className="p-3 text-left">
                    Lot / Batch
                  </th>
                  <th className="p-3 text-right">
                    Qty
                  </th>
                  <th className="p-3 text-right">
                    Unit Cost
                  </th>
                  <th className="p-3 text-left">
                    Reference
                  </th>
                  <th className="p-3 text-left">
                    Reason
                  </th>
                </tr>
              </thead>

              <tbody>
                {snapshot.movements.map(
                  (movement) => {
                    const product =
                      productsById.get(
                        movement.product_id
                      );

                    const warehouse =
                      warehousesById.get(
                        movement.warehouse_id
                      );

                    const qty = numberValue(
                      movement.quantity
                    );

                    return (
                      <tr
                        key={movement.id}
                        className="border-t hover:bg-slate-50"
                      >
                        <td className="p-3 whitespace-nowrap">
                          {new Date(
                            movement.occurred_at
                          ).toLocaleString()}
                        </td>

                        <td className="p-3 font-black">
                          {movement.movement_type}
                        </td>

                        <td className="p-3 font-bold text-blue-700">
                          {product?.sku || '-'}
                        </td>

                        <td className="p-3">
                          {product?.name || '-'}
                        </td>

                        <td className="p-3">
                          {warehouse?.code || '-'}
                        </td>

                        <td className="p-3">
                          {movement.lot_id
                            ? (() => {
                                const lot =
                                  lotsById.get(
                                    movement.lot_id
                                  );

                                return lot
                                  ? `${lot.lot_no}${
                                      lot.batch_no
                                        ? ` / ${lot.batch_no}`
                                        : ''
                                    }`
                                  : '-';
                              })()
                            : '-'}
                        </td>

                        <td
                          className={`p-3 text-right font-black ${
                            qty >= 0
                              ? 'text-emerald-700'
                              : 'text-red-600'
                          }`}
                        >
                          {qty.toLocaleString()}
                        </td>

                        <td className="p-3 text-right">
                          {numberValue(
                            movement.unit_cost
                          ).toLocaleString()}{' '}
                          Ks
                        </td>

                        <td className="p-3">
                          {movement.reference_id ||
                            '-'}
                        </td>

                        <td className="p-3 max-w-xs truncate">
                          {movement.reason || '-'}
                        </td>
                      </tr>
                    );
                  }
                )}

                {snapshot.movements.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-10 text-center text-slate-400 font-bold"
                    >
                      {t(
                        'Ledger Movement မရှိသေးပါ။',
                        'No ledger movements yet.'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
