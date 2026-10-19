import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  changeMavoraInventoryLotStatus,
  createMavoraInventoryLot,
  type MavoraInventorySnapshot,
  type MavoraLotStatus,
} from '../inventory/mavoraInventory';

interface MavoraLotManagementProps {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraInventorySnapshot;
  onChanged: () => Promise<void>;
}

type DispositionStatus =
  | 'released'
  | 'quarantine'
  | 'blocked'
  | 'expired';

export const MavoraLotManagement: React.FC<
  MavoraLotManagementProps
> = ({
  tenantId,
  language,
  snapshot,
  onChanged,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [working, setWorking] = useState(false);
  const [errorMessage, setErrorMessage] =
    useState('');
  const [successMessage, setSuccessMessage] =
    useState('');

  const [lotForm, setLotForm] = useState({
    productId: '',
    lotNo: '',
    batchNo: '',
    manufacturedAt: '',
    expiresAt: '',
    notes: '',
  });

  const [dispositionForm, setDispositionForm] =
    useState({
      lotId: '',
      newStatus: 'released' as DispositionStatus,
      reason: '',
    });

  const trackedProducts = useMemo(
    () =>
      snapshot.products.filter(
        (product) =>
          product.tracking_mode === 'lot' ||
          product.tracking_mode === 'batch'
      ),
    [snapshot.products]
  );

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

  const selectedProduct = productsById.get(
    lotForm.productId
  );

  useEffect(() => {
    setLotForm((current) => ({
      ...current,
      productId:
        trackedProducts.some(
          (product) =>
            product.id === current.productId
        )
          ? current.productId
          : trackedProducts[0]?.id || '',
    }));
  }, [trackedProducts]);

  useEffect(() => {
    setDispositionForm((current) => ({
      ...current,
      lotId:
        snapshot.lots.some(
          (lot) => lot.id === current.lotId
        )
          ? current.lotId
          : snapshot.lots[0]?.id || '',
    }));
  }, [snapshot.lots]);

  const formatDate = (
    value: string | null
  ): string => {
    if (!value) return '-';

    const date = new Date(`${value}T00:00:00`);

    return Number.isNaN(date.getTime())
      ? value
      : date.toLocaleDateString();
  };

  const statusClass = (
    status: MavoraLotStatus
  ): string => {
    switch (status) {
      case 'released':
        return 'bg-emerald-100 text-emerald-700';
      case 'quarantine':
        return 'bg-amber-100 text-amber-800';
      case 'blocked':
        return 'bg-red-100 text-red-700';
      case 'expired':
        return 'bg-slate-200 text-slate-700';
      case 'consumed':
        return 'bg-violet-100 text-violet-700';
      default:
        return 'bg-slate-100 text-slate-600';
    }
  };

  const handleCreateLot = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!lotForm.productId) {
      setErrorMessage(
        t(
          'Lot/Batch Tracking Product ကို ရွေးပါ။',
          'Select a lot/batch tracked product.'
        )
      );
      return;
    }

    if (!lotForm.lotNo.trim()) {
      setErrorMessage(
        t(
          'Lot Number ထည့်ပါ။',
          'Enter a lot number.'
        )
      );
      return;
    }

    if (
      selectedProduct?.tracking_mode === 'batch' &&
      !lotForm.batchNo.trim()
    ) {
      setErrorMessage(
        t(
          'Batch Tracking Product အတွက် Batch Number လိုအပ်ပါသည်။',
          'Batch number is required for a batch-tracked product.'
        )
      );
      return;
    }

    if (
      lotForm.manufacturedAt &&
      lotForm.expiresAt &&
      lotForm.expiresAt < lotForm.manufacturedAt
    ) {
      setErrorMessage(
        t(
          'Expiry Date သည် Manufacture Date ထက် မစောရပါ။',
          'Expiry date cannot be earlier than manufacture date.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      await createMavoraInventoryLot({
        tenantId,
        productId: lotForm.productId,
        lotNo: lotForm.lotNo,
        batchNo: lotForm.batchNo || null,
        manufacturedAt:
          lotForm.manufacturedAt || null,
        expiresAt: lotForm.expiresAt || null,
        notes: lotForm.notes || null,
      });

      setSuccessMessage(
        t(
          'Lot/Batch ကို Controlled Workflow ဖြင့် ဖန်တီးပြီး Quarantine Status ဖြင့် စတင်ထားပါသည်။',
          'Lot/Batch created through the controlled workflow and started in Quarantine status.'
        )
      );

      setLotForm((current) => ({
        ...current,
        lotNo: '',
        batchNo: '',
        manufacturedAt: '',
        expiresAt: '',
        notes: '',
      }));

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create lot/batch'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleDisposition = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();

    setErrorMessage('');
    setSuccessMessage('');

    if (!dispositionForm.lotId) {
      setErrorMessage(
        t(
          'Lot/Batch ကို ရွေးပါ။',
          'Select a lot/batch.'
        )
      );
      return;
    }

    if (!dispositionForm.reason.trim()) {
      setErrorMessage(
        t(
          'QC Disposition အတွက် Reason လိုအပ်ပါသည်။',
          'A reason is required for QC disposition.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      await changeMavoraInventoryLotStatus({
        tenantId,
        lotId: dispositionForm.lotId,
        newStatus: dispositionForm.newStatus,
        reason: dispositionForm.reason,
      });

      setSuccessMessage(
        t(
          'Lot/Batch QC Status ကို အောင်မြင်စွာ ပြောင်းပြီးပါပြီ။',
          'Lot/Batch QC status updated successfully.'
        )
      );

      setDispositionForm((current) => ({
        ...current,
        reason: '',
      }));

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to change lot status'
      );
    } finally {
      setWorking(false);
    }
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-900">
        🧪{' '}
        {t(
          'Lot/Batch အသစ်တိုင်းသည် Quarantine Status ဖြင့် စတင်ပါသည်။ QC Disposition Permission ရှိသူမှသာ Released / Blocked / Expired ပြောင်းနိုင်ပါသည်။',
          'Every new Lot/Batch starts in Quarantine. Only users with QC disposition permission can Release, Block or Expire it.'
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

      <div className="grid lg:grid-cols-2 gap-5">
        <form
          onSubmit={handleCreateLot}
          className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
        >
          <div>
            <h3 className="text-xl font-black text-slate-800">
              🧬{' '}
              {t(
                'Lot / Batch အသစ်',
                'Create Lot / Batch'
              )}
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {t(
                'Controlled Lot Master Creation',
                'Controlled Lot Master Creation'
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Product *
            </label>

            <select
              value={lotForm.productId}
              onChange={(event) =>
                setLotForm((current) => ({
                  ...current,
                  productId: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              <option value="">
                -- Select tracked product --
              </option>

              {trackedProducts.map((product) => (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {product.sku} — {product.name} (
                  {product.tracking_mode})
                </option>
              ))}
            </select>
          </div>

          {trackedProducts.length === 0 && (
            <div className="rounded-xl bg-slate-50 border p-3 text-sm font-bold text-slate-500">
              {t(
                'Lot သို့မဟုတ် Batch Tracking Product မရှိသေးပါ။ Products Tab မှ Product တစ်ခုကို Tracking = Lot / Batch ဖြင့် ဖန်တီးပါ။',
                'No Lot/Batch tracked product exists yet. Create a product with Tracking = Lot or Batch from the Products tab.'
              )}
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Lot Number *
              </label>
              <input
                value={lotForm.lotNo}
                onChange={(event) =>
                  setLotForm((current) => ({
                    ...current,
                    lotNo: event.target.value,
                  }))
                }
                placeholder="LOT-2026-001"
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Batch Number{' '}
                {selectedProduct?.tracking_mode ===
                'batch'
                  ? '*'
                  : ''}
              </label>
              <input
                value={lotForm.batchNo}
                onChange={(event) =>
                  setLotForm((current) => ({
                    ...current,
                    batchNo: event.target.value,
                  }))
                }
                placeholder="BATCH-2026-001"
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Manufacture Date
              </label>
              <input
                type="date"
                value={lotForm.manufacturedAt}
                onChange={(event) =>
                  setLotForm((current) => ({
                    ...current,
                    manufacturedAt:
                      event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>

            <div>
              <label className="block text-xs font-black text-slate-500 mb-1">
                Expiry Date
              </label>
              <input
                type="date"
                min={
                  lotForm.manufacturedAt || undefined
                }
                value={lotForm.expiresAt}
                onChange={(event) =>
                  setLotForm((current) => ({
                    ...current,
                    expiresAt: event.target.value,
                  }))
                }
                className="w-full border-2 rounded-xl p-3 font-bold"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Notes
            </label>
            <textarea
              value={lotForm.notes}
              onChange={(event) =>
                setLotForm((current) => ({
                  ...current,
                  notes: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold min-h-24"
              placeholder="Supplier / Production / QC notes"
            />
          </div>

          <button
            disabled={
              working ||
              trackedProducts.length === 0
            }
            className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-black disabled:opacity-50"
          >
            {working
              ? t(
                  'ဖန်တီးနေသည်...',
                  'Creating...'
                )
              : t(
                  'Lot / Batch ဖန်တီးမည်',
                  'Create Lot / Batch'
                )}
          </button>
        </form>

        <form
          onSubmit={handleDisposition}
          className="bg-white border rounded-2xl shadow-sm p-5 space-y-4"
        >
          <div>
            <h3 className="text-xl font-black text-slate-800">
              ✅{' '}
              {t(
                'QC Lot Disposition',
                'QC Lot Disposition'
              )}
            </h3>
            <p className="text-xs font-bold text-slate-400 mt-1">
              {t(
                'Release • Quarantine • Block • Expire',
                'Release • Quarantine • Block • Expire'
              )}
            </p>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Lot / Batch *
            </label>

            <select
              value={dispositionForm.lotId}
              onChange={(event) =>
                setDispositionForm((current) => ({
                  ...current,
                  lotId: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              <option value="">
                -- Select --
              </option>

              {snapshot.lots.map((lot) => {
                const product =
                  productsById.get(lot.product_id);

                return (
                  <option
                    key={lot.id}
                    value={lot.id}
                  >
                    {product?.sku || '-'} —{' '}
                    {lot.lot_no}
                    {lot.batch_no
                      ? ` / ${lot.batch_no}`
                      : ''}{' '}
                    [{lot.status}]
                  </option>
                );
              })}
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              New Status *
            </label>

            <select
              value={dispositionForm.newStatus}
              onChange={(event) =>
                setDispositionForm((current) => ({
                  ...current,
                  newStatus:
                    event.target
                      .value as DispositionStatus,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold"
            >
              <option value="released">
                Released
              </option>
              <option value="quarantine">
                Quarantine
              </option>
              <option value="blocked">
                Blocked
              </option>
              <option value="expired">
                Expired
              </option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-black text-slate-500 mb-1">
              Reason *
            </label>

            <textarea
              value={dispositionForm.reason}
              onChange={(event) =>
                setDispositionForm((current) => ({
                  ...current,
                  reason: event.target.value,
                }))
              }
              className="w-full border-2 rounded-xl p-3 font-bold min-h-28"
              placeholder="QC inspection result / hold reason / release approval"
            />
          </div>

          <button
            disabled={
              working ||
              snapshot.lots.length === 0
            }
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-black disabled:opacity-50"
          >
            {working
              ? t(
                  'ပြောင်းနေသည်...',
                  'Updating...'
                )
              : t(
                  'QC Status ပြောင်းမည်',
                  'Apply QC Disposition'
                )}
          </button>
        </form>
      </div>

      <div className="bg-white border rounded-2xl shadow-sm overflow-hidden">
        <div className="p-4 border-b bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-2">
          <div>
            <h3 className="font-black text-slate-800">
              📋{' '}
              {t(
                'Lot / Batch Register',
                'Lot / Batch Register'
              )}
            </h3>

            <p className="text-xs text-slate-400 font-bold mt-1">
              {snapshot.lots.length}{' '}
              {t('ခု', 'records')}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1150px] text-xs">
            <thead className="bg-slate-100 text-slate-600">
              <tr>
                <th className="p-3 text-left">
                  SKU
                </th>
                <th className="p-3 text-left">
                  Product
                </th>
                <th className="p-3 text-left">
                  Lot
                </th>
                <th className="p-3 text-left">
                  Batch
                </th>
                <th className="p-3 text-left">
                  Manufactured
                </th>
                <th className="p-3 text-left">
                  Expiry
                </th>
                <th className="p-3 text-left">
                  Status
                </th>
                <th className="p-3 text-left">
                  Notes
                </th>
              </tr>
            </thead>

            <tbody>
              {snapshot.lots.map((lot) => {
                const product =
                  productsById.get(lot.product_id);

                return (
                  <tr
                    key={lot.id}
                    className="border-t hover:bg-slate-50"
                  >
                    <td className="p-3 font-black text-blue-700">
                      {product?.sku || '-'}
                    </td>

                    <td className="p-3 font-bold">
                      {product?.name || '-'}
                    </td>

                    <td className="p-3 font-mono font-bold">
                      {lot.lot_no}
                    </td>

                    <td className="p-3 font-mono">
                      {lot.batch_no || '-'}
                    </td>

                    <td className="p-3">
                      {formatDate(
                        lot.manufactured_at
                      )}
                    </td>

                    <td className="p-3">
                      {formatDate(lot.expires_at)}
                    </td>

                    <td className="p-3">
                      <span
                        className={`inline-flex px-2.5 py-1 rounded-full text-[11px] font-black uppercase ${statusClass(
                          lot.status
                        )}`}
                      >
                        {lot.status}
                      </span>
                    </td>

                    <td className="p-3 max-w-xs truncate">
                      {lot.notes || '-'}
                    </td>
                  </tr>
                );
              })}

              {snapshot.lots.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-10 text-center text-slate-400 font-bold"
                  >
                    {t(
                      'Lot / Batch Record မရှိသေးပါ။',
                      'No Lot / Batch records yet.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
