import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  createMavoraProductionOrderPlan,
  type MavoraProductionSnapshot,
} from '../production/mavoraProduction';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraProductionSnapshot;
  onRefresh: () => Promise<void>;
}

type ProductionPriority =
  | 'low'
  | 'normal'
  | 'high'
  | 'urgent';

export const MavoraProductionOrderSetup:
  React.FC<Props> = ({
    tenantId,
    language,
    snapshot,
    onRefresh,
  }) => {
    const t = (my: string, en: string) =>
      language === 'my' ? my : en;

    const [working, setWorking] =
      useState(false);

    const [errorMessage, setErrorMessage] =
      useState('');

    const [successMessage, setSuccessMessage] =
      useState('');

    const [form, setForm] = useState({
      orderNo: '',
      siteId: '',
      recipeVersionId: '',
      plannedQty: '',
      workCenterId: '',
      productionLineId: '',
      priority: 'normal' as ProductionPriority,
      notes: '',
    });

    const recipesById = useMemo(
      () =>
        new Map(
          snapshot.recipes.map((item) => [
            item.id,
            item,
          ])
        ),
      [snapshot.recipes]
    );

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

    const approvedVersions = useMemo(
      () =>
        snapshot.recipeVersions.filter(
          (version) => {
            if (version.status !== 'approved') {
              return false;
            }

            const recipe =
              recipesById.get(
                version.recipe_id
              );

            return recipe?.is_active === true;
          }
        ),
      [
        snapshot.recipeVersions,
        recipesById,
      ]
    );

    useEffect(() => {
      const currentIsValid =
        approvedVersions.some(
          (version) =>
            version.id ===
            form.recipeVersionId
        );

      if (
        !currentIsValid &&
        approvedVersions[0]
      ) {
        setForm((current) => ({
          ...current,
          recipeVersionId:
            approvedVersions[0].id,
        }));
      }

      if (
        approvedVersions.length === 0 &&
        form.recipeVersionId
      ) {
        setForm((current) => ({
          ...current,
          recipeVersionId: '',
        }));
      }
    }, [
      approvedVersions,
      form.recipeVersionId,
    ]);

    useEffect(() => {
      const currentSiteIsValid =
        snapshot.sites.some(
          (site) =>
            site.id === form.siteId
        );

      if (
        !currentSiteIsValid &&
        snapshot.sites[0]
      ) {
        setForm((current) => ({
          ...current,
          siteId: snapshot.sites[0].id,
          workCenterId: '',
          productionLineId: '',
        }));
      }
    }, [
      snapshot.sites,
      form.siteId,
    ]);

    const selectedVersion =
      approvedVersions.find(
        (version) =>
          version.id ===
          form.recipeVersionId
      );

    const selectedRecipe =
      selectedVersion
        ? recipesById.get(
            selectedVersion.recipe_id
          )
        : undefined;

    const outputProduct =
      selectedRecipe
        ? productsById.get(
            selectedRecipe.output_product_id
          )
        : undefined;

    const outputUnit =
      selectedVersion
        ? unitsById.get(
            selectedVersion.output_unit_id
          )
        : undefined;

    const recipeComponents =
      useMemo(
        () =>
          selectedVersion
            ? snapshot.recipeComponents
                .filter(
                  (component) =>
                    component.recipe_version_id ===
                    selectedVersion.id
                )
                .sort(
                  (a, b) =>
                    a.line_no -
                    b.line_no
                )
            : [],
        [
          snapshot.recipeComponents,
          selectedVersion,
        ]
      );

    const workCentersForSite =
      useMemo(
        () =>
          snapshot.workCenters.filter(
            (workCenter) =>
              workCenter.site_id ===
              form.siteId
          ),
        [
          snapshot.workCenters,
          form.siteId,
        ]
      );

    const linesForWorkCenter =
      useMemo(
        () =>
          form.workCenterId
            ? snapshot.productionLines.filter(
                (line) =>
                  line.site_id ===
                    form.siteId &&
                  line.work_center_id ===
                    form.workCenterId
              )
            : [],
        [
          snapshot.productionLines,
          form.siteId,
          form.workCenterId,
        ]
      );

    useEffect(() => {
      if (!form.workCenterId) {
        if (form.productionLineId) {
          setForm((current) => ({
            ...current,
            productionLineId: '',
          }));
        }

        return;
      }

      const workCenterIsValid =
        workCentersForSite.some(
          (workCenter) =>
            workCenter.id ===
            form.workCenterId
        );

      if (!workCenterIsValid) {
        setForm((current) => ({
          ...current,
          workCenterId: '',
          productionLineId: '',
        }));
      }
    }, [
      form.workCenterId,
      form.productionLineId,
      workCentersForSite,
    ]);

    useEffect(() => {
      if (!form.productionLineId) {
        return;
      }

      const lineIsValid =
        linesForWorkCenter.some(
          (line) =>
            line.id ===
            form.productionLineId
        );

      if (!lineIsValid) {
        setForm((current) => ({
          ...current,
          productionLineId: '',
        }));
      }
    }, [
      form.productionLineId,
      linesForWorkCenter,
    ]);

    const plannedQty =
      form.plannedQty.trim()
        ? Number(form.plannedQty)
        : 0;

    const validPlannedQty =
      Number.isFinite(plannedQty) &&
      plannedQty > 0;

    const scaleFactor =
      selectedVersion &&
      validPlannedQty &&
      Number(
        selectedVersion.standard_output_qty
      ) > 0
        ? plannedQty /
          Number(
            selectedVersion.standard_output_qty
          )
        : 0;

    const materialPreview =
      useMemo(
        () =>
          recipeComponents.map(
            (component) => ({
              component,
              plannedQty:
                Math.round(
                  Number(
                    component.required_qty
                  ) *
                    scaleFactor *
                    1_000_000
                ) / 1_000_000,
            })
          ),
        [
          recipeComponents,
          scaleFactor,
        ]
      );

    const resetMessages = () => {
      setErrorMessage('');
      setSuccessMessage('');
    };

    const handleSubmit = async (
      event: React.FormEvent
    ) => {
      event.preventDefault();
      resetMessages();

      if (!form.orderNo.trim()) {
        setErrorMessage(
          t(
            'Production Order No. ဖြည့်ပါ။',
            'Production Order number is required.'
          )
        );
        return;
      }

      if (!form.siteId) {
        setErrorMessage(
          t(
            'Production Site ကိုရွေးပါ။',
            'Select a Production Site.'
          )
        );
        return;
      }

      if (
        !selectedVersion ||
        !selectedRecipe
      ) {
        setErrorMessage(
          t(
            'Approved Recipe / BOM ကိုရွေးပါ။',
            'Select an approved Recipe / BOM.'
          )
        );
        return;
      }

      if (recipeComponents.length === 0) {
        setErrorMessage(
          t(
            'Approved Recipe တွင် BOM Component မရှိပါ။',
            'The approved Recipe has no BOM components.'
          )
        );
        return;
      }

      if (!validPlannedQty) {
        setErrorMessage(
          t(
            'Planned Qty သည် 0 ထက်ကြီးရပါမည်။',
            'Planned quantity must be greater than zero.'
          )
        );
        return;
      }

      if (form.workCenterId) {
        const validWorkCenter =
          workCentersForSite.some(
            (item) =>
              item.id ===
              form.workCenterId
          );

        if (!validWorkCenter) {
          setErrorMessage(
            t(
              'ရွေးထားသော Work Center နှင့် Site မကိုက်ညီပါ။',
              'The selected Work Center does not belong to the Site.'
            )
          );
          return;
        }
      }

      if (form.productionLineId) {
        const validLine =
          linesForWorkCenter.some(
            (item) =>
              item.id ===
              form.productionLineId
          );

        if (!validLine) {
          setErrorMessage(
            t(
              'ရွေးထားသော Production Line နှင့် Work Center မကိုက်ညီပါ။',
              'The selected Production Line does not belong to the Work Center.'
            )
          );
          return;
        }
      }

      const confirmed =
        window.confirm(
          t(
            `Production Order ${form.orderNo.trim()} ကို Draft အဖြစ်ဖန်တီးမလား?\n\nOutput: ${outputProduct?.sku || ''} ${outputProduct?.name || ''}\nPlanned Qty: ${plannedQty.toLocaleString()} ${outputUnit?.code || ''}\nBOM Snapshot: ${recipeComponents.length} lines\n\nဒီအဆင့်တွင် Stock မနှုတ်သေးပါ။`,
            `Create Production Order ${form.orderNo.trim()} as Draft?\n\nOutput: ${outputProduct?.sku || ''} ${outputProduct?.name || ''}\nPlanned Qty: ${plannedQty.toLocaleString()} ${outputUnit?.code || ''}\nBOM Snapshot: ${recipeComponents.length} lines\n\nNo inventory will be consumed at this stage.`
          )
        );

      if (!confirmed) {
        return;
      }

      setWorking(true);

      try {
        const result =
          await createMavoraProductionOrderPlan({
            tenantId,
            siteId: form.siteId,
            orderNo: form.orderNo,
            recipeVersionId:
              selectedVersion.id,
            plannedQty,
            workCenterId:
              form.workCenterId || null,
            productionLineId:
              form.productionLineId || null,
            priority: form.priority,
            notes:
              form.notes.trim() || null,
          });

        setSuccessMessage(
          t(
            `Production Order ${result.order_no} ကို Draft အဖြစ်ဖန်တီးပြီး BOM Material Snapshot ${result.material_count} လိုင်း Lock ချပြီးပါပြီ။`,
            `Draft Production Order ${result.order_no} created with ${result.material_count} frozen BOM material lines.`
          )
        );

        setForm((current) => ({
          ...current,
          orderNo: '',
          plannedQty: '',
          notes: '',
        }));

        await onRefresh();
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to create Production Order'
        );
      } finally {
        setWorking(false);
      }
    };

    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-bold text-emerald-800">
          🧭{' '}
          {t(
            'Approved Recipe / BOM မှ Draft Production Order ကို Atomic Planning ဖြင့် ဖန်တီးနိုင်ပါသည်။ ဒီအဆင့်တွင် Stock Consumption, Start, Complete မလုပ်သေးပါ။',
            'Create Draft Production Orders atomically from approved Recipes / BOMs. No stock consumption, Start or Complete action occurs at this stage.'
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

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          <form
            onSubmit={handleSubmit}
            className="rounded-2xl border bg-white p-5 space-y-4"
          >
            <div>
              <div className="font-black text-slate-800">
                📝{' '}
                {t(
                  'Production Order Plan အသစ်',
                  'New Production Order Plan'
                )}
              </div>

              <div className="text-xs font-bold text-slate-400 mt-1">
                {t(
                  'Approved Formula / BOM ကိုအခြေခံပြီး Draft Order ဖန်တီးပါ',
                  'Create a Draft Order from an approved Formula / BOM'
                )}
              </div>
            </div>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Production Order No. *
              </div>

              <input
                value={form.orderNo}
                maxLength={100}
                disabled={working}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    orderNo:
                      event.target.value,
                  }))
                }
                placeholder="PO-2026-001"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Approved Recipe / BOM *
              </div>

              <select
                value={
                  form.recipeVersionId
                }
                disabled={
                  working ||
                  approvedVersions.length ===
                    0
                }
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    recipeVersionId:
                      event.target.value,
                  }))
                }
                className="w-full rounded-xl border p-3 font-bold bg-white"
              >
                {approvedVersions.length ===
                0 ? (
                  <option value="">
                    {t(
                      'Approved Recipe မရှိသေးပါ',
                      'No approved Recipe available'
                    )}
                  </option>
                ) : (
                  approvedVersions.map(
                    (version) => {
                      const recipe =
                        recipesById.get(
                          version.recipe_id
                        );

                      return (
                        <option
                          key={version.id}
                          value={version.id}
                        >
                          {recipe?.code ||
                            'Recipe'}{' '}
                          — V
                          {version.version_no}{' '}
                          —{' '}
                          {Number(
                            version.standard_output_qty
                          ).toLocaleString()}{' '}
                          {unitsById.get(
                            version.output_unit_id
                          )?.code || ''}
                        </option>
                      );
                    }
                  )
                )}
              </select>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs font-black text-slate-500 mb-1">
                  Planned Qty *
                </div>

                <input
                  type="number"
                  min="0.000001"
                  step="0.000001"
                  value={form.plannedQty}
                  disabled={working}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      plannedQty:
                        event.target.value,
                    }))
                  }
                  placeholder="14"
                  className="w-full rounded-xl border p-3 font-bold"
                />
              </label>

              <label>
                <div className="text-xs font-black text-slate-500 mb-1">
                  Output Unit
                </div>

                <input
                  value={
                    outputUnit
                      ? `${outputUnit.code} — ${outputUnit.name}`
                      : ''
                  }
                  disabled
                  className="w-full rounded-xl border p-3 font-bold bg-slate-100"
                />
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Production Site *
              </div>

              <select
                value={form.siteId}
                disabled={working}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    siteId:
                      event.target.value,
                    workCenterId: '',
                    productionLineId: '',
                  }))
                }
                className="w-full rounded-xl border p-3 font-bold bg-white"
              >
                {snapshot.sites.map(
                  (site) => (
                    <option
                      key={site.id}
                      value={site.id}
                    >
                      {site.code} —{' '}
                      {site.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <label>
                <div className="text-xs font-black text-slate-500 mb-1">
                  Work Center
                </div>

                <select
                  value={
                    form.workCenterId
                  }
                  disabled={working}
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        workCenterId:
                          event.target
                            .value,
                        productionLineId:
                          '',
                      })
                    )
                  }
                  className="w-full rounded-xl border p-3 font-bold bg-white"
                >
                  <option value="">
                    {t(
                      'မသတ်မှတ်သေး',
                      'Not assigned yet'
                    )}
                  </option>

                  {workCentersForSite.map(
                    (workCenter) => (
                      <option
                        key={workCenter.id}
                        value={workCenter.id}
                      >
                        {workCenter.code} —{' '}
                        {workCenter.name}
                      </option>
                    )
                  )}
                </select>
              </label>

              <label>
                <div className="text-xs font-black text-slate-500 mb-1">
                  Production Line
                </div>

                <select
                  value={
                    form.productionLineId
                  }
                  disabled={
                    working ||
                    !form.workCenterId
                  }
                  onChange={(event) =>
                    setForm(
                      (current) => ({
                        ...current,
                        productionLineId:
                          event.target
                            .value,
                      })
                    )
                  }
                  className="w-full rounded-xl border p-3 font-bold bg-white disabled:bg-slate-100"
                >
                  <option value="">
                    {t(
                      'မသတ်မှတ်သေး',
                      'Not assigned yet'
                    )}
                  </option>

                  {linesForWorkCenter.map(
                    (line) => (
                      <option
                        key={line.id}
                        value={line.id}
                      >
                        {line.code} —{' '}
                        {line.name}
                      </option>
                    )
                  )}
                </select>
              </label>
            </div>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Priority
              </div>

              <select
                value={form.priority}
                disabled={working}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    priority:
                      event.target
                        .value as ProductionPriority,
                  }))
                }
                className="w-full rounded-xl border p-3 font-bold bg-white"
              >
                <option value="low">
                  Low
                </option>
                <option value="normal">
                  Normal
                </option>
                <option value="high">
                  High
                </option>
                <option value="urgent">
                  Urgent
                </option>
              </select>
            </label>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Notes
              </div>

              <textarea
                value={form.notes}
                maxLength={4000}
                disabled={working}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    notes:
                      event.target.value,
                  }))
                }
                rows={3}
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>

            <button
              type="submit"
              disabled={
                working ||
                !form.orderNo.trim() ||
                !selectedVersion ||
                !validPlannedQty ||
                recipeComponents.length ===
                  0
              }
              className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
            >
              {working
                ? t(
                    'ဖန်တီးနေပါသည်...',
                    'Creating...'
                  )
                : t(
                    '📋 Draft Production Order ဖန်တီးမည်',
                    '📋 Create Draft Production Order'
                  )}
            </button>
          </form>

          <div className="rounded-2xl border bg-white p-5">
            <div className="font-black text-slate-800">
              🧾{' '}
              {t(
                'Planning Preview',
                'Planning Preview'
              )}
            </div>

            {selectedVersion &&
            selectedRecipe ? (
              <div className="mt-4 space-y-4 text-sm">
                <div className="rounded-xl bg-slate-50 p-4 space-y-2">
                  <div>
                    <span className="font-black">
                      Recipe:
                    </span>{' '}
                    {selectedRecipe.code} —{' '}
                    {selectedRecipe.name}
                  </div>

                  <div>
                    <span className="font-black">
                      Version:
                    </span>{' '}
                    V
                    {selectedVersion.version_no}{' '}
                    • Approved
                  </div>

                  <div>
                    <span className="font-black">
                      Output:
                    </span>{' '}
                    {outputProduct?.sku ||
                      '—'}{' '}
                    —{' '}
                    {outputProduct?.name ||
                      '—'}
                  </div>

                  <div>
                    <span className="font-black">
                      Standard Output:
                    </span>{' '}
                    {Number(
                      selectedVersion.standard_output_qty
                    ).toLocaleString()}{' '}
                    {outputUnit?.code || ''}
                  </div>

                  <div>
                    <span className="font-black">
                      Planned Output:
                    </span>{' '}
                    {validPlannedQty
                      ? plannedQty.toLocaleString()
                      : '—'}{' '}
                    {outputUnit?.code || ''}
                  </div>
                </div>

                <div>
                  <div className="font-black text-slate-700 mb-2">
                    🧱{' '}
                    {t(
                      'Scaled BOM Material Snapshot',
                      'Scaled BOM Material Snapshot'
                    )}
                  </div>

                  <div className="overflow-x-auto rounded-xl border">
                    <table className="w-full text-xs">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="text-left p-2">
                            Line
                          </th>
                          <th className="text-left p-2">
                            Material
                          </th>
                          <th className="text-right p-2">
                            Planned Qty
                          </th>
                        </tr>
                      </thead>

                      <tbody>
                        {materialPreview.map(
                          ({
                            component,
                            plannedQty:
                              materialQty,
                          }) => {
                            const product =
                              productsById.get(
                                component.input_product_id
                              );

                            const unit =
                              unitsById.get(
                                component.input_unit_id
                              );

                            return (
                              <tr
                                key={
                                  component.id
                                }
                                className="border-t"
                              >
                                <td className="p-2">
                                  {
                                    component.line_no
                                  }
                                </td>

                                <td className="p-2">
                                  <div className="font-black">
                                    {product?.sku ||
                                      '—'}
                                  </div>

                                  <div className="text-slate-500">
                                    {product?.name ||
                                      '—'}
                                    {component.is_optional
                                      ? ' • Optional'
                                      : ''}
                                  </div>
                                </td>

                                <td className="p-2 text-right font-black">
                                  {validPlannedQty
                                    ? materialQty.toLocaleString(
                                        undefined,
                                        {
                                          maximumFractionDigits:
                                            6,
                                        }
                                      )
                                    : '—'}{' '}
                                  {unit?.code ||
                                    ''}
                                </td>
                              </tr>
                            );
                          }
                        )}

                        {materialPreview.length ===
                          0 && (
                          <tr>
                            <td
                              colSpan={3}
                              className="p-5 text-center font-bold text-slate-400"
                            >
                              {t(
                                'BOM Component မရှိပါ။',
                                'No BOM components.'
                              )}
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="rounded-xl border border-blue-200 bg-blue-50 p-3 text-xs font-bold text-blue-700">
                  🔒{' '}
                  {t(
                    'Create လုပ်သောအခါ Server သည် Approved BOM ကို ပြန်လည်စစ်ဆေးပြီး Header + Material Snapshot ကို Transaction တစ်ခုတည်းဖြင့် ဖန်တီးမည်။',
                    'On creation, the server re-validates the approved BOM and creates the Order header and material snapshot in one transaction.'
                  )}
                </div>
              </div>
            ) : (
              <div className="mt-4 font-bold text-slate-400">
                {t(
                  'Approved Recipe မရှိသေးပါ။',
                  'No approved Recipe available.'
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };
