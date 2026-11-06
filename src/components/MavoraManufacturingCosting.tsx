import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  loadManufacturingCostOverview,
  upsertManufacturingCostPolicy,
  type MavoraManufacturingCostOverviewItem,
} from '../production/mavoraManufacturingCosting';

interface Props {
  tenantId: string;
  language: AppLanguage;
}

interface PolicyForm {
  standardUnitCost: string;
  minimumMarginPct: string;

  factorySellingPrice: string;
  distributorTransferPrice: string;
  wholesaleTransferPrice: string;

  reason: string;
}

const EMPTY_FORM: PolicyForm = {
  standardUnitCost: '',
  minimumMarginPct: '',

  factorySellingPrice: '',
  distributorTransferPrice: '',
  wholesaleTransferPrice: '',

  reason: '',
};

const formatFixed2 = (
  value: number | null
): string =>
  value === null
    ? '—'
    : value.toLocaleString(
        undefined,
        {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }
      );

const formatMMK = (
  value: number | null
): string =>
  value === null
    ? '—'
    : `${value.toLocaleString(
        undefined,
        {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        }
      )} MMK`;

const formatDate = (
  value: string | null
): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);

  return Number.isNaN(
    date.getTime()
  )
    ? value
    : date.toLocaleString();
};

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-800 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100';

export const MavoraManufacturingCosting:
  React.FC<Props> = ({
    tenantId,
    language,
  }) => {
    const t = (
      my: string,
      en: string
    ) =>
      language === 'my'
        ? my
        : en;

    const [
      items,
      setItems,
    ] =
      useState<
        MavoraManufacturingCostOverviewItem[]
      >([]);

    const [
      loading,
      setLoading,
    ] =
      useState(true);

    const [
      saving,
      setSaving,
    ] =
      useState(false);

    const [
      errorMessage,
      setErrorMessage,
    ] =
      useState('');

    const [
      successMessage,
      setSuccessMessage,
    ] =
      useState('');

    const [
      editingProductId,
      setEditingProductId,
    ] =
      useState<string | null>(
        null
      );

    const [
      form,
      setForm,
    ] =
      useState<PolicyForm>(
        EMPTY_FORM
      );

    const refresh =
      useCallback(async () => {
        setLoading(true);
        setErrorMessage('');

        try {
          const result =
            await loadManufacturingCostOverview(
              tenantId
            );

          setItems(
            result.items
          );
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load Manufacturing Costing'
          );
        } finally {
          setLoading(false);
        }
      }, [tenantId]);

    useEffect(() => {
      refresh();
    }, [refresh]);

    const editingItem =
      useMemo(
        () =>
          items.find(
            (item) =>
              item.product_id ===
              editingProductId
          ) || null,
        [
          items,
          editingProductId,
        ]
      );

    const policyCount =
      useMemo(
        () =>
          items.filter(
            (item) =>
              item.policy_id
          ).length,
        [items]
      );

    const actualCostCount =
      useMemo(
        () =>
          items.filter(
            (item) =>
              item.latest_actual_unit_cost !==
              null
          ).length,
        [items]
      );

    const minimumAllowedPreview =
      useMemo(() => {
        const cost =
          Number(
            form.standardUnitCost
          );

        const margin =
          Number(
            form.minimumMarginPct
          );

        if (
          !Number.isFinite(cost) ||
          cost < 0 ||
          !Number.isFinite(margin) ||
          margin < 0 ||
          margin >= 100
        ) {
          return null;
        }

        return (
          cost /
          (1 - margin / 100)
        );
      }, [
        form.standardUnitCost,
        form.minimumMarginPct,
      ]);

    const startEditing = (
      item:
        MavoraManufacturingCostOverviewItem
    ) => {
      setErrorMessage('');
      setSuccessMessage('');

      setEditingProductId(
        item.product_id
      );

      setForm({
        standardUnitCost:
          String(
            item.standard_unit_cost ??
            item.latest_actual_unit_cost ??
            0
          ),

        minimumMarginPct:
          String(
            item.minimum_margin_pct ??
            0
          ),

        factorySellingPrice:
          item.factory_selling_price ===
          null
            ? ''
            : String(
                item.factory_selling_price
              ),

        distributorTransferPrice:
          item.distributor_transfer_price ===
          null
            ? ''
            : String(
                item.distributor_transfer_price
              ),

        wholesaleTransferPrice:
          item.wholesale_transfer_price ===
          null
            ? ''
            : String(
                item.wholesale_transfer_price
              ),

        reason: '',
      });
    };

    const cancelEditing = () => {
      setEditingProductId(null);
      setForm(EMPTY_FORM);
      setErrorMessage('');
    };

    const parseOptionalPrice = (
      value: string,
      label: string
    ): number | null => {
      const trimmed =
        value.trim();

      if (!trimmed) {
        return null;
      }

      const parsed =
        Number(trimmed);

      if (
        !Number.isFinite(parsed) ||
        parsed < 0
      ) {
        throw new Error(
          `${label} must be zero or greater`
        );
      }

      return parsed;
    };

    const handleSave =
      async () => {
        if (!editingItem) {
          return;
        }

        setSaving(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
          const standardUnitCost =
            Number(
              form.standardUnitCost
            );

          const minimumMarginPct =
            Number(
              form.minimumMarginPct
            );

          if (
            !Number.isFinite(
              standardUnitCost
            ) ||
            standardUnitCost < 0
          ) {
            throw new Error(
              t(
                'Standard Cost မှန်ကန်စွာထည့်ပါ။',
                'Enter a valid Standard Cost.'
              )
            );
          }

          if (
            !Number.isFinite(
              minimumMarginPct
            ) ||
            minimumMarginPct < 0 ||
            minimumMarginPct >= 100
          ) {
            throw new Error(
              t(
                'Minimum Margin သည် 0% မှ 100% အောက်အတွင်း ဖြစ်ရပါမည်။',
                'Minimum Margin must be at least 0% and less than 100%.'
              )
            );
          }

          if (
            form.reason.length >
            1000
          ) {
            throw new Error(
              t(
                'Reason သည် စာလုံး 1000 ထက်မကျော်ရပါ။',
                'Reason cannot exceed 1000 characters.'
              )
            );
          }

          const factorySellingPrice =
            parseOptionalPrice(
              form.factorySellingPrice,
              'Factory Selling Price'
            );

          const distributorTransferPrice =
            parseOptionalPrice(
              form.distributorTransferPrice,
              'Distributor Transfer Price'
            );

          const wholesaleTransferPrice =
            parseOptionalPrice(
              form.wholesaleTransferPrice,
              'Wholesale Transfer Price'
            );

          const minimumAllowedPrice =
            standardUnitCost /
            (
              1 -
              minimumMarginPct /
                100
            );

          [
            [
              'Factory Selling Price',
              factorySellingPrice,
            ],
            [
              'Distributor Transfer Price',
              distributorTransferPrice,
            ],
            [
              'Wholesale Transfer Price',
              wholesaleTransferPrice,
            ],
          ].forEach(
            ([
              label,
              price,
            ]) => {
              if (
                typeof price ===
                  'number' &&
                price + 0.000001 <
                  minimumAllowedPrice
              ) {
                throw new Error(
                  `${label} is below Minimum Margin price ${minimumAllowedPrice.toLocaleString(
                    undefined,
                    {
                      minimumFractionDigits:
                        0,
                      maximumFractionDigits:
                        0,
                    }
                  )} MMK`
                );
              }
            }
          );

          const result =
            await upsertManufacturingCostPolicy(
              {
                tenantId,
                productId:
                  editingItem.product_id,

                standardUnitCost,
                minimumMarginPct,

                currencyCode:
                  'MMK',

                factorySellingPrice,
                distributorTransferPrice,
                wholesaleTransferPrice,

                reason:
                  form.reason,
              }
            );

          setSuccessMessage(
            t(
              `${result.product_sku} Cost Policy Version ${result.version_no} ကို သိမ်းပြီးပါပြီ။`,
              `${result.product_sku} Cost Policy Version ${result.version_no} saved successfully.`
            )
          );

          setEditingProductId(
            null
          );

          setForm(
            EMPTY_FORM
          );

          await refresh();
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to save Manufacturing Cost Policy'
          );
        } finally {
          setSaving(false);
        }
      };

    return (
      <div className="space-y-5">

        <div className="rounded-2xl border border-orange-200 bg-gradient-to-r from-orange-50 to-amber-50 p-5">
          <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="text-lg font-black text-slate-900">
                🧮{' '}
                {t(
                  'ထုတ်လုပ်မှု ကုန်ကျစရိတ်နှင့် လွှဲပြောင်းဈေးနှုန်း',
                  'Manufacturing Costing & Transfer Pricing'
                )}
              </div>

              <div className="mt-2 max-w-4xl text-sm font-bold leading-6 text-slate-600">
                {t(
                  'Actual Production Cost ကို Production Ledger မှ Server ကတွက်ချက်ထားပြီး ပြင်၍မရပါ။ Standard Cost၊ Minimum Margin နှင့် Factory / Distributor / Wholesale Transfer Price များကို Management Policy အဖြစ် သီးခြား Version ထိန်းချုပ်ပါသည်။',
                  'Actual Production Cost is server-derived from the Production Ledger and remains immutable. Standard Cost, Minimum Margin, and Factory / Distributor / Wholesale Transfer Prices are controlled separately as versioned management policy.'
                )}
              </div>
            </div>

            <button
              type="button"
              onClick={refresh}
              disabled={
                loading ||
                saving
              }
              className="rounded-xl border border-orange-200 bg-white px-4 py-2 text-sm font-black text-orange-700 hover:bg-orange-50 disabled:opacity-50"
            >
              ↻{' '}
              {t(
                'ပြန်လည်ဖတ်မည်',
                'Refresh'
              )}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {[
            [
              t(
                'SFG / FG Products',
                'SFG / FG Products'
              ),
              items.length,
            ],
            [
              t(
                'Policy သတ်မှတ်ပြီး',
                'Policies Configured'
              ),
              policyCount,
            ],
            [
              t(
                'Actual Cost ရှိပြီး',
                'Actual Costs Available'
              ),
              actualCostCount,
            ],
          ].map(
            ([label, value]) => (
              <div
                key={String(label)}
                className="rounded-2xl border bg-white p-5"
              >
                <div className="text-xs font-black uppercase tracking-wide text-slate-400">
                  {label}
                </div>

                <div className="mt-2 text-3xl font-black text-slate-800">
                  {value}
                </div>
              </div>
            )
          )}
        </div>

        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold leading-6 text-blue-800">
          ℹ️{' '}
          {t(
            'Minimum Margin သည် Gross Margin ဖြစ်သည်။ ဥပမာ Standard Cost 100 နှင့် Minimum Margin 20% ဆိုလျှင် Minimum Allowed Price သည် 125 ဖြစ်သည်။',
            'Minimum Margin uses gross margin. For example, Standard Cost 100 with a 20% Minimum Margin produces a Minimum Allowed Price of 125.'
          )}
        </div>

        {errorMessage && (
          <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-700">
            ⚠️ {errorMessage}
          </div>
        )}

        {successMessage && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-700">
            ✅ {successMessage}
          </div>
        )}

        {editingItem && (
          <div className="rounded-2xl border-2 border-orange-200 bg-white p-5 shadow-sm">

            <div className="flex flex-col gap-3 border-b pb-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="text-lg font-black text-slate-900">
                  {editingItem.sku} —{' '}
                  {editingItem.name}
                </div>

                <div className="mt-1 text-xs font-bold text-slate-400">
                  {editingItem.product_type}
                  {' • '}
                  {editingItem.policy_version_no
                    ? `Current Policy v${editingItem.policy_version_no}`
                    : t(
                        'Policy မရှိသေးပါ',
                        'No policy yet'
                      )}
                </div>
              </div>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-lg border px-3 py-2 text-xs font-black text-slate-600 hover:bg-slate-50"
              >
                ✕{' '}
                {t(
                  'ပိတ်မည်',
                  'Close'
                )}
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  {t(
                    'Standard Unit Cost',
                    'Standard Unit Cost'
                  )}
                </span>

                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={
                    form.standardUnitCost
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        standardUnitCost:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  {t(
                    'Minimum Margin %',
                    'Minimum Margin %'
                  )}
                </span>

                <input
                  type="number"
                  min="0"
                  max="99.9999"
                  step="0.01"
                  value={
                    form.minimumMarginPct
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        minimumMarginPct:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
                <div className="text-[11px] font-black uppercase text-amber-600">
                  Minimum Allowed Price
                </div>

                <div className="mt-1 text-lg font-black text-amber-800">
                  {formatMMK(
                    minimumAllowedPreview
                  )}
                </div>
              </div>

              <div className="rounded-xl border bg-slate-50 p-3">
                <div className="text-[11px] font-black uppercase text-slate-400">
                  Latest Actual Cost
                </div>

                <div className="mt-1 text-lg font-black text-slate-800">
                  {formatFixed2(
                    editingItem.latest_actual_unit_cost
                  )}
                </div>
              </div>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  Factory Selling Price
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={
                    form.factorySellingPrice
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        factorySellingPrice:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  Distributor Transfer Price
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={
                    form.distributorTransferPrice
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        distributorTransferPrice:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  Wholesale Transfer Price
                </span>

                <input
                  type="number"
                  min="0"
                  step="1"
                  placeholder="Optional"
                  value={
                    form.wholesaleTransferPrice
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        wholesaleTransferPrice:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>

              <label className="space-y-1 md:col-span-2 xl:col-span-1">
                <span className="text-xs font-black text-slate-500">
                  {t(
                    'ပြောင်းလဲရသည့်အကြောင်းရင်း',
                    'Reason'
                  )}
                </span>

                <input
                  type="text"
                  maxLength={1000}
                  placeholder={t(
                    'ဥပမာ — Q4 Cost Review',
                    'Example — Q4 Cost Review'
                  )}
                  value={form.reason}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        reason:
                          event.target.value,
                      })
                    )
                  }
                  className={inputClass}
                />
              </label>
            </div>

            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-orange-500 px-5 py-2.5 text-sm font-black text-white hover:bg-orange-600 disabled:opacity-50"
              >
                {saving
                  ? t(
                      'သိမ်းနေသည်...',
                      'Saving...'
                    )
                  : t(
                      'Cost Policy Version အသစ် သိမ်းမည်',
                      'Save New Cost Policy Version'
                    )}
              </button>

              <button
                type="button"
                onClick={cancelEditing}
                disabled={saving}
                className="rounded-xl border px-5 py-2.5 text-sm font-black text-slate-600 hover:bg-slate-50 disabled:opacity-50"
              >
                {t(
                  'မလုပ်တော့ပါ',
                  'Cancel'
                )}
              </button>
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-2xl border bg-white">

          <div className="border-b p-4">
            <div className="font-black text-slate-800">
              {t(
                'Cost Policy Overview',
                'Cost Policy Overview'
              )}
            </div>

            <div className="mt-1 text-xs font-bold text-slate-400">
              {t(
                'Actual Cost သည် read-only ဖြစ်ပြီး Policy values များသာ Version အသစ်ဖြင့် update လုပ်နိုင်ပါသည်။',
                'Actual Cost is read-only. Only management policy values can be revised through a new policy version.'
              )}
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px] text-xs">

              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="sticky left-0 z-20 border-r bg-slate-50 p-3 text-left">
                    Product
                  </th>

                  <th className="p-3 text-right">
                    Actual Cost
                  </th>

                  <th className="p-3 text-right">
                    Standard Cost
                  </th>

                  <th className="p-3 text-right">
                    Variance
                  </th>

                  <th className="p-3 text-right">
                    Min Margin
                  </th>

                  <th className="p-3 text-right">
                    Min Price
                  </th>

                  <th className="p-3 text-right">
                    Factory Price
                  </th>

                  <th className="p-3 text-right">
                    Distributor
                  </th>

                  <th className="p-3 text-right">
                    Wholesale
                  </th>

                  <th className="p-3 text-left">
                    Policy
                  </th>

                  <th className="p-3 text-center">
                    Action
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  (item) => (
                    <tr
                      key={
                        item.product_id
                      }
                      className="border-t align-top"
                    >
                      <td className="sticky left-0 z-10 border-r bg-white p-3 shadow-[4px_0_8px_-8px_rgba(15,23,42,0.45)]">
                        <div className="font-black text-slate-800">
                          {item.sku}
                        </div>

                        <div className="mt-1 font-bold text-slate-500">
                          {item.name}
                        </div>

                        <div className="mt-1 text-[10px] font-black text-orange-500">
                          {item.product_type}
                        </div>
                      </td>

                      <td className="p-3 text-right font-black text-slate-700">
                        {formatFixed2(
                          item.latest_actual_unit_cost
                        )}

                        {item.latest_actual_cost_order_no && (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            {
                              item.latest_actual_cost_order_no
                            }
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right font-black text-slate-700">
                        {formatFixed2(
                          item.standard_unit_cost
                        )}
                      </td>

                      <td
                        className={`p-3 text-right font-black ${
                          item.standard_vs_actual_variance ===
                          null
                            ? 'text-slate-400'
                            : item.standard_vs_actual_variance >
                                0
                              ? 'text-red-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {formatFixed2(
                          item.standard_vs_actual_variance
                        )}

                        {item.standard_vs_actual_variance_pct !==
                          null && (
                          <div className="mt-1 text-[10px]">
                            {formatFixed2(
                              item.standard_vs_actual_variance_pct
                            )}
                            %
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right font-black">
                        {item.minimum_margin_pct ===
                        null
                          ? '—'
                          : `${formatFixed2(
                              item.minimum_margin_pct
                            )}%`}
                      </td>

                      <td className="p-3 text-right font-black text-amber-700">
                        {formatMMK(
                          item.minimum_allowed_price
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="font-black text-slate-800">
                          {formatMMK(
                            item.factory_selling_price
                          )}
                        </div>

                        {item.factory_margin_pct !==
                          null && (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            Margin{' '}
                            {formatFixed2(
                              item.factory_margin_pct
                            )}
                            %
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="font-black text-slate-800">
                          {formatMMK(
                            item.distributor_transfer_price
                          )}
                        </div>

                        {item.distributor_margin_pct !==
                          null && (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            Margin{' '}
                            {formatFixed2(
                              item.distributor_margin_pct
                            )}
                            %
                          </div>
                        )}
                      </td>

                      <td className="p-3 text-right">
                        <div className="font-black text-slate-800">
                          {formatMMK(
                            item.wholesale_transfer_price
                          )}
                        </div>

                        {item.wholesale_margin_pct !==
                          null && (
                          <div className="mt-1 text-[10px] font-bold text-slate-400">
                            Margin{' '}
                            {formatFixed2(
                              item.wholesale_margin_pct
                            )}
                            %
                          </div>
                        )}
                      </td>

                      <td className="p-3">
                        {item.policy_version_no ? (
                          <>
                            <div className="font-black text-emerald-700">
                              v{
                                item.policy_version_no
                              }
                            </div>

                            <div className="mt-1 text-[10px] font-bold text-slate-400">
                              {formatDate(
                                item.policy_effective_from
                              )}
                            </div>
                          </>
                        ) : (
                          <span className="font-bold text-slate-400">
                            Not set
                          </span>
                        )}
                      </td>

                      <td className="p-3 text-center">
                        <button
                          type="button"
                          onClick={() =>
                            startEditing(
                              item
                            )
                          }
                          disabled={
                            saving
                          }
                          className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 font-black text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          ✏️{' '}
                          {item.policy_id
                            ? t(
                                'ပြင်မည်',
                                'Revise'
                              )
                            : t(
                                'သတ်မှတ်မည်',
                                'Set Policy'
                              )}
                        </button>
                      </td>
                    </tr>
                  )
                )}

                {!loading &&
                  items.length === 0 && (
                    <tr>
                      <td
                        colSpan={11}
                        className="p-10 text-center font-bold text-slate-400"
                      >
                        {t(
                          'Active SFG / FG Product မရှိသေးပါ။',
                          'No active SFG / FG products are available.'
                        )}
                      </td>
                    </tr>
                  )}

                {loading && (
                  <tr>
                    <td
                      colSpan={11}
                      className="p-10 text-center font-bold text-slate-400"
                    >
                      {t(
                        'Costing Data ဖတ်နေသည်...',
                        'Loading Costing data...'
                      )}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-xs font-bold leading-6 text-slate-500">
          🔒{' '}
          {t(
            'ဤ Screen သည် Factory Costing / Transfer Pricing အတွက်သာဖြစ်သည်။ Route Sales၊ Sales Rep Tracking၊ Promotion၊ Customer-specific Pricing နှင့် Territory Pricing များကို MAVORA Manufacturing တွင် မထည့်ထားပါ။',
            'This screen is limited to Factory Costing and Transfer Pricing. Route Sales, Sales Rep Tracking, Promotions, Customer-specific Pricing, and Territory Pricing remain outside MAVORA Manufacturing.'
          )}
        </div>
      </div>
    );
  };
