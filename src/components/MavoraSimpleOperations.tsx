import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import { MavoraSimpleQc } from './MavoraSimpleQc';
import { MavoraSimplePutAway } from './MavoraSimplePutAway';
import { MavoraSimpleIssue } from './MavoraSimpleIssue';

import {
  createInventoryPostingKey,
  receiveMavoraInventory,
  type MavoraInventorySnapshot,
  type MavoraSimpleReceiveResult,
} from '../inventory/mavoraInventory';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraInventorySnapshot;
  onChanged: () => Promise<void>;
}

export const MavoraSimpleOperations: React.FC<Props> = ({
  tenantId,
  language,
  snapshot,
  onChanged,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [activeOperation, setActiveOperation] =
    useState<
      'receive' | 'qc' | 'putaway' | 'issue'
    >('receive');

  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [lastResult, setLastResult] =
    useState<MavoraSimpleReceiveResult | null>(null);

  const [postingKey, setPostingKey] = useState(
    () => createInventoryPostingKey('simple-receive')
  );

  const [form, setForm] = useState({
    productId: '',
    warehouseId: '',
    quantity: '',
    unitCost: '',
    manufacturedAt: '',
    expiresAt: '',
    referenceId: '',
    notes: '',
  });

  const selectedProduct = snapshot.products.find(
    (item) => item.id === form.productId
  );

  const isTracked =
    selectedProduct?.tracking_mode === 'lot' ||
    selectedProduct?.tracking_mode === 'batch';

  const quarantineWarehouse = useMemo(
    () =>
      snapshot.warehouses.find(
        (item) =>
          item.warehouse_type.toUpperCase() ===
          'QUARANTINE'
      ),
    [snapshot.warehouses]
  );

  const normalWarehouses = useMemo(
    () =>
      snapshot.warehouses.filter(
        (item) =>
          item.warehouse_type.toUpperCase() !==
          'QUARANTINE'
      ),
    [snapshot.warehouses]
  );

  const pendingQcCount = useMemo(
    () =>
      snapshot.lots.filter(
        (lot) => lot.status === 'quarantine'
      ).length,
    [snapshot.lots]
  );

  useEffect(() => {
    setForm((current) => ({
      ...current,
      productId:
        snapshot.products.some(
          (item) => item.id === current.productId
        )
          ? current.productId
          : snapshot.products[0]?.id || '',
    }));
  }, [snapshot.products]);

  useEffect(() => {
    if (!selectedProduct) return;

    if (isTracked) {
      setForm((current) => ({
        ...current,
        warehouseId: quarantineWarehouse?.id || '',
      }));
      return;
    }

    const recommended =
      normalWarehouses.find(
        (warehouse) =>
          warehouse.warehouse_type.toUpperCase() ===
          selectedProduct.product_type.toUpperCase()
      ) ||
      normalWarehouses[0] ||
      snapshot.warehouses[0];

    setForm((current) => ({
      ...current,
      warehouseId: recommended?.id || '',
    }));
  }, [
    selectedProduct?.id,
    isTracked,
    quarantineWarehouse?.id,
    normalWarehouses,
    snapshot.warehouses,
  ]);

  const handleReceive = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');
    setLastResult(null);

    const quantity = Number(form.quantity);
    const unitCost = Number(form.unitCost);

    if (!form.productId) {
      setErrorMessage(
        t('ကုန်ပစ္စည်းကို ရွေးပါ။', 'Select a product.')
      );
      return;
    }

    if (!Number.isFinite(quantity) || quantity <= 0) {
      setErrorMessage(
        t(
          'အရေအတွက်ကို မှန်ကန်စွာ ထည့်ပါ။',
          'Enter a valid quantity.'
        )
      );
      return;
    }

    if (
      form.unitCost.trim() === '' ||
      !Number.isFinite(unitCost) ||
      unitCost < 0
    ) {
      setErrorMessage(
        t(
          'တစ်ယူနစ်ကုန်ကျငွေကို ထည့်ပါ။',
          'Enter a valid unit cost.'
        )
      );
      return;
    }

    if (!form.warehouseId) {
      setErrorMessage(
        t(
          'လက်ခံမည့် Warehouse မတွေ့ပါ။',
          'Receiving warehouse is unavailable.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      const result =
        await receiveMavoraInventory({
          tenantId,
          warehouseId: form.warehouseId,
          productId: form.productId,
          quantity,
          unitCost,
          postingKey,
          lotNo: null,
          batchNo: null,
          manufacturedAt:
            isTracked && form.manufacturedAt
              ? form.manufacturedAt
              : null,
          expiresAt:
            isTracked && form.expiresAt
              ? form.expiresAt
              : null,
          referenceId:
            form.referenceId.trim() || null,
          notes: form.notes.trim() || null,
        });

      setLastResult(result);

      setSuccessMessage(
        result.tracked
          ? t(
              'ကုန်ဝင်ပြီးပါပြီ။ MAVORA မှ Lot/Batch ဖန်တီးပြီး QC စစ်ရန်ထားရှိထားပါသည်။',
              'Stock received. MAVORA created the Lot/Batch and placed it in Pending QC.'
            )
          : t(
              'ကုန်ဝင်စာရင်း အောင်မြင်ပါသည်။',
              'Stock receipt completed successfully.'
            )
      );

      setPostingKey(
        createInventoryPostingKey('simple-receive')
      );

      setForm((current) => ({
        ...current,
        quantity: '',
        manufacturedAt: '',
        expiresAt: '',
        referenceId: '',
        notes: '',
      }));

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to receive stock'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h3 className="text-2xl font-black text-slate-800">
          🏭 {t('နေ့စဉ်လုပ်ငန်း', 'Daily Operations')}
        </h3>
        <p className="text-sm font-bold text-slate-500 mt-1">
          {t(
            'အသုံးပြုသူအတွက် ရိုးရှင်းပြီး လုံခြုံရေး၊ ကုန်လက်ကျန်စာရင်းနှင့် လုပ်ဆောင်မှုမှတ်တမ်းများကို MAVORA က နောက်ကွယ်မှ အလိုအလျောက်လုပ်ပေးပါသည်။',
            'Simple for users while MAVORA handles control, ledger and audit automatically.'
          )}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <button
          type="button"
          onClick={() =>
            setActiveOperation('receive')
          }
          className={`text-left rounded-2xl border-2 p-4 transition ${
            activeOperation === 'receive'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-2xl">📥</div>
          <div className="font-black text-blue-800 mt-2">
            {t('၁။ ကုန်ဝင်', '1. Receive')}
          </div>
          <div className="text-xs font-bold text-blue-600 mt-1">
            {t('အသုံးပြုနိုင်သည်', 'Ready')}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveOperation('qc')
          }
          className={`text-left rounded-2xl border-2 p-4 transition ${
            activeOperation === 'qc'
              ? 'border-amber-500 bg-amber-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-2xl">🧪</div>
          <div className="font-black text-slate-700 mt-2">
            {t(
              '၂။ အရည်အသွေးစစ်ရန် (QC)',
              '2. QC Check'
            )}
          </div>
          <div className="text-xs font-bold text-amber-600 mt-1">
            {pendingQcCount}{' '}
            {t('ခု စစ်ရန်ရှိ', 'pending')}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveOperation('putaway')
          }
          className={`text-left rounded-2xl border-2 p-4 transition ${
            activeOperation === 'putaway'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-2xl">🚚</div>

          <div className="font-black text-slate-700 mt-2">
            {t(
              '၃။ သိုလှောင် / လွှဲ',
              '3. Put Away / Transfer'
            )}
          </div>

          <div className="text-xs font-bold text-blue-600 mt-1">
            {t(
              'အသုံးပြုနိုင်သည်',
              'Ready'
            )}
          </div>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveOperation('issue')
          }
          className={`text-left rounded-2xl border-2 p-4 transition ${
            activeOperation === 'issue'
              ? 'border-blue-500 bg-blue-50'
              : 'border-slate-200 bg-white hover:bg-slate-50'
          }`}
        >
          <div className="text-2xl">📤</div>

          <div className="font-black text-slate-700 mt-2">
            {t('၄။ ထုတ်ပေး', '4. Issue')}
          </div>

          <div className="text-xs font-bold text-blue-600 mt-1">
            {t(
              'အသုံးပြုနိုင်သည်',
              'Ready'
            )}
          </div>
        </button>
      </div>

      {activeOperation === 'receive' && (
        <div className="grid lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleReceive}
          className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
        >
          <h3 className="text-xl font-black text-slate-800">
            📥 {t('ကုန်ဝင်သွင်းမည်', 'Receive Stock')}
          </h3>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              {t('ကုန်ပစ္စည်း', 'Product')} *
            </label>

            <select
              value={form.productId}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              <option value="">
                -- {t('ရွေးပါ', 'Select')} --
              </option>

              {snapshot.products
                .filter((product) => product.is_active)
                .map((product) => (
                  <option key={product.id} value={product.id}>
                    {product.sku} — {product.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t('အရေအတွက်', 'Quantity')} *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.quantity}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    quantity: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
                placeholder="500"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t(
                  'တစ်ယူနစ်ကုန်ကျငွေ',
                  'Unit Cost'
                )}{' '}
                *
              </label>
              <input
                type="number"
                min="0"
                step="any"
                value={form.unitCost}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    unitCost: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
                placeholder="1200"
              />
            </div>
          </div>

          {isTracked ? (
            <div className="rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
              <div className="font-black text-amber-900">
                🧪{' '}
                {quarantineWarehouse
                  ? `${quarantineWarehouse.code} — ${quarantineWarehouse.name}`
                  : t(
                      'Quarantine Warehouse မရှိပါ',
                      'Quarantine Warehouse unavailable'
                    )}
              </div>
              <p className="text-xs font-bold text-amber-700 mt-1">
                {t(
                  'Lot/Batch Product ဖြစ်သောကြောင့် QC စစ်ဆေးရန် Warehouse ကို အလိုအလျောက်ရွေးထားပါသည်။',
                  'MAVORA automatically routes this Lot/Batch product to Quarantine for QC.'
                )}
              </p>
            </div>
          ) : (
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t(
                  'လက်ခံမည့် Warehouse',
                  'Receiving Warehouse'
                )}
              </label>
              <select
                value={form.warehouseId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    warehouseId: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              >
                {normalWarehouses.map((warehouse) => (
                  <option
                    key={warehouse.id}
                    value={warehouse.id}
                  >
                    {warehouse.code} — {warehouse.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {isTracked && (
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                {t(
                  'သက်တမ်းကုန်ရက်',
                  'Expiry Date'
                )}{' '}
                <span className="text-slate-400">
                  ({t('ရှိလျှင်', 'if applicable')})
                </span>
              </label>

              <input
                type="date"
                value={form.expiresAt}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    expiresAt: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              />

              <p className="text-xs font-bold text-blue-600 mt-2">
                ✨{' '}
                {t(
                  'Lot No / Batch No ကို MAVORA မှ အလိုအလျောက်ဖန်တီးပေးပါမည်။',
                  'MAVORA generates the Lot/Batch number automatically.'
                )}
              </p>
            </div>
          )}

          <details className="rounded-xl border bg-slate-50">
            <summary className="cursor-pointer p-3 font-black text-slate-600">
              ⚙️{' '}
              {t(
                'အပိုအချက်အလက် — လိုအပ်မှသာ',
                'More details — only if needed'
              )}
            </summary>

            <div className="p-4 pt-1 space-y-4">
              {isTracked && (
                <div>
                  <label className="block text-xs font-black text-slate-500 mb-1">
                    {t(
                      'ထုတ်လုပ်ရက်',
                      'Manufacture Date'
                    )}
                  </label>

                  <input
                    type="date"
                    value={form.manufacturedAt}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        manufacturedAt:
                          event.target.value,
                      }))
                    }
                    className="w-full border-2 rounded-xl p-3 font-bold bg-white"
                  />
                </div>
              )}

              <input
                value={form.referenceId}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    referenceId: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold bg-white"
                placeholder={t(
                  'Invoice / Reference No.',
                  'Invoice / Reference No.'
                )}
              />

              <textarea
                value={form.notes}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold bg-white min-h-20"
                placeholder={t('မှတ်ချက်', 'Notes')}
              />
            </div>
          </details>

          {errorMessage && (
            <div className="rounded-xl bg-red-50 border border-red-200 p-3 font-bold text-red-700">
              ❌ {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 font-bold text-emerald-700">
              ✅ {successMessage}
            </div>
          )}

          <button
            type="submit"
            disabled={
              working ||
              !selectedProduct ||
              !form.warehouseId
            }
            className="w-full bg-blue-600 hover:bg-blue-700 text-white p-4 rounded-xl font-black text-lg disabled:opacity-50"
          >
            {working
              ? t('ကုန်ဝင်နေသည်...', 'Receiving...')
              : t(
                  '📥 ကုန်ဝင်သွင်းမည်',
                  '📥 Receive Stock'
                )}
          </button>
        </form>

        <div className="space-y-5">
          <div className="bg-white border rounded-2xl shadow-sm p-5">
            <h3 className="text-lg font-black text-slate-800">
              🤖{' '}
              {t(
                'MAVORA က အလိုအလျောက်လုပ်ပေးမည်',
                'MAVORA handles automatically'
              )}
            </h3>

            <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
              <div>✓ {t('အတွဲအမှတ် (Lot/Batch) လိုအပ်မှု စစ်ဆေးခြင်း', 'Detect Lot/Batch requirement')}</div>
              <div>✓ {t('အတွဲအမှတ် (Lot/Batch No.) အလိုအလျောက်ဖန်တီးခြင်း', 'Generate Lot/Batch number')}</div>
              <div>✓ {t('အရည်အသွေးစစ်ဆေးရန် သီးသန့်ထားခြင်း (QC Quarantine)', 'Route to QC Quarantine')}</div>
              <div>✓ {t('ကုန်လက်ကျန်စာရင်း အလိုအလျောက်ပြင်ဆင်ခြင်း', 'Update stock ledger')}</div>
              <div>✓ {t('ပျမ်းမျှကုန်ကျစရိတ် တွက်ချက်ခြင်း', 'Calculate average cost')}</div>
              <div>✓ {t('ကုန်စာရင်း နှစ်ခါဝင်ခြင်း ကာကွယ်ခြင်း', 'Prevent duplicate posting')}</div>
              <div>✓ {t('လုပ်ဆောင်မှုမှတ်တမ်း (Audit) သိမ်းဆည်းခြင်း', 'Record audit trail')}</div>
            </div>
          </div>

          {lastResult && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <h3 className="font-black text-emerald-800">
                ✅ {t('နောက်ဆုံးကုန်ဝင်', 'Last Receipt')}
              </h3>

              {lastResult.lot_no && (
                <div className="mt-3 font-bold">
                  Lot: {lastResult.lot_no}
                </div>
              )}

              {lastResult.batch_no && (
                <div className="font-bold">
                  Batch: {lastResult.batch_no}
                </div>
              )}

              {lastResult.lot_status && (
                <div className="font-bold">
                  Status: {lastResult.lot_status}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {activeOperation === 'qc' && (
        <MavoraSimpleQc
          tenantId={tenantId}
          language={language}
          snapshot={snapshot}
          onChanged={onChanged}
        />
      )}

      {activeOperation === 'putaway' && (
        <MavoraSimplePutAway
          tenantId={tenantId}
          language={language}
          snapshot={snapshot}
          onChanged={onChanged}
        />
      )}

      {activeOperation === 'issue' && (
        <MavoraSimpleIssue
          tenantId={tenantId}
          language={language}
          snapshot={snapshot}
          onChanged={onChanged}
        />
      )}
    </div>
  );
};
