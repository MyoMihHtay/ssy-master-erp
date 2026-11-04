import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import html2canvas from 'html2canvas';

import type { AppLanguage } from '../i18n';

import {
  checkoutMavoraSalesOrder,
  createSalesPostingKey,
  loadMavoraSalesCatalog,
  loadMavoraSalesCustomers,
  loadMavoraSalesHistory,
  loadMavoraSalesInvoiceDetail,
  loadMavoraSalesWarehouses,
  setMavoraSalesProductPrice,
  upsertMavoraSalesPriceList,
  type MavoraSalesCatalog,
  type MavoraSalesCatalogProduct,
  type MavoraSalesCheckoutResult,
  type MavoraSalesCustomer,
  type MavoraSalesHistoryResult,
  type MavoraSalesInvoiceDetail,
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

const formatDateTime = (
  value: string | null | undefined
): string => {
  if (!value) {
    return '-';
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime()
    )
  ) {
    return value;
  }

  return date.toLocaleString();
};

const escapeHtml = (
  value: unknown
): string =>
  String(
    value ?? ''
  )
    .replaceAll(
      '&',
      '&amp;'
    )
    .replaceAll(
      '<',
      '&lt;'
    )
    .replaceAll(
      '>',
      '&gt;'
    )
    .replaceAll(
      '"',
      '&quot;'
    )
    .replaceAll(
      "'",
      '&#039;'
    );

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
    selectedCustomerId,
    setSelectedCustomerId,
  ] = useState('');

  const [
    selectedCustomer,
    setSelectedCustomer,
  ] = useState<
    MavoraSalesCustomer | null
  >(null);

  const [
    salesCustomers,
    setSalesCustomers,
  ] = useState<
    MavoraSalesCustomer[]
  >([]);

  const [
    customerSearch,
    setCustomerSearch,
  ] = useState('');

  const [
    customerLoading,
    setCustomerLoading,
  ] = useState(false);

  const [
    customerLoadError,
    setCustomerLoadError,
  ] = useState('');

  const [
    invoiceRemark,
    setInvoiceRemark,
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

  const [
    salesView,
    setSalesView,
  ] = useState<
    'pos' | 'records'
  >('pos');

  const [
    history,
    setHistory,
  ] = useState<
    MavoraSalesHistoryResult | null
  >(null);

  const [
    historyLoading,
    setHistoryLoading,
  ] = useState(false);

  const [
    historyError,
    setHistoryError,
  ] = useState('');

  const [
    historySearch,
    setHistorySearch,
  ] = useState('');

  const [
    historyFromDate,
    setHistoryFromDate,
  ] = useState('');

  const [
    historyToDate,
    setHistoryToDate,
  ] = useState('');

  const [
    invoiceDetail,
    setInvoiceDetail,
  ] = useState<
    MavoraSalesInvoiceDetail | null
  >(null);

  const [
    invoiceOpen,
    setInvoiceOpen,
  ] = useState(false);

  const [
    invoiceLoading,
    setInvoiceLoading,
  ] = useState(false);

  const [
    invoiceError,
    setInvoiceError,
  ] = useState('');

  const [
    outputOpen,
    setOutputOpen,
  ] = useState(false);

  const [
    thermalPaperSize,
    setThermalPaperSize,
  ] = useState<
    '55mm' | '58mm' | '80mm'
  >('80mm');

  const [
    imageSaving,
    setImageSaving,
  ] = useState(false);

  const invoiceImageRef =
    useRef<HTMLDivElement>(
      null
    );

  const postingKeyRef =
    useRef<string | null>(null);

  const invalidatePostingKey =
    useCallback(() => {
      postingKeyRef.current =
        null;
    }, []);

  const refreshSalesCustomers =
    useCallback(
      async (
        search = ''
      ) => {
        setCustomerLoading(
          true
        );

        setCustomerLoadError(
          ''
        );

        try {
          const result =
            await loadMavoraSalesCustomers(
              {
                tenantId,
                limit: 200,
                offset: 0,
                search:
                  search.trim() ||
                  null,
                isActive:
                  true,
              }
            );

          setSalesCustomers(
            result.customers ??
            []
          );
        } catch (error) {
          setSalesCustomers(
            []
          );

          setCustomerLoadError(
            error instanceof Error
              ? error.message
              : 'Unable to load Customer Master'
          );
        } finally {
          setCustomerLoading(
            false
          );
        }
      },
      [
        tenantId,
      ]
    );

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

  const selectCheckoutCustomer =
    (
      customerId: string
    ) => {
      invalidatePostingKey();

      if (!customerId) {
        setSelectedCustomerId(
          ''
        );

        setSelectedCustomer(
          null
        );

        setCustomerName('');
        setCustomerPhone('');
        setCustomerShopType(
          'Retail'
        );
        setCustomerAddress('');
        setCustomerGps('');

        setCreditTerms(
          '7 Days'
        );

        return;
      }

      const customer =
        salesCustomers.find(
          (item) =>
            item.customer_id ===
            customerId
        ) ??
        null;

      if (!customer) {
        setSelectedCustomerId(
          ''
        );

        setSelectedCustomer(
          null
        );

        setErrorMessage(
          t(
            'Customer Master မှတ်တမ်းကို ပြန်ရွေးပေးပါ။',
            'Please select the Customer Master record again.'
          )
        );

        return;
      }

      setSelectedCustomerId(
        customer.customer_id
      );

      setSelectedCustomer(
        customer
      );

      setCustomerName(
        customer.name
      );

      setCustomerPhone(
        customer.phone ??
        ''
      );

      setCustomerShopType(
        customer.shop_type ??
        ''
      );

      setCustomerAddress(
        customer.address ??
        ''
      );

      setCustomerGps(
        customer.gps ??
        ''
      );

      setCreditTerms(
        `${customer.credit_days} Days`
      );

      setErrorMessage('');
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
        !selectedCustomerId &&
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
        !selectedCustomerId
      ) {
        setErrorMessage(
          t(
            'CREDIT အရောင်းအတွက် Customer Master ကို မဖြစ်မနေရွေးပါ။',
            'Customer Master selection is required for CREDIT Sales.'
          )
        );

        return;
      }

      if (
        paymentMethod ===
          'CREDIT' &&
        selectedCustomer &&
        !selectedCustomer
          .credit_enabled
      ) {
        setErrorMessage(
          t(
            'ရွေးထားသော Customer အတွက် Credit မဖွင့်ထားပါ။',
            'Credit is not enabled for the selected Customer.'
          )
        );

        return;
      }

      if (
        paymentMethod ===
          'CREDIT' &&
        selectedCustomer
          ?.credit_hold
      ) {
        setErrorMessage(
          t(
            'ရွေးထားသော Customer ကို Credit Hold ထားပါသည်။',
            'The selected Customer is currently on Credit Hold.'
          )
        );

        return;
      }

      if (
        invoiceRemark.length >
        500
      ) {
        setErrorMessage(
          t(
            'Invoice Remark သည် စာလုံး 500 ထက် မကျော်ရပါ။',
            'Invoice Remark cannot exceed 500 characters.'
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

              customerId:
                selectedCustomerId ||
                null,

              invoiceRemark,

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

        setSelectedCustomerId(
          ''
        );

        setSelectedCustomer(
          null
        );

        setCustomerSearch('');

        setCustomerName('');
        setCustomerPhone('');
        setCustomerShopType(
          'Retail'
        );
        setCustomerAddress('');
        setCustomerGps('');

        setInvoiceRemark('');

        setCreditTerms(
          '7 Days'
        );

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

  const refreshSalesHistory =
    async () => {
      if (
        !selectedWarehouseId
      ) {
        return;
      }

      setHistoryLoading(
        true
      );

      setHistoryError('');

      try {
        const result =
          await loadMavoraSalesHistory(
            {
              tenantId,
              warehouseId:
                selectedWarehouseId,

              limit:
                50,

              offset:
                0,

              search:
                historySearch,

              fromDate:
                historyFromDate ||
                null,

              toDate:
                historyToDate ||
                null,
            }
          );

        setHistory(
          result
        );
      } catch (error) {
        setHistory(null);

        setHistoryError(
          error instanceof Error
            ? error.message
            : 'Unable to load Sales History'
        );
      } finally {
        setHistoryLoading(
          false
        );
      }
    };

  const openInvoiceDetail =
    async (
      salesOrderId: string
    ) => {
      setInvoiceLoading(
        true
      );

      setInvoiceError('');

      try {
        const result =
          await loadMavoraSalesInvoiceDetail(
            tenantId,
            salesOrderId
          );

        setInvoiceDetail(
          result
        );

        setInvoiceOpen(
          true
        );
      } catch (error) {
        setInvoiceDetail(
          null
        );

        setInvoiceError(
          error instanceof Error
            ? error.message
            : 'Unable to load Sales Invoice'
        );
      } finally {
        setInvoiceLoading(
          false
        );
      }
    };

  const closeInvoiceDetail =
    () => {
      setOutputOpen(
        false
      );

      setInvoiceOpen(
        false
      );

      setInvoiceDetail(
        null
      );

      setInvoiceError('');
    };

  const buildInvoicePrintHtml =
    (
      mode:
        | 'A4'
        | 'THERMAL'
    ): string => {
      if (!invoiceDetail) {
        return '';
      }

      const order =
        invoiceDetail.order;

      const currency =
        order.price_list
          .currency_code ??
        'MMK';

      const isThermal =
        mode === 'THERMAL';

      const rows =
        invoiceDetail.lines
          .map(
            (line) => {
              const trace =
                line.allocations
                  .map(
                    (
                      allocation
                    ) => {
                      const lot =
                        allocation.lot_no ??
                        '-';

                      const batch =
                        allocation.batch_no
                          ? ` / ${allocation.batch_no}`
                          : '';

                      return `${escapeHtml(
                        lot
                      )}${escapeHtml(
                        batch
                      )}`;
                    }
                  )
                  .join(
                    '<br />'
                  );

              if (isThermal) {
                return `
                  <div class="thermal-line">
                    <div class="thermal-product">
                      ${escapeHtml(
                        line.product.sku
                      )} — ${escapeHtml(
                        line.product.name
                      )}
                    </div>

                    <div class="thermal-row">
                      <span>
                        ${escapeHtml(
                          formatNumber(
                            line.quantity,
                            3
                          )
                        )}
                        ×
                        ${escapeHtml(
                          formatNumber(
                            line.unit_price
                          )
                        )}
                      </span>

                      <strong>
                        ${escapeHtml(
                          formatNumber(
                            line.line_total
                          )
                        )}
                      </strong>
                    </div>

                    ${
                      trace &&
                      trace !== '-'
                        ? `
                          <div class="trace">
                            Lot/Batch:
                            ${trace}
                          </div>
                        `
                        : ''
                    }
                  </div>
                `;
              }

              return `
                <tr>
                  <td>
                    <strong>
                      ${escapeHtml(
                        line.product.sku
                      )}
                    </strong>

                    <br />

                    ${escapeHtml(
                      line.product.name
                    )}
                  </td>

                  <td class="num">
                    ${escapeHtml(
                      formatNumber(
                        line.quantity,
                        3
                      )
                    )}
                  </td>

                  <td class="num">
                    ${escapeHtml(
                      formatNumber(
                        line.unit_price
                      )
                    )}
                  </td>

                  <td class="num">
                    ${escapeHtml(
                      formatNumber(
                        line.line_total
                      )
                    )}
                  </td>

                  <td>
                    ${trace || '-'}
                  </td>
                </tr>
              `;
            }
          )
          .join('');

      if (isThermal) {
        return `
          <!doctype html>
          <html>
            <head>
              <meta charset="utf-8" />

              <title>
                ${escapeHtml(
                  order.invoice_no
                )}
              </title>

              <style>
                @page {
                  size:
                    ${thermalPaperSize}
                    auto;

                  margin: 2mm;
                }

                * {
                  box-sizing:
                    border-box;
                }

                body {
                  width:
                    ${thermalPaperSize};

                  margin: 0;
                  padding: 2mm;

                  font-family:
                    "Pyidaungsu",
                    "Myanmar Text",
                    Arial,
                    sans-serif;

                  color: #000;

                  font-size: 11px;
                }

                .center {
                  text-align:
                    center;
                }

                .title {
                  font-size:
                    16px;

                  font-weight:
                    900;
                }

                .sub {
                  margin-top:
                    2px;

                  font-weight:
                    700;
                }

                .divider {
                  margin:
                    6px 0;

                  border-top:
                    1px dashed
                    #000;
                }

                .info-row,
                .thermal-row,
                .total-row {
                  display:
                    flex;

                  justify-content:
                    space-between;

                  gap: 6px;
                }

                .info-row span:first-child {
                  white-space:
                    nowrap;
                }

                .info-row span:last-child {
                  text-align:
                    right;
                }

                .thermal-line {
                  padding:
                    5px 0;

                  border-bottom:
                    1px dashed
                    #999;
                }

                .thermal-product {
                  font-weight:
                    800;
                }

                .trace {
                  margin-top:
                    2px;

                  font-size:
                    9px;
                }

                .grand {
                  margin-top:
                    5px;

                  padding-top:
                    5px;

                  border-top:
                    2px solid
                    #000;

                  font-size:
                    14px;

                  font-weight:
                    900;
                }

                .footer {
                  margin-top:
                    9px;

                  text-align:
                    center;

                  font-size:
                    9px;
                }
              </style>
            </head>

            <body>
              <div class="center title">
                MAVORA ERP
              </div>

              <div class="center sub">
                SALES RECEIPT
              </div>

              <div class="center">
                ${escapeHtml(
                  order.invoice_no
                )}
              </div>

              <div class="divider"></div>

              <div class="info-row">
                <span>Date</span>
                <span>
                  ${escapeHtml(
                    formatDateTime(
                      order.sold_at
                    )
                  )}
                </span>
              </div>

              <div class="info-row">
                <span>Customer</span>
                <span>
                  ${escapeHtml(
                    order.customer_name ??
                    '-'
                  )}
                </span>
              </div>

              <div class="info-row">
                <span>Phone</span>
                <span>
                  ${escapeHtml(
                    order.customer_phone ??
                    '-'
                  )}
                </span>
              </div>

              <div class="info-row">
                <span>Payment</span>
                <span>
                  ${escapeHtml(
                    order.payment_method
                  )}
                </span>
              </div>

              ${
                order.credit_terms
                  ? `
                    <div class="info-row">
                      <span>Credit Terms</span>
                      <span>
                        ${escapeHtml(
                          order.credit_terms
                        )}
                      </span>
                    </div>
                  `
                  : ''
              }

              ${
                order.invoice_remark
                  ? `
                    <div class="divider"></div>

                    <div>
                      <strong>
                        Remark:
                      </strong>

                      ${escapeHtml(
                        order.invoice_remark
                      )}
                    </div>

                    <div class="divider"></div>
                  `
                  : ''
              }

              <div class="info-row">
                <span>Sold By</span>
                <span>
                  ${escapeHtml(
                    order.sold_by
                  )}
                </span>
              </div>

              <div class="divider"></div>

              ${rows}

              <div class="divider"></div>

              <div class="total-row">
                <span>Subtotal</span>

                <strong>
                  ${escapeHtml(
                    formatNumber(
                      order.subtotal
                    )
                  )}
                </strong>
              </div>

              ${
                order.discount_amount >
                0
                  ? `
                    <div class="total-row">
                      <span>
                        Discount
                        (${escapeHtml(
                          formatNumber(
                            order.discount_percent
                          )
                        )}%)
                      </span>

                      <strong>
                        -
                        ${escapeHtml(
                          formatNumber(
                            order.discount_amount
                          )
                        )}
                      </strong>
                    </div>
                  `
                  : ''
              }

              ${
                order.tax_amount >
                0
                  ? `
                    <div class="total-row">
                      <span>
                        Tax
                        (${escapeHtml(
                          formatNumber(
                            order.tax_percent
                          )
                        )}%)
                      </span>

                      <strong>
                        ${escapeHtml(
                          formatNumber(
                            order.tax_amount
                          )
                        )}
                      </strong>
                    </div>
                  `
                  : ''
              }

              <div class="total-row grand">
                <span>
                  TOTAL
                </span>

                <span>
                  ${escapeHtml(
                    formatNumber(
                      order.grand_total
                    )
                  )}
                  ${escapeHtml(
                    currency
                  )}
                </span>
              </div>

              <div class="footer">
                Thank you.
                <br />
                MAVORA ERP
              </div>

              <script>
                window.addEventListener(
                  'load',
                  function () {
                    setTimeout(
                      function () {
                        window.print();
                      },
                      250
                    );
                  }
                );
              </script>
            </body>
          </html>
        `;
      }

      return `
        <!doctype html>
        <html>
          <head>
            <meta charset="utf-8" />

            <title>
              ${escapeHtml(
                order.invoice_no
              )}
            </title>

            <style>
              @page {
                size: A4;
                margin: 12mm;
              }

              * {
                box-sizing:
                  border-box;
              }

              body {
                margin: 0;

                font-family:
                  "Pyidaungsu",
                  "Myanmar Text",
                  Arial,
                  sans-serif;

                color:
                  #111827;

                font-size:
                  12px;
              }

              .header {
                display:
                  flex;

                justify-content:
                  space-between;

                gap:
                  20px;

                padding-bottom:
                  15px;

                border-bottom:
                  2px solid
                  #111827;
              }

              h1 {
                margin: 0;

                font-size:
                  24px;
              }

              .invoice-no {
                font-size:
                  18px;

                font-weight:
                  900;
              }

              .muted {
                color:
                  #64748b;
              }

              .customer {
                display:
                  grid;

                grid-template-columns:
                  1fr 1fr;

                gap:
                  7px 22px;

                margin:
                  17px 0;
              }

              table {
                width:
                  100%;

                border-collapse:
                  collapse;
              }

              th,
              td {
                border:
                  1px solid
                  #cbd5e1;

                padding:
                  7px;

                vertical-align:
                  top;
              }

              th {
                background:
                  #f1f5f9;

                text-align:
                  left;
              }

              .num {
                text-align:
                  right;

                white-space:
                  nowrap;
              }

              .totals {
                width:
                  330px;

                margin:
                  15px 0 0 auto;
              }

              .total-row {
                display:
                  flex;

                justify-content:
                  space-between;

                gap:
                  10px;

                padding:
                  5px 0;
              }

              .grand {
                margin-top:
                  5px;

                padding-top:
                  9px;

                border-top:
                  2px solid
                  #111827;

                font-size:
                  16px;

                font-weight:
                  900;
              }

              .footer {
                margin-top:
                  30px;

                padding-top:
                  10px;

                border-top:
                  1px solid
                  #cbd5e1;

                color:
                  #64748b;

                font-size:
                  10px;
              }
            </style>
          </head>

          <body>
            <div class="header">
              <div>
                <h1>
                  MAVORA ERP
                </h1>

                <div>
                  Controlled Sales Invoice
                </div>

                <div class="muted">
                  ${escapeHtml(
                    order.warehouse.code
                  )}
                  —
                  ${escapeHtml(
                    order.warehouse.name
                  )}
                </div>
              </div>

              <div style="text-align:right">
                <div class="invoice-no">
                  ${escapeHtml(
                    order.invoice_no
                  )}
                </div>

                <div>
                  ${escapeHtml(
                    formatDateTime(
                      order.sold_at
                    )
                  )}
                </div>

                <div class="muted">
                  ${escapeHtml(
                    order.status
                  )}
                </div>
              </div>
            </div>

            <div class="customer">
              <div>
                <strong>
                  Customer:
                </strong>

                ${escapeHtml(
                  order.customer_name ??
                  '-'
                )}
              </div>

              <div>
                <strong>
                  Phone:
                </strong>

                ${escapeHtml(
                  order.customer_phone ??
                  '-'
                )}
              </div>

              <div>
                <strong>
                  Shop Type:
                </strong>

                ${escapeHtml(
                  order.customer_shop_type ??
                  '-'
                )}
              </div>

              <div>
                <strong>
                  Payment:
                </strong>

                ${escapeHtml(
                  order.payment_method
                )}
              </div>

              <div>
                <strong>
                  Address:
                </strong>

                ${escapeHtml(
                  order.customer_address ??
                  '-'
                )}
              </div>

              <div>
                <strong>
                  Sold By:
                </strong>

                ${escapeHtml(
                  order.sold_by
                )}
              </div>

              ${
                order.credit_terms
                  ? `
                    <div>
                      <strong>
                        Credit Terms:
                      </strong>

                      ${escapeHtml(
                        order.credit_terms
                      )}
                    </div>
                  `
                  : ''
              }
            </div>

            ${
              order.invoice_remark
                ? `
                  <div style="
                    margin: 0 0 15px 0;
                    padding: 10px 12px;
                    border: 1px solid #c7d2fe;
                    border-radius: 8px;
                    background: #eef2ff;
                    white-space: pre-wrap;
                  ">
                    <strong>
                      Invoice Remark:
                    </strong>

                    ${escapeHtml(
                      order.invoice_remark
                    )}
                  </div>
                `
                : ''
            }

            <table>
              <thead>
                <tr>
                  <th>
                    Product
                  </th>

                  <th class="num">
                    Qty
                  </th>

                  <th class="num">
                    Unit Price
                  </th>

                  <th class="num">
                    Amount
                  </th>

                  <th>
                    Lot / Batch
                  </th>
                </tr>
              </thead>

              <tbody>
                ${rows}
              </tbody>
            </table>

            <div class="totals">
              <div class="total-row">
                <span>
                  Subtotal
                </span>

                <strong>
                  ${escapeHtml(
                    formatNumber(
                      order.subtotal
                    )
                  )}
                </strong>
              </div>

              <div class="total-row">
                <span>
                  Discount
                  (${escapeHtml(
                    formatNumber(
                      order.discount_percent
                    )
                  )}%)
                </span>

                <strong>
                  -
                  ${escapeHtml(
                    formatNumber(
                      order.discount_amount
                    )
                  )}
                </strong>
              </div>

              <div class="total-row">
                <span>
                  Tax
                  (${escapeHtml(
                    formatNumber(
                      order.tax_percent
                    )
                  )}%)
                </span>

                <strong>
                  ${escapeHtml(
                    formatNumber(
                      order.tax_amount
                    )
                  )}
                </strong>
              </div>

              <div class="total-row grand">
                <span>
                  Grand Total
                </span>

                <span>
                  ${escapeHtml(
                    formatNumber(
                      order.grand_total
                    )
                  )}
                  ${escapeHtml(
                    currency
                  )}
                </span>
              </div>
            </div>

            <div class="footer">
              Controlled invoice generated by MAVORA ERP.
            </div>

            <script>
              window.addEventListener(
                'load',
                function () {
                  setTimeout(
                    function () {
                      window.print();
                    },
                    250
                  );
                }
              );
            </script>
          </body>
        </html>
      `;
    };

  const openPrintWindow =
    (
      mode:
        | 'A4'
        | 'THERMAL'
    ) => {
      if (!invoiceDetail) {
        return;
      }

      const popup =
        window.open(
          '',
          '_blank',
          'width=900,height=900'
        );

      if (!popup) {
        setInvoiceError(
          t(
            'Browser Pop-up ပိတ်ထားပါသည်။ Pop-up ကို Allow လုပ်ပြီး ပြန်စမ်းပါ။',
            'The browser blocked the print window. Allow pop-ups and try again.'
          )
        );

        return;
      }

      popup.document.open();

      popup.document.write(
        buildInvoicePrintHtml(
          mode
        )
      );

      popup.document.close();

      popup.focus();

      setOutputOpen(
        false
      );
    };

  const handleUsbPrint =
    () => {
      openPrintWindow(
        'A4'
      );
    };

  const handleBluetoothPrint =
    () => {
      openPrintWindow(
        'THERMAL'
      );
    };

  const handleSaveInvoiceImage =
    async () => {
      if (
        !invoiceDetail ||
        !invoiceImageRef.current
      ) {
        return;
      }

      setImageSaving(
        true
      );

      setInvoiceError('');

      try {
        const canvas =
          await html2canvas(
            invoiceImageRef.current,
            {
              scale:
                2,

              useCORS:
                true,

              logging:
                false,

              backgroundColor:
                '#ffffff',
            }
          );

        const dataUrl =
          canvas.toDataURL(
            'image/png',
            1
          );

        const anchor =
          document.createElement(
            'a'
          );

        anchor.href =
          dataUrl;

        anchor.download =
          `${invoiceDetail.order.invoice_no}.png`;

        document.body.appendChild(
          anchor
        );

        anchor.click();

        anchor.remove();

        setOutputOpen(
          false
        );
      } catch (error) {
        setInvoiceError(
          error instanceof Error
            ? error.message
            : 'Unable to save Invoice image'
        );
      } finally {
        setImageSaving(
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
              'Controlled Sales',
              'Controlled Sales'
            )}
          </h2>

          <p className="text-xs md:text-sm text-slate-500 mt-1">
            {salesView === 'pos'
              ? t(
                  'Server Price • FEFO • COGS • Atomic Stock Issue',
                  'Server Price • FEFO • COGS • Atomic Stock Issue'
                )
              : t(
                  'Sales History • Invoice • Lot / Batch Trace',
                  'Sales History • Invoice • Lot / Batch Trace'
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
              salesView === 'records'
                ? void refreshSalesHistory()
                : void refreshCatalog()
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

      <div className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-2">
        <button
          type="button"
          onClick={() => {
            setSalesView(
              'pos'
            );

            setInvoiceOpen(
              false
            );

            setOutputOpen(
              false
            );
          }}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-black transition ${
            salesView === 'pos'
              ? 'bg-emerald-600 text-white shadow'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          🛒{' '}
          {t(
            'POS / Sale',
            'POS / Sale'
          )}
        </button>

        <button
          type="button"
          onClick={() => {
            setCheckoutOpen(
              false
            );

            setSalesView(
              'records'
            );

            setErrorMessage(
              ''
            );

            void refreshSalesHistory();
          }}
          className={`flex-1 rounded-xl px-4 py-2 text-sm font-black transition ${
            salesView === 'records'
              ? 'bg-slate-900 text-white shadow'
              : 'text-slate-500 hover:bg-slate-50'
          }`}
        >
          📄{' '}
          {t(
            'Sales Records',
            'Sales Records'
          )}
        </button>
      </div>

      {errorMessage && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {errorMessage}
        </div>
      )}

      {salesView === 'pos' && (
        <>

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
                  onClick={() => {
                    setCheckoutOpen(
                      true
                    );

                    setCustomerSearch(
                      ''
                    );

                    setCustomerLoadError(
                      ''
                    );

                    void refreshSalesCustomers(
                      ''
                    );
                  }}
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
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-4 space-y-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-wide text-indigo-700">
                    Customer Master
                  </div>

                  <div className="mt-1 text-[11px] text-slate-500">
                    {t(
                      'Credit Sale အတွက် Customer Master မဖြစ်မနေရွေးပါ။ Cash Sale အတွက် Walk-in Customer သုံးနိုင်ပါသည်။',
                      'Customer Master is required for Credit Sales. Walk-in customers remain available for Cash Sales.'
                    )}
                  </div>
                </div>

                <div className="grid gap-2 md:grid-cols-[1fr_auto]">
                  <input
                    value={
                      customerSearch
                    }
                    onChange={(
                      event
                    ) =>
                      setCustomerSearch(
                        event.target.value
                      )
                    }
                    onKeyDown={(
                      event
                    ) => {
                      if (
                        event.key ===
                        'Enter'
                      ) {
                        event.preventDefault();

                        void refreshSalesCustomers(
                          customerSearch
                        );
                      }
                    }}
                    placeholder="Customer Code / Name / Phone / Address"
                    className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm"
                  />

                  <button
                    type="button"
                    disabled={
                      customerLoading
                    }
                    onClick={() =>
                      void refreshSalesCustomers(
                        customerSearch
                      )
                    }
                    className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-black text-white hover:bg-indigo-700 disabled:opacity-50"
                  >
                    {customerLoading
                      ? 'Loading...'
                      : 'Search'}
                  </button>
                </div>

                <select
                  value={
                    selectedCustomerId
                  }
                  onChange={(
                    event
                  ) =>
                    selectCheckoutCustomer(
                      event.target.value
                    )
                  }
                  className="w-full rounded-xl border border-indigo-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
                >
                  <option value="">
                    Walk-in / Ad-hoc Customer
                  </option>

                  {salesCustomers.map(
                    (customer) => (
                      <option
                        key={
                          customer.customer_id
                        }
                        value={
                          customer.customer_id
                        }
                      >
                        {
                          customer.customer_code
                        }
                        {' — '}
                        {
                          customer.name
                        }
                        {customer.phone
                          ? ` — ${customer.phone}`
                          : ''}
                      </option>
                    )
                  )}
                </select>

                {customerLoadError && (
                  <div className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {
                      customerLoadError
                    }
                  </div>
                )}

                {selectedCustomer && (
                  <div className="grid gap-2 rounded-xl border border-indigo-100 bg-white p-3 text-xs md:grid-cols-3">
                    <div>
                      <div className="font-black text-slate-400">
                        Customer Code
                      </div>

                      <div className="font-black text-slate-800">
                        {
                          selectedCustomer.customer_code
                        }
                      </div>
                    </div>

                    <div>
                      <div className="font-black text-slate-400">
                        Credit Policy
                      </div>

                      <div
                        className={`font-black ${
                          !selectedCustomer.credit_enabled
                            ? 'text-slate-500'
                            : selectedCustomer.credit_hold
                              ? 'text-rose-600'
                              : 'text-emerald-600'
                        }`}
                      >
                        {!selectedCustomer.credit_enabled
                          ? 'Credit Disabled'
                          : selectedCustomer.credit_hold
                            ? 'CREDIT HOLD'
                            : `${selectedCustomer.credit_days} Days`}
                      </div>
                    </div>

                    <div>
                      <div className="font-black text-slate-400">
                        Credit Limit
                      </div>

                      <div className="font-black text-slate-800">
                        {formatNumber(
                          selectedCustomer.credit_limit
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

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
                    readOnly={
                      Boolean(
                        selectedCustomerId
                      )
                    }
                    className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${
                      selectedCustomerId
                        ? 'bg-slate-100 text-slate-600'
                        : ''
                    }`}
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
                    readOnly={
                      Boolean(
                        selectedCustomerId
                      )
                    }
                    className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${
                      selectedCustomerId
                        ? 'bg-slate-100 text-slate-600'
                        : ''
                    }`}
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
                    readOnly={
                      Boolean(
                        selectedCustomerId
                      )
                    }
                    className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${
                      selectedCustomerId
                        ? 'bg-slate-100 text-slate-600'
                        : ''
                    }`}
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
                    readOnly={
                      Boolean(
                        selectedCustomerId
                      )
                    }
                    className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${
                      selectedCustomerId
                        ? 'bg-slate-100 text-slate-600'
                        : ''
                    }`}
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
                    readOnly={
                      Boolean(
                        selectedCustomerId
                      )
                    }
                    className={`w-full rounded-xl border border-slate-300 px-3 py-2 ${
                      selectedCustomerId
                        ? 'bg-slate-100 text-slate-600'
                        : ''
                    }`}
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
                <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-3">
                  <div className="text-xs font-black text-amber-700">
                    Credit Terms — Customer Master
                  </div>

                  <div className="mt-1 text-sm font-black text-slate-800">
                    {selectedCustomer
                      ? `${selectedCustomer.credit_days} Days`
                      : 'Select Customer Master'}
                  </div>

                  <div className="mt-1 text-[11px] text-amber-700">
                    {t(
                      'Credit Terms ကို Customer Master မှ Server က သတ်မှတ်ပါသည်။',
                      'Credit Terms are controlled by Customer Master.'
                    )}
                  </div>
                </div>
              )}

              <label className="block space-y-1">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-xs font-black text-slate-500">
                    Invoice Remark
                  </span>

                  <span className="text-[10px] font-bold text-slate-400">
                    {invoiceRemark.length}/500
                  </span>
                </div>

                <textarea
                  value={
                    invoiceRemark
                  }
                  rows={3}
                  maxLength={500}
                  onChange={(
                    event
                  ) =>
                    modifyCheckoutField(
                      setInvoiceRemark,
                      event.target.value
                    )
                  }
                  placeholder={t(
                    'Customer မြင်ရမည့် Invoice မှတ်ချက်...',
                    'Customer-visible Invoice remark...'
                  )}
                  className="w-full resize-y rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

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

        </>
      )}

      {/* CONTROLLED SALES HISTORY UI START */}

      {salesView === 'records' && (
        <div className="space-y-4">
          {historyError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {historyError}
            </div>
          )}

          {invoiceError && (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
              {invoiceError}
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-end">
              <label className="flex-1 space-y-1">
                <span className="text-xs font-black text-slate-500">
                  Invoice / Customer / Phone
                </span>

                <input
                  value={
                    historySearch
                  }
                  onChange={(
                    event
                  ) =>
                    setHistorySearch(
                      event.target.value
                    )
                  }
                  onKeyDown={(
                    event
                  ) => {
                    if (
                      event.key ===
                      'Enter'
                    ) {
                      void refreshSalesHistory();
                    }
                  }}
                  placeholder="Invoice No., Customer Name, Phone..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  From Date
                </span>

                <input
                  type="date"
                  value={
                    historyFromDate
                  }
                  onChange={(
                    event
                  ) =>
                    setHistoryFromDate(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <label className="space-y-1">
                <span className="text-xs font-black text-slate-500">
                  To Date
                </span>

                <input
                  type="date"
                  value={
                    historyToDate
                  }
                  onChange={(
                    event
                  ) =>
                    setHistoryToDate(
                      event.target.value
                    )
                  }
                  className="rounded-xl border border-slate-300 px-3 py-2 text-sm"
                />
              </label>

              <button
                type="button"
                disabled={
                  historyLoading ||
                  !selectedWarehouseId
                }
                onClick={() =>
                  void refreshSalesHistory()
                }
                className="rounded-xl bg-slate-900 px-5 py-2.5 text-sm font-black text-white hover:bg-slate-800 disabled:opacity-50"
              >
                🔎 Search
              </button>

              <button
                type="button"
                disabled={
                  historyLoading
                }
                onClick={() => {
                  setHistorySearch(
                    ''
                  );

                  setHistoryFromDate(
                    ''
                  );

                  setHistoryToDate(
                    ''
                  );

                  setHistory(
                    null
                  );
                }}
                className="rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-black text-slate-600"
              >
                Clear
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-2 border-b border-slate-200 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900">
                  📄 Controlled Sales Records
                </h3>

                <div className="text-xs text-slate-500">
                  {history
                    ? `${history.total_count} records`
                    : t(
                        'Refresh သို့ Search လုပ်၍ Sales Records ကိုဖတ်ပါ။',
                        'Refresh or search to load Sales records.'
                      )}
                </div>
              </div>

              {history && (
                <div className="text-xs font-bold text-slate-500">
                  {
                    history
                      .warehouse
                      .code
                  }
                  {' • '}
                  {
                    history
                      .warehouse
                      .timezone
                  }
                </div>
              )}
            </div>

            {historyLoading ? (
              <div className="py-16 text-center text-sm font-bold text-slate-400">
                Loading Sales Records...
              </div>
            ) : history &&
              history.orders.length >
                0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                    <tr>
                      <th className="px-4 py-3 text-left">
                        Invoice
                      </th>

                      <th className="px-4 py-3 text-left">
                        Customer
                      </th>

                      <th className="px-4 py-3 text-left">
                        Payment
                      </th>

                      <th className="px-4 py-3 text-right">
                        Qty
                      </th>

                      <th className="px-4 py-3 text-right">
                        Total
                      </th>

                      <th className="px-4 py-3 text-left">
                        Date
                      </th>

                      <th className="px-4 py-3 text-center">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-100">
                    {history.orders.map(
                      (order) => (
                        <tr
                          key={
                            order.sales_order_id
                          }
                          className="hover:bg-slate-50"
                        >
                          <td className="px-4 py-3">
                            <div className="font-black text-slate-900">
                              {
                                order.invoice_no
                              }
                            </div>

                            <div className="text-[11px] text-slate-400">
                              {
                                order.status
                              }
                              {' • '}
                              {
                                order.line_count
                              }
                              {' lines'}
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-800">
                              {
                                order.customer_name ??
                                '-'
                              }
                            </div>

                            <div className="text-xs text-slate-400">
                              {
                                order.customer_phone ??
                                '-'
                              }
                            </div>
                          </td>

                          <td className="px-4 py-3">
                            <div className="font-bold text-slate-700">
                              {
                                order.payment_method
                              }
                            </div>

                            <div
                              className={`text-xs font-black ${
                                order.is_paid
                                  ? 'text-emerald-600'
                                  : 'text-amber-600'
                              }`}
                            >
                              {order.is_paid
                                ? 'PAID'
                                : 'UNPAID'}
                            </div>
                          </td>

                          <td className="px-4 py-3 text-right font-black">
                            {formatNumber(
                              order.total_quantity,
                              3
                            )}
                          </td>

                          <td className="px-4 py-3 text-right">
                            <div className="font-black text-emerald-600">
                              {formatNumber(
                                order.grand_total
                              )}
                            </div>

                            <div className="text-[11px] text-slate-400">
                              {
                                order.currency_code ??
                                'MMK'
                              }
                            </div>
                          </td>

                          <td className="whitespace-nowrap px-4 py-3 text-xs text-slate-500">
                            {formatDateTime(
                              order.sold_at
                            )}
                          </td>

                          <td className="px-4 py-3 text-center">
                            <button
                              type="button"
                              disabled={
                                invoiceLoading
                              }
                              onClick={() =>
                                void openInvoiceDetail(
                                  order.sales_order_id
                                )
                              }
                              className="rounded-lg bg-indigo-50 px-3 py-2 text-xs font-black text-indigo-700 hover:bg-indigo-100 disabled:opacity-50"
                            >
                              View Invoice
                            </button>
                          </td>
                        </tr>
                      )
                    )}
                  </tbody>
                </table>
              </div>
            ) : history ? (
              <div className="py-16 text-center text-sm font-bold text-slate-400">
                No Sales Records found.
              </div>
            ) : (
              <div className="py-16 text-center text-sm font-bold text-slate-400">
                Refresh or Search to load Sales Records.
              </div>
            )}
          </div>
        </div>
      )}


      {/* =====================================================
          CONTROLLED INVOICE DETAIL
          ===================================================== */}

      {invoiceOpen &&
        invoiceDetail && (
          <div className="fixed inset-0 z-[140] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm">
            <div className="max-h-[95vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white shadow-2xl">
              <div className="sticky top-0 z-10 flex items-center justify-between gap-3 bg-slate-900 px-4 py-3 text-white">
                <div>
                  <div className="text-xs font-bold text-slate-300">
                    Controlled Sales Invoice
                  </div>

                  <div className="text-lg font-black">
                    {
                      invoiceDetail
                        .order
                        .invoice_no
                    }
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setOutputOpen(
                        true
                      )
                    }
                    className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-black text-white hover:bg-emerald-700"
                  >
                    🖨️ Output Invoice
                  </button>

                  <button
                    type="button"
                    onClick={
                      closeInvoiceDetail
                    }
                    className="rounded-lg bg-white/10 px-3 py-2 font-black text-white hover:bg-white/20"
                  >
                    ✕
                  </button>
                </div>
              </div>

              <div className="space-y-5 p-4 md:p-6">
                <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-400">
                      Customer
                    </div>

                    <div className="font-black text-slate-800">
                      {
                        invoiceDetail
                          .order
                          .customer_name ??
                        '-'
                      }
                    </div>

                    <div className="text-xs text-slate-500">
                      {
                        invoiceDetail
                          .order
                          .customer_phone ??
                        '-'
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-400">
                      Payment
                    </div>

                    <div className="font-black text-slate-800">
                      {
                        invoiceDetail
                          .order
                          .payment_method
                      }
                    </div>

                    <div
                      className={`text-xs font-black ${
                        invoiceDetail
                          .order
                          .is_paid
                          ? 'text-emerald-600'
                          : 'text-amber-600'
                      }`}
                    >
                      {invoiceDetail
                        .order
                        .is_paid
                        ? 'PAID'
                        : 'UNPAID'}
                    </div>

                    {invoiceDetail
                      .order
                      .credit_terms && (
                      <div className="mt-1 text-[11px] font-bold text-amber-700">
                        {
                          invoiceDetail
                            .order
                            .credit_terms
                        }
                      </div>
                    )}
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-400">
                      Warehouse
                    </div>

                    <div className="font-black text-slate-800">
                      {
                        invoiceDetail
                          .order
                          .warehouse
                          .code
                      }
                    </div>

                    <div className="text-xs text-slate-500">
                      {
                        invoiceDetail
                          .order
                          .warehouse
                          .name
                      }
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <div className="text-xs font-bold text-slate-400">
                      Sold At
                    </div>

                    <div className="font-black text-slate-800">
                      {formatDateTime(
                        invoiceDetail
                          .order
                          .sold_at
                      )}
                    </div>

                    <div className="text-xs text-slate-500">
                      {
                        invoiceDetail
                          .order
                          .sold_by
                      }
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-xs font-black text-slate-400">
                      Shop Type
                    </div>

                    <div className="font-bold text-slate-700">
                      {
                        invoiceDetail
                          .order
                          .customer_shop_type ??
                        '-'
                      }
                    </div>
                  </div>

                  <div className="rounded-xl border border-slate-200 p-3">
                    <div className="text-xs font-black text-slate-400">
                      Address
                    </div>

                    <div className="font-bold text-slate-700">
                      {
                        invoiceDetail
                          .order
                          .customer_address ??
                        '-'
                      }
                    </div>
                  </div>
                </div>

                {invoiceDetail
                  .order
                  .invoice_remark && (
                  <div className="rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3">
                    <div className="text-xs font-black uppercase tracking-wide text-indigo-600">
                      Invoice Remark
                    </div>

                    <div className="mt-1 whitespace-pre-wrap text-sm font-bold text-slate-700">
                      {
                        invoiceDetail
                          .order
                          .invoice_remark
                      }
                    </div>
                  </div>
                )}

                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                      <tr>
                        <th className="px-4 py-3 text-left">
                          Product
                        </th>

                        <th className="px-4 py-3 text-right">
                          Qty
                        </th>

                        <th className="px-4 py-3 text-right">
                          Unit Price
                        </th>

                        <th className="px-4 py-3 text-right">
                          Amount
                        </th>

                        <th className="px-4 py-3 text-left">
                          Lot / Batch
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100">
                      {invoiceDetail.lines.map(
                        (line) => (
                          <tr
                            key={
                              line.line_id
                            }
                          >
                            <td className="px-4 py-3">
                              <div className="text-xs font-black text-indigo-600">
                                {
                                  line
                                    .product
                                    .sku
                                }
                              </div>

                              <div className="font-black text-slate-800">
                                {
                                  line
                                    .product
                                    .name
                                }
                              </div>
                            </td>

                            <td className="px-4 py-3 text-right font-black">
                              {formatNumber(
                                line.quantity,
                                3
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-bold">
                              {formatNumber(
                                line.unit_price
                              )}
                            </td>

                            <td className="px-4 py-3 text-right font-black text-emerald-600">
                              {formatNumber(
                                line.line_total
                              )}
                            </td>

                            <td className="px-4 py-3">
                              {line.allocations.map(
                                (
                                  allocation
                                ) => (
                                  <div
                                    key={
                                      allocation.allocation_id
                                    }
                                    className="mb-1 rounded-lg bg-slate-50 px-2 py-1 text-xs"
                                  >
                                    <span className="font-black">
                                      {
                                        allocation.lot_no ??
                                        '-'
                                      }
                                    </span>

                                    {allocation.batch_no && (
                                      <span className="text-slate-400">
                                        {' / '}
                                        {
                                          allocation.batch_no
                                        }
                                      </span>
                                    )}

                                    <span className="ml-2 text-slate-500">
                                      ×{' '}
                                      {formatNumber(
                                        allocation.quantity,
                                        3
                                      )}
                                    </span>
                                  </div>
                                )
                              )}
                            </td>
                          </tr>
                        )
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="ml-auto w-full max-w-md space-y-2 rounded-2xl bg-slate-50 p-4">
                  <div className="flex justify-between">
                    <span>
                      Subtotal
                    </span>

                    <strong>
                      {formatNumber(
                        invoiceDetail
                          .order
                          .subtotal
                      )}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Discount
                    </span>

                    <strong className="text-rose-600">
                      -
                      {formatNumber(
                        invoiceDetail
                          .order
                          .discount_amount
                      )}
                    </strong>
                  </div>

                  <div className="flex justify-between">
                    <span>
                      Tax
                    </span>

                    <strong>
                      {formatNumber(
                        invoiceDetail
                          .order
                          .tax_amount
                      )}
                    </strong>
                  </div>

                  <div className="flex justify-between border-t border-slate-300 pt-3 text-lg">
                    <span className="font-black">
                      Grand Total
                    </span>

                    <span className="font-black text-emerald-600">
                      {formatNumber(
                        invoiceDetail
                          .order
                          .grand_total
                      )}{' '}
                      {
                        invoiceDetail
                          .order
                          .price_list
                          .currency_code ??
                        'MMK'
                      }
                    </span>
                  </div>
                </div>

                <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs font-bold text-emerald-700">
                  🔒 Customer-facing Invoice တွင်
                  Inventory Cost / COGS မဖော်ပြပါ။
                </div>
              </div>
            </div>
          </div>
        )}


      {/* =====================================================
          OUTPUT INVOICE MODAL
          ===================================================== */}

      {outputOpen &&
        invoiceDetail && (
          <div className="fixed inset-0 z-[160] flex items-center justify-center bg-black/70 p-3 backdrop-blur-sm">
            <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl">
              <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
                <div>
                  <div className="text-xs font-bold text-slate-300">
                    Invoice Output
                  </div>

                  <div className="font-black">
                    {
                      invoiceDetail
                        .order
                        .invoice_no
                    }
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOutputOpen(
                      false
                    )
                  }
                  className="text-xl font-black"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 p-4 md:p-6">
                <div className="grid gap-3 sm:grid-cols-3">
                  <button
                    type="button"
                    disabled={
                      imageSaving
                    }
                    onClick={() =>
                      void handleSaveInvoiceImage()
                    }
                    className="rounded-2xl bg-blue-600 px-3 py-5 text-white shadow hover:bg-blue-700 disabled:opacity-50"
                  >
                    <div className="text-3xl">
                      🖼️
                    </div>

                    <div className="mt-2 font-black">
                      Save Image
                    </div>

                    <div className="mt-1 text-[10px] text-blue-100">
                      PNG High Resolution
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleUsbPrint
                    }
                    className="rounded-2xl bg-indigo-600 px-3 py-5 text-white shadow hover:bg-indigo-700"
                  >
                    <div className="text-3xl">
                      🖨️
                    </div>

                    <div className="mt-2 font-black">
                      USB Printer
                    </div>

                    <div className="mt-1 text-[10px] text-indigo-100">
                      A4 / System Printer
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={
                      handleBluetoothPrint
                    }
                    className="rounded-2xl bg-orange-500 px-3 py-5 text-white shadow hover:bg-orange-600"
                  >
                    <div className="flex justify-center">
                      <svg
                        viewBox="0 0 24 24"
                        className="h-8 w-8"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="M6 7l12 10-6 5V2l6 5L6 17" />
                      </svg>
                    </div>

                    <div className="mt-2 font-black">
                      Bluetooth Printer
                    </div>

                    <div className="mt-1 text-[10px] text-orange-100">
                      NEXORA BT Print
                    </div>
                  </button>
                </div>

                <div className="rounded-xl border border-orange-200 bg-orange-50 p-4">
                  <div className="text-xs font-black text-orange-800">
                    Bluetooth Thermal Paper
                  </div>

                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {[
                      '55mm',
                      '58mm',
                      '80mm',
                    ].map(
                      (
                        size
                      ) => (
                        <button
                          type="button"
                          key={
                            size
                          }
                          onClick={() =>
                            setThermalPaperSize(
                              size as
                                | '55mm'
                                | '58mm'
                                | '80mm'
                            )
                          }
                          className={`rounded-lg border px-3 py-2 text-sm font-black ${
                            thermalPaperSize ===
                            size
                              ? 'border-orange-500 bg-orange-500 text-white'
                              : 'border-orange-200 bg-white text-orange-700'
                          }`}
                        >
                          {size}
                        </button>
                      )
                    )}
                  </div>

                  <div className="mt-3 text-xs leading-5 text-orange-800">
                    Bluetooth Printer ကိုနှိပ်ပြီး
                    System Print Dialog ပေါ်လာပါက
                    <strong>
                      {' '}
                      NEXORA BT Print
                    </strong>
                    {' '}
                    ကိုရွေးပြီး paired Bluetooth
                    printer သို့ထုတ်ပါ။
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 p-3 text-xs text-slate-500">
                  USB Printer သည် A4 invoice layout ကို
                  အသုံးပြုသည်။ Bluetooth Printer သည်
                  compact thermal receipt layout ကို
                  အသုံးပြုသည်။
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setOutputOpen(
                      false
                    )
                  }
                  className="w-full rounded-xl bg-slate-100 px-4 py-3 font-black text-slate-600"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}


      {/* =====================================================
          SAVE IMAGE TEMPLATE
          Off-screen only — customer-facing, no COGS
          ===================================================== */}

      {invoiceDetail && (
        <div
          className="fixed left-[10000px] top-0 -z-50 w-[800px] bg-white"
          aria-hidden="true"
        >
          <div
            ref={
              invoiceImageRef
            }
            className="w-[800px] bg-white p-10 text-slate-900"
            style={{
              fontFamily:
                '"Pyidaungsu", "Myanmar Text", Arial, sans-serif',
            }}
          >
            <div className="flex justify-between gap-6 border-b-2 border-slate-900 pb-5">
              <div>
                <div className="text-3xl font-black">
                  MAVORA ERP
                </div>

                <div className="font-bold text-slate-600">
                  Controlled Sales Invoice
                </div>

                <div className="mt-1 text-xs text-slate-500">
                  {
                    invoiceDetail
                      .order
                      .warehouse
                      .code
                  }
                  {' — '}
                  {
                    invoiceDetail
                      .order
                      .warehouse
                      .name
                  }
                </div>
              </div>

              <div className="text-right">
                <div className="text-xl font-black">
                  {
                    invoiceDetail
                      .order
                      .invoice_no
                  }
                </div>

                <div className="mt-1 text-sm">
                  {formatDateTime(
                    invoiceDetail
                      .order
                      .sold_at
                  )}
                </div>

                <div className="text-xs uppercase text-slate-500">
                  {
                    invoiceDetail
                      .order
                      .status
                  }
                </div>
              </div>
            </div>

            <div className="my-5 grid grid-cols-2 gap-x-8 gap-y-2 text-sm">
              <div>
                <span className="font-black">
                  Customer:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .customer_name ??
                  '-'
                }
              </div>

              <div>
                <span className="font-black">
                  Phone:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .customer_phone ??
                  '-'
                }
              </div>

              <div>
                <span className="font-black">
                  Shop Type:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .customer_shop_type ??
                  '-'
                }
              </div>

              <div>
                <span className="font-black">
                  Payment:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .payment_method
                }
              </div>

              <div>
                <span className="font-black">
                  Address:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .customer_address ??
                  '-'
                }
              </div>

              <div>
                <span className="font-black">
                  Sold By:
                </span>{' '}
                {
                  invoiceDetail
                    .order
                    .sold_by
                }
              </div>
            </div>

            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-900 text-white">
                  <th className="border border-slate-900 px-3 py-2 text-left">
                    Product
                  </th>

                  <th className="border border-slate-900 px-3 py-2 text-right">
                    Qty
                  </th>

                  <th className="border border-slate-900 px-3 py-2 text-right">
                    Unit Price
                  </th>

                  <th className="border border-slate-900 px-3 py-2 text-right">
                    Amount
                  </th>

                  <th className="border border-slate-900 px-3 py-2 text-left">
                    Lot / Batch
                  </th>
                </tr>
              </thead>

              <tbody>
                {invoiceDetail.lines.map(
                  (
                    line
                  ) => (
                    <tr
                      key={
                        line.line_id
                      }
                    >
                      <td className="border border-slate-300 px-3 py-2">
                        <div className="font-black">
                          {
                            line
                              .product
                              .sku
                          }
                        </div>

                        <div>
                          {
                            line
                              .product
                              .name
                          }
                        </div>
                      </td>

                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatNumber(
                          line.quantity,
                          3
                        )}
                      </td>

                      <td className="border border-slate-300 px-3 py-2 text-right">
                        {formatNumber(
                          line.unit_price
                        )}
                      </td>

                      <td className="border border-slate-300 px-3 py-2 text-right font-black">
                        {formatNumber(
                          line.line_total
                        )}
                      </td>

                      <td className="border border-slate-300 px-3 py-2 text-xs">
                        {line.allocations
                          .map(
                            (
                              allocation
                            ) =>
                              `${
                                allocation.lot_no ??
                                '-'
                              }${
                                allocation.batch_no
                                  ? ` / ${allocation.batch_no}`
                                  : ''
                              }`
                          )
                          .join(
                            ', '
                          )}
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>

            <div className="ml-auto mt-5 w-[330px] space-y-2">
              <div className="flex justify-between">
                <span>
                  Subtotal
                </span>

                <strong>
                  {formatNumber(
                    invoiceDetail
                      .order
                      .subtotal
                  )}
                </strong>
              </div>

              <div className="flex justify-between">
                <span>
                  Discount
                </span>

                <strong>
                  -
                  {formatNumber(
                    invoiceDetail
                      .order
                      .discount_amount
                  )}
                </strong>
              </div>

              <div className="flex justify-between">
                <span>
                  Tax
                </span>

                <strong>
                  {formatNumber(
                    invoiceDetail
                      .order
                      .tax_amount
                  )}
                </strong>
              </div>

              <div className="flex justify-between border-t-2 border-slate-900 pt-3 text-lg font-black">
                <span>
                  Grand Total
                </span>

                <span>
                  {formatNumber(
                    invoiceDetail
                      .order
                      .grand_total
                  )}{' '}
                  {
                    invoiceDetail
                      .order
                      .price_list
                      .currency_code ??
                    'MMK'
                  }
                </span>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-300 pt-3 text-center text-xs text-slate-500">
              Controlled invoice generated by MAVORA ERP.
            </div>
          </div>
        </div>
      )}

      {/* CONTROLLED SALES HISTORY UI END */}

      {(loading ||
        historyLoading ||
        invoiceLoading ||
        imageSaving) && (
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
