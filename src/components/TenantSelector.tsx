import React, { useState } from 'react';

import type {
  MavoraTenantOption,
  MavoraTenantSelection,
} from '../auth/mavoraAuth';

import type {
  AppLanguage,
} from '../i18n';

interface TenantSelectorProps {
  language: AppLanguage;

  selection:
    MavoraTenantSelection;

  onSelect: (
    tenantId: string
  ) => Promise<void>;

  onLogout: () => Promise<void>;
}

const editionLabel = (
  tenant: MavoraTenantOption
): string => {
  if (
    tenant.editionCode
    === 'MANUFACTURING'
  ) {
    return 'MAVORA Manufacturing Pro';
  }

  if (
    tenant.editionCode
    === 'PRODUCTION'
  ) {
    return 'MAVORA Production';
  }

  return 'No Active Edition';
};

export const TenantSelector:
  React.FC<TenantSelectorProps> = ({
    language,
    selection,
    onSelect,
    onLogout,
  }) => {
    const [
      submittingTenantId,
      setSubmittingTenantId,
    ] = useState<string | null>(
      null
    );

    const [
      error,
      setError,
    ] = useState('');

    const handleSelect = async (
      tenant: MavoraTenantOption
    ) => {
      if (
        !tenant.accessAllowed
        || !tenant.editionCode
        || submittingTenantId
      ) {
        return;
      }

      setError('');
      setSubmittingTenantId(
        tenant.tenantId
      );

      try {
        await onSelect(
          tenant.tenantId
        );
      } catch {
        setError(
          language === 'my'
            ? 'ဤလုပ်ငန်းအတွက် Membership သို့မဟုတ် Commercial License ကို အတည်ပြု၍ မရပါ။'
            : 'Unable to verify the membership or commercial license for this company.'
        );
      } finally {
        setSubmittingTenantId(
          null
        );
      }
    };

    return (
      <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">

        <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl border border-slate-200 overflow-hidden">

          <div className="bg-slate-950 text-white p-7 md:p-9">

            <div className="flex items-start justify-between gap-4">

              <div>

                <p className="text-emerald-400 text-xs font-black tracking-[0.2em] uppercase">
                  MAVORA ERP
                </p>

                <h1 className="text-2xl md:text-3xl font-black mt-2">
                  {language === 'my'
                    ? 'အသုံးပြုမည့် လုပ်ငန်းကို ရွေးချယ်ပါ'
                    : 'Select your company'}
                </h1>

                <p className="text-slate-400 text-sm mt-2">
                  {selection.name}
                </p>

              </div>

              <button
                type="button"
                onClick={() => {
                  void onLogout();
                }}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-xs font-bold"
              >
                {language === 'my'
                  ? 'ထွက်မည်'
                  : 'Sign out'}
              </button>

            </div>

          </div>

          <div className="p-5 md:p-8">

            {error && (
              <div className="mb-5 p-4 rounded-xl border border-red-200 bg-red-50 text-red-700 text-sm font-semibold">
                {error}
              </div>
            )}

            <div className="grid gap-4">

              {selection.tenants.map(
                (tenant) => {
                  const disabled =
                    !tenant.accessAllowed
                    || !tenant.editionCode;

                  const isSubmitting =
                    submittingTenantId
                    === tenant.tenantId;

                  return (
                    <button
                      key={tenant.tenantId}
                      type="button"
                      disabled={
                        disabled
                        || submittingTenantId
                          !== null
                      }
                      onClick={() => {
                        void handleSelect(
                          tenant
                        );
                      }}
                      className={`w-full text-left rounded-2xl border p-5 transition-all ${
                        disabled
                          ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                          : 'bg-white border-slate-200 hover:border-blue-400 hover:shadow-lg'
                      }`}
                    >

                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">

                        <div>

                          <h2 className="text-lg font-black text-slate-900">
                            {tenant.tenantName}
                          </h2>

                          <p className="text-xs text-slate-400 mt-1">
                            {tenant.tenantSlug}
                          </p>

                          <div className="flex flex-wrap gap-2 mt-3">

                            <span className="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-black">
                              {editionLabel(
                                tenant
                              )}
                            </span>

                            <span
                              className={`px-2.5 py-1 rounded-lg text-xs font-black ${
                                tenant.accessAllowed
                                  ? 'bg-emerald-50 text-emerald-700'
                                  : 'bg-red-50 text-red-700'
                              }`}
                            >
                              {tenant.licenseStatus}
                            </span>

                            {tenant.licenseType && (
                              <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-600 text-xs font-bold">
                                {tenant.licenseType}
                              </span>
                            )}

                          </div>

                        </div>

                        <div className="text-sm font-black text-blue-700">

                          {isSubmitting
                            ? language === 'my'
                              ? 'စစ်ဆေးနေသည်...'
                              : 'Checking...'

                            : disabled
                              ? language === 'my'
                                ? 'အသုံးပြုခွင့်မရှိ'
                                : 'Unavailable'

                              : language === 'my'
                                ? 'ဝင်ရောက်မည် →'
                                : 'Open →'}

                        </div>

                      </div>

                    </button>
                  );
                }
              )}

            </div>

            <p className="text-center text-[11px] text-slate-400 mt-6">
              {language === 'my'
                ? 'လုပ်ငန်းဝင်ရောက်ခွင့်ကို User Membership နှင့် Commercial License နှစ်မျိုးစလုံးဖြင့် စစ်ဆေးပါသည်။'
                : 'Company access is verified by both user membership and commercial license.'}
            </p>

          </div>

        </div>

      </div>
    );
  };
