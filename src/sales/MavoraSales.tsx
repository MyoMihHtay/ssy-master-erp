import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  checkoutMavoraSalesOrder,
  createSalesPostingKey,
  loadMavoraSalesCatalog,
  loadMavoraSalesWarehouses,
  setMavoraSalesProductPrice,
  upsertMavoraSalesPriceList,
  type MavoraSalesCatalog,
  type MavoraSalesCatalogProduct,
  type MavoraSalesCheckoutResult,
  type MavoraSalesWarehouse,
} from './mavoraSalesService';

interface MavoraSalesProps {
  tenantId: string;
  language: AppLanguage;
  userName: string;
  roleCode: string;
}

interface CartLine {
  product: MavoraSalesCatalogProduct;
  quantity: number;
}

const numberValue = (
  value: unknown
): number => {
  const parsed = Number(value ?? 0);

  return Number.isFinite(parsed)
    ? parsed
    : 0;
};

const formatNumber = (
  value: number,
  maximumFractionDigits = 2
): string =>
  value.toLocaleString(undefined, {
    maximumFractionDigits,
  });

export const MavoraSales: React.FC<
  MavoraSalesProps
> = ({
  tenantId,
  language,
  userName,
  roleCode,
}) => {
  const t = (
    my: string,
    en: string
  ) =>
    language === 'my'
      ? my
      : en;

  const canManagePrices =
    roleCode
      .trim()
      .toUpperCase() ===
    'OWNER';

  const [
    warehouses,
    setWarehouses,
  ] = useState<
    MavoraSalesWarehouse[]
  >([]);

  const [
    selectedWarehouseId,
    setSelectedWarehouseId,
  ] = useState('');

  const [
    catalog,
    setCatalog,
  ] = useState<
    MavoraSalesCatalog | null
  >(null);

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    priceSetupRequired,
    setPriceSetupRequired,
  ] = useState(false);

  const [
    priceSetupOpen,
    setPriceSetupOpen,
  ] = useState(false);

  const [
    priceSavingProductId,
    setPriceSavingProductId,
  ] = useState<string | null>(
    null
  );

  const [
    priceFields,
    setPriceFields,
  ] = useState<
    Record<string, string>
  >({});

  const [
    searchText,
    setSearchText,
  ] = useState('');

  const [
    cart,
    setCart,
  ] = useState<CartLine[]>([]);

  const [
    checkoutOpen,
    setCheckoutOpen,
  ] = useState(false);

  const [
    checkoutBusy,
    setCheckoutBusy,
  ] = useState(false);

  const [
    customerName,
    setCustomerName,
  ] = useState('');

  const [
    customerPhone,
    setCustomerPhone,
  ] = useState('');

  const [
    customerShopType,
    setCustomerShopType,
  ] = useState(
    'Retail'
  );

  const [
    customerAddress,
    setCustomerAddress,
  ] = useState('');

  const [
    customerGps,
    setCustomerGps,
  ] = useState('');

  const [
    paymentMethod,
    setPaymentMethod,
  ] = useState('CASH');

  const [
    creditTerms,
    setCreditTerms,
  ] = useState(
    '7 Days'
  );

  const [
    discountPercent,
    setDiscountPercent,
  ] = useState(0);

  const [
    taxPercent,
    setTaxPercent,
  ] = useState(0);

  const [
    lastCheckout,
    setLastCheckout,
  ] = useState<
    MavoraSalesCheckoutResult | null
  >(null);

  const postingKeyRef =
    useRef<string | null>(null);

  const invalidatePostingKey =
    useCallback(() => {
      postingKeyRef.current =
        null;
    }, []);

  const refreshCatalog =
    useCallback(
      async (
        warehouseId =
          selectedWarehouseId,
        priceListId?: string | null
      ) => {
        if (!warehouseId) {
          return;
        }

        setLoading(true);
        setErrorMessage('');

        try {
          const result =
            await loadMavoraSalesCatalog(
              tenantId,
              warehouseId,
              priceListId
            );

          setCatalog(result);

          setPriceSetupRequired(
            false
          );

          const initialPrices:
            Record<
              string,
              string
            > = {};

          result.products.forEach(
            (product) => {
              initialPrices[
                product.product_id
              ] =
                product.unit_price ===
                null
                  ? ''
                  : String(
                      product.unit_price
                    );
            }
          );

          setPriceFields(
            initialPrices
          );
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Unable to load Sales Catalog';

          setCatalog(null);

          setErrorMessage(
            message
          );

          if (
            message
              .toLowerCase()
              .includes(
                'active sales price list not found'
              )
          ) {
            setPriceSetupRequired(
              true
            );

            setPriceSetupOpen(
              true
            );
          }
        } finally {
          setLoading(false);
        }
      },
      [
        tenantId,
        selectedWarehouseId,
      ]
    );

  const refreshWarehouses =
    useCallback(async () => {
      setLoading(true);
      setErrorMessage('');

      try {
        const data =
          await loadMavoraSalesWarehouses(
            tenantId
          );

        setWarehouses(
          data
        );

        if (
          data.length === 0
        ) {
          setSelectedWarehouseId(
            ''
          );

          setErrorMessage(
            t(
              'အသုံးပြုနိုင်သော FG Warehouse မရှိပါ။',
              'No active Finished Goods warehouse is available.'
            )
          );

          return;
        }

        setSelectedWarehouseId(
          (current) =>
            current ||
            data[0].id
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to load Sales warehouses'
        );
      } finally {
        setLoading(false);
      }
    }, [
      tenantId,
      language,
    ]);

  useEffect(() => {
    void refreshWarehouses();
  }, [refreshWarehouses]);

  useEffect(() => {
    if (
      !selectedWarehouseId
    ) {
      return;
    }

    setCart([]);
    invalidatePostingKey();

    void refreshCatalog(
      selectedWarehouseId
    );
  }, [
    selectedWarehouseId,
    refreshCatalog,
    invalidatePostingKey,
  ]);

  const visibleProducts =
    useMemo(() => {
      const search =
        searchText
          .trim()
          .toLowerCase();

      if (!catalog) {
        return [];
      }

      if (!search) {
        return catalog.products;
      }

      return catalog.products.filter(
        (product) =>
          product.sku
            .toLowerCase()
            .includes(search) ||
          product.name
            .toLowerCase()
            .includes(search) ||
          (
            product.category_name ??
            ''
          )
            .toLowerCase()
            .includes(search)
      );
    }, [
      catalog,
      searchText,
    ]);

  const cartSubtotal =
    useMemo(
      () =>
        cart.reduce(
          (
            total,
            line
          ) =>
            total +
            line.quantity *
              numberValue(
                line.product
                  .unit_price
              ),
          0
        ),
      [cart]
    );

  const discountAmount =
    cartSubtotal *
    (
      discountPercent /
      100
    );

  const taxableAmount =
    cartSubtotal -
    discountAmount;

  const taxAmount =
    taxableAmount *
    (
      taxPercent /
      100
    );

  const grandTotal =
    taxableAmount +
    taxAmount;

  const addToCart = (
    product:
      MavoraSalesCatalogProduct
  ) => {
    if (
      !product.is_sellable ||
      product.unit_price ===
        null ||
      product.available <= 0
    ) {
      return;
    }

    invalidatePostingKey();

    const minimum =
      Math.max(
        1,
        numberValue(
          product.min_quantity
        ) || 1
      );

    setCart(
      (current) => {
        const existing =
          current.find(
            (line) =>
              line.product
                .product_id ===
              product.product_id
          );

        if (existing) {
          const nextQuantity =
            existing.quantity +
            minimum;

          if (
            nextQuantity >
            product.available
          ) {
            return current;
          }

          return current.map(
            (line) =>
              line.product
                .product_id ===
              product.product_id
                ? {
                    ...line,
                    quantity:
                      nextQuantity,
                  }
                : line
          );
        }

        if (
          minimum >
          product.available
        ) {
          return current;
        }

        return [
          ...current,
          {
            product,
            quantity:
              minimum,
          },
        ];
      }
    );
  };

  const updateCartQuantity = (
    productId: string,
    value: number
  ) => {
    invalidatePostingKey();

    setCart(
      (current) =>
        current
          .map(
            (line) => {
              if (
                line.product
                  .product_id !==
                productId
              ) {
                return line;
              }

              const minimum =
                Math.max(
                  1,
                  numberValue(
                    line.product
                      .min_quantity
                  ) || 1
                );

              const quantity =
                Math.min(
                  line.product
                    .available,
                  Math.max(
                    minimum,
                    Number.isFinite(
                      value
                    )
                      ? value
                      : minimum
                  )
                );

              return {
                ...line,
                quantity,
              };
            }
          )
          .filter(
            (line) =>
              line.quantity > 0
          )
    );
  };

  const removeFromCart = (
    productId: string
  ) => {
    invalidatePostingKey();

    setCart(
      (current) =>
        current.filter(
          (line) =>
            line.product
              .product_id !==
            productId
        )
    );
  };

  const createDefaultPriceList =
    async () => {
      if (
        !selectedWarehouseId
      ) {
        return;
      }

      setLoading(true);
      setErrorMessage('');

      try {
        const created =
          await upsertMavoraSalesPriceList(
            {
              tenantId,
              code: 'RETAIL',
              name:
                'Retail Price List',
              currencyCode:
                'MMK',
              description:
                'Default controlled Sales price list',
              isDefault:
                true,
              isActive:
                true,
            }
          );

        await refreshCatalog(
          selectedWarehouseId,
          created.price_list_id
        );

        setPriceSetupRequired(
          false
        );

        setPriceSetupOpen(
          true
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to create Price List'
        );
      } finally {
        setLoading(false);
      }
    };

  const saveProductPrice =
    async (
      product:
        MavoraSalesCatalogProduct
    ) => {
      if (!catalog) {
        return;
      }

      const price =
        Number(
          priceFields[
            product.product_id
          ]
        );

      if (
        !Number.isFinite(
          price
        ) ||
        price < 0
      ) {
        setErrorMessage(
          t(
            'ဈေးနှုန်းမှန်ကန်စွာ ထည့်ပါ။',
            'Enter a valid price.'
          )
        );

        return;
      }

      setPriceSavingProductId(
        product.product_id
      );

      setErrorMessage('');

      try {
        await setMavoraSalesProductPrice(
          {
            tenantId,
            priceListId:
              catalog.price_list.id,
            productId:
              product.product_id,
            unitPrice:
              price,
            effectiveFrom:
              catalog.as_of,
            minQuantity:
              1,
          }
        );

        await refreshCatalog(
          selectedWarehouseId,
          catalog.price_list.id
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to save Sales price'
        );
      } finally {
        setPriceSavingProductId(
          null
        );
      }
    };

  const submitCheckout =
    async () => {
      if (
        !catalog ||
        !selectedWarehouseId ||
        cart.length === 0
      ) {
        return;
      }

      if (
        !customerName.trim()
      ) {
        setErrorMessage(
          t(
            'Customer Name လိုအပ်ပါသည်။',
            'Customer name is required.'
          )
        );

        return;
      }

      if (
        paymentMethod ===
          'CREDIT' &&
        !creditTerms.trim()
      ) {
        setErrorMessage(
          t(
            'Credit Terms လိုအပ်ပါသည်။',
            'Credit terms are required.'
          )
        );

        return;
      }

      setCheckoutBusy(true);
      setErrorMessage('');

      if (
        !postingKeyRef.current
      ) {
        postingKeyRef.current =
          createSalesPostingKey(
            'checkout'
          );
      }

      try {
        const result =
          await checkoutMavoraSalesOrder(
            {
              tenantId,
              warehouseId:
                selectedWarehouseId,

              postingKey:
                postingKeyRef.current,

              customerName,

              items:
                cart.map(
                  (line) => ({
                    productId:
                      line.product
                        .product_id,
                    quantity:
                      line.quantity,
                  })
                ),

              priceListId:
                catalog
                  .price_list.id,

              customerPhone,
              customerShopType,
              customerAddress,
              customerGps,

              paymentMethod,

              creditTerms:
                paymentMethod ===
                'CREDIT'
                  ? creditTerms
                  : null,

              discountPercent,
              taxPercent,
            }
          );

        setLastCheckout(
          result
        );

        setCart([]);
        setCheckoutOpen(false);

        setCustomerName('');
        setCustomerPhone('');
        setCustomerAddress('');
        setCustomerGps('');

        postingKeyRef.current =
          null;

        await refreshCatalog(
          selectedWarehouseId,
          catalog.price_list.id
        );
      } catch (error) {
        setErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to complete Sales checkout'
        );
      } finally {
        setCheckoutBusy(
          false
        );
      }
    };

  const modifyCheckoutField =
    <T,>(
      setter:
        React.Dispatch<
          React.SetStateAction<T>
        >,
      value: T
    ) => {
      invalidatePostingKey();
      setter(value);
    };

  return (
    <div className="p-2 md:p-6 space-y-4 md:space-y-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between border-b border-slate-200 pb-4">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-600">
            MAVORA ERP
          </div>

          <h2 className="text-2xl md:text-3xl font-black text-slate-900">
            {t(
              'Controlled Sales POS',
              'Controlled Sales POS'
            )}
          </h2>

          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {t(
              'Server Price • FEFO • COGS • Atomic Stock Issue',
              'Server Price • FEFO • COGS • Atomic Stock Issue'
            )}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-2">
          <select
            value={
              selectedWarehouseId
            }
            onChange={(event) =>
              setSelectedWarehouseId(
                event.target.value
              )
            }
            className="min-w-[220px] rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            {warehouses.map(
              (warehouse) => (
                <option
                  key={
                    warehouse.id
                  }
                  value={
                    warehouse.id
                  }
                >
                  {warehouse.code} —{' '}
                  {warehouse.name}
                </option>
              )
            )}
          </select>

          <button
            type="button"
            disabled={
              loading ||
              !selectedWarehouseId
            }
            onClick={() =>
              void refreshCatalog()
            }
            className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-black text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            ↻{' '}
            {t(
              'Refresh',
              'Refresh'
            )}
          </button>
        </div>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {errorMessage}
        </div>
      )}

      {priceSetupRequired && (
        <div className="rounded-2xl border-2 border-amber-300 bg-amber-50 p-4 md:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="text-lg font-black text-amber-900">
                ⚠️{' '}
                {t(
                  'Sales Price Setup လိုအပ်ပါသည်',
                  'Sales Price Setup Required'
                )}
              </div>

              <p className="mt-1 text-sm text-amber-800">
                {t(
                  'Controlled Sales တွင် Inventory Cost ကို ရောင်းဈေးအဖြစ် မသုံးပါ။ သီးခြား Sales Price List သတ်မှတ်ရပါမည်။',
                  'Controlled Sales never derives selling price from inventory cost. A Sales Price List must be configured.'
                )}
              </p>
            </div>

            {canManagePrices ? (
              <button
                type="button"
                disabled={loading}
                onClick={() =>
                  void createDefaultPriceList()
                }
                className="rounded-xl bg-amber-600 px-5 py-3 font-black text-white shadow hover:bg-amber-700 disabled:opacity-50"
              >
                +{' '}
                {t(
                  'Default Retail Price List ဖန်တီးမည်',
                  'Create Default Retail Price List'
                )}
              </button>
            ) : (
              <div className="rounded-xl bg-white px-4 py-3 text-sm font-bold text-amber-800">
                {t(
                  'OWNER မှ Price Setup ပြုလုပ်ရန်လိုအပ်ပါသည်။',
                  'An OWNER must configure Sales prices.'
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {catalog && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 md:gap-4">
            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
              <div className="text-xs font-bold text-slate-400">
                {t(
                  'Price List',
                  'Price List'
                )}
              </div>
              <div className="font-black text-slate-800">
                {
                  catalog
                    .price_list
                    .code
                }
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
              <div className="text-xs font-bold text-slate-400">
                {t(
                  'Catalog Date',
                  'Catalog Date'
                )}
              </div>
              <div className="font-black text-slate-800">
                {catalog.as_of}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
              <div className="text-xs font-bold text-slate-400">
                {t(
                  'FG Products',
                  'FG Products'
                )}
              </div>
              <div className="text-xl font-black text-slate-800">
                {
                  catalog
                    .products
                    .length
                }
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-3 md:p-4">
              <div className="text-xs font-bold text-slate-400">
                {t(
                  'Sellable',
                  'Sellable'
                )}
              </div>
              <div className="text-xl font-black text-emerald-600">
                {
                  catalog.products.filter(
                    (product) =>
                      product.is_sellable
                  ).length
                }
              </div>
            </div>
          </div>

          {canManagePrices && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/50 overflow-hidden">
              <button
                type="button"
                onClick={() =>
                  setPriceSetupOpen(
                    (current) =>
                      !current
                  )
                }
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <span className="font-black text-indigo-900">
                  💰{' '}
                  {t(
                    'Price Setup',
                    'Price Setup'
                  )}
                </span>

                <span className="font-black text-indigo-500">
                  {priceSetupOpen
                    ? '−'
                    : '+'}
                </span>
              </button>

              {priceSetupOpen && (
                <div className="border-t border-indigo-200 p-3 md:p-4 space-y-2">
                  {catalog.products.map(
                    (product) => (
                      <div
                        key={
                          product.product_id
                        }
                        className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-3 md:grid-cols-[1fr_170px_110px] md:items-center"
                      >
                        <div>
                          <div className="font-black text-slate-800">
                            {
                              product.sku
                            }
                          </div>

                          <div className="text-xs text-slate-500">
                            {
                              product.name
                            }
                          </div>
                        </div>

                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={
                            priceFields[
                              product
                                .product_id
                            ] ?? ''
                          }
                          onChange={(
                            event
                          ) =>
                            setPriceFields(
                              (
                                current
                              ) => ({
                                ...current,
                                [product
                                  .product_id]:
                                  event
                                    .target
                                    .value,
                              })
                            )
                          }
                          placeholder="MMK"
                          className="rounded-lg border border-slate-300 px-3 py-2 text-right font-black"
                        />

                        <button
                          type="button"
                          disabled={
                            priceSavingProductId ===
                            product.product_id
                          }
                          onClick={() =>
                            void saveProductPrice(
                              product
                            )
                          }
                          className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                        >
                          {priceSavingProductId ===
                          product.product_id
                            ? t(
                                'သိမ်းနေသည်...',
                                'Saving...'
                              )
                            : t(
                                'Save',
                                'Save'
                              )}
                        </button>
                      </div>
                    )
                  )}
                </div>
              )}
            </div>
          )}

          <div className="grid gap-4 xl:grid-cols-[1fr_380px]">
            <section className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="text-lg font-black text-slate-900">
                  {t(
                    'Finished Goods Catalog',
                    'Finished Goods Catalog'
                  )}
                </h3>

                <input
                  value={searchText}
                  onChange={(
                    event
                  ) =>
                    setSearchText(
                      event.target.value
                    )
                  }
                  placeholder={t(
                    'SKU / Product ရှာရန်',
                    'Search SKU / product'
                  )}
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
                {visibleProducts.map(
                  (product) => (
                    <button
                      key={
                        product.product_id
                      }
                      type="button"
                      disabled={
                        !product.is_sellable
                      }
                      onClick={() =>
                        addToCart(
                          product
                        )
                      }
                      className={`rounded-2xl border p-4 text-left transition ${
                        product.is_sellable
                          ? 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-md'
                          : 'border-slate-200 bg-slate-50 opacity-60'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-emerald-600">
                            {
                              product.sku
                            }
                          </div>

                          <div className="font-black text-slate-900">
                            {
                              product.name
                            }
                          </div>
                        </div>

                        <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-black text-white">
                          {
                            product.tracking_mode
                          }
                        </span>
                      </div>

                      <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                        <div>
                          <div className="text-slate-400">
                            {t(
                              'Available',
                              'Available'
                            )}
                          </div>
                          <div className="font-black text-slate-700">
                            {formatNumber(
                              product.available,
                              3
                            )}{' '}
                            {
                              product.unit_symbol ??
                              product.unit_code
                            }
                          </div>
                        </div>

                        <div className="text-right">
                          <div className="text-slate-400">
                            {t(
                              'Price',
                              'Price'
                            )}
                          </div>

                          <div className="font-black text-emerald-600">
                            {product.unit_price ===
                            null
                              ? t(
                                  'မသတ်မှတ်ရသေး',
                                  'Not set'
                                )
                              : `${formatNumber(
                                  product.unit_price
                                )} ${catalog.price_list.currency_code}`}
                          </div>
                        </div>
                      </div>

                      {!product.is_sellable && (
                        <div className="mt-3 rounded-lg bg-amber-50 px-2 py-1 text-[10px] font-bold text-amber-700">
                          {product.unit_price ===
                          null
                            ? t(
                                'Selling Price လိုအပ်သည်',
                                'Selling price required'
                              )
                            : t(
                                'ရောင်းနိုင်သော Stock မရှိပါ',
                                'No sellable stock'
                              )}
                        </div>
                      )}
                    </button>
                  )
                )}
              </div>
            </section>

            <aside className="rounded-2xl border border-slate-200 bg-white p-3 md:p-5 xl:sticky xl:top-4 xl:self-start">
              <div className="flex items-center justify-between border-b border-slate-200 pb-3">
                <h3 className="font-black text-slate-900">
                  🛒{' '}
                  {t(
                    'Cart',
                    'Cart'
                  )}
                </h3>

                <span className="text-xs font-bold text-slate-400">
                  {cart.length}{' '}
                  {t(
                    'items',
                    'items'
                  )}
                </span>
              </div>

              <div className="mt-3 space-y-2">
                {cart.map(
                  (line) => (
                    <div
                      key={
                        line.product
                          .product_id
                      }
                      className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="text-xs font-black text-slate-500">
                            {
                              line.product.sku
                            }
                          </div>

                          <div className="font-black text-slate-800">
                            {
                              line.product.name
                            }
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            removeFromCart(
                              line.product
                                .product_id
                            )
                          }
                          className="font-black text-rose-500"
                        >
                          ✕
                        </button>
                      </div>

                      <div className="mt-2 flex items-center justify-between gap-2">
                        <input
                          type="number"
                          min={
                            line.product
                              .min_quantity ??
                            1
                          }
                          max={
                            line.product
                              .available
                          }
                          step="1"
                          value={
                            line.quantity
                          }
                          onChange={(
                            event
                          ) =>
                            updateCartQuantity(
                              line.product
                                .product_id,
                              Number(
                                event
                                  .target
                                  .value
                              )
                            )
                          }
                          className="w-24 rounded-lg border border-slate-300 px-2 py-1 text-center font-black"
                        />

                        <div className="text-right">
                          <div className="text-xs text-slate-400">
                            {formatNumber(
                              numberValue(
                                line.product
                                  .unit_price
                              )
                            )}{' '}
                            ×{' '}
                            {formatNumber(
                              line.quantity,
                              3
                            )}
                          </div>

                          <div className="font-black text-emerald-600">
                            {formatNumber(
                              numberValue(
                                line.product
                                  .unit_price
                              ) *
                                line.quantity
                            )}{' '}
                            {
                              catalog
                                .price_list
                                .currency_code
                            }
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                )}

                {cart.length === 0 && (
                  <div className="py-10 text-center text-sm font-bold text-slate-400">
                    {t(
                      'Product ကိုရွေးပြီး Cart ထဲထည့်ပါ',
                      'Select a product to add it to the cart.'
                    )}
                  </div>
                )}
              </div>

              <div className="mt-4 border-t border-dashed border-slate-300 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {t(
                      'Subtotal',
                      'Subtotal'
                    )}
                  </span>
                  <span className="font-black">
                    {formatNumber(
                      cartSubtotal
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {t(
                      'Discount',
                      'Discount'
                    )}
                  </span>
                  <span className="font-black text-rose-600">
                    -
                    {formatNumber(
                      discountAmount
                    )}
                  </span>
                </div>

                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">
                    {t(
                      'Tax',
                      'Tax'
                    )}
                  </span>
                  <span className="font-black">
                    {formatNumber(
                      taxAmount
                    )}
                  </span>
                </div>

                <div className="flex justify-between border-t border-slate-200 pt-2 text-lg">
                  <span className="font-black">
                    {t(
                      'Grand Total',
                      'Grand Total'
                    )}
                  </span>

                  <span className="font-black text-emerald-600">
                    {formatNumber(
                      grandTotal
                    )}{' '}
                    {
                      catalog
                        .price_list
                        .currency_code
                    }
                  </span>
                </div>

                <button
                  type="button"
                  disabled={
                    cart.length ===
                    0
                  }
                  onClick={() =>
                    setCheckoutOpen(
                      true
                    )
                  }
                  className="mt-2 w-full rounded-xl bg-emerald-600 px-4 py-3 font-black text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  {t(
                    'Checkout',
                    'Checkout'
                  )}
                </button>
              </div>
            </aside>
          </div>
        </>
      )}

      {lastCheckout && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="font-black text-emerald-800">
            ✅{' '}
            {t(
              'Controlled Sale Completed',
              'Controlled Sale Completed'
            )}
          </div>

          <div className="mt-2 grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <span className="text-emerald-700">
                Invoice:
              </span>{' '}
              <strong>
                {
                  lastCheckout.invoice_no
                }
              </strong>
            </div>

            <div>
              <span className="text-emerald-700">
                Order:
              </span>{' '}
              <strong className="break-all">
                {
                  lastCheckout.sales_order_id
                }
              </strong>
            </div>

            <div>
              <span className="text-emerald-700">
                Total:
              </span>{' '}
              <strong>
                {formatNumber(
                  lastCheckout.grand_total
                )}
              </strong>
            </div>

            <div>
              <span className="text-emerald-700">
                COGS:
              </span>{' '}
              <strong>
                {formatNumber(
                  numberValue(
                    lastCheckout.total_cogs
                  )
                )}
              </strong>
            </div>
          </div>
        </div>
      )}

      {checkoutOpen && catalog && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
          <div className="max-h-[94vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
              <div>
                <div className="text-xs font-bold text-slate-300">
                  {userName}
                </div>

                <div className="font-black">
                  {t(
                    'Controlled Checkout',
                    'Controlled Checkout'
                  )}
                </div>
              </div>

              <button
                type="button"
                disabled={checkoutBusy}
                onClick={() =>
                  setCheckoutOpen(
                    false
                  )
                }
                className="text-xl font-black"
              >
                ✕
              </button>
            </div>

            <div className="p-4 md:p-6 space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Customer Name *
                  </span>
                  <input
                    value={
                      customerName
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCustomerName,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Phone
                  </span>
                  <input
                    value={
                      customerPhone
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCustomerPhone,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Shop Type
                  </span>
                  <input
                    value={
                      customerShopType
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCustomerShopType,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Address
                  </span>
                  <input
                    value={
                      customerAddress
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCustomerAddress,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="space-y-1 md:col-span-2">
                  <span className="text-xs font-black text-slate-500">
                    GPS / Location Note
                  </span>
                  <input
                    value={
                      customerGps
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCustomerGps,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div>
                <div className="mb-2 text-xs font-black text-slate-500">
                  Payment Method
                </div>

                <div className="grid grid-cols-3 gap-2 md:grid-cols-6">
                  {[
                    'CASH',
                    'KPAY',
                    'WAVE PAY',
                    'UAB PAY',
                    'AYA PAY',
                    'CREDIT',
                  ].map(
                    (method) => (
                      <button
                        type="button"
                        key={method}
                        onClick={() =>
                          modifyCheckoutField(
                            setPaymentMethod,
                            method
                          )
                        }
                        className={`rounded-lg border px-2 py-2 text-[11px] font-black ${
                          paymentMethod ===
                          method
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                            : 'border-slate-200 text-slate-500'
                        }`}
                      >
                        {method}
                      </button>
                    )
                  )}
                </div>
              </div>

              {paymentMethod ===
                'CREDIT' && (
                <label className="block space-y-1">
                  <span className="text-xs font-black text-amber-700">
                    Credit Terms *
                  </span>

                  <input
                    value={
                      creditTerms
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setCreditTerms,
                        event.target.value
                      )
                    }
                    className="w-full rounded-xl border border-amber-300 bg-amber-50 px-3 py-2"
                  />
                </label>
              )}

              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Discount %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      discountPercent
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setDiscountPercent,
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>

                <label className="space-y-1">
                  <span className="text-xs font-black text-slate-500">
                    Tax %
                  </span>

                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    value={
                      taxPercent
                    }
                    onChange={(
                      event
                    ) =>
                      modifyCheckoutField(
                        setTaxPercent,
                        Number(
                          event.target
                            .value
                        )
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  />
                </label>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-500">
                    {t(
                      'Amount Due',
                      'Amount Due'
                    )}
                  </span>

                  <span className="text-2xl font-black text-emerald-600">
                    {formatNumber(
                      grandTotal
                    )}{' '}
                    {
                      catalog
                        .price_list
                        .currency_code
                    }
                  </span>
                </div>

                <div className="mt-1 text-xs text-slate-400">
                  {t(
                    'ဈေးနှုန်းနှင့် Final Total ကို server မှ checkout အချိန်တွင် ပြန်လည်စစ်ဆေးမည်။',
                    'The server revalidates pricing and totals during checkout.'
                  )}
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  disabled={
                    checkoutBusy
                  }
                  onClick={() =>
                    setCheckoutOpen(
                      false
                    )
                  }
                  className="flex-1 rounded-xl bg-slate-100 px-4 py-3 font-black text-slate-600"
                >
                  {t(
                    'Cancel',
                    'Cancel'
                  )}
                </button>

                <button
                  type="button"
                  disabled={
                    checkoutBusy
                  }
                  onClick={() =>
                    void submitCheckout()
                  }
                  className="flex-[2] rounded-xl bg-emerald-600 px-4 py-3 font-black text-white shadow hover:bg-emerald-700 disabled:opacity-50"
                >
                  {checkoutBusy
                    ? t(
                        'လုပ်ဆောင်နေသည်...',
                        'Processing...'
                      )
                    : t(
                        'Confirm Sale',
                        'Confirm Sale'
                      )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {loading && (
        <div className="fixed bottom-4 right-4 z-[130] rounded-full bg-slate-900 px-4 py-2 text-xs font-black text-white shadow-lg">
          {t(
            'Loading...',
            'Loading...'
          )}
        </div>
      )}
    </div>
  );
};
