import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  loadMavoraInventorySnapshot,
  type MavoraInventorySnapshot,
} from '../inventory/mavoraInventory';

interface MavoraFinishedGoodsProps {
  tenantId: string;
  language: AppLanguage;
}

const EMPTY_SNAPSHOT: MavoraInventorySnapshot = {
  products: [],
  warehouses: [],
  units: [],
  categories: [],
  lots: [],
  balances: [],
  movements: [],
};

const numberValue = (value: unknown): number => {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
};

const formatNumber = (
  value: number,
  maximumFractionDigits = 3
): string =>
  value.toLocaleString(undefined, {
    maximumFractionDigits,
  });

export const MavoraFinishedGoods: React.FC<
  MavoraFinishedGoodsProps
> = ({ tenantId, language }) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const [snapshot, setSnapshot] =
    useState<MavoraInventorySnapshot>(EMPTY_SNAPSHOT);

  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] =
    useState('');

  const [searchText, setSearchText] =
    useState('');

  const [categoryFilter, setCategoryFilter] =
    useState('ALL');

  const refresh = useCallback(async () => {
    setLoading(true);
    setErrorMessage('');

    try {
      const data =
        await loadMavoraInventorySnapshot(
          tenantId
        );

      setSnapshot(data);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to load Finished Goods'
      );
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

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

  const warehousesById = useMemo(
    () =>
      new Map(
        snapshot.warehouses.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.warehouses]
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

  const categoriesById = useMemo(
    () =>
      new Map(
        snapshot.categories.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.categories]
  );

  const lotsById = useMemo(
    () =>
      new Map(
        snapshot.lots.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.lots]
  );

  const fgWarehouses = useMemo(
    () =>
      snapshot.warehouses.filter(
        (warehouse) =>
          warehouse.is_active &&
          warehouse.warehouse_type === 'FG'
      ),
    [snapshot.warehouses]
  );

  const fgWarehouseIds = useMemo(
    () =>
      new Set(
        fgWarehouses.map(
          (warehouse) => warehouse.id
        )
      ),
    [fgWarehouses]
  );

  const fgProducts = useMemo(
    () =>
      snapshot.products.filter(
        (product) =>
          product.is_active &&
          product.product_type === 'FG'
      ),
    [snapshot.products]
  );

  const fgProductIds = useMemo(
    () =>
      new Set(
        fgProducts.map(
          (product) => product.id
        )
      ),
    [fgProducts]
  );

  const fgBalances = useMemo(
    () =>
      snapshot.balances.filter(
        (balance) =>
          fgWarehouseIds.has(
            balance.warehouse_id
          ) &&
          fgProductIds.has(
            balance.product_id
          )
      ),
    [
      snapshot.balances,
      fgWarehouseIds,
      fgProductIds,
    ]
  );

  const productRows = useMemo(
    () =>
      fgProducts
        .map((product) => {
          const balances =
            fgBalances.filter(
              (balance) =>
                balance.product_id ===
                product.id
            );

          const onHand =
            balances.reduce(
              (sum, balance) =>
                sum +
                numberValue(
                  balance.quantity
                ),
              0
            );

          const reserved =
            balances.reduce(
              (sum, balance) =>
                sum +
                numberValue(
                  balance.reserved_quantity
                ),
              0
            );

          const value =
            balances.reduce(
              (sum, balance) =>
                sum +
                numberValue(
                  balance.quantity
                ) *
                  numberValue(
                    balance.average_unit_cost
                  ),
              0
            );

          const averageCost =
            onHand !== 0
              ? value / onHand
              : 0;

          const activeLots =
            balances.filter(
              (balance) =>
                balance.lot_id &&
                numberValue(
                  balance.quantity
                ) !== 0
            ).length;

          const unit =
            unitsById.get(
              product.base_unit_id
            );

          const category =
            product.category_id
              ? categoriesById.get(
                  product.category_id
                )
              : undefined;

          return {
            product,
            category,
            unit,
            onHand,
            reserved,
            available:
              onHand - reserved,
            averageCost,
            value,
            activeLots,
          };
        })
        .sort((a, b) =>
          a.product.sku.localeCompare(
            b.product.sku
          )
        ),
    [
      fgProducts,
      fgBalances,
      unitsById,
      categoriesById,
    ]
  );

  const categoryOptions = useMemo(
    () =>
      Array.from(
        new Set(
          productRows
            .map(
              (row) =>
                row.category?.code ||
                'UNCATEGORIZED'
            )
        )
      ).sort(),
    [productRows]
  );

  const visibleProductRows = useMemo(
    () => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      return productRows.filter(
        (row) => {
          const categoryCode =
            row.category?.code ||
            'UNCATEGORIZED';

          const categoryMatches =
            categoryFilter === 'ALL' ||
            categoryCode ===
              categoryFilter;

          const searchMatches =
            !search ||
            row.product.sku
              .toLowerCase()
              .includes(search) ||
            row.product.name
              .toLowerCase()
              .includes(search) ||
            (
              row.category?.name || ''
            )
              .toLowerCase()
              .includes(search);

          return (
            categoryMatches &&
            searchMatches
          );
        }
      );
    },
    [
      productRows,
      categoryFilter,
      searchText,
    ]
  );

  const lotRows = useMemo(
    () =>
      fgBalances
        .filter(
          (balance) =>
            numberValue(
              balance.quantity
            ) !== 0
        )
        .map((balance) => {
          const product =
            productsById.get(
              balance.product_id
            );

          const warehouse =
            warehousesById.get(
              balance.warehouse_id
            );

          const lot =
            balance.lot_id
              ? lotsById.get(
                  balance.lot_id
                )
              : undefined;

          const unit = product
            ? unitsById.get(
                product.base_unit_id
              )
            : undefined;

          const quantity =
            numberValue(
              balance.quantity
            );

          const reserved =
            numberValue(
              balance.reserved_quantity
            );

          const averageCost =
            numberValue(
              balance.average_unit_cost
            );

          return {
            balance,
            product,
            warehouse,
            lot,
            unit,
            quantity,
            reserved,
            available:
              quantity - reserved,
            averageCost,
            value:
              quantity *
              averageCost,
          };
        })
        .sort((a, b) =>
          (
            a.product?.sku || ''
          ).localeCompare(
            b.product?.sku || ''
          )
        ),
    [
      fgBalances,
      productsById,
      warehousesById,
      lotsById,
      unitsById,
    ]
  );

  const totalInventoryValue =
    useMemo(
      () =>
        productRows.reduce(
          (sum, row) =>
            sum + row.value,
          0
        ),
      [productRows]
    );

  return (
    <div className="p-2 md:p-6 max-w-7xl mx-auto">

      <div className="flex flex-col md:flex-row justify-between gap-4 items-start md:items-center border-b-2 border-blue-100 pb-5 mb-5">

        <div>
          <div className="text-[10px] font-black tracking-[0.18em] text-blue-600 uppercase">
            MAVORA CONTROLLED INVENTORY
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-slate-800 mt-1">
            🛍️ {t(
              'ကုန်ချော စီမံခန့်ခွဲမှု',
              'Finished Goods Management'
            )}
          </h2>

          <p className="text-sm font-bold text-slate-500 mt-1">
            {t(
              'FG Warehouse • Lot / Batch • Inventory Ledger • Production Cost',
              'FG Warehouse • Lot / Batch • Inventory Ledger • Production Cost'
            )}
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refresh()}
          disabled={loading}
          className="px-5 py-3 rounded-xl bg-slate-900 text-white font-black disabled:opacity-50"
        >
          🔄 {loading
            ? t(
                'ဖတ်နေသည်...',
                'Loading...'
              )
            : t(
                'ပြန်ဖတ်မည်',
                'Refresh'
              )}
        </button>
      </div>

      <div className="mb-5 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-800">
        🛡️ {t(
          'ဤစာမျက်နှာသည် MAVORA Controlled Inventory Ledger မှ FG Warehouse လက်ကျန်ကိုသာ ဖတ်ပြထားပါသည်။ Manual stock edit မပြုလုပ်ပါ။',
          'This screen reads Finished Goods stock only from the MAVORA Controlled Inventory Ledger. Manual stock editing is disabled.'
        )}
      </div>

      {errorMessage && (
        <div className="mb-5 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
          ❌ {errorMessage}
        </div>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-black text-slate-400 uppercase">
            FG Products
          </div>
          <div className="text-3xl font-black text-blue-600 mt-1">
            {fgProducts.length}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-black text-slate-400 uppercase">
            FG Warehouses
          </div>
          <div className="text-3xl font-black text-indigo-600 mt-1">
            {fgWarehouses.length}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-black text-slate-400 uppercase">
            Active Stock Lines
          </div>
          <div className="text-3xl font-black text-violet-600 mt-1">
            {lotRows.length}
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4 shadow-sm">
          <div className="text-xs font-black text-slate-400 uppercase">
            Inventory Value
          </div>
          <div className="text-2xl font-black text-emerald-700 mt-1">
            {formatNumber(
              totalInventoryValue,
              2
            )} Ks
          </div>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden mb-5">

        <div className="p-4 border-b bg-slate-50 flex flex-col lg:flex-row gap-3 lg:items-center lg:justify-between">

          <h3 className="font-black text-slate-800">
            📦 {t(
              'FG Product Stock Summary',
              'FG Product Stock Summary'
            )}
          </h3>

          <div className="flex flex-col sm:flex-row gap-2">

            <select
              value={categoryFilter}
              onChange={(event) =>
                setCategoryFilter(
                  event.target.value
                )
              }
              className="border rounded-lg px-3 py-2 font-bold"
            >
              <option value="ALL">
                All Categories
              </option>

              {categoryOptions.map(
                (category) => (
                  <option
                    key={category}
                    value={category}
                  >
                    {category}
                  </option>
                )
              )}
            </select>

            <input
              value={searchText}
              onChange={(event) =>
                setSearchText(
                  event.target.value
                )
              }
              placeholder="Search SKU / Product"
              className="border rounded-lg px-3 py-2 font-bold min-w-[220px]"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] text-left">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Category</th>
                <th className="p-3 text-right">On Hand</th>
                <th className="p-3 text-right">Reserved</th>
                <th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Avg Cost</th>
                <th className="p-3 text-right">Value</th>
                <th className="p-3 text-right">Lots</th>
              </tr>
            </thead>

            <tbody>
              {visibleProductRows.map(
                (row) => (
                  <tr
                    key={row.product.id}
                    className="border-b hover:bg-blue-50/40"
                  >
                    <td className="p-3 font-black text-blue-700">
                      {row.product.sku}
                    </td>

                    <td className="p-3 font-bold text-slate-800">
                      {row.product.name}
                    </td>

                    <td className="p-3 text-slate-600">
                      {row.category?.name ||
                        row.category?.code ||
                        '—'}
                    </td>

                    <td className="p-3 text-right font-black">
                      {formatNumber(
                        row.onHand
                      )}{' '}
                      {row.unit?.symbol ||
                        row.unit?.code ||
                        ''}
                    </td>

                    <td className="p-3 text-right">
                      {formatNumber(
                        row.reserved
                      )}
                    </td>

                    <td className="p-3 text-right font-black text-emerald-700">
                      {formatNumber(
                        row.available
                      )}
                    </td>

                    <td className="p-3 text-right">
                      {formatNumber(
                        row.averageCost
                      )}{' '}
                      Ks
                    </td>

                    <td className="p-3 text-right font-black">
                      {formatNumber(
                        row.value,
                        2
                      )}{' '}
                      Ks
                    </td>

                    <td className="p-3 text-right">
                      {row.activeLots}
                    </td>
                  </tr>
                )
              )}

              {!loading &&
                visibleProductRows.length ===
                  0 && (
                  <tr>
                    <td
                      colSpan={9}
                      className="p-8 text-center text-slate-400 font-bold"
                    >
                      No controlled Finished Goods found.
                    </td>
                  </tr>
                )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="bg-white border rounded-xl shadow-sm overflow-hidden">

        <div className="p-4 border-b bg-slate-50">
          <h3 className="font-black text-slate-800">
            🧬 FG Lot / Batch Stock
          </h3>

          <p className="text-xs text-slate-500 font-bold mt-1">
            Physical stock currently held in FG warehouse locations.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full min-w-[1050px] text-left">
            <thead className="bg-slate-100 border-b">
              <tr>
                <th className="p-3">SKU</th>
                <th className="p-3">Product</th>
                <th className="p-3">Warehouse</th>
                <th className="p-3">Lot / Batch</th>
                <th className="p-3">Status</th>
                <th className="p-3 text-right">On Hand</th>
                <th className="p-3 text-right">Reserved</th>
                <th className="p-3 text-right">Available</th>
                <th className="p-3 text-right">Unit Cost</th>
                <th className="p-3 text-right">Value</th>
              </tr>
            </thead>

            <tbody>
              {lotRows.map((row) => (
                <tr
                  key={row.balance.id}
                  className="border-b hover:bg-emerald-50/40"
                >
                  <td className="p-3 font-black text-blue-700">
                    {row.product?.sku ||
                      '—'}
                  </td>

                  <td className="p-3 font-bold">
                    {row.product?.name ||
                      '—'}
                  </td>

                  <td className="p-3">
                    <div className="font-black">
                      {row.warehouse?.code ||
                        '—'}
                    </div>
                    <div className="text-xs text-slate-500">
                      {row.warehouse?.name ||
                        ''}
                    </div>
                  </td>

                  <td className="p-3">
                    {row.lot
                      ? `${row.lot.lot_no}${
                          row.lot.batch_no
                            ? ` / ${row.lot.batch_no}`
                            : ''
                        }`
                      : '—'}
                  </td>

                  <td className="p-3">
                    <span className="px-2 py-1 rounded-full bg-emerald-50 text-emerald-700 text-xs font-black">
                      {row.lot?.status ||
                        'untracked'}
                    </span>
                  </td>

                  <td className="p-3 text-right font-black">
                    {formatNumber(
                      row.quantity
                    )}{' '}
                    {row.unit?.symbol ||
                      row.unit?.code ||
                      ''}
                  </td>

                  <td className="p-3 text-right">
                    {formatNumber(
                      row.reserved
                    )}
                  </td>

                  <td className="p-3 text-right font-black text-emerald-700">
                    {formatNumber(
                      row.available
                    )}
                  </td>

                  <td className="p-3 text-right">
                    {formatNumber(
                      row.averageCost
                    )}{' '}
                    Ks
                  </td>

                  <td className="p-3 text-right font-black">
                    {formatNumber(
                      row.value,
                      2
                    )}{' '}
                    Ks
                  </td>
                </tr>
              ))}

              {!loading &&
                lotRows.length === 0 && (
                  <tr>
                    <td
                      colSpan={10}
                      className="p-8 text-center text-slate-400 font-bold"
                    >
                      No FG warehouse stock is available.
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
