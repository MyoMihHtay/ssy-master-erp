import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import { MavoraBomSetup } from './MavoraBomSetup';

import {
  createMavoraProductionRecipe,
  createMavoraRecipeVersion,
  type MavoraProductionSnapshot,
  type MavoraRecipeProcessType,
} from '../production/mavoraProduction';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraProductionSnapshot;
  onRefresh: () => Promise<void>;
}

export const MavoraRecipeSetup: React.FC<
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

  const outputProducts = useMemo(
    () =>
      snapshot.products.filter(
        (product) =>
          product.product_type === 'SFG' ||
          product.product_type === 'FG'
      ),
    [snapshot.products]
  );

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

  const [recipeForm, setRecipeForm] =
    useState({
      code: '',
      name: '',
      processType:
        'manufacturing' as MavoraRecipeProcessType,
      outputProductId: '',
    });

  const [versionForm, setVersionForm] =
    useState({
      recipeId: '',
      versionNo: '1',
      standardOutputQty: '',
      outputUnitId: '',
    });

  useEffect(() => {
    if (
      !recipeForm.outputProductId &&
      outputProducts[0]
    ) {
      setRecipeForm((current) => ({
        ...current,
        outputProductId:
          outputProducts[0].id,
      }));
    }
  }, [
    outputProducts,
    recipeForm.outputProductId,
  ]);

  useEffect(() => {
    if (
      !versionForm.recipeId &&
      snapshot.recipes[0]
    ) {
      setVersionForm((current) => ({
        ...current,
        recipeId:
          snapshot.recipes[0].id,
      }));
    }
  }, [
    snapshot.recipes,
    versionForm.recipeId,
  ]);

  useEffect(() => {
    const recipe =
      snapshot.recipes.find(
        (item) =>
          item.id ===
          versionForm.recipeId
      );

    if (!recipe) {
      return;
    }

    const outputProduct =
      productsById.get(
        recipe.output_product_id
      );

    if (
      outputProduct &&
      versionForm.outputUnitId !==
        outputProduct.base_unit_id
    ) {
      setVersionForm((current) => ({
        ...current,
        outputUnitId:
          outputProduct.base_unit_id,
      }));
    }
  }, [
    snapshot.recipes,
    productsById,
    versionForm.recipeId,
    versionForm.outputUnitId,
  ]);

  const versionsByRecipe =
    useMemo(() => {
      const result = new Map<
        string,
        typeof snapshot.recipeVersions
      >();

      snapshot.recipeVersions.forEach(
        (version) => {
          const current =
            result.get(
              version.recipe_id
            ) || [];

          current.push(version);

          result.set(
            version.recipe_id,
            current
          );
        }
      );

      return result;
    }, [snapshot.recipeVersions]);

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const handleCreateRecipe = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    if (
      !recipeForm.code.trim() ||
      !recipeForm.name.trim() ||
      !recipeForm.outputProductId
    ) {
      setErrorMessage(
        t(
          'Recipe Code, Name နှင့် Output Product ဖြည့်ပါ။',
          'Recipe Code, Name and Output Product are required.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      const created =
        await createMavoraProductionRecipe({
          tenantId,
          code: recipeForm.code,
          name: recipeForm.name,
          processType:
            recipeForm.processType,
          outputProductId:
            recipeForm.outputProductId,
        });

      setRecipeForm((current) => ({
        ...current,
        code: '',
        name: '',
      }));

      setVersionForm((current) => ({
        ...current,
        recipeId: created.id,
        versionNo: '1',
        standardOutputQty: '',
      }));

      setSuccessMessage(
        t(
          'Recipe Master ဖန်တီးပြီးပါပြီ။',
          'Recipe Master created successfully.'
        )
      );

      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create Recipe'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleCreateVersion = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    const versionNo = Number(
      versionForm.versionNo
    );

    const standardOutputQty =
      Number(
        versionForm.standardOutputQty
      );

    if (!versionForm.recipeId) {
      setErrorMessage(
        t(
          'Recipe ကိုရွေးပါ။',
          'Select a Recipe.'
        )
      );
      return;
    }

    if (
      !Number.isInteger(versionNo) ||
      versionNo <= 0
    ) {
      setErrorMessage(
        t(
          'Version No သည် 1 နှင့်အထက် ကိန်းပြည့်ဖြစ်ရပါမည်။',
          'Version No must be a positive integer.'
        )
      );
      return;
    }

    if (
      !Number.isFinite(
        standardOutputQty
      ) ||
      standardOutputQty <= 0
    ) {
      setErrorMessage(
        t(
          'Standard Output Qty သည် 0 ထက်ကြီးရပါမည်။',
          'Standard Output Qty must be greater than zero.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      await createMavoraRecipeVersion({
        tenantId,
        recipeId:
          versionForm.recipeId,
        versionNo,
        standardOutputQty,
        outputUnitId:
          versionForm.outputUnitId,
      });

      setVersionForm((current) => ({
        ...current,
        standardOutputQty: '',
      }));

      setSuccessMessage(
        t(
          'Draft Recipe Version ဖန်တီးပြီးပါပြီ။',
          'Draft Recipe Version created successfully.'
        )
      );

      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to create Recipe Version'
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
          'Recipe Master, Draft Version, Draft BOM Setup နှင့် Controlled Approval ကို ဖွင့်ထားပါသည်။',
          'Recipe Master, Draft Version, Draft BOM setup and Controlled Approval are enabled.'
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
          onSubmit={handleCreateRecipe}
          className="rounded-2xl border bg-white p-5 space-y-4"
        >
          <div>
            <div className="font-black text-slate-800">
              🧾{' '}
              {t(
                'Recipe Master အသစ်',
                'New Recipe Master'
              )}
            </div>

            <div className="text-xs font-bold text-slate-400 mt-1">
              {t(
                'ထုတ်ကုန်တစ်မျိုးအတွက် Formula Master',
                'Formula master for one output product'
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Recipe Code *
              </div>

              <input
                value={recipeForm.code}
                disabled={working}
                onChange={(event) =>
                  setRecipeForm(
                    (current) => ({
                      ...current,
                      code:
                        event.target.value,
                    })
                  )
                }
                placeholder="REC-FISHSKIN-001"
                className="w-full rounded-xl border p-3 font-bold uppercase"
              />
            </label>

            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                {t(
                  'Recipe Name',
                  'Recipe Name'
                )}{' '}
                *
              </div>

              <input
                value={recipeForm.name}
                disabled={working}
                onChange={(event) =>
                  setRecipeForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="ငါးရေခွံကြော် Formula"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Process Type *
            </div>

            <select
              value={
                recipeForm.processType
              }
              disabled={working}
              onChange={(event) =>
                setRecipeForm(
                  (current) => ({
                    ...current,
                    processType:
                      event.target
                        .value as MavoraRecipeProcessType,
                  })
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="manufacturing">
                Manufacturing
              </option>
              <option value="packaging">
                Packaging
              </option>
              <option value="rework">
                Rework
              </option>
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Output Product *
            </div>

            <select
              value={
                recipeForm.outputProductId
              }
              disabled={working}
              onChange={(event) =>
                setRecipeForm(
                  (current) => ({
                    ...current,
                    outputProductId:
                      event.target.value,
                  })
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="">
                {t(
                  'Output Product ရွေးပါ',
                  'Select Output Product'
                )}
              </option>

              {outputProducts.map(
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

          <button
            type="submit"
            disabled={
              working ||
              !recipeForm.outputProductId
            }
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
          >
            {t(
              'Recipe Master ဖန်တီးမည်',
              'Create Recipe Master'
            )}
          </button>
        </form>

        <form
          onSubmit={handleCreateVersion}
          className="rounded-2xl border bg-white p-5 space-y-4"
        >
          <div>
            <div className="font-black text-slate-800">
              📑{' '}
              {t(
                'Draft Recipe Version',
                'Draft Recipe Version'
              )}
            </div>

            <div className="text-xs font-bold text-slate-400 mt-1">
              {t(
                'Standard Output Quantity ကို သတ်မှတ်ပါ',
                'Define the standard output quantity'
              )}
            </div>
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Recipe *
            </div>

            <select
              value={
                versionForm.recipeId
              }
              disabled={working}
              onChange={(event) =>
                setVersionForm(
                  (current) => ({
                    ...current,
                    recipeId:
                      event.target.value,
                  })
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="">
                {t(
                  'Recipe ရွေးပါ',
                  'Select Recipe'
                )}
              </option>

              {snapshot.recipes.map(
                (recipe) => (
                  <option
                    key={recipe.id}
                    value={recipe.id}
                  >
                    {recipe.code} —{' '}
                    {recipe.name}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Version No *
              </div>

              <input
                type="number"
                min="1"
                step="1"
                value={
                  versionForm.versionNo
                }
                disabled={working}
                onChange={(event) =>
                  setVersionForm(
                    (current) => ({
                      ...current,
                      versionNo:
                        event.target.value,
                    })
                  )
                }
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>

            <label>
              <div className="text-xs font-black text-slate-500 mb-1">
                Standard Output Qty *
              </div>

              <input
                type="number"
                min="0.000001"
                step="any"
                value={
                  versionForm.standardOutputQty
                }
                disabled={working}
                onChange={(event) =>
                  setVersionForm(
                    (current) => ({
                      ...current,
                      standardOutputQty:
                        event.target.value,
                    })
                  )
                }
                placeholder="1.4"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Output Unit
            </div>

            <select
              value={
                versionForm.outputUnitId
              }
              disabled
              className="w-full rounded-xl border p-3 font-bold bg-slate-100"
            >
              <option value="">
                —
              </option>

              {snapshot.units.map(
                (unit) => (
                  <option
                    key={unit.id}
                    value={unit.id}
                  >
                    {unit.code} —{' '}
                    {unit.name}
                  </option>
                )
              )}
            </select>
          </label>

          <button
            type="submit"
            disabled={
              working ||
              !versionForm.recipeId ||
              !versionForm.outputUnitId
            }
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
          >
            {t(
              'Draft Version ဖန်တီးမည်',
              'Create Draft Version'
            )}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-4 border-b font-black text-slate-800">
          🧾{' '}
          {t(
            'Recipe / Version Register',
            'Recipe / Version Register'
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">
                  Code
                </th>
                <th className="text-left p-3">
                  Name
                </th>
                <th className="text-left p-3">
                  Output
                </th>
                <th className="text-left p-3">
                  Version
                </th>
                <th className="text-left p-3">
                  Standard Qty
                </th>
                <th className="text-left p-3">
                  Status
                </th>
              </tr>
            </thead>

            <tbody>
              {snapshot.recipes.flatMap(
                (recipe) => {
                  const versions =
                    versionsByRecipe.get(
                      recipe.id
                    ) || [];

                  const output =
                    productsById.get(
                      recipe.output_product_id
                    );

                  if (
                    versions.length === 0
                  ) {
                    return [
                      <tr
                        key={recipe.id}
                        className="border-t"
                      >
                        <td className="p-3 font-bold">
                          {recipe.code}
                        </td>

                        <td className="p-3">
                          {recipe.name}
                        </td>

                        <td className="p-3">
                          {output?.sku || '—'}
                        </td>

                        <td className="p-3">
                          —
                        </td>

                        <td className="p-3">
                          —
                        </td>

                        <td className="p-3">
                          🧾 No Version
                        </td>
                      </tr>,
                    ];
                  }

                  return versions.map(
                    (version) => {
                      const unit =
                        unitsById.get(
                          version.output_unit_id
                        );

                      return (
                        <tr
                          key={version.id}
                          className="border-t"
                        >
                          <td className="p-3 font-bold">
                            {recipe.code}
                          </td>

                          <td className="p-3">
                            {recipe.name}
                          </td>

                          <td className="p-3">
                            {output?.sku ||
                              '—'}
                          </td>

                          <td className="p-3">
                            V{version.version_no}
                          </td>

                          <td className="p-3">
                            {Number(
                              version.standard_output_qty
                            ).toLocaleString()}{' '}
                            {unit?.code ||
                              ''}
                          </td>

                          <td className="p-3">
                            {version.status ===
                            'approved'
                              ? '✅ Approved'
                              : version.status ===
                                  'retired'
                                ? '⏹ Retired'
                                : '📝 Draft'}
                          </td>
                        </tr>
                      );
                    }
                  );
                }
              )}

              {snapshot.recipes.length ===
                0 && (
                <tr>
                  <td
                    colSpan={6}
                    className="p-8 text-center font-bold text-slate-400"
                  >
                    {t(
                      'Recipe မရှိသေးပါ။',
                      'No Recipes configured yet.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <MavoraBomSetup
        tenantId={tenantId}
        language={language}
        snapshot={snapshot}
        onRefresh={onRefresh}
      />
    </div>
  );
};
