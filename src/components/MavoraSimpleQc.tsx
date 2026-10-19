import React, {
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  changeMavoraInventoryLotStatus,
  type MavoraInventorySnapshot,
} from '../inventory/mavoraInventory';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraInventorySnapshot;
  onChanged: () => Promise<void>;
}

export const MavoraSimpleQc: React.FC<Props> = ({
  tenantId,
  language,
  snapshot,
  onChanged,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [workingLotId, setWorkingLotId] =
    useState<string>('');

  const [notes, setNotes] =
    useState<Record<string, string>>({});

  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] =
    useState('');

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

  const pendingLots = useMemo(
    () =>
      snapshot.lots.filter(
        (lot) => lot.status === 'quarantine'
      ),
    [snapshot.lots]
  );

  const quantityForLot = (lotId: string) =>
    snapshot.balances
      .filter(
        (balance) =>
          balance.lot_id === lotId
      )
      .reduce(
        (total, balance) =>
          total + Number(balance.quantity || 0),
        0
      );

  const handleRelease = async (
    lotId: string
  ) => {
    setErrorMessage('');
    setMessage('');
    setWorkingLotId(lotId);

    try {
      await changeMavoraInventoryLotStatus({
        tenantId,
        lotId,
        newStatus: 'released',
        reason:
          notes[lotId]?.trim() ||
          'QC approved via MAVORA Simple Operations',
      });

      setMessage(
        t(
          'QC အတည်ပြုပြီးပါပြီ။ ယခု Batch ကို သိုလှောင်ရန် (Put Away) လုပ်နိုင်ပါပြီ။',
          'QC approved. This batch is now ready for Put Away.'
        )
      );

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to release lot'
      );
    } finally {
      setWorkingLotId('');
    }
  };

  const handleBlock = async (
    lotId: string
  ) => {
    const reason = notes[lotId]?.trim();

    setErrorMessage('');
    setMessage('');

    if (!reason) {
      setErrorMessage(
        t(
          'ပိတ်ထားရသည့်အကြောင်းရင်းကို အရင်ရေးပါ။',
          'Enter a reason before blocking this batch.'
        )
      );
      return;
    }

    setWorkingLotId(lotId);

    try {
      await changeMavoraInventoryLotStatus({
        tenantId,
        lotId,
        newStatus: 'blocked',
        reason,
      });

      setMessage(
        t(
          'Batch ကို အသုံးမပြုရန် Block လုပ်ပြီးပါပြီ။',
          'Batch has been blocked from use.'
        )
      );

      await onChanged();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to block lot'
      );
    } finally {
      setWorkingLotId('');
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-xl font-black text-slate-800">
          🧪{' '}
          {t(
            'အရည်အသွေးစစ်ဆေးရန်',
            'QC Check'
          )}
        </h3>

        <p className="text-sm font-bold text-slate-500 mt-1">
          {t(
            'စစ်ဆေးပြီး အတည်ပြုပါ။ အတည်ပြုပြီးမှ သိုလှောင် Warehouse သို့ ရွှေ့နိုင်ပါမည်။',
            'Review pending batches. Approved stock can then be moved to its storage warehouse.'
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

      {pendingLots.length === 0 ? (
        <div className="rounded-2xl border bg-white p-8 text-center">
          <div className="text-4xl">✅</div>
          <div className="font-black text-slate-700 mt-3">
            {t(
              'စစ်ဆေးရန် Batch မရှိပါ။',
              'No batches are waiting for QC.'
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {pendingLots.map((lot) => {
            const product =
              productsById.get(lot.product_id);

            const quantity =
              quantityForLot(lot.id);

            return (
              <div
                key={lot.id}
                className="bg-white border rounded-2xl shadow-sm p-5"
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <div className="text-xs font-black text-blue-600">
                      {product?.sku || '-'}
                    </div>

                    <div className="text-lg font-black text-slate-800">
                      {product?.name || '-'}
                    </div>

                    <div className="text-sm font-bold text-slate-500">
                      Lot: {lot.lot_no}
                    </div>

                    {lot.batch_no && (
                      <div className="text-sm font-bold text-slate-500">
                        Batch: {lot.batch_no}
                      </div>
                    )}

                    <div className="text-sm font-bold text-slate-500">
                      {t(
                        'အရေအတွက်',
                        'Quantity'
                      )}
                      :{' '}
                      <span className="text-blue-700">
                        {quantity.toLocaleString()}
                      </span>
                    </div>

                    <div className="text-sm font-bold text-slate-500">
                      {t(
                        'သက်တမ်းကုန်ရက်',
                        'Expiry'
                      )}
                      : {lot.expires_at || '-'}
                    </div>

                    <div className="inline-flex mt-2 rounded-full bg-amber-100 text-amber-800 px-3 py-1 text-xs font-black">
                      {t(
                        'QC စစ်ဆေးရန်',
                        'Pending QC'
                      )}
                    </div>
                  </div>

                  <div className="w-full lg:w-[420px] space-y-3">
                    <textarea
                      value={notes[lot.id] || ''}
                      onChange={(event) =>
                        setNotes((current) => ({
                          ...current,
                          [lot.id]:
                            event.target.value,
                        }))
                      }
                      placeholder={t(
                        'QC မှတ်ချက် — Release အတွက် မဖြည့်လည်းရ၊ Block အတွက် မဖြစ်မနေဖြည့်ပါ',
                        'QC note — optional for Release, required for Block'
                      )}
                      className="w-full border-2 rounded-xl p-3 font-bold min-h-20"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      <button
                        type="button"
                        disabled={
                          workingLotId === lot.id
                        }
                        onClick={() =>
                          handleRelease(lot.id)
                        }
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white p-3 font-black disabled:opacity-50"
                      >
                        ✅{' '}
                        {workingLotId === lot.id
                          ? t(
                              'လုပ်ဆောင်နေသည်...',
                              'Working...'
                            )
                          : t(
                              'အတည်ပြုမည်',
                              'Release'
                            )}
                      </button>

                      <button
                        type="button"
                        disabled={
                          workingLotId === lot.id
                        }
                        onClick={() =>
                          handleBlock(lot.id)
                        }
                        className="rounded-xl bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 p-3 font-black disabled:opacity-50"
                      >
                        ⛔{' '}
                        {t(
                          'အသုံးမပြုရန်',
                          'Block'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
