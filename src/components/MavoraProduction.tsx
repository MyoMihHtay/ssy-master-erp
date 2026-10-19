import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import { MavoraProductionMasters } from './MavoraProductionMasters';

import {
  loadMavoraProductionSnapshot,
  type MavoraProductionSnapshot,
} from '../production/mavoraProduction';

interface Props {
  tenantId: string;
  language: AppLanguage;
}

type AdvancedTab =
  | 'overview'
  | 'work-centers'
  | 'recipes'
  | 'orders';

const EMPTY_SNAPSHOT: MavoraProductionSnapshot = {
  sites: [],
  departments: [],
  workCenters: [],
  productionLines: [],
  products: [],
  units: [],
  recipes: [],
  recipeVersions: [],
  recipeComponents: [],
  orders: [],
  orderMaterials: [],
};

export const MavoraProduction: React.FC<Props> = ({
  tenantId,
  language,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [snapshot, setSnapshot] =
    useState<MavoraProductionSnapshot>(
      EMPTY_SNAPSHOT
    );

  const [loading, setLoading] = useState(true);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [showAdvanced, setShowAdvanced] =
    useState(false);

  const [activeTab, setActiveTab] =
    useState<AdvancedTab>('overview');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data =
        await loadMavoraProductionSnapshot(
          tenantId
        );

      setSnapshot(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load MAVORA Production'
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const productCounts = useMemo(() => {
    const count = (
      type: string
    ) =>
      snapshot.products.filter(
        (product) =>
          product.product_type === type
      ).length;

    return {
      RM: count('RM'),
      SFG: count('SFG'),
      PKG: count('PKG'),
      FG: count('FG'),
    };
  }, [snapshot.products]);

  const approvedRecipeCount =
    snapshot.recipeVersions.filter(
      (version) =>
        version.status === 'approved'
    ).length;

  const readiness = {
    site: snapshot.sites.length > 0,

    workCenter:
      snapshot.workCenters.length > 0,

    productionLine:
      snapshot.productionLines.length > 0,

    inputProducts:
      productCounts.RM > 0 ||
      productCounts.SFG > 0 ||
      productCounts.PKG > 0,

    outputProducts:
      productCounts.SFG > 0 ||
      productCounts.FG > 0,

    recipes:
      approvedRecipeCount > 0,
  };

  const readyCount =
    Object.values(readiness).filter(
      Boolean
    ).length;

  const totalReadiness =
    Object.keys(readiness).length;

  const productionReady =
    readyCount === totalReadiness;

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
        snapshot.units.map((unit) => [
          unit.id,
          unit,
        ])
      ),
    [snapshot.units]
  );

  const versionsByRecipe = useMemo(() => {
    const map = new Map<
      string,
      typeof snapshot.recipeVersions
    >();

    snapshot.recipeVersions.forEach(
      (version) => {
        const current =
          map.get(version.recipe_id) || [];

        current.push(version);
        map.set(
          version.recipe_id,
          current
        );
      }
    );

    return map;
  }, [snapshot.recipeVersions]);

  if (loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="rounded-2xl border bg-white p-10 text-center">
          <div className="text-4xl animate-pulse">
            🏭
          </div>

          <div className="font-black text-slate-700 mt-3">
            {t(
              'Production Data ချိတ်ဆက်နေပါသည်...',
              'Loading Production data...'
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto space-y-5">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="text-xs font-black tracking-widest text-orange-600">
            MAVORA MANUFACTURING ERP
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-slate-800 mt-1">
            🏭{' '}
            {t(
              'ထုတ်လုပ်မှု စီမံခန့်ခွဲမှု',
              'Production Management'
            )}
          </h2>

          <p className="text-sm font-bold text-slate-500 mt-1">
            {t(
              'Formula, BOM, Work Center နှင့် Production Order များကို စနစ်တကျ ချိတ်ဆက်စီမံပါသည်။',
              'Controlled Recipes, BOM, Work Centers and Production Orders.'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            setShowAdvanced(
              (current) => !current
            )
          }
          className="rounded-xl border-2 border-slate-200 bg-white px-4 py-3 font-black text-slate-600 hover:bg-slate-50"
        >
          {showAdvanced
            ? `← ${t(
                'ရိုးရှင်းသောပုံစံ',
                'Simple Mode'
              )}`
            : `⚙️ ${t(
                'အဆင့်မြင့်',
                'Advanced'
              )}`}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 font-bold text-red-700">
          ❌ {errorMessage}

          <button
            type="button"
            onClick={refresh}
            className="ml-3 underline"
          >
            {t(
              'ပြန်စမ်းမည်',
              'Retry'
            )}
          </button>
        </div>
      )}

      {!showAdvanced && (
        <>
          <div
            className={`rounded-2xl border-2 p-5 ${
              productionReady
                ? 'border-emerald-200 bg-emerald-50'
                : 'border-amber-200 bg-amber-50'
            }`}
          >
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="font-black text-lg text-slate-800">
                  {productionReady
                    ? `✅ ${t(
                        'Production အသင့်ဖြစ်ပါပြီ',
                        'Production is ready'
                      )}`
                    : `🧭 ${t(
                        'Production Setup လိုအပ်နေသေးသည်',
                        'Production setup is not complete yet'
                      )}`}
                </div>

                <div className="text-sm font-bold text-slate-600 mt-1">
                  {t(
                    `လိုအပ်ချက် ${totalReadiness} ခုအနက် ${readyCount} ခု အသင့်ဖြစ်ပါသည်။`,
                    `${readyCount} of ${totalReadiness} readiness checks are complete.`
                  )}
                </div>
              </div>

              <div className="text-3xl font-black text-slate-800">
                {readyCount}/{totalReadiness}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {[
              {
                icon: '🏢',
                title: t(
                  'စက်ရုံ / Site',
                  'Factory / Site'
                ),
                ready: readiness.site,
                detail: `${snapshot.sites.length}`,
              },
              {
                icon: '⚙️',
                title: t(
                  'Work Center',
                  'Work Centers'
                ),
                ready:
                  readiness.workCenter,
                detail: `${snapshot.workCenters.length}`,
              },
              {
                icon: '🏭',
                title: t(
                  'Production Line',
                  'Production Lines'
                ),
                ready:
                  readiness.productionLine,
                detail: `${snapshot.productionLines.length}`,
              },
              {
                icon: '🧱',
                title: t(
                  'ထုတ်လုပ်မှု Input',
                  'Production Inputs'
                ),
                ready:
                  readiness.inputProducts,
                detail: `RM ${productCounts.RM} • SFG ${productCounts.SFG} • PKG ${productCounts.PKG}`,
              },
              {
                icon: '📦',
                title: t(
                  'ထုတ်ကုန် Output',
                  'Production Outputs'
                ),
                ready:
                  readiness.outputProducts,
                detail: `SFG ${productCounts.SFG} • FG ${productCounts.FG}`,
              },
              {
                icon: '🧾',
                title: t(
                  'အတည်ပြုပြီး Formula / BOM',
                  'Approved Recipe / BOM'
                ),
                ready:
                  readiness.recipes,
                detail: `${approvedRecipeCount}`,
              },
            ].map((item) => (
              <div
                key={item.title}
                className="rounded-2xl border bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="text-3xl">
                    {item.icon}
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-black ${
                      item.ready
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-amber-100 text-amber-700'
                    }`}
                  >
                    {item.ready
                      ? t(
                          'အသင့်',
                          'Ready'
                        )
                      : t(
                          'လိုအပ်',
                          'Required'
                        )}
                  </div>
                </div>

                <div className="font-black text-slate-800 mt-4">
                  {item.title}
                </div>

                <div className="text-sm font-bold text-slate-500 mt-1">
                  {item.detail}
                </div>
              </div>
            ))}
          </div>

          <div className="rounded-2xl border bg-white p-5">
            <div className="font-black text-slate-800">
              🚦{' '}
              {t(
                'နေ့စဉ် Production Flow',
                'Daily Production Flow'
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
              {[
                [
                  '1',
                  t(
                    'ထုတ်လုပ်ရန်',
                    'Plan'
                  ),
                ],
                [
                  '2',
                  t(
                    'စတင်ရန်',
                    'Start'
                  ),
                ],
                [
                  '3',
                  t(
                    'ပြီးစီးရန်',
                    'Complete'
                  ),
                ],
                [
                  '4',
                  t(
                    'QC စစ်ရန်',
                    'QC'
                  ),
                ],
              ].map(([number, title]) => (
                <div
                  key={number}
                  className="rounded-xl border bg-slate-50 p-4"
                >
                  <div className="text-xs font-black text-orange-600">
                    STEP {number}
                  </div>

                  <div className="font-black text-slate-700 mt-1">
                    {title}
                  </div>

                  <div className="text-xs font-bold text-slate-400 mt-2">
                    {t(
                      'Setup ပြီးမှ အသုံးပြုနိုင်မည်',
                      'Enabled after setup'
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {showAdvanced && (
        <>
          <div className="flex flex-wrap gap-2">
            {[
              [
                'overview',
                t(
                  'အနှစ်ချုပ်',
                  'Overview'
                ),
              ],
              [
                'work-centers',
                'Work Centers',
              ],
              [
                'recipes',
                t(
                  'Formula / BOM',
                  'Recipes / BOM'
                ),
              ],
              [
                'orders',
                'Production Orders',
              ],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() =>
                  setActiveTab(
                    key as AdvancedTab
                  )
                }
                className={`rounded-xl px-4 py-2 font-black text-sm ${
                  activeTab === key
                    ? 'bg-orange-500 text-white'
                    : 'bg-white border text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {activeTab === 'overview' && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                [
                  t(
                    'Formula',
                    'Recipes'
                  ),
                  snapshot.recipes.length,
                ],
                [
                  t(
                    'Approved',
                    'Approved'
                  ),
                  approvedRecipeCount,
                ],
                [
                  'Production Orders',
                  snapshot.orders.length,
                ],
                [
                  t(
                    'Work Center / Line',
                    'Work Center / Line'
                  ),
                  `${snapshot.workCenters.length} / ${snapshot.productionLines.length}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={String(label)}
                  className="rounded-2xl border bg-white p-5"
                >
                  <div className="text-xs font-black text-slate-400">
                    {label}
                  </div>

                  <div className="text-2xl font-black text-slate-800 mt-2">
                    {value}
                  </div>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'work-centers' && (
            <MavoraProductionMasters
              tenantId={tenantId}
              language={language}
              snapshot={snapshot}
              onRefresh={refresh}
            />
          )}

          {activeTab === 'recipes' && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="p-4 border-b font-black text-slate-800">
                🧾{' '}
                {t(
                  'Formula / BOM Register',
                  'Recipe / BOM Register'
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
                        Versions
                      </th>
                      <th className="text-left p-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {snapshot.recipes.map(
                      (recipe) => {
                        const versions =
                          versionsByRecipe.get(
                            recipe.id
                          ) || [];

                        const approved =
                          versions.find(
                            (version) =>
                              version.status ===
                              'approved'
                          );

                        const output =
                          productsById.get(
                            recipe.output_product_id
                          );

                        const outputUnit =
                          approved
                            ? unitsById.get(
                                approved.output_unit_id
                              )
                            : undefined;

                        return (
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
                              {output?.sku ||
                                '—'}
                              {approved
                                ? ` • ${approved.standard_output_qty} ${outputUnit?.symbol || outputUnit?.code || ''}`
                                : ''}
                            </td>

                            <td className="p-3">
                              {versions.length}
                            </td>

                            <td className="p-3">
                              {approved
                                ? '✅ Approved'
                                : '📝 Draft / None'}
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {snapshot.recipes.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="p-8 text-center font-bold text-slate-400"
                        >
                          {t(
                            'Formula / BOM မရှိသေးပါ။',
                            'No Production Recipes configured yet.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {activeTab === 'orders' && (
            <div className="rounded-2xl border bg-white overflow-hidden">
              <div className="p-4 border-b font-black text-slate-800">
                📋 Production Orders
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left p-3">
                        Order
                      </th>
                      <th className="text-left p-3">
                        Output
                      </th>
                      <th className="text-left p-3">
                        Planned Qty
                      </th>
                      <th className="text-left p-3">
                        Status
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {snapshot.orders.map(
                      (order) => {
                        const product =
                          productsById.get(
                            order.output_product_id
                          );

                        const unit =
                          unitsById.get(
                            order.output_unit_id
                          );

                        return (
                          <tr
                            key={order.id}
                            className="border-t"
                          >
                            <td className="p-3 font-bold">
                              {order.order_no}
                            </td>

                            <td className="p-3">
                              {product?.sku ||
                                '—'}
                            </td>

                            <td className="p-3">
                              {Number(
                                order.planned_qty
                              ).toLocaleString()}{' '}
                              {unit?.symbol ||
                                unit?.code ||
                                ''}
                            </td>

                            <td className="p-3">
                              {order.status}
                            </td>
                          </tr>
                        );
                      }
                    )}

                    {snapshot.orders.length ===
                      0 && (
                      <tr>
                        <td
                          colSpan={4}
                          className="p-8 text-center font-bold text-slate-400"
                        >
                          {t(
                            'Production Order မရှိသေးပါ။',
                            'No Production Orders yet.'
                          )}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm font-bold text-blue-700">
            🔒{' '}
            {t(
              'Work Center / Production Line Setup ကို အခွင့်အရေးထိန်းချုပ်မှုဖြင့် ဖွင့်ထားပါသည်။ Formula / BOM နှင့် Production Order များသည် Read-only ဖြစ်နေသေးသည်။',
              'Controlled Work Center / Production Line setup is enabled. Recipes / BOM and Production Orders remain read-only.'
            )}
          </div>
        </>
      )}
    </div>
  );
};
