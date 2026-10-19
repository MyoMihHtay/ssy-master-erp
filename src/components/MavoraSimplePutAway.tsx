import React, {
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  createInventoryPostingKey,
  postMavoraInventoryTransfer,
  type MavoraInventorySnapshot,
} from '../inventory/mavoraInventory';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraInventorySnapshot;
  onChanged: () => Promise<void>;
}

export const MavoraSimplePutAway: React.FC<Props> = ({
  tenantId,
  language,
  snapshot,
  onChanged,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [workingLotId, setWorkingLotId] =
    useState('');

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] =
    useState('');

  const [postingKeys, setPostingKeys] =
    useState<Record<string, string>>({});

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

  const putAwayItems = useMemo(() => {
    return snapshot.lots
      .filter((lot) => lot.status === 'released')
      .map((lot) => {
        const product =
          productsById.get(lot.product_id);

        const sourceBalance =
          snapshot.balances.find(
            (balance) => {
              const warehouse =
                warehousesById.get(
                  balance.warehouse_id
                );

              return (
                balance.lot_id === lot.id &&
                Number(balance.quantity || 0) > 0 &&
                warehouse?.warehouse_type
                  .toUpperCase() === 'QUARANTINE'
              );
            }
          );

        if (!product || !sourceBalance) {
          return null;
        }

        const destinationWarehouse =
          snapshot.warehouses.find(
            (warehouse) =>
              warehouse.is_active &&
              warehouse.id !==
                sourceBalance.warehouse_id &&
              warehouse.warehouse_type
                .toUpperCase() ===
                product.product_type.toUpperCase()
          );

        return {
          lot,
          product,
          sourceBalance,
          sourceWarehouse:
            warehousesById.get(
              sourceBalance.warehouse_id
            ),
          destinationWarehouse,
          quantity: Number(
            sourceBalance.quantity || 0
          ),
        };
      })
      .filter(
        (
          item
        ): item is NonNullable<typeof item> =>
          item !== null
      );
  }, [
    snapshot.lots,
    snapshot.balances,
    snapshot.warehouses,
    productsById,
    warehousesById,
  ]);

  const handlePutAway = async (
    item: (typeof putAwayItems)[number]
  ) => {
    setErrorMessage('');
    setMessage('');
    setWorkingLotId(item.lot.id);

    if (!item.destinationWarehouse) {
      setErrorMessage(
        t(
          'ဤကုန်ပစ္စည်းအတွက် သိုလှောင်မည့် Warehouse မတွေ့ပါ။ Admin Setup ကို စစ်ဆေးပါ။',
          'No destination warehouse is configured for this product type.'
        )
      );

      setWorkingLotId('');
      return;
    }

    const postingKey =
      postingKeys[item.lot.id] ||
      createInventoryPostingKey(
        'simple-putaway'
      );

    setPostingKeys((current) => ({
      ...current,
      [item.lot.id]: postingKey,
    }));

    try {
      await postMavoraInventoryTransfer({
        tenantId,
        sourceWarehouseId:
          item.sourceBalance.warehouse_id,
        destinationWarehouseId:
          item.destinationWarehouse.id,
        productId: item.product.id,
        quantity: item.quantity,
        postingKey,
        lotId: item.lot.id,
        referenceType: 'simple_putaway',
        referenceId: item.lot.lot_no,
        reason:
          'QC released stock put away via MAVORA Simple Operations',
      });

      setMessage(
        t(
          `${item.product.name} — ${item.quantity.toLocaleString()} ခုကို ${item.destinationWarehouse.name} သို့ အောင်မြင်စွာ သိုလှောင်ပြီးပါပြီ။`,
          `${item.product.name} — ${item.quantity.toLocaleString()} units moved successfully to ${item.destinationWarehouse.name}.`
        )
      );

      setPostingKeys((current) => {
        const next = { ...current };
        delete next[item.lot.id];
        return next;
      });

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to put away stock'
      );
    } finally {
      setWorkingLotId('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-black text-slate-800">
          🚚{' '}
          {t(
            'သိုလှောင်ရန်',
            'Put Away'
          )}
        </h3>

        <p className="text-sm font-bold text-slate-500 mt-1">
          {t(
            'QC အတည်ပြုပြီးသော ကုန်ပစ္စည်းများကို သက်ဆိုင်ရာ Warehouse သို့ ရွှေ့ပါ။',
            'Move QC-approved stock from Quarantine to its storage warehouse.'
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

      {putAwayItems.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-4xl">✅</div>

          <div className="font-black text-slate-700 mt-3">
            {t(
              'သိုလှောင်ရန် စောင့်ဆိုင်းနေသော ကုန်ပစ္စည်းမရှိပါ။',
              'No stock is waiting for Put Away.'
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {putAwayItems.map((item) => (
            <div
              key={item.lot.id}
              className="bg-white border rounded-2xl shadow-sm p-5"
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-5">
                <div className="space-y-1">
                  <div className="text-xs font-black text-blue-600">
                    {item.product.sku}
                  </div>

                  <div className="text-lg font-black text-slate-800">
                    {item.product.name}
                  </div>

                  <div className="text-sm font-bold text-slate-500">
                    Lot: {item.lot.lot_no}
                  </div>

                  {item.lot.batch_no && (
                    <div className="text-sm font-bold text-slate-500">
                      Batch: {item.lot.batch_no}
                    </div>
                  )}

                  <div className="text-sm font-bold text-slate-500">
                    {t('အရေအတွက်', 'Quantity')}
                    :{' '}
                    <span className="text-blue-700">
                      {item.quantity.toLocaleString()}
                    </span>
                  </div>

                  <div className="inline-flex mt-2 rounded-full bg-emerald-100 text-emerald-800 px-3 py-1 text-xs font-black">
                    ✅{' '}
                    {t(
                      'QC အတည်ပြုပြီး',
                      'QC Released'
                    )}
                  </div>
                </div>

                <div className="w-full lg:w-[420px] rounded-xl border bg-slate-50 p-4">
                  <div className="text-xs font-black text-slate-400">
                    {t(
                      'ရွှေ့မည့်လမ်းကြောင်း',
                      'Put Away Route'
                    )}
                  </div>

                  <div className="font-black text-slate-800 mt-2">
                    {item.sourceWarehouse?.code ||
                      'QUARANTINE'}
                    {' → '}
                    {item.destinationWarehouse
                      ? `${item.destinationWarehouse.code} — ${item.destinationWarehouse.name}`
                      : t(
                          'Destination Warehouse မရှိပါ',
                          'Destination unavailable'
                        )}
                  </div>

                  <button
                    type="button"
                    disabled={
                      workingLotId === item.lot.id ||
                      !item.destinationWarehouse
                    }
                    onClick={() =>
                      handlePutAway(item)
                    }
                    className="w-full mt-4 rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-3 font-black disabled:opacity-50"
                  >
                    🚚{' '}
                    {workingLotId === item.lot.id
                      ? t(
                          'သိုလှောင်နေသည်...',
                          'Putting away...'
                        )
                      : t(
                          'သိုလှောင်မည်',
                          'Put Away'
                        )}
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
