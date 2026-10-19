import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  createInventoryPostingKey,
  postMavoraInventoryMovement,
  type MavoraInventorySnapshot,
} from '../inventory/mavoraInventory';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraInventorySnapshot;
  onChanged: () => Promise<void>;
}

export const MavoraSimpleIssue: React.FC<Props> = ({
  tenantId,
  language,
  snapshot,
  onChanged,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [working, setWorking] = useState(false);
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');

  const [postingKey, setPostingKey] = useState(
    () => createInventoryPostingKey('simple-issue')
  );

  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    lotId: '',
    quantity: '',
    referenceId: '',
    reason: '',
  });

  const productsById = useMemo(
    () =>
      new Map(
        snapshot.products.map((product) => [
          product.id,
          product,
        ])
      ),
    [snapshot.products]
  );

  const lotsById = useMemo(
    () =>
      new Map(
        snapshot.lots.map((lot) => [
          lot.id,
          lot,
        ])
      ),
    [snapshot.lots]
  );

  const warehousesById = useMemo(
    () =>
      new Map(
        snapshot.warehouses.map((warehouse) => [
          warehouse.id,
          warehouse,
        ])
      ),
    [snapshot.warehouses]
  );

  const issueableBalances = useMemo(
    () =>
      snapshot.balances.filter((balance) => {
        const warehouse =
          warehousesById.get(balance.warehouse_id);

        const product =
          productsById.get(balance.product_id);

        const available =
          Number(balance.quantity || 0) -
          Number(balance.reserved_quantity || 0);

        if (
          !warehouse ||
          !product ||
          available <= 0 ||
          warehouse.warehouse_type.toUpperCase() ===
            'QUARANTINE'
        ) {
          return false;
        }

        if (balance.lot_id) {
          const lot =
            lotsById.get(balance.lot_id);

          return lot?.status === 'released';
        }

        return true;
      }),
    [
      snapshot.balances,
      warehousesById,
      productsById,
      lotsById,
    ]
  );

  const issueableProducts = useMemo(() => {
    const ids = new Set(
      issueableBalances.map(
        (balance) => balance.product_id
      )
    );

    return snapshot.products.filter(
      (product) =>
        product.is_active &&
        ids.has(product.id)
    );
  }, [
    snapshot.products,
    issueableBalances,
  ]);

  const selectedProduct =
    productsById.get(form.productId);

  const productBalances = useMemo(
    () =>
      issueableBalances.filter(
        (balance) =>
          balance.product_id === form.productId
      ),
    [issueableBalances, form.productId]
  );

  const eligibleWarehouses = useMemo(() => {
    const ids = new Set(
      productBalances.map(
        (balance) => balance.warehouse_id
      )
    );

    return snapshot.warehouses.filter(
      (warehouse) => ids.has(warehouse.id)
    );
  }, [
    snapshot.warehouses,
    productBalances,
  ]);

  const lotOptions = useMemo(() => {
    if (
      !selectedProduct ||
      selectedProduct.tracking_mode === 'none'
    ) {
      return [];
    }

    return productBalances
      .filter(
        (balance) =>
          balance.warehouse_id ===
            form.warehouseId &&
          balance.lot_id
      )
      .map((balance) => {
        const lot = balance.lot_id
          ? lotsById.get(balance.lot_id)
          : undefined;

        return {
          balance,
          lot,
          available:
            Number(balance.quantity || 0) -
            Number(balance.reserved_quantity || 0),
        };
      })
      .filter(
        (item) =>
          item.lot?.status === 'released'
      )
      .sort((a, b) => {
        const aExpiry =
          a.lot?.expires_at || '9999-12-31';

        const bExpiry =
          b.lot?.expires_at || '9999-12-31';

        return aExpiry.localeCompare(bExpiry);
      });
  }, [
    selectedProduct,
    productBalances,
    form.warehouseId,
    lotsById,
  ]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      productId:
        issueableProducts.some(
          (product) =>
            product.id === current.productId
        )
          ? current.productId
          : issueableProducts[0]?.id || '',
    }));
  }, [issueableProducts]);

  useEffect(() => {
    setForm((current) => ({
      ...current,
      warehouseId:
        eligibleWarehouses.some(
          (warehouse) =>
            warehouse.id ===
            current.warehouseId
        )
          ? current.warehouseId
          : eligibleWarehouses[0]?.id || '',
    }));
  }, [eligibleWarehouses]);

  useEffect(() => {
    if (
      selectedProduct?.tracking_mode === 'none'
    ) {
      setForm((current) => ({
        ...current,
        lotId: '',
      }));
      return;
    }

    setForm((current) => ({
      ...current,
      lotId:
        lotOptions.some(
          (item) =>
            item.lot?.id === current.lotId
        )
          ? current.lotId
          : lotOptions[0]?.lot?.id || '',
    }));
  }, [
    selectedProduct?.tracking_mode,
    lotOptions,
  ]);

  const selectedBalance = useMemo(() => {
    if (!selectedProduct) return undefined;

    if (
      selectedProduct.tracking_mode === 'none'
    ) {
      return productBalances.find(
        (balance) =>
          balance.warehouse_id ===
          form.warehouseId &&
          !balance.lot_id
      );
    }

    return productBalances.find(
      (balance) =>
        balance.warehouse_id ===
          form.warehouseId &&
        balance.lot_id === form.lotId
    );
  }, [
    selectedProduct,
    productBalances,
    form.warehouseId,
    form.lotId,
  ]);

  const available = selectedBalance
    ? Number(selectedBalance.quantity || 0) -
      Number(
        selectedBalance.reserved_quantity || 0
      )
    : 0;

  const handleIssue = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setMessage('');
    setErrorMessage('');

    const quantity = Number(form.quantity);

    if (!selectedProduct) {
      setErrorMessage(
        t(
          'ထုတ်ပေးမည့် ကုန်ပစ္စည်းကို ရွေးပါ။',
          'Select a product to issue.'
        )
      );
      return;
    }

    if (!form.warehouseId) {
      setErrorMessage(
        t(
          'Warehouse ကို ရွေးပါ။',
          'Select a warehouse.'
        )
      );
      return;
    }

    if (
      selectedProduct.tracking_mode !==
        'none' &&
      !form.lotId
    ) {
      setErrorMessage(
        t(
          'Batch / Lot ကို ရွေးပါ။',
          'Select a Lot / Batch.'
        )
      );
      return;
    }

    if (
      !Number.isFinite(quantity) ||
      quantity <= 0
    ) {
      setErrorMessage(
        t(
          'အရေအတွက်ကို မှန်ကန်စွာ ထည့်ပါ။',
          'Enter a valid quantity.'
        )
      );
      return;
    }

    if (quantity > available) {
      setErrorMessage(
        t(
          `လက်ရှိထုတ်ပေးနိုင်သော အရေအတွက် ${available.toLocaleString()} သာရှိပါသည်။`,
          `Only ${available.toLocaleString()} units are available.`
        )
      );
      return;
    }

    setWorking(true);

    try {
      await postMavoraInventoryMovement({
        tenantId,
        warehouseId: form.warehouseId,
        productId: selectedProduct.id,
        movementType: 'issue',
        quantity,
        postingKey,
        lotId:
          selectedProduct.tracking_mode ===
          'none'
            ? null
            : form.lotId,
        referenceType: 'simple_issue',
        referenceId:
          form.referenceId.trim() || null,
        reason:
          form.reason.trim() ||
          'Inventory issued via MAVORA Simple Operations',
      });

      setMessage(
        t(
          `${selectedProduct.name} — ${quantity.toLocaleString()} ခု ထုတ်ပေးပြီးပါပြီ။`,
          `${selectedProduct.name} — ${quantity.toLocaleString()} units issued successfully.`
        )
      );

      setPostingKey(
        createInventoryPostingKey(
          'simple-issue'
        )
      );

      setForm((current) => ({
        ...current,
        quantity: '',
        referenceId: '',
        reason: '',
      }));

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to issue inventory'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-black text-slate-800">
          📤{' '}
          {t(
            'ကုန်ပစ္စည်းထုတ်ပေးရန်',
            'Issue Stock'
          )}
        </h3>

        <p className="text-sm font-bold text-slate-500 mt-1">
          {t(
            'အသုံးပြုနိုင်သော Stock မှသာ ထုတ်ပေးနိုင်ပါသည်။ Batch Product ဖြစ်ပါက သက်တမ်းကုန်ရက်အနီးဆုံး Batch ကို MAVORA က အရင်ရွေးပေးပါသည်။',
            'Only available stock can be issued. For tracked products, MAVORA recommends the earliest-expiring released batch first.'
          )}
        </p>
      </div>

      {message && (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 font-bold text-emerald-700">
          ✅ {message}
        </div>
      )}

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-3 font-bold text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      {issueableProducts.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-4xl">📦</div>

          <div className="font-black text-slate-700 mt-3">
            {t(
              'ထုတ်ပေးနိုင်သော Stock မရှိပါ။',
              'No stock is currently available to issue.'
            )}
          </div>
        </div>
      ) : (
        <form
          onSubmit={handleIssue}
          className="bg-white border rounded-2xl shadow-sm p-5 max-w-3xl space-y-4"
        >
          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              {t('ကုန်ပစ္စည်း', 'Product')} *
            </label>

            <select
              value={form.productId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  productId:
                    event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              {issueableProducts.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.sku} — {product.name}
                  </option>
                )
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Warehouse *
            </label>

            <select
              value={form.warehouseId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  warehouseId:
                    event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              {eligibleWarehouses.map(
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

          {selectedProduct?.tracking_mode !==
            'none' && (
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t(
                  'Batch / Lot',
                  'Batch / Lot'
                )}{' '}
                *
              </label>

              <select
                value={form.lotId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    lotId: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                {lotOptions.map((item) => (
                  <option
                    key={item.lot?.id}
                    value={item.lot?.id}
                  >
                    {item.lot?.batch_no ||
                      item.lot?.lot_no}
                    {' — '}
                    {item.available.toLocaleString()}
                    {' available'}
                    {item.lot?.expires_at
                      ? ` — Exp ${item.lot.expires_at}`
                      : ''}
                  </option>
                ))}
              </select>

              {lotOptions.length > 1 && (
                <p className="text-xs font-bold text-blue-600 mt-2">
                  ✨{' '}
                  {t(
                    'MAVORA က သက်တမ်းကုန်ရက်အနီးဆုံး Batch ကို အလိုအလျောက်အရင်ရွေးထားပါသည်။',
                    'MAVORA preselects the earliest-expiring batch (FEFO).'
                  )}
                </p>
              )}
            </div>
          )}

          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3">
            <div className="text-xs font-black text-blue-600">
              {t(
                'ထုတ်ပေးနိုင်သော လက်ကျန်',
                'Available to Issue'
              )}
            </div>

            <div className="text-2xl font-black text-blue-800 mt-1">
              {available.toLocaleString()}
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              {t('ထုတ်ပေးမည့်အရေအတွက်', 'Issue Quantity')} *
            </label>

            <input
              type="number"
              min="0"
              step="any"
              value={form.quantity}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  quantity:
                    event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
              placeholder="10"
            />
          </div>

          <details className="rounded-xl border bg-slate-50">
            <summary className="cursor-pointer p-3 font-black text-slate-600">
              ⚙️{' '}
              {t(
                'အပိုအချက်အလက် — လိုအပ်မှသာ',
                'More details — only if needed'
              )}
            </summary>

            <div className="p-4 pt-1 space-y-3">
              <input
                value={form.referenceId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    referenceId:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold bg-white"
                placeholder={t(
                  'ထုတ်ပေးစာ / Reference No.',
                  'Issue / Reference No.'
                )}
              />

              <textarea
                value={form.reason}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    reason:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold bg-white"
                placeholder={t(
                  'ထုတ်ပေးရသည့်အကြောင်းရင်း',
                  'Issue reason'
                )}
              />
            </div>
          </details>

          <button
            type="submit"
            disabled={
              working ||
              available <= 0
            }
            className="w-full rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-4 font-black text-lg disabled:opacity-50"
          >
            📤{' '}
            {working
              ? t(
                  'ထုတ်ပေးနေသည်...',
                  'Issuing...'
                )
              : t(
                  'ထုတ်ပေးမည်',
                  'Issue Stock'
                )}
          </button>
        </form>
      )}
    </div>
  );
};
