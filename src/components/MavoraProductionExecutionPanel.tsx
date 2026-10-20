import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import type {
  MavoraProductionOrder,
  MavoraProductionOrderMaterial,
  MavoraProductionSnapshot,
} from '../production/mavoraProduction';

import {
  completeProductionOrder,
  consumeProductionMaterial,
  createProductionExecutionPostingKey,
  loadMavoraProductionExecutionSnapshot,
  recordProductionOutput,
  releaseProductionOrder,
  startProductionOrder,
  type MavoraProductionExecutionSnapshot,
} from '../production/mavoraProductionExecution';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraProductionSnapshot;
  order: MavoraProductionOrder;
  onClose: () => void;
  onRefresh: () => Promise<void>;
}

interface MaterialForm {
  warehouseId: string;
  lotId: string;
  actualQty: string;
  varianceReason: string;
  reason: string;
  postingKey: string;
}

interface OutputForm {
  warehouseId: string;
  lotId: string;
  actualQty: string;
  reason: string;
  postingKey: string;
}

const EMPTY_EXECUTION: MavoraProductionExecutionSnapshot = {
  warehouses: [],
  lots: [],
  balances: [],
  consumptions: [],
  outputs: [],
};

const EMPTY_MATERIAL_FORM: MaterialForm = {
  warehouseId: '',
  lotId: '',
  actualQty: '',
  varianceReason: '',
  reason: '',
  postingKey: '',
};

const EMPTY_OUTPUT_FORM: OutputForm = {
  warehouseId: '',
  lotId: '',
  actualQty: '',
  reason: '',
  postingKey: '',
};

export const MavoraProductionExecutionPanel:
  React.FC<Props> = ({
    tenantId,
    language,
    snapshot,
    order,
    onClose,
    onRefresh,
  }) => {
    const t = (my: string, en: string) =>
      language === 'my' ? my : en;

    const [execution, setExecution] =
      useState<MavoraProductionExecutionSnapshot>(
        EMPTY_EXECUTION
      );

    const [loading, setLoading] =
      useState(true);

    const [working, setWorking] =
      useState(false);

    const [errorMessage, setErrorMessage] =
      useState('');

    const [successMessage, setSuccessMessage] =
      useState('');

    const [releaseReason, setReleaseReason] =
      useState('');

    const [startReason, setStartReason] =
      useState('');

    const [completeReason, setCompleteReason] =
      useState('');

    const [materialForms, setMaterialForms] =
      useState<Record<string, MaterialForm>>(
        {}
      );

    const [outputForm, setOutputForm] =
      useState<OutputForm>(
        EMPTY_OUTPUT_FORM
      );

    const refreshExecution =
      useCallback(async () => {
        setLoading(true);
        setErrorMessage('');

        try {
          const data =
            await loadMavoraProductionExecutionSnapshot(
              tenantId
            );

          setExecution(data);
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load Production execution data'
          );
        } finally {
          setLoading(false);
        }
      }, [tenantId]);

    useEffect(() => {
      refreshExecution();
    }, [
      refreshExecution,
      order.id,
      order.status,
    ]);

    const productsById = useMemo(
      () =>
        new Map(
          snapshot.products.map(
            (item) => [
              item.id,
              item,
            ]
          )
        ),
      [snapshot.products]
    );

    const unitsById = useMemo(
      () =>
        new Map(
          snapshot.units.map(
            (item) => [
              item.id,
              item,
            ]
          )
        ),
      [snapshot.units]
    );

    const warehousesById = useMemo(
      () =>
        new Map(
          execution.warehouses.map(
            (item) => [
              item.id,
              item,
            ]
          )
        ),
      [execution.warehouses]
    );

    const lotsById = useMemo(
      () =>
        new Map(
          execution.lots.map(
            (item) => [
              item.id,
              item,
            ]
          )
        ),
      [execution.lots]
    );

    const orderMaterials = useMemo(
      () =>
        snapshot.orderMaterials
          .filter(
            (item) =>
              item.production_order_id ===
              order.id
          )
          .sort(
            (a, b) =>
              a.line_no - b.line_no
          ),
      [
        snapshot.orderMaterials,
        order.id,
      ]
    );

    const orderConsumptions =
      useMemo(
        () =>
          execution.consumptions.filter(
            (item) =>
              item.production_order_id ===
              order.id
          ),
        [
          execution.consumptions,
          order.id,
        ]
      );

    const orderOutputs = useMemo(
      () =>
        execution.outputs.filter(
          (item) =>
            item.production_order_id ===
            order.id
        ),
      [
        execution.outputs,
        order.id,
      ]
    );

    const outputProduct =
      productsById.get(
        order.output_product_id
      );

    const outputUnit =
      unitsById.get(
        order.output_unit_id
      );

    const totalOutput = useMemo(
      () =>
        orderOutputs.reduce(
          (sum, item) =>
            sum +
            Number(item.actual_qty),
          0
        ),
      [orderOutputs]
    );

    const yieldPct =
      Number(order.planned_qty) > 0
        ? (
            (totalOutput /
              Number(order.planned_qty)) *
            100
          )
        : 0;

    const refreshAll = async () => {
      await Promise.all([
        onRefresh(),
        refreshExecution(),
      ]);
    };

    const runAction = async (
      action: () => Promise<void>
    ) => {
      if (working) {
        return;
      }

      setWorking(true);
      setErrorMessage('');
      setSuccessMessage('');

      try {
        await action();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Production execution action failed'
        );
      } finally {
        setWorking(false);
      }
    };

    const handleRelease = () =>
      runAction(async () => {
        const confirmed =
          window.confirm(
            t(
              `${order.order_no} ကို Release လုပ်မလား?\n\nRelease အဆင့်တွင် Stock မနှုတ်သေးပါ။`,
              `Release ${order.order_no}?\n\nNo inventory will be consumed during Release.`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await releaseProductionOrder({
            tenantId,
            productionOrderId:
              order.id,
            reason:
              releaseReason.trim() ||
              null,
          });

        setSuccessMessage(
          t(
            `${result.order_no} ကို Released အဖြစ် အောင်မြင်စွာပြောင်းပြီးပါပြီ။`,
            `${result.order_no} was released successfully.`
          )
        );

        await refreshAll();
      });

    const handleStart = () =>
      runAction(async () => {
        const confirmed =
          window.confirm(
            t(
              `${order.order_no} ကို Production စတင်မလား?`,
              `Start Production Order ${order.order_no}?`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await startProductionOrder({
            tenantId,
            productionOrderId:
              order.id,
            reason:
              startReason.trim() ||
              null,
          });

        setSuccessMessage(
          t(
            `${result.order_no} Production စတင်ပြီးပါပြီ။`,
            `${result.order_no} is now In Progress.`
          )
        );

        await refreshAll();
      });

    const updateMaterialForm = (
      materialId: string,
      patch: Partial<MaterialForm>
    ) => {
      setMaterialForms(
        (current) => ({
          ...current,
          [materialId]: {
            ...EMPTY_MATERIAL_FORM,
            ...(current[
              materialId
            ] || {}),
            ...patch,
          },
        })
      );
    };

    const materialConsumedQty = (
      materialId: string
    ) =>
      orderConsumptions
        .filter(
          (item) =>
            item.production_order_material_id ===
            materialId
        )
        .reduce(
          (sum, item) =>
            sum +
            Number(item.actual_qty),
          0
        );

    const materialEligibleBalances = (
      material: MavoraProductionOrderMaterial
    ) => {
      const product =
        productsById.get(
          material.input_product_id
        );

      return execution.balances.filter(
        (balance) => {
          if (
            balance.product_id !==
            material.input_product_id
          ) {
            return false;
          }

          const warehouse =
            warehousesById.get(
              balance.warehouse_id
            );

          if (
            !warehouse ||
            !warehouse.is_active ||
            warehouse.site_id !==
              order.site_id ||
            warehouse.warehouse_type ===
              'QUARANTINE'
          ) {
            return false;
          }

          const available =
            Number(balance.quantity) -
            Number(
              balance.reserved_quantity
            );

          if (available <= 0) {
            return false;
          }

          if (
            product?.tracking_mode ===
            'lot' ||
            product?.tracking_mode ===
            'batch'
          ) {
            if (!balance.lot_id) {
              return false;
            }

            const lot =
              lotsById.get(
                balance.lot_id
              );

            return (
              lot?.status ===
              'released'
            );
          }

          return balance.lot_id === null;
        }
      );
    };

    const handleConsume = (
      material: MavoraProductionOrderMaterial
    ) =>
      runAction(async () => {
        const form = {
          ...EMPTY_MATERIAL_FORM,
          ...(materialForms[
            material.id
          ] || {}),
        };

        const qty =
          Number(form.actualQty);

        if (
          !Number.isFinite(qty) ||
          qty <= 0
        ) {
          throw new Error(
            t(
              'Actual Consume Qty သည် 0 ထက်ကြီးရပါမည်။',
              'Actual consumption quantity must be greater than zero.'
            )
          );
        }

        if (!form.warehouseId) {
          throw new Error(
            t(
              'Source Warehouse ရွေးပါ။',
              'Select a source warehouse.'
            )
          );
        }

        const product =
          productsById.get(
            material.input_product_id
          );

        const tracked =
          product?.tracking_mode ===
            'lot' ||
          product?.tracking_mode ===
            'batch';

        if (
          tracked &&
          !form.lotId
        ) {
          throw new Error(
            t(
              'Released Lot / Batch ရွေးပါ။',
              'Select a released Lot / Batch.'
            )
          );
        }

        const postingKey =
          form.postingKey ||
          createProductionExecutionPostingKey(
            `consume-${order.order_no}-${material.line_no}`
          );

        updateMaterialForm(
          material.id,
          { postingKey }
        );

        const confirmed =
          window.confirm(
            t(
              `${product?.name || 'Material'} ကို ${qty.toLocaleString()} consume လုပ်မလား?\n\nဒီလုပ်ဆောင်ချက်က Inventory Stock ကို အမှန်တကယ်နှုတ်ပါမည်။`,
              `Consume ${qty.toLocaleString()} of ${product?.name || 'material'}?\n\nThis will post an actual Inventory consumption.`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await consumeProductionMaterial({
            tenantId,
            productionOrderId:
              order.id,
            productionOrderMaterialId:
              material.id,
            warehouseId:
              form.warehouseId,
            lotId:
              tracked
                ? form.lotId
                : null,
            actualQty: qty,
            postingKey,
            varianceReason:
              form.varianceReason.trim() ||
              null,
            reason:
              form.reason.trim() ||
              null,
          });

        setSuccessMessage(
          t(
            `Material ${Number(result.actual_qty).toLocaleString()} ကို Inventory Ledger မှတစ်ဆင့် consume လုပ်ပြီးပါပြီ။`,
            `Material consumption of ${Number(result.actual_qty).toLocaleString()} was posted successfully.`
          )
        );

        setMaterialForms(
          (current) => ({
            ...current,
            [material.id]: {
              ...EMPTY_MATERIAL_FORM,
            },
          })
        );

        await refreshAll();
      });

    const quarantineWarehouses =
      useMemo(
        () =>
          execution.warehouses.filter(
            (item) =>
              item.is_active &&
              item.site_id ===
                order.site_id &&
              item.warehouse_type ===
                'QUARANTINE'
          ),
        [
          execution.warehouses,
          order.site_id,
        ]
      );

    const outputLots = useMemo(
      () =>
        execution.lots.filter(
          (item) =>
            item.product_id ===
              order.output_product_id &&
            item.status ===
              'quarantine'
        ),
      [
        execution.lots,
        order.output_product_id,
      ]
    );

    const handleOutput = () =>
      runAction(async () => {
        const qty =
          Number(
            outputForm.actualQty
          );

        if (
          !Number.isFinite(qty) ||
          qty <= 0
        ) {
          throw new Error(
            t(
              'Actual Output Qty သည် 0 ထက်ကြီးရပါမည်။',
              'Actual output quantity must be greater than zero.'
            )
          );
        }

        if (
          !outputForm.warehouseId
        ) {
          throw new Error(
            t(
              'QUARANTINE Warehouse ရွေးပါ။',
              'Select a QUARANTINE warehouse.'
            )
          );
        }

        const tracked =
          outputProduct?.tracking_mode ===
            'lot' ||
          outputProduct?.tracking_mode ===
            'batch';

        if (
          tracked &&
          !outputForm.lotId
        ) {
          throw new Error(
            t(
              'Output Quarantine Lot / Batch ရွေးပါ။ Lot/Batch မရှိသေးပါက Lot Management မှ အရင်ဖန်တီးပါ။',
              'Select an output Quarantine Lot / Batch. Create it in Lot Management first if none exists.'
            )
          );
        }

        const postingKey =
          outputForm.postingKey ||
          createProductionExecutionPostingKey(
            `output-${order.order_no}`
          );

        setOutputForm(
          (current) => ({
            ...current,
            postingKey,
          })
        );

        const confirmed =
          window.confirm(
            t(
              `${outputProduct?.name || 'Output'} ${qty.toLocaleString()} ကို Production Output အဖြစ် QUARANTINE သို့တင်မလား?`,
              `Record ${qty.toLocaleString()} of ${outputProduct?.name || 'output'} into QUARANTINE?`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await recordProductionOutput({
            tenantId,
            productionOrderId:
              order.id,
            warehouseId:
              outputForm.warehouseId,
            lotId:
              tracked
                ? outputForm.lotId
                : null,
            actualQty: qty,
            postingKey,
            reason:
              outputForm.reason.trim() ||
              null,
          });

        setSuccessMessage(
          t(
            `Production Output ${Number(result.actual_qty).toLocaleString()} ကို QUARANTINE Inventory သို့တင်ပြီးပါပြီ။`,
            `Production output of ${Number(result.actual_qty).toLocaleString()} was posted to QUARANTINE.`
          )
        );

        setOutputForm(
          EMPTY_OUTPUT_FORM
        );

        await refreshAll();
      });

    const handleComplete = () =>
      runAction(async () => {
        const confirmed =
          window.confirm(
            t(
              `${order.order_no} ကို Completed အဖြစ်ပိတ်မလား?\n\nMandatory materials နှင့် Output Trace မပြည့်စုံလျှင် Server မှ Reject လုပ်ပါမည်။`,
              `Complete ${order.order_no}?\n\nThe server will reject completion if mandatory material or output traces are incomplete.`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await completeProductionOrder({
            tenantId,
            productionOrderId:
              order.id,
            reason:
              completeReason.trim() ||
              null,
          });

        setSuccessMessage(
          t(
            `${result.order_no} Completed ဖြစ်ပါပြီ။ Yield ${Number(result.yield_pct).toFixed(2)}%`,
            `${result.order_no} completed. Yield ${Number(result.yield_pct).toFixed(2)}%`
          )
        );

        await refreshAll();
      });

    const statusClass =
      order.status === 'completed'
        ? 'bg-emerald-100 text-emerald-700'
        : order.status ===
            'in_progress'
          ? 'bg-blue-100 text-blue-700'
          : order.status ===
              'released'
            ? 'bg-amber-100 text-amber-700'
            : order.status ===
                'cancelled'
              ? 'bg-red-100 text-red-700'
              : 'bg-slate-100 text-slate-700';

    return (
      <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/40 overflow-hidden">
        <div className="bg-white border-b p-4 md:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black tracking-widest text-orange-600">
              CONTROLLED EXECUTION
            </div>

            <div className="flex flex-wrap items-center gap-2 mt-1">
              <h3 className="text-xl font-black text-slate-800">
                ⚙️ {order.order_no}
              </h3>

              <span
                className={`rounded-full px-3 py-1 text-xs font-black ${statusClass}`}
              >
                {order.status}
              </span>
            </div>

            <div className="text-sm font-bold text-slate-500 mt-1">
              {outputProduct?.sku ||
                '—'}{' '}
              •{' '}
              {Number(
                order.planned_qty
              ).toLocaleString()}{' '}
              {outputUnit?.symbol ||
                outputUnit?.code ||
                ''}
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border bg-white px-4 py-2 font-black text-slate-600"
          >
            ✕ {t('ပိတ်မည်', 'Close')}
          </button>
        </div>

        <div className="p-4 md:p-5 space-y-5">
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

          {loading && (
            <div className="rounded-xl border bg-white p-5 text-center font-bold text-slate-500">
              ⏳{' '}
              {t(
                'Execution Data ချိတ်ဆက်နေပါသည်...',
                'Loading execution data...'
              )}
            </div>
          )}

          {!loading &&
            order.status ===
              'draft' && (
              <div className="rounded-2xl border bg-white p-5 space-y-4">
                <div>
                  <div className="font-black text-lg text-slate-800">
                    1️⃣{' '}
                    {t(
                      'Production Order Release',
                      'Release Production Order'
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-500 mt-1">
                    {t(
                      'Frozen BOM ကို execution အတွက် Release လုပ်ပါမည်။ Stock မနှုတ်သေးပါ။',
                      'Release the frozen Production plan for execution. No stock is consumed yet.'
                    )}
                  </div>
                </div>

                <textarea
                  value={releaseReason}
                  onChange={(event) =>
                    setReleaseReason(
                      event.target.value
                    )
                  }
                  rows={2}
                  placeholder={t(
                    'Release မှတ်ချက် (Optional)',
                    'Release reason (optional)'
                  )}
                  className="w-full rounded-xl border p-3 font-bold"
                />

                <button
                  type="button"
                  disabled={working}
                  onClick={handleRelease}
                  className="rounded-xl bg-amber-500 px-5 py-3 font-black text-white disabled:opacity-50"
                >
                  🔓{' '}
                  {t(
                    'Release လုပ်မည်',
                    'Release Order'
                  )}
                </button>
              </div>
            )}

          {!loading &&
            order.status ===
              'released' && (
              <div className="rounded-2xl border bg-white p-5 space-y-4">
                <div>
                  <div className="font-black text-lg text-slate-800">
                    2️⃣{' '}
                    {t(
                      'Production စတင်ရန်',
                      'Start Production'
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-500 mt-1">
                    {t(
                      'Released Order ကို In Progress အဖြစ် စတင်ပါမည်။ ဒီအဆင့်မှာလည်း Stock မနှုတ်သေးပါ။',
                      'Start the Released Order as In Progress. No stock is consumed by this step.'
                    )}
                  </div>
                </div>

                <textarea
                  value={startReason}
                  onChange={(event) =>
                    setStartReason(
                      event.target.value
                    )
                  }
                  rows={2}
                  placeholder={t(
                    'Start မှတ်ချက် (Optional)',
                    'Start reason (optional)'
                  )}
                  className="w-full rounded-xl border p-3 font-bold"
                />

                <button
                  type="button"
                  disabled={working}
                  onClick={handleStart}
                  className="rounded-xl bg-blue-600 px-5 py-3 font-black text-white disabled:opacity-50"
                >
                  ▶️{' '}
                  {t(
                    'Production စတင်မည်',
                    'Start Production'
                  )}
                </button>
              </div>
            )}

          {!loading &&
            order.status ===
              'in_progress' && (
              <>
                <div className="rounded-2xl border bg-white p-5">
                  <div className="font-black text-lg text-slate-800">
                    3️⃣{' '}
                    {t(
                      'Material Consumption',
                      'Material Consumption'
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-500 mt-1">
                    {t(
                      'Released Lot/Batch နှင့် လက်ကျန်ရှိသော Warehouse မှသာ Stock နှုတ်ပါမည်။',
                      'Consume only from available stock and released Lots/Batches.'
                    )}
                  </div>

                  <div className="space-y-4 mt-5">
                    {orderMaterials.map(
                      (material) => {
                        const product =
                          productsById.get(
                            material.input_product_id
                          );

                        const unit =
                          unitsById.get(
                            material.input_unit_id
                          );

                        const consumed =
                          materialConsumedQty(
                            material.id
                          );

                        const remaining =
                          Number(
                            material.planned_qty
                          ) - consumed;

                        const balances =
                          materialEligibleBalances(
                            material
                          );

                        const form = {
                          ...EMPTY_MATERIAL_FORM,
                          ...(materialForms[
                            material.id
                          ] || {}),
                        };

                        const warehouseIds =
                          Array.from(
                            new Set(
                              balances.map(
                                (item) =>
                                  item.warehouse_id
                              )
                            )
                          );

                        const lotBalances =
                          balances.filter(
                            (item) =>
                              item.warehouse_id ===
                                form.warehouseId &&
                              item.lot_id
                          );

                        const selectedAvailable =
                          balances
                            .filter(
                              (item) =>
                                item.warehouse_id ===
                                  form.warehouseId &&
                                (
                                  !form.lotId ||
                                  item.lot_id ===
                                    form.lotId
                                )
                            )
                            .reduce(
                              (sum, item) =>
                                sum +
                                Number(
                                  item.quantity
                                ) -
                                Number(
                                  item.reserved_quantity
                                ),
                              0
                            );

                        return (
                          <div
                            key={material.id}
                            className="rounded-xl border bg-slate-50 p-4"
                          >
                            <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                              <div>
                                <div className="font-black text-slate-800">
                                  {material.line_no}.{' '}
                                  {product?.sku ||
                                    '—'}{' '}
                                  —{' '}
                                  {product?.name ||
                                    ''}
                                </div>

                                <div className="text-xs font-bold text-slate-500 mt-1">
                                  Planned:{' '}
                                  {Number(
                                    material.planned_qty
                                  ).toLocaleString()}{' '}
                                  {unit?.symbol ||
                                    unit?.code ||
                                    ''}{' '}
                                  • Consumed:{' '}
                                  {consumed.toLocaleString()}{' '}
                                  • Remaining:{' '}
                                  {remaining.toLocaleString()}
                                </div>
                              </div>

                              <span className="rounded-full bg-white border px-3 py-1 text-xs font-black text-slate-600">
                                {product?.tracking_mode ||
                                  'none'}
                              </span>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 mt-4">
                              <select
                                value={
                                  form.warehouseId
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMaterialForm(
                                    material.id,
                                    {
                                      warehouseId:
                                        event
                                          .target
                                          .value,
                                      lotId:
                                        '',
                                    }
                                  )
                                }
                                className="rounded-xl border bg-white p-3 font-bold"
                              >
                                <option value="">
                                  {t(
                                    'Source Warehouse ရွေးပါ',
                                    'Select source warehouse'
                                  )}
                                </option>

                                {warehouseIds.map(
                                  (warehouseId) => {
                                    const warehouse =
                                      warehousesById.get(
                                        warehouseId
                                      );

                                    return (
                                      <option
                                        key={
                                          warehouseId
                                        }
                                        value={
                                          warehouseId
                                        }
                                      >
                                        {warehouse?.code}{' '}
                                        —{' '}
                                        {warehouse?.name}
                                      </option>
                                    );
                                  }
                                )}
                              </select>

                              {(product?.tracking_mode ===
                                'lot' ||
                                product?.tracking_mode ===
                                  'batch') && (
                                <select
                                  value={
                                    form.lotId
                                  }
                                  onChange={(
                                    event
                                  ) =>
                                    updateMaterialForm(
                                      material.id,
                                      {
                                        lotId:
                                          event
                                            .target
                                            .value,
                                      }
                                    )
                                  }
                                  disabled={
                                    !form.warehouseId
                                  }
                                  className="rounded-xl border bg-white p-3 font-bold disabled:bg-slate-100"
                                >
                                  <option value="">
                                    {t(
                                      'Released Lot / Batch ရွေးပါ',
                                      'Select released Lot / Batch'
                                    )}
                                  </option>

                                  {lotBalances.map(
                                    (balance) => {
                                      const lot =
                                        balance.lot_id
                                          ? lotsById.get(
                                              balance.lot_id
                                            )
                                          : null;

                                      const available =
                                        Number(
                                          balance.quantity
                                        ) -
                                        Number(
                                          balance.reserved_quantity
                                        );

                                      return (
                                        <option
                                          key={
                                            balance.id
                                          }
                                          value={
                                            balance.lot_id ||
                                            ''
                                          }
                                        >
                                          {lot?.lot_no ||
                                            '—'}
                                          {lot?.batch_no
                                            ? ` / ${lot.batch_no}`
                                            : ''}
                                          {' • '}
                                          {available.toLocaleString()}
                                        </option>
                                      );
                                    }
                                  )}
                                </select>
                              )}

                              <input
                                type="number"
                                min="0"
                                step="0.000001"
                                value={
                                  form.actualQty
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMaterialForm(
                                    material.id,
                                    {
                                      actualQty:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder={t(
                                  'Actual Consume Qty',
                                  'Actual Consume Qty'
                                )}
                                className="rounded-xl border bg-white p-3 font-bold"
                              />

                              <input
                                value={
                                  form.varianceReason
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMaterialForm(
                                    material.id,
                                    {
                                      varianceReason:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder={t(
                                  'Variance Reason (လိုအပ်ပါက)',
                                  'Variance reason (when needed)'
                                )}
                                className="rounded-xl border bg-white p-3 font-bold"
                              />

                              <input
                                value={
                                  form.reason
                                }
                                onChange={(
                                  event
                                ) =>
                                  updateMaterialForm(
                                    material.id,
                                    {
                                      reason:
                                        event
                                          .target
                                          .value,
                                    }
                                  )
                                }
                                placeholder={t(
                                  'မှတ်ချက် (Optional)',
                                  'Reason / note (optional)'
                                )}
                                className="rounded-xl border bg-white p-3 font-bold"
                              />

                              <div className="rounded-xl border bg-white p-3 text-xs font-bold text-slate-500">
                                {t(
                                  'ရွေးထားသော Stock Available',
                                  'Selected available stock'
                                )}
                                <div className="text-lg font-black text-slate-800 mt-1">
                                  {selectedAvailable.toLocaleString()}{' '}
                                  {unit?.symbol ||
                                    unit?.code ||
                                    ''}
                                </div>
                              </div>
                            </div>

                            {balances.length ===
                              0 && (
                              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">
                                ⚠️{' '}
                                {t(
                                  'ဒီ Material အတွက် Release ဖြစ်ပြီး အသုံးပြုနိုင်သော Stock မရှိသေးပါ။',
                                  'No released and available stock is currently eligible for this material.'
                                )}
                              </div>
                            )}

                            <button
                              type="button"
                              disabled={
                                working ||
                                balances.length ===
                                  0
                              }
                              onClick={() =>
                                handleConsume(
                                  material
                                )
                              }
                              className="mt-4 rounded-xl bg-orange-600 px-4 py-2.5 font-black text-white disabled:opacity-50"
                            >
                              📤{' '}
                              {t(
                                'Material Consume လုပ်မည်',
                                'Consume Material'
                              )}
                            </button>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                <div className="rounded-2xl border bg-white p-5 space-y-4">
                  <div>
                    <div className="font-black text-lg text-slate-800">
                      4️⃣{' '}
                      {t(
                        'Production Output',
                        'Record Production Output'
                      )}
                    </div>

                    <div className="text-sm font-bold text-slate-500 mt-1">
                      {t(
                        'ထုတ်လုပ်ပြီးသော Output ကို QUARANTINE Warehouse / Batch သို့ အရင်တင်ပါမည်။ QC Release ပြီးမှ SFG/FG သို့ရွှေ့ပါမည်။',
                        'Post finished output into QUARANTINE first. QC release and put-away to SFG/FG happen separately.'
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                    <select
                      value={
                        outputForm.warehouseId
                      }
                      onChange={(event) =>
                        setOutputForm(
                          (current) => ({
                            ...current,
                            warehouseId:
                              event.target
                                .value,
                          })
                        )
                      }
                      className="rounded-xl border p-3 font-bold"
                    >
                      <option value="">
                        {t(
                          'QUARANTINE Warehouse ရွေးပါ',
                          'Select QUARANTINE warehouse'
                        )}
                      </option>

                      {quarantineWarehouses.map(
                        (warehouse) => (
                          <option
                            key={
                              warehouse.id
                            }
                            value={
                              warehouse.id
                            }
                          >
                            {warehouse.code}{' '}
                            —{' '}
                            {warehouse.name}
                          </option>
                        )
                      )}
                    </select>

                    {(outputProduct?.tracking_mode ===
                      'lot' ||
                      outputProduct?.tracking_mode ===
                        'batch') && (
                      <select
                        value={
                          outputForm.lotId
                        }
                        onChange={(
                          event
                        ) =>
                          setOutputForm(
                            (current) => ({
                              ...current,
                              lotId:
                                event
                                  .target
                                  .value,
                            })
                          )
                        }
                        className="rounded-xl border p-3 font-bold"
                      >
                        <option value="">
                          {t(
                            'Quarantine Lot / Batch ရွေးပါ',
                            'Select Quarantine Lot / Batch'
                          )}
                        </option>

                        {outputLots.map(
                          (lot) => (
                            <option
                              key={lot.id}
                              value={lot.id}
                            >
                              {lot.lot_no}
                              {lot.batch_no
                                ? ` / ${lot.batch_no}`
                                : ''}
                            </option>
                          )
                        )}
                      </select>
                    )}

                    <input
                      type="number"
                      min="0"
                      step="0.000001"
                      value={
                        outputForm.actualQty
                      }
                      onChange={(event) =>
                        setOutputForm(
                          (current) => ({
                            ...current,
                            actualQty:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder={t(
                        'Actual Output Qty',
                        'Actual Output Qty'
                      )}
                      className="rounded-xl border p-3 font-bold"
                    />

                    <input
                      value={
                        outputForm.reason
                      }
                      onChange={(event) =>
                        setOutputForm(
                          (current) => ({
                            ...current,
                            reason:
                              event.target
                                .value,
                          })
                        )
                      }
                      placeholder={t(
                        'Output မှတ်ချက် (Optional)',
                        'Output reason (optional)'
                      )}
                      className="rounded-xl border p-3 font-bold"
                    />
                  </div>

                  {(outputProduct?.tracking_mode ===
                    'lot' ||
                    outputProduct?.tracking_mode ===
                      'batch') &&
                    outputLots.length ===
                      0 && (
                      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-700">
                        ⚠️{' '}
                        {t(
                          'Output အတွက် Quarantine Lot/Batch မရှိသေးပါ။ Lot/Batch Management မှ အရင်ဖန်တီးပါ။',
                          'No Quarantine Lot/Batch exists for this output product. Create one in Lot/Batch Management first.'
                        )}
                      </div>
                    )}

                  <button
                    type="button"
                    disabled={working}
                    onClick={handleOutput}
                    className="rounded-xl bg-purple-600 px-5 py-3 font-black text-white disabled:opacity-50"
                  >
                    📦{' '}
                    {t(
                      'Output Record လုပ်မည်',
                      'Record Output'
                    )}
                  </button>
                </div>

                <div className="rounded-2xl border bg-white p-5 space-y-4">
                  <div className="font-black text-lg text-slate-800">
                    5️⃣{' '}
                    {t(
                      'Production Complete',
                      'Complete Production Order'
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-black text-slate-400">
                        PLANNED OUTPUT
                      </div>

                      <div className="text-xl font-black text-slate-800 mt-1">
                        {Number(
                          order.planned_qty
                        ).toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-black text-slate-400">
                        ACTUAL OUTPUT
                      </div>

                      <div className="text-xl font-black text-slate-800 mt-1">
                        {totalOutput.toLocaleString()}
                      </div>
                    </div>

                    <div className="rounded-xl border bg-slate-50 p-4">
                      <div className="text-xs font-black text-slate-400">
                        YIELD
                      </div>

                      <div className="text-xl font-black text-slate-800 mt-1">
                        {yieldPct.toFixed(
                          2
                        )}
                        %
                      </div>
                    </div>
                  </div>

                  <textarea
                    value={
                      completeReason
                    }
                    onChange={(event) =>
                      setCompleteReason(
                        event.target.value
                      )
                    }
                    rows={2}
                    placeholder={t(
                      'Completion / Yield Variance Reason (Output Planned Qty နှင့် မတူပါက လိုအပ်သည်)',
                      'Completion / yield variance reason (required when actual output differs from planned)'
                    )}
                    className="w-full rounded-xl border p-3 font-bold"
                  />

                  <button
                    type="button"
                    disabled={
                      working ||
                      totalOutput <= 0
                    }
                    onClick={
                      handleComplete
                    }
                    className="rounded-xl bg-emerald-600 px-5 py-3 font-black text-white disabled:opacity-50"
                  >
                    ✅{' '}
                    {t(
                      'Production Complete လုပ်မည်',
                      'Complete Production Order'
                    )}
                  </button>
                </div>
              </>
            )}

          {!loading &&
            order.status ===
              'completed' && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                <div className="text-xl font-black text-emerald-800">
                  ✅{' '}
                  {t(
                    'Production ပြီးစီးပြီးပါပြီ',
                    'Production Completed'
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-4">
                  <div className="rounded-xl bg-white border p-4">
                    <div className="text-xs font-black text-slate-400">
                      PLANNED
                    </div>
                    <div className="text-xl font-black mt-1">
                      {Number(
                        order.planned_qty
                      ).toLocaleString()}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border p-4">
                    <div className="text-xs font-black text-slate-400">
                      ACTUAL OUTPUT
                    </div>
                    <div className="text-xl font-black mt-1">
                      {totalOutput.toLocaleString()}
                    </div>
                  </div>

                  <div className="rounded-xl bg-white border p-4">
                    <div className="text-xs font-black text-slate-400">
                      YIELD
                    </div>
                    <div className="text-xl font-black mt-1">
                      {yieldPct.toFixed(
                        2
                      )}
                      %
                    </div>
                  </div>
                </div>
              </div>
            )}

          {!loading &&
            order.status ===
              'cancelled' && (
              <div className="rounded-2xl border border-red-200 bg-red-50 p-5 font-bold text-red-700">
                ⛔{' '}
                {t(
                  'ဤ Production Order ကို Cancelled အဖြစ်ပိတ်ထားပါသည်။',
                  'This Production Order is cancelled and cannot be executed.'
                )}
              </div>
            )}
        </div>
      </div>
    );
  };
