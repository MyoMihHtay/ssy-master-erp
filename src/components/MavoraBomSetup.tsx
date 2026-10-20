import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  approveMavoraRecipeVersion,
  createMavoraRecipeComponent,
  removeMavoraRecipeComponent,
  type MavoraProductionSnapshot,
} from '../production/mavoraProduction';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraProductionSnapshot;
  onRefresh: () => Promise<void>;
}

export const MavoraBomSetup: React.FC<
  Props
> = ({
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

  const productsById = useMemo(
    () =>
      new Map(
        snapshot.products.map(
          (product) => [
            product.id,
            product,
          ]
        )
      ),
    [snapshot.products]
  );

  const unitsById = useMemo(
    () =>
      new Map(
        snapshot.units.map(
          (unit) => [
            unit.id,
            unit,
          ]
        )
      ),
    [snapshot.units]
  );

  const recipesById = useMemo(
    () =>
      new Map(
        snapshot.recipes.map(
          (recipe) => [
            recipe.id,
            recipe,
          ]
        )
      ),
    [snapshot.recipes]
  );

  const draftVersions = useMemo(
    () =>
      snapshot.recipeVersions.filter(
        (version) =>
          version.status === 'draft'
      ),
    [snapshot.recipeVersions]
  );

  const [versionId, setVersionId] =
    useState('');

  const [inputProductId, setInputProductId] =
    useState('');

  const [requiredQty, setRequiredQty] =
    useState('');

  const [wastagePct, setWastagePct] =
    useState('0');

  const [isOptional, setIsOptional] =
    useState(false);

  useEffect(() => {
    if (
      !versionId &&
      draftVersions[0]
    ) {
      setVersionId(
        draftVersions[0].id
      );
    }
  }, [
    draftVersions,
    versionId,
  ]);

  const selectedVersion =
    draftVersions.find(
      (version) =>
        version.id === versionId
    );

  const selectedRecipe =
    selectedVersion
      ? recipesById.get(
          selectedVersion.recipe_id
        )
      : undefined;

  const components = useMemo(
    () =>
      snapshot.recipeComponents
        .filter(
          (component) =>
            component.recipe_version_id ===
            versionId
        )
        .sort(
          (a, b) =>
            a.line_no - b.line_no
        ),
    [
      snapshot.recipeComponents,
      versionId,
    ]
  );

  const existingProductIds = useMemo(
    () =>
      new Set(
        components.map(
          (component) =>
            component.input_product_id
        )
      ),
    [components]
  );

  const availableInputs = useMemo(
    () =>
      snapshot.products.filter(
        (product) =>
          [
            'RM',
            'SFG',
            'PKG',
            'CONSUMABLE',
          ].includes(
            product.product_type
          ) &&
          product.id !==
            selectedRecipe?.output_product_id &&
          !existingProductIds.has(
            product.id
          )
      ),
    [
      snapshot.products,
      selectedRecipe,
      existingProductIds,
    ]
  );

  useEffect(() => {
    if (
      inputProductId &&
      availableInputs.some(
        (product) =>
          product.id ===
          inputProductId
      )
    ) {
      return;
    }

    setInputProductId(
      availableInputs[0]?.id || ''
    );
  }, [
    availableInputs,
    inputProductId,
  ]);

  const selectedInputProduct =
    productsById.get(
      inputProductId
    );

  const inputUnit =
    selectedInputProduct
      ? unitsById.get(
          selectedInputProduct.base_unit_id
        )
      : undefined;

  const nextLineNo =
    components.length === 0
      ? 1
      : Math.max(
          ...components.map(
            (component) =>
              component.line_no
          )
        ) + 1;

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleAdd = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (
      !selectedVersion ||
      !selectedInputProduct
    ) {
      setErrorMessage(
        t(
          'Draft Version နှင့် Ingredient ကိုရွေးပါ။',
          'Select a Draft Version and Ingredient.'
        )
      );
      return;
    }

    const qty = Number(
      requiredQty
    );

    const wastage = Number(
      wastagePct
    );

    if (
      !Number.isFinite(qty) ||
      qty <= 0
    ) {
      setErrorMessage(
        t(
          'Required Qty သည် 0 ထက်ကြီးရပါမည်။',
          'Required Qty must be greater than zero.'
        )
      );
      return;
    }

    if (
      !Number.isFinite(wastage) ||
      wastage < 0 ||
      wastage > 100
    ) {
      setErrorMessage(
        t(
          'Wastage % သည် 0 မှ 100 အတွင်းဖြစ်ရပါမည်။',
          'Wastage % must be between 0 and 100.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      await createMavoraRecipeComponent({
        tenantId,
        recipeVersionId:
          selectedVersion.id,
        lineNo: nextLineNo,
        inputProductId:
          selectedInputProduct.id,
        inputUnitId:
          selectedInputProduct.base_unit_id,
        requiredQty: qty,
        wastageAllowancePct:
          wastage,
        isOptional,
      });

      setRequiredQty('');
      setWastagePct('0');
      setIsOptional(false);

      setSuccessMessage(
        t(
          'BOM Ingredient ထည့်ပြီးပါပြီ။',
          'BOM ingredient added successfully.'
        )
      );

      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to add BOM ingredient'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleRemove = async (
    componentId: string
  ) => {
    if (!selectedVersion) {
      return;
    }

    const confirmed =
      window.confirm(
        t(
          'ဒီ Draft BOM Ingredient ကို ဖယ်ရှားမလား?',
          'Remove this Draft BOM ingredient?'
        )
      );

    if (!confirmed) {
      return;
    }

    resetMessages();
    setWorking(true);

    try {
      await removeMavoraRecipeComponent(
        tenantId,
        selectedVersion.id,
        componentId
      );

      setSuccessMessage(
        t(
          'BOM Ingredient ကို ဖယ်ရှားပြီးပါပြီ။',
          'BOM ingredient removed successfully.'
        )
      );

      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to remove BOM ingredient'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleApprove = async () => {
    if (
      !selectedVersion ||
      !selectedRecipe
    ) {
      setErrorMessage(
        t(
          'Approve လုပ်ရန် Draft Recipe Version ကိုရွေးပါ။',
          'Select a Draft Recipe Version to approve.'
        )
      );
      return;
    }

    if (components.length === 0) {
      setErrorMessage(
        t(
          'BOM Ingredient မရှိသော Formula ကို Approve မလုပ်နိုင်ပါ။',
          'A Recipe Version without BOM ingredients cannot be approved.'
        )
      );
      return;
    }

    const confirmed =
      window.confirm(
        t(
          'ဒီ Recipe Version ကို Approve လုပ်မလား? Approve ပြီးနောက် Formula Quantity / Unit နှင့် BOM Components ကို Lock လုပ်သွားမည်ဖြစ်ပြီး ပြင်ဆင်လိုပါက Version အသစ်ဖန်တီးရပါမည်။',
          'Approve this Recipe Version? After approval, the formula quantity/unit and BOM components are locked. Future formula changes require a new version.'
        )
      );

    if (!confirmed) {
      return;
    }

    setWorking(true);
    resetMessages();

    try {
      await approveMavoraRecipeVersion({
        tenantId,
        recipeVersionId:
          selectedVersion.id,
      });

      setVersionId('');
      setInputProductId('');
      setRequiredQty('');

      setSuccessMessage(
        t(
          'Recipe / BOM ကို Approve လုပ်ပြီး Lock ချပြီးပါပြီ။',
          'Recipe / BOM approved and locked successfully.'
        )
      );

      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to approve Recipe Version'
      );
    } finally {
      setWorking(false);
    }
  };


  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-bold text-amber-800">
        🔐{' '}
        {t(
          'Draft Recipe Version တွင် BOM Ingredient Add / Remove နှင့် Controlled Approval လုပ်နိုင်ပါသည်။ Approve ပြီးနောက် Formula / BOM ကို Lock လုပ်မည်။',
          'Draft Recipe Versions support controlled BOM Add / Remove and Approval. After approval, the Formula / BOM is locked.'
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
          onSubmit={handleAdd}
          className="rounded-2xl border bg-white p-5 space-y-4"
        >
          <div>
            <div className="font-black text-slate-800">
              🧱{' '}
              {t(
                'BOM Ingredient အသစ်',
                'Add BOM Ingredient'
              )}
            </div>

            <div className="text-xs font-bold text-slate-400 mt-1">
              {t(
                'Draft Formula အတွက် Ingredient Quantity ကိုသတ်မှတ်ပါ',
                'Define ingredient quantity for the Draft Formula'
              )}
            </div>
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Draft Recipe Version *
            </div>

            <select
              value={versionId}
              disabled={working}
              onChange={(event) => {
                setVersionId(
                  event.target.value
                );
                setRequiredQty('');
                setWastagePct('0');
                setIsOptional(false);
              }}
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="">
                {t(
                  'Draft Version ရွေးပါ',
                  'Select Draft Version'
                )}
              </option>

              {draftVersions.map(
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
              )}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Ingredient *
            </div>

            <select
              value={inputProductId}
              disabled={
                working ||
                !selectedVersion
              }
              onChange={(event) =>
                setInputProductId(
                  event.target.value
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="">
                {t(
                  'Ingredient ရွေးပါ',
                  'Select Ingredient'
                )}
              </option>

              {availableInputs.map(
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
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Required Qty *
              </div>

              <input
                type="number"
                min="0.000001"
                step="any"
                value={requiredQty}
                disabled={
                  working ||
                  !inputProductId
                }
                onChange={(event) =>
                  setRequiredQty(
                    event.target.value
                  )
                }
                placeholder="1"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>

            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Unit
              </div>

              <input
                value={
                  inputUnit
                    ? `${inputUnit.code} — ${inputUnit.name}`
                    : ''
                }
                disabled
                className="w-full rounded-xl border p-3 font-bold bg-slate-100"
              />
            </label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Wastage Allowance %
              </div>

              <input
                type="number"
                min="0"
                max="100"
                step="0.0001"
                value={wastagePct}
                disabled={working}
                onChange={(event) =>
                  setWastagePct(
                    event.target.value
                  )
                }
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>

            <label className="flex items-center gap-3 pt-6">
              <input
                type="checkbox"
                checked={isOptional}
                disabled={working}
                onChange={(event) =>
                  setIsOptional(
                    event.target.checked
                  )
                }
              />

              <span className="font-bold text-sm text-slate-600">
                {t(
                  'Optional Ingredient',
                  'Optional Ingredient'
                )}
              </span>
            </label>
          </div>

          <button
            type="submit"
            disabled={
              working ||
              !selectedVersion ||
              !inputProductId
            }
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
          >
            {t(
              'BOM Ingredient ထည့်မည်',
              'Add BOM Ingredient'
            )}
          </button>
        </form>

        <div className="rounded-2xl border bg-white p-5">
          <div className="font-black text-slate-800">
            📋{' '}
            {t(
              'Draft BOM Summary',
              'Draft BOM Summary'
            )}
          </div>

          {selectedVersion &&
          selectedRecipe ? (
            <div className="mt-4 space-y-3 text-sm">
              <div>
                <span className="font-black">
                  Recipe:
                </span>{' '}
                {selectedRecipe.code}
              </div>

              <div>
                <span className="font-black">
                  Version:
                </span>{' '}
                V
                {selectedVersion.version_no}
              </div>

              <div>
                <span className="font-black">
                  Standard Output:
                </span>{' '}
                {Number(
                  selectedVersion.standard_output_qty
                ).toLocaleString()}{' '}
                {unitsById.get(
                  selectedVersion.output_unit_id
                )?.code || ''}
              </div>

              <div>
                <span className="font-black">
                  Components:
                </span>{' '}
                {components.length}
              </div>

              <div className="rounded-lg bg-slate-50 p-3 font-bold text-slate-500">
                {t(
                  'Approval မပြုမီ BOM အားလုံးကို စစ်ဆေးပါ။',
                  'Review the complete BOM before approval.'
                )}
              </div>

              <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs font-bold text-amber-800">
                ⚠️{' '}
                {t(
                  'Approve ပြီးနောက် Formula Quantity / Unit နှင့် BOM Components ကို ပြန်ပြင်၍မရတော့ပါ။ ပြောင်းလဲရန် Version အသစ်ဖန်တီးရပါမည်။',
                  'Approval locks the formula quantity/unit and BOM components. Future formula changes require a new version.'
                )}
              </div>

              <button
                type="button"
                disabled={
                  working ||
                  components.length === 0
                }
                onClick={handleApprove}
                className="w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white disabled:opacity-50"
              >
                {t(
                  '✅ Recipe / BOM Approve & Lock',
                  '✅ Approve & Lock Recipe / BOM'
                )}
              </button>
            </div>
          ) : (
            <div className="mt-4 font-bold text-slate-400">
              {t(
                'Draft Version မရှိပါ။',
                'No Draft Version available.'
              )}
            </div>
          )}
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-4 border-b font-black text-slate-800">
          🧱 BOM Components
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">
                  Line
                </th>
                <th className="text-left p-3">
                  SKU
                </th>
                <th className="text-left p-3">
                  Ingredient
                </th>
                <th className="text-left p-3">
                  Required Qty
                </th>
                <th className="text-left p-3">
                  Unit
                </th>
                <th className="text-left p-3">
                  Wastage %
                </th>
                <th className="text-left p-3">
                  Optional
                </th>
                <th className="text-left p-3">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {components.map(
                (component) => {
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
                      key={component.id}
                      className="border-t"
                    >
                      <td className="p-3 font-bold">
                        {component.line_no}
                      </td>

                      <td className="p-3">
                        {product?.sku || '—'}
                      </td>

                      <td className="p-3 font-bold">
                        {product?.name || '—'}
                      </td>

                      <td className="p-3">
                        {Number(
                          component.required_qty
                        ).toLocaleString()}
                      </td>

                      <td className="p-3">
                        {unit?.code || '—'}
                      </td>

                      <td className="p-3">
                        {Number(
                          component.wastage_allowance_pct
                        ).toLocaleString()}
                      </td>

                      <td className="p-3">
                        {component.is_optional
                          ? 'Yes'
                          : 'No'}
                      </td>

                      <td className="p-3">
                        <button
                          type="button"
                          disabled={working}
                          onClick={() =>
                            handleRemove(
                              component.id
                            )
                          }
                          className="font-black text-red-600 hover:underline disabled:opacity-50"
                        >
                          🗑 Remove
                        </button>
                      </td>
                    </tr>
                  );
                }
              )}

              {components.length === 0 && (
                <tr>
                  <td
                    colSpan={8}
                    className="p-8 text-center font-bold text-slate-400"
                  >
                    {t(
                      'BOM Ingredient မရှိသေးပါ။',
                      'No BOM ingredients yet.'
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
