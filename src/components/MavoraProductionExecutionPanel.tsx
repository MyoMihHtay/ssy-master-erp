import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  changeMavoraInventoryLotStatus,
  createInventoryPostingKey,
  postMavoraInventoryTransfer,
} from '../inventory/mavoraInventory';

import type {
  MavoraProductionOrder,
  MavoraProductionOrderMaterial,
  MavoraProductionSnapshot,
} from '../production/mavoraProduction';

import {
  cancelProductionOrder,
  completeProductionOrder,
  consumeProductionMaterial,
  createProductionExecutionPostingKey,
  createProductionOutputLot,
  finalizeCompletedProductionOrderCost,
  loadMavoraProductionExecutionSnapshot,
  loadProductionOrderCost,
  recordProductionOutput,
  releaseProductionOrder,
  startProductionOrder,
  type MavoraProductionExecutionSnapshot,
  type MavoraProductionOrderCost,
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

interface OutputLotForm {
  lotNo: string;
  batchNo: string;
  manufacturedAt: string;
  expiresAt: string;
  notes: string;
}

interface PostProductionForm {
  qcReason: string;
  destinationWarehouseId: string;
  putawayReason: string;
  postingKey: string;
}

interface PostProductionOutputGroup {
  key: string;
  lotId: string;
  sourceWarehouseId: string;
  recordedQty: number;
  quarantineQty: number;
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

const EMPTY_OUTPUT_LOT_FORM: OutputLotForm = {
  lotNo: '',
  batchNo: '',
  manufacturedAt: '',
  expiresAt: '',
  notes: '',
};

const EMPTY_POST_PRODUCTION_FORM: PostProductionForm = {
  qcReason: '',
  destinationWarehouseId: '',
  putawayReason: '',
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

    const [productionCost, setProductionCost] =
      useState<MavoraProductionOrderCost | null>(
        null
      );

    const [cancelDialogOpen, setCancelDialogOpen] =
      useState(false);

    const [cancelReason, setCancelReason] =
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

    const [
      outputLotDialogOpen,
      setOutputLotDialogOpen,
    ] = useState(false);

    const [
      outputLotForm,
      setOutputLotForm,
    ] = useState<OutputLotForm>(
      EMPTY_OUTPUT_LOT_FORM
    );

    const [
      postProductionForms,
      setPostProductionForms,
    ] = useState<
      Record<string, PostProductionForm>
    >({});

    const refreshExecution =
      useCallback(async () => {
        setLoading(true);
        setErrorMessage('');

        try {
          const [
            data,
            cost,
          ] = await Promise.all([
            loadMavoraProductionExecutionSnapshot(
              tenantId
            ),
            loadProductionOrderCost(
              tenantId,
              order.id
            ),
          ]);

          setExecution(data);
          setProductionCost(cost);
        } catch (error) {
          setErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load Production execution data'
          );
        } finally {
          setLoading(false);
        }
      }, [
        tenantId,
        order.id,
      ]);

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

    const handleCancel = () =>
      runAction(async () => {
        const reason =
          cancelReason.trim();

        if (!reason) {
          throw new Error(
            t(
              'Cancel လုပ်ရသည့် အကြောင်းရင်းကို မဖြစ်မနေ ဖြည့်ပါ။',
              'Cancellation reason is required.'
            )
          );
        }

        const result =
          await cancelProductionOrder({
            tenantId,
            productionOrderId:
              order.id,
            reason,
          });

        setCancelDialogOpen(false);
        setCancelReason('');

        setSuccessMessage(
          t(
            `${result.order_no} ကို Cancelled အဖြစ် ပိတ်ပြီးပါပြီ။`,
            `${result.order_no} was cancelled successfully.`
          )
        );

        await refreshAll();
      });

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

    const putawayWarehouses =
      useMemo(
        () =>
          execution.warehouses.filter(
            (item) =>
              item.is_active &&
              item.site_id ===
                order.site_id &&
              (
                item.warehouse_type ===
                  'SFG' ||
                item.warehouse_type ===
                  'FG'
              )
          ),
        [
          execution.warehouses,
          order.site_id,
        ]
      );

    const postProductionOutputGroups =
      useMemo(() => {
        const groups =
          new Map<
            string,
            PostProductionOutputGroup
          >();

        for (const output of orderOutputs) {
          if (!output.lot_id) {
            continue;
          }

          const key =
            `${output.lot_id}:${output.warehouse_id}`;

          const existing =
            groups.get(key);

          if (existing) {
            existing.recordedQty +=
              Number(output.actual_qty);
          } else {
            groups.set(key, {
              key,
              lotId: output.lot_id,
              sourceWarehouseId:
                output.warehouse_id,
              recordedQty:
                Number(output.actual_qty),
              quarantineQty: 0,
            });
          }
        }

        for (const group of groups.values()) {
          group.quarantineQty =
            execution.balances
              .filter(
                (balance) =>
                  balance.product_id ===
                    order.output_product_id &&
                  balance.lot_id ===
                    group.lotId &&
                  balance.warehouse_id ===
                    group.sourceWarehouseId
              )
              .reduce(
                (sum, balance) =>
                  sum +
                  Number(balance.quantity),
                0
              );
        }

        return Array.from(
          groups.values()
        );
      }, [
        orderOutputs,
        execution.balances,
        order.output_product_id,
      ]);

    const updatePostProductionForm = (
      key: string,
      patch: Partial<PostProductionForm>
    ) => {
      setPostProductionForms(
        (current) => ({
          ...current,
          [key]: {
            ...EMPTY_POST_PRODUCTION_FORM,
            ...(current[key] || {}),
            ...patch,
          },
        })
      );
    };

    const handleProductionQcRelease = (
      group: PostProductionOutputGroup
    ) =>
      runAction(async () => {
        const lot =
          lotsById.get(
            group.lotId
          );

        if (!lot) {
          throw new Error(
            t(
              'Production Output Lot/Batch ကို မတွေ့ပါ။',
              'Production output Lot/Batch was not found.'
            )
          );
        }

        if (!productionCost) {
          throw new Error(
            t(
              'Production Cost Finalized မဖြစ်သေးသဖြင့် QC Release မလုပ်နိုင်သေးပါ။',
              'QC Release is not available until Production cost is finalized.'
            )
          );
        }

        if (
          lot.status !==
            'quarantine'
        ) {
          throw new Error(
            t(
              'Quarantine Lot/Batch ကိုသာ QC Release လုပ်နိုင်ပါသည်။',
              'Only a Quarantine Lot/Batch can be QC released.'
            )
          );
        }

        const form = {
          ...EMPTY_POST_PRODUCTION_FORM,
          ...(postProductionForms[
            group.key
          ] || {}),
        };

        const reason =
          form.qcReason.trim();

        if (!reason) {
          throw new Error(
            t(
              'QC Release Reason ကို ဖြည့်ပါ။',
              'QC Release reason is required.'
            )
          );
        }

        await changeMavoraInventoryLotStatus({
          tenantId,
          lotId: group.lotId,
          newStatus: 'released',
          reason,
        });

        updatePostProductionForm(
          group.key,
          { qcReason: '' }
        );

        setSuccessMessage(
          t(
            `${lot.lot_no} ကို QC Released အဖြစ်ပြောင်းပြီးပါပြီ။`,
            `${lot.lot_no} was QC released successfully.`
          )
        );

        await refreshAll();
      });

    const handleProductionPutaway = (
      group: PostProductionOutputGroup
    ) =>
      runAction(async () => {
        const lot =
          lotsById.get(
            group.lotId
          );

        const sourceWarehouse =
          warehousesById.get(
            group.sourceWarehouseId
          );

        if (!lot) {
          throw new Error(
            t(
              'Production Output Lot/Batch ကို မတွေ့ပါ။',
              'Production output Lot/Batch was not found.'
            )
          );
        }

        if (
          lot.status !==
            'released'
        ) {
          throw new Error(
            t(
              'QC Released Lot/Batch ကိုသာ Put-away လုပ်နိုင်ပါသည်။',
              'Only a QC Released Lot/Batch can be put away.'
            )
          );
        }

        if (
          group.quarantineQty <= 0
        ) {
          throw new Error(
            t(
              'Quarantine Warehouse တွင် Put-away လုပ်ရန် လက်ကျန်မရှိပါ။',
              'There is no remaining Quarantine stock to put away.'
            )
          );
        }

        const form = {
          ...EMPTY_POST_PRODUCTION_FORM,
          ...(postProductionForms[
            group.key
          ] || {}),
        };

        if (
          !form.destinationWarehouseId
        ) {
          throw new Error(
            t(
              'Destination SFG / FG Warehouse ကို ရွေးပါ။',
              'Select a destination SFG / FG warehouse.'
            )
          );
        }

        const destinationWarehouse =
          warehousesById.get(
            form.destinationWarehouseId
          );

        if (
          !destinationWarehouse ||
          !['SFG', 'FG'].includes(
            destinationWarehouse.warehouse_type
          )
        ) {
          throw new Error(
            t(
              'မှန်ကန်သော SFG / FG Warehouse ကို ရွေးပါ။',
              'Select a valid SFG / FG warehouse.'
            )
          );
        }

        const postingKey =
          form.postingKey ||
          createInventoryPostingKey(
            `production-putaway-${order.order_no}`
          );

        updatePostProductionForm(
          group.key,
          { postingKey }
        );

        const confirmed =
          window.confirm(
            t(
              `${lot.lot_no} မှ ${group.quarantineQty.toLocaleString()} ကို ${sourceWarehouse?.code || 'QUARANTINE'} မှ ${destinationWarehouse.code} သို့ Put-away လုပ်မလား?`,
              `Put away ${group.quarantineQty.toLocaleString()} of ${lot.lot_no} from ${sourceWarehouse?.code || 'QUARANTINE'} to ${destinationWarehouse.code}?`
            )
          );

        if (!confirmed) {
          return;
        }

        await postMavoraInventoryTransfer({
          tenantId,
          sourceWarehouseId:
            group.sourceWarehouseId,
          destinationWarehouseId:
            destinationWarehouse.id,
          productId:
            order.output_product_id,
          quantity:
            group.quarantineQty,
          postingKey,
          lotId:
            group.lotId,
          referenceType:
            'production_order',
          referenceId:
            order.id,
          reason:
            form.putawayReason.trim() ||
            'Production output put-away',
        });

        setPostProductionForms(
          (current) => ({
            ...current,
            [group.key]: {
              ...EMPTY_POST_PRODUCTION_FORM,
            },
          })
        );

        setSuccessMessage(
          t(
            `${lot.lot_no} ကို ${destinationWarehouse.code} Warehouse သို့ Put-away ပြီးပါပြီ။`,
            `${lot.lot_no} was put away to ${destinationWarehouse.code} successfully.`
          )
        );

        await refreshAll();
      });

    const handleCreateOutputLot = () =>
      runAction(async () => {
        const tracked =
          outputProduct?.tracking_mode ===
            'lot' ||
          outputProduct?.tracking_mode ===
            'batch';

        if (!tracked) {
          throw new Error(
            t(
              'ဒီ Output Product သည် Lot / Batch Tracking မသုံးပါ။',
              'This output product does not use Lot / Batch tracking.'
            )
          );
        }

        const lotNo =
          outputLotForm.lotNo.trim();

        const batchNo =
          outputLotForm.batchNo.trim();

        if (!lotNo) {
          throw new Error(
            t(
              'Output Lot Number ကို ဖြည့်ပါ။',
              'Output Lot number is required.'
            )
          );
        }

        if (
          outputProduct?.tracking_mode ===
            'batch' &&
          !batchNo
        ) {
          throw new Error(
            t(
              'ဒီ Product သည် Batch Tracking ဖြစ်သဖြင့် Batch Number ကို ဖြည့်ပါ။',
              'Batch number is required for this batch-tracked product.'
            )
          );
        }

        if (
          outputLotForm.manufacturedAt &&
          outputLotForm.expiresAt &&
          outputLotForm.expiresAt <
            outputLotForm.manufacturedAt
        ) {
          throw new Error(
            t(
              'Expiry Date သည် Manufacture Date ထက် မစောရပါ။',
              'Expiry date cannot be earlier than manufacture date.'
            )
          );
        }

        const result =
          await createProductionOutputLot({
            tenantId,
            productionOrderId:
              order.id,
            lotNo,
            batchNo:
              batchNo || null,
            manufacturedAt:
              outputLotForm.manufacturedAt ||
              null,
            expiresAt:
              outputLotForm.expiresAt ||
              null,
            notes:
              outputLotForm.notes.trim() ||
              null,
          });

        // Refresh only the execution snapshot here.
        // Calling refreshAll() also refreshes the parent Production
        // snapshot and can remount this panel, which loses the local
        // Output form selection immediately after Lot/Batch creation.
        await refreshExecution();

        setOutputForm(
          (current) => ({
            ...current,
            lotId: result.lot_id,
          })
        );

        setOutputLotDialogOpen(false);

        setOutputLotForm(
          EMPTY_OUTPUT_LOT_FORM
        );

        setSuccessMessage(
          t(
            `Output Lot/Batch ${result.lot_no}${result.batch_no ? ` / ${result.batch_no}` : ''} ကို Quarantine အဖြစ်ဖန်တီးပြီး Auto-select လုပ်ပြီးပါပြီ။`,
            `Output Lot/Batch ${result.lot_no}${result.batch_no ? ` / ${result.batch_no}` : ''} was created in Quarantine and auto-selected.`
          )
        );
      });

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
              'Output Quarantine Lot / Batch ရွေးပါ။ မရှိသေးပါက Create Output Lot / Batch ခလုတ်ဖြင့် Controlled Workflow မှ ဖန်တီးပါ။',
              'Select an output Quarantine Lot / Batch. If none exists, use Create Output Lot / Batch to create one through the controlled workflow.'
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

    const handleFinalizeHistoricalCost = () =>
      runAction(async () => {
        const confirmed =
          window.confirm(
            t(
              `${order.order_no} အတွက် Historical Production Cost ကို Finalize လုပ်မလား?

ဒီလုပ်ဆောင်ချက်သည် actual material consumption cost မှ Cost ကိုတွက်ပြီး output inventory valuation ကို ပြန်ဖြည့်ပါမည်။ Historical Inventory Movement rows များကို rewrite မလုပ်ပါ။`,
              `Finalize historical Production Cost for ${order.order_no}?

This derives cost from actual material consumption and restores output inventory valuation. Historical Inventory Movement rows are not rewritten.`
            )
          );

        if (!confirmed) {
          return;
        }

        const result =
          await finalizeCompletedProductionOrderCost({
            tenantId,
            productionOrderId:
              order.id,
          });

        setSuccessMessage(
          t(
            `${result.order_no} Cost Finalized ဖြစ်ပါပြီ။ Material Cost ${Number(result.material_cost).toLocaleString()} • Unit Cost ${Number(result.output_unit_cost).toLocaleString()}`,
            `${result.order_no} cost finalized. Material Cost ${Number(result.material_cost).toLocaleString()} • Unit Cost ${Number(result.output_unit_cost).toLocaleString()}`
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
        {cancelDialogOpen &&
          order.status ===
            'draft' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
              <div className="w-full max-w-xl rounded-2xl border border-red-200 bg-white shadow-2xl">
                <div className="border-b border-red-100 p-5">
                  <div className="text-xs font-black tracking-widest text-red-600">
                    CONTROLLED CANCELLATION
                  </div>

                  <div className="text-xl font-black text-slate-800 mt-1">
                    ⛔{' '}
                    {t(
                      'Production Order Cancel လုပ်ရန်',
                      'Cancel Production Order'
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-500 mt-2">
                    {t(
                      `${order.order_no} ကို Draft အဆင့်မှ Cancelled အဖြစ်ပိတ်ပါမည်။ ဒီလုပ်ဆောင်ချက်ပြီးပါက Order ကို ပြန်လည် Execute မလုပ်နိုင်ပါ။`,
                      `${order.order_no} will move from Draft to Cancelled. A cancelled order cannot be executed again.`
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {t(
                        'Cancel လုပ်ရသည့် အကြောင်းရင်း *',
                        'Cancellation reason *'
                      )}
                    </label>

                    <textarea
                      value={cancelReason}
                      onChange={(event) =>
                        setCancelReason(
                          event.target.value
                        )
                      }
                      rows={4}
                      maxLength={2000}
                      autoFocus
                      placeholder={t(
                        'ဥပမာ - Production plan ပြောင်းလဲခြင်း၊ Order မှားယွင်းဖန်တီးခြင်း...',
                        'Example: Production plan changed, order created by mistake...'
                      )}
                      className="w-full rounded-xl border border-red-200 p-3 font-bold outline-none focus:border-red-500"
                    />

                    <div className="mt-1 text-right text-xs font-bold text-slate-400">
                      {cancelReason.length}/2000
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    ⚠️{' '}
                    {t(
                      'Draft Order များကိုသာ Cancel လုပ်နိုင်ပါသည်။ Released / In Progress / Completed Order များကို ဤနေရာမှ Cancel မလုပ်နိုင်ပါ။',
                      'Only Draft Orders can be cancelled. Released, In Progress and Completed Orders cannot be cancelled here.'
                    )}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        setCancelDialogOpen(false);
                        setCancelReason('');
                      }}
                      className="rounded-xl border bg-white px-5 py-3 font-black text-slate-600 disabled:opacity-50"
                    >
                      {t(
                        'မလုပ်တော့ပါ',
                        'Keep Order'
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={
                        working ||
                        !cancelReason.trim()
                      }
                      onClick={handleCancel}
                      className="rounded-xl bg-red-600 px-5 py-3 font-black text-white disabled:opacity-50"
                    >
                      ⛔{' '}
                      {working
                        ? t(
                            'ဆောင်ရွက်နေသည်...',
                            'Cancelling...'
                          )
                        : t(
                            'Order ကို Cancel လုပ်မည်',
                            'Cancel Order'
                          )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

        {outputLotDialogOpen &&
          order.status ===
            'in_progress' && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/60 p-4">
              <div className="w-full max-w-2xl rounded-2xl border border-purple-200 bg-white shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="border-b border-purple-100 p-5">
                  <div className="text-xs font-black tracking-widest text-purple-600">
                    CONTROLLED OUTPUT LOT
                  </div>

                  <div className="text-xl font-black text-slate-800 mt-1">
                    🧬{' '}
                    {t(
                      'Production Output Lot / Batch ဖန်တီးရန်',
                      'Create Production Output Lot / Batch'
                    )}
                  </div>

                  <div className="text-sm font-bold text-slate-500 mt-2">
                    {t(
                      `${order.order_no} ၏ ${outputProduct?.sku || 'Output'} အတွက်သာ ဖန်တီးပါမည်။ Lot/Batch အသစ်သည် Quarantine Status ဖြင့်စတင်ပြီး ဖန်တီးပြီးသည်နှင့် Output Form တွင် Auto-select ဖြစ်ပါမည်။`,
                      `Create a Lot/Batch only for ${outputProduct?.sku || 'this output'} on ${order.order_no}. The new Lot/Batch starts in Quarantine and will be auto-selected in the Output form.`
                    )}
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  {errorMessage && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                      ❌ {errorMessage}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">
                        Lot Number *
                      </label>

                      <input
                        value={
                          outputLotForm.lotNo
                        }
                        onChange={(event) =>
                          setOutputLotForm(
                            (current) => ({
                              ...current,
                              lotNo:
                                event.target
                                  .value,
                            })
                          )
                        }
                        maxLength={200}
                        autoFocus
                        placeholder="LOT-20261102-001"
                        className="w-full rounded-xl border p-3 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">
                        {outputProduct?.tracking_mode ===
                        'batch'
                          ? 'Batch Number *'
                          : 'Batch Number (Optional)'}
                      </label>

                      <input
                        value={
                          outputLotForm.batchNo
                        }
                        onChange={(event) =>
                          setOutputLotForm(
                            (current) => ({
                              ...current,
                              batchNo:
                                event.target
                                  .value,
                            })
                          )
                        }
                        maxLength={200}
                        placeholder="BATCH-20261102-001"
                        className="w-full rounded-xl border p-3 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">
                        {t(
                          'ထုတ်လုပ်သည့်ရက်',
                          'Manufacture Date'
                        )}
                      </label>

                      <input
                        type="date"
                        value={
                          outputLotForm.manufacturedAt
                        }
                        onChange={(event) =>
                          setOutputLotForm(
                            (current) => ({
                              ...current,
                              manufacturedAt:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full rounded-xl border p-3 font-bold"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-black text-slate-700 mb-2">
                        {t(
                          'သက်တမ်းကုန်ရက်',
                          'Expiry Date'
                        )}
                      </label>

                      <input
                        type="date"
                        value={
                          outputLotForm.expiresAt
                        }
                        onChange={(event) =>
                          setOutputLotForm(
                            (current) => ({
                              ...current,
                              expiresAt:
                                event.target
                                  .value,
                            })
                          )
                        }
                        className="w-full rounded-xl border p-3 font-bold"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-black text-slate-700 mb-2">
                      {t(
                        'မှတ်ချက်',
                        'Notes'
                      )}
                    </label>

                    <textarea
                      value={
                        outputLotForm.notes
                      }
                      onChange={(event) =>
                        setOutputLotForm(
                          (current) => ({
                            ...current,
                            notes:
                              event.target
                                .value,
                          })
                        )
                      }
                      rows={3}
                      maxLength={2000}
                      placeholder={t(
                        'Output Lot / Batch မှတ်ချက် (Optional)',
                        'Output Lot / Batch notes (optional)'
                      )}
                      className="w-full rounded-xl border p-3 font-bold"
                    />

                    <div className="mt-1 text-right text-xs font-bold text-slate-400">
                      {outputLotForm.notes.length}/2000
                    </div>
                  </div>

                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    ⚠️{' '}
                    {t(
                      'လက်ရှိ In Progress Production Order ၏ Output Product အတွက်သာ Lot/Batch ဖန်တီးနိုင်ပြီး Quarantine Status ဖြင့် စတင်ပါမည်။',
                      'A Lot/Batch can be created only for the current In Progress Production Order output product and will start in Quarantine.'
                    )}
                  </div>

                  <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                    <button
                      type="button"
                      disabled={working}
                      onClick={() => {
                        setOutputLotDialogOpen(
                          false
                        );
                        setOutputLotForm(
                          EMPTY_OUTPUT_LOT_FORM
                        );
                        setErrorMessage('');
                      }}
                      className="rounded-xl border bg-white px-5 py-3 font-black text-slate-600 disabled:opacity-50"
                    >
                      {t(
                        'မဖန်တီးတော့ပါ',
                        'Close'
                      )}
                    </button>

                    <button
                      type="button"
                      disabled={
                        working ||
                        !outputLotForm.lotNo.trim() ||
                        (
                          outputProduct?.tracking_mode ===
                            'batch' &&
                          !outputLotForm.batchNo.trim()
                        )
                      }
                      onClick={
                        handleCreateOutputLot
                      }
                      className="rounded-xl bg-purple-600 px-5 py-3 font-black text-white disabled:opacity-50"
                    >
                      🧬{' '}
                      {working
                        ? t(
                            'ဖန်တီးနေသည်...',
                            'Creating...'
                          )
                        : t(
                            'ဖန်တီးပြီး Auto-select လုပ်မည်',
                            'Create & Auto-select'
                          )}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

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

                <div className="flex flex-col sm:flex-row gap-3">
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

                  <button
                    type="button"
                    disabled={working}
                    onClick={() =>
                      setCancelDialogOpen(true)
                    }
                    className="rounded-xl border border-red-200 bg-red-50 px-5 py-3 font-black text-red-700 disabled:opacity-50"
                  >
                    ⛔{' '}
                    {t(
                      'Order Cancel',
                      'Cancel Order'
                    )}
                  </button>
                </div>
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
                      <div className="space-y-2">
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
                          className="w-full rounded-xl border p-3 font-bold"
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

                        <button
                          type="button"
                          disabled={working}
                          onClick={() => {
                            setErrorMessage('');
                            setOutputLotDialogOpen(
                              true
                            );
                          }}
                          className="w-full rounded-xl border border-purple-200 bg-purple-50 px-4 py-2.5 text-sm font-black text-purple-700 disabled:opacity-50"
                        >
                          ➕{' '}
                          {t(
                            'Output Lot / Batch အသစ်ဖန်တီးရန်',
                            'Create Output Lot / Batch'
                          )}
                        </button>
                      </div>
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
                          'Output အတွက် Quarantine Lot/Batch မရှိသေးပါ။ အပေါ်ရှိ Create Output Lot / Batch ခလုတ်ဖြင့် Controlled Workflow မှ တိုက်ရိုက်ဖန်တီးနိုင်ပါသည်။',
                          'No Quarantine Lot/Batch exists for this output product. Use Create Output Lot / Batch above to create one through the controlled workflow.'
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
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-4">
                <div>
                  <div className="text-xl font-black text-emerald-800">
                    ✅{' '}
                    {t(
                      'Production ပြီးစီးပြီးပါပြီ',
                      'Production Completed'
                    )}
                  </div>

                  <div className="text-sm font-bold text-emerald-700 mt-1">
                    {productionCost
                      ? t(
                          'Production Cost Finalized ဖြစ်ပြီး Inventory Valuation ချိတ်ဆက်ပြီးပါပြီ။',
                          'Production cost is finalized and linked to Inventory valuation.'
                        )
                      : t(
                          'ယခင် Production Order ဖြစ်သောကြောင့် Cost Finalization လိုအပ်နေသေးသည်။',
                          'This historical Production Order still requires cost finalization.'
                        )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
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

                {productionCost ? (
                  <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4">
                    <div className="font-black text-blue-800">
                      💰{' '}
                      {t(
                        'Finalized Production Cost',
                        'Finalized Production Cost'
                      )}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-3">
                      <div className="rounded-xl bg-white border p-3">
                        <div className="text-xs font-black text-slate-400">
                          MATERIAL COST
                        </div>
                        <div className="text-lg font-black text-slate-800 mt-1">
                          {Number(
                            productionCost.material_cost
                          ).toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border p-3">
                        <div className="text-xs font-black text-slate-400">
                          TOTAL COST
                        </div>
                        <div className="text-lg font-black text-slate-800 mt-1">
                          {Number(
                            productionCost.total_cost
                          ).toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border p-3">
                        <div className="text-xs font-black text-slate-400">
                          COSTED OUTPUT
                        </div>
                        <div className="text-lg font-black text-slate-800 mt-1">
                          {Number(
                            productionCost.actual_output_qty
                          ).toLocaleString()}
                        </div>
                      </div>

                      <div className="rounded-xl bg-white border p-3">
                        <div className="text-xs font-black text-slate-400">
                          UNIT COST
                        </div>
                        <div className="text-lg font-black text-blue-800 mt-1">
                          {Number(
                            productionCost.output_unit_cost
                          ).toLocaleString()}
                        </div>
                      </div>
                    </div>

                    <div className="text-xs font-bold text-blue-700 mt-3">
                      {productionCost.is_backfill
                        ? t(
                            'Historical Cost Backfill',
                            'Historical Cost Backfill'
                          )
                        : t(
                            'Automatic Cost Finalization',
                            'Automatic Cost Finalization'
                          )}
                      {' • '}
                      {productionCost.costing_method}
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                    <div className="font-black text-amber-800">
                      ⚠️{' '}
                      {t(
                        'Production Cost မဖြည့်ရသေးပါ',
                        'Production Cost Not Finalized'
                      )}
                    </div>

                    <div className="text-sm font-bold text-amber-700 mt-1">
                      {t(
                        'Actual Material Consumption Ledger ကိုအခြေခံပြီး Historical Cost ကို server မှတွက်ချက်ပါမည်။',
                        'The server will derive historical cost from the actual Material Consumption ledger.'
                      )}
                    </div>

                    <button
                      type="button"
                      disabled={working}
                      onClick={
                        handleFinalizeHistoricalCost
                      }
                      className="mt-4 rounded-xl bg-amber-600 px-5 py-3 font-black text-white disabled:opacity-50"
                    >
                      💰{' '}
                      {t(
                        'Historical Cost Finalize လုပ်မည်',
                        'Finalize Historical Cost'
                      )}
                    </button>
                  </div>
                )}

                {(outputProduct?.tracking_mode ===
                  'lot' ||
                  outputProduct?.tracking_mode ===
                    'batch') &&
                  postProductionOutputGroups.length >
                    0 && (
                    <div className="rounded-2xl border border-purple-200 bg-purple-50 p-4 space-y-4">
                      <div>
                        <div className="font-black text-purple-800 text-lg">
                          🧪➡️📦{' '}
                          {t(
                            'QC Release & Put-away',
                            'QC Release & Put-away'
                          )}
                        </div>

                        <div className="text-sm font-bold text-purple-700 mt-1">
                          {t(
                            'Production Output Lot/Batch ကို QC Release လုပ်ပြီးမှ QUARANTINE မှ SFG/FG Warehouse သို့ Put-away လုပ်နိုင်ပါသည်။',
                            'QC Release the Production output Lot/Batch before moving it from QUARANTINE to an SFG/FG warehouse.'
                          )}
                        </div>
                      </div>

                      {!productionCost && (
                        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-bold text-amber-800">
                          ⚠️{' '}
                          {t(
                            'Production Cost Finalization မပြီးသေးသဖြင့် QC Release ကို Server မှခွင့်ပြုမည်မဟုတ်ပါ။',
                            'QC Release remains locked until Production cost finalization is complete.'
                          )}
                        </div>
                      )}

                      <div className="space-y-4">
                        {postProductionOutputGroups.map(
                          (group) => {
                            const lot =
                              lotsById.get(
                                group.lotId
                              );

                            const sourceWarehouse =
                              warehousesById.get(
                                group.sourceWarehouseId
                              );

                            const form = {
                              ...EMPTY_POST_PRODUCTION_FORM,
                              ...(postProductionForms[
                                group.key
                              ] || {}),
                            };

                            return (
                              <div
                                key={group.key}
                                className="rounded-xl border bg-white p-4 space-y-4"
                              >
                                <div className="flex flex-col md:flex-row md:items-start justify-between gap-3">
                                  <div>
                                    <div className="font-black text-slate-800">
                                      {lot?.lot_no ||
                                        '—'}
                                      {lot?.batch_no
                                        ? ` / ${lot.batch_no}`
                                        : ''}
                                    </div>

                                    <div className="text-xs font-bold text-slate-500 mt-1">
                                      Output Qty:{' '}
                                      {group.recordedQty.toLocaleString()}
                                      {' • '}
                                      Quarantine Balance:{' '}
                                      {group.quarantineQty.toLocaleString()}
                                      {' • '}
                                      {sourceWarehouse?.code ||
                                        '—'}
                                    </div>
                                  </div>

                                  <span className="rounded-full border px-3 py-1 text-xs font-black text-slate-600">
                                    {lot?.status ||
                                      'unknown'}
                                  </span>
                                </div>

                                {lot?.status ===
                                  'quarantine' && (
                                  <div className="space-y-3">
                                    <textarea
                                      value={
                                        form.qcReason
                                      }
                                      onChange={(
                                        event
                                      ) =>
                                        updatePostProductionForm(
                                          group.key,
                                          {
                                            qcReason:
                                              event.target
                                                .value,
                                          }
                                        )
                                      }
                                      rows={2}
                                      maxLength={2000}
                                      placeholder={t(
                                        'QC Inspection / Release Reason *',
                                        'QC inspection / release reason *'
                                      )}
                                      className="w-full rounded-xl border p-3 font-bold"
                                    />

                                    <button
                                      type="button"
                                      disabled={
                                        working ||
                                        !productionCost ||
                                        !form.qcReason.trim()
                                      }
                                      onClick={() =>
                                        handleProductionQcRelease(
                                          group
                                        )
                                      }
                                      className="rounded-xl bg-emerald-600 px-4 py-2.5 font-black text-white disabled:opacity-50"
                                    >
                                      ✅{' '}
                                      {t(
                                        'QC Release လုပ်မည်',
                                        'QC Release Lot'
                                      )}
                                    </button>
                                  </div>
                                )}

                                {lot?.status ===
                                  'released' &&
                                  group.quarantineQty >
                                    0 && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                      <select
                                        value={
                                          form.destinationWarehouseId
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updatePostProductionForm(
                                            group.key,
                                            {
                                              destinationWarehouseId:
                                                event.target
                                                  .value,
                                            }
                                          )
                                        }
                                        className="rounded-xl border p-3 font-bold"
                                      >
                                        <option value="">
                                          {t(
                                            'Destination SFG / FG ရွေးပါ',
                                            'Select destination SFG / FG'
                                          )}
                                        </option>

                                        {putawayWarehouses.map(
                                          (
                                            warehouse
                                          ) => (
                                            <option
                                              key={
                                                warehouse.id
                                              }
                                              value={
                                                warehouse.id
                                              }
                                            >
                                              {
                                                warehouse.code
                                              }{' '}
                                              —{' '}
                                              {
                                                warehouse.name
                                              }
                                            </option>
                                          )
                                        )}
                                      </select>

                                      <input
                                        value={
                                          form.putawayReason
                                        }
                                        onChange={(
                                          event
                                        ) =>
                                          updatePostProductionForm(
                                            group.key,
                                            {
                                              putawayReason:
                                                event.target
                                                  .value,
                                            }
                                          )
                                        }
                                        placeholder={t(
                                          'Put-away မှတ်ချက် (Optional)',
                                          'Put-away reason (optional)'
                                        )}
                                        className="rounded-xl border p-3 font-bold"
                                      />

                                      <button
                                        type="button"
                                        disabled={
                                          working ||
                                          !form.destinationWarehouseId
                                        }
                                        onClick={() =>
                                          handleProductionPutaway(
                                            group
                                          )
                                        }
                                        className="md:col-span-2 rounded-xl bg-purple-600 px-4 py-2.5 font-black text-white disabled:opacity-50"
                                      >
                                        📦{' '}
                                        {t(
                                          'Quarantine Stock အားလုံး Put-away လုပ်မည်',
                                          'Put Away All Quarantine Stock'
                                        )}
                                      </button>
                                    </div>
                                  )}

                                {lot?.status ===
                                  'released' &&
                                  group.quarantineQty <=
                                    0 && (
                                    <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-bold text-emerald-700">
                                      ✅{' '}
                                      {t(
                                        'QC Released ဖြစ်ပြီး Quarantine လက်ကျန်မရှိတော့ပါ။ Put-away ပြီးစီးထားပါသည်။',
                                        'QC Released with no remaining Quarantine balance. Put-away is complete.'
                                      )}
                                    </div>
                                  )}

                                {(lot?.status ===
                                  'blocked' ||
                                  lot?.status ===
                                    'expired') && (
                                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-bold text-red-700">
                                    ⛔{' '}
                                    {t(
                                      `ဤ Lot/Batch သည် ${lot.status} ဖြစ်နေသဖြင့် Put-away မလုပ်နိုင်ပါ။`,
                                      `This Lot/Batch is ${lot.status} and cannot be put away.`
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          }
                        )}
                      </div>
                    </div>
                  )}
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
