export type AppLanguage = 'my' | 'en';

export const DEFAULT_LANGUAGE: AppLanguage = 'my';
export const LANGUAGE_STORAGE_KEY = 'ssy_language';

export const translations = {
  my: {
    dashboard: 'လုပ်ငန်းအကျဉ်းချုပ်',
    workspace: 'လုပ်ငန်းခွင် ဆက်သွယ်ရေး',
    sales: 'အရောင်း',
    procurement: 'ဝယ်ယူရေး',
    inventory: 'ကုန်လှောင်ရုံ',
    production: 'ထုတ်လုပ်မှု',
    packaging: 'ထုပ်ပိုးမှု',
    finishedGoods: 'ကုန်ချော',
    finance: 'ဘဏ္ဍာရေး / စာရင်း',
    reports: 'အစီရင်ခံစာများ',
    hr: 'ဝန်ထမ်းရေးရာ / HR',
    accounts: 'အကောင့်များ',
    quality: 'အရည်အသွေး / QC',
    maintenance: 'စက်ပြုပြင်ထိန်းသိမ်းမှု',
    calibration: 'Calibration',
    safety: 'ဘေးကင်းလုံခြုံရေး',
    language: 'ဘာသာစကား',
    myanmar: 'မြန်မာ',
    english: 'English',
    currentUser: 'လက်ရှိအသုံးပြုသူ',
    logout: 'အကောင့်ထွက်မည်',

    dashboardMonthlySales: 'ယခုလ အရောင်းရငွေ',
    dashboardMonthlyExpenses: 'ယခုလ ထွက်ငွေစုစုပေါင်း',
    dashboardNetProfit: 'အသားတင် အမြတ်ငွေ',
    dashboardActiveEmployees: 'လက်ရှိ ဝန်ထမ်းအင်အား',
    dashboardPeople: 'ဦး',
    dashboardTopSelling: 'ရောင်းအားအကောင်းဆုံး ပစ္စည်းများ (Top 5)',
    dashboardUnits: 'ခု',
    dashboardNoSales: 'ယခုလအတွင်း အရောင်းမှတ်တမ်း မရှိသေးပါ',
    dashboardLowStock: 'ကုန်လက်ကျန် သတိပေးချက်',
    dashboardFinishedGoodsLow: 'ကုန်ချော ပြတ်လုနီးပါး',
    dashboardRawMaterialsLow: 'ကုန်ကြမ်း ပြတ်လုနီးပါး',
    dashboardPacks: 'ထုပ်',
    dashboardStockOK: 'ကုန်လက်ကျန် အားလုံး လုံလောက်မှုရှိပါသည်',
  },
  en: {
    dashboard: 'Dashboard',
    workspace: 'Team Workspace',
    sales: 'Sales',
    procurement: 'Procurement',
    inventory: 'Inventory',
    production: 'Production',
    packaging: 'Packaging',
    finishedGoods: 'Finished Goods',
    finance: 'Finance / Accounting',
    reports: 'Reports',
    hr: 'Human Resources',
    accounts: 'Accounts',
    quality: 'Quality / QC',
    maintenance: 'Maintenance',
    calibration: 'Calibration',
    safety: 'Safety',
    language: 'Language',
    myanmar: 'Myanmar',
    english: 'English',
    currentUser: 'Current User',
    logout: 'Log Out',

    dashboardMonthlySales: 'Sales This Month',
    dashboardMonthlyExpenses: 'Total Expenses This Month',
    dashboardNetProfit: 'Net Profit',
    dashboardActiveEmployees: 'Active Employees',
    dashboardPeople: 'People',
    dashboardTopSelling: 'Top Selling Products (Top 5)',
    dashboardUnits: 'Units',
    dashboardNoSales: 'No sales records for this month',
    dashboardLowStock: 'Low Stock Alerts',
    dashboardFinishedGoodsLow: 'Low Finished Goods',
    dashboardRawMaterialsLow: 'Low Raw Materials',
    dashboardPacks: 'Packs',
    dashboardStockOK: 'All stock levels are sufficient',
  },
} as const;

export type TranslationKey = keyof typeof translations.my;

export const normalizeLanguage = (value?: string | null): AppLanguage =>
  value === 'en' ? 'en' : DEFAULT_LANGUAGE;

export const tr = (language: AppLanguage, key: TranslationKey): string =>
  translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
