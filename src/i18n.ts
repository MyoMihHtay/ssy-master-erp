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
  },
} as const;

export type TranslationKey = keyof typeof translations.my;

export const normalizeLanguage = (value?: string | null): AppLanguage =>
  value === 'en' ? 'en' : DEFAULT_LANGUAGE;

export const tr = (language: AppLanguage, key: TranslationKey): string =>
  translations[language]?.[key] ?? translations[DEFAULT_LANGUAGE][key] ?? key;
