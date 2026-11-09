import React, {
  useState,
} from 'react';

import {
  signInMavora,
  type MavoraAuthResult,
  type MavoraUserSession,
} from '../auth/mavoraAuth';

import {
  tr,
  type AppLanguage,
} from '../i18n';

interface LoginProps {
  language: AppLanguage;

  setLanguage:
    React.Dispatch<
      React.SetStateAction<AppLanguage>
    >;

  // Temporary compatibility until App.tsx integration.
  onLogin?: (
    session: MavoraUserSession
  ) => void;

  onAuthenticated?: (
    result: MavoraAuthResult
  ) => void;
}

const getAuthErrorMessage = (
  language: AppLanguage,
  error: unknown
): string => {
  const code =
    error instanceof Error
      ? error.message
      : '';

  if (
    code ===
    'MAVORA_NO_ACTIVE_LICENSED_TENANT'
  ) {
    return language === 'my'
      ? 'အသုံးပြုခွင့်ရှိသော MAVORA Commercial License မရှိပါ။ Platform Administrator ကို ဆက်သွယ်ပါ။'
      : 'No active MAVORA commercial license is available. Please contact the platform administrator.';
  }

  if (
    code ===
      'MAVORA_MEMBERSHIP_NOT_FOUND'
    || code ===
      'MAVORA_TENANT_ACCESS_DENIED'
  ) {
    return language === 'my'
      ? 'အသုံးပြုခွင့်ရှိသော လုပ်ငန်းအကောင့် မတွေ့ပါ။'
      : 'No accessible company account was found.';
  }

  if (
    code ===
    'MAVORA_PROFILE_NOT_ACTIVE'
  ) {
    return language === 'my'
      ? 'ဤ User Account ကို အသုံးပြုခွင့်မပြုထားပါ။'
      : 'This user account is not active.';
  }

  if (
    code ===
    'MAVORA_TENANT_SELECTION_HANDLER_REQUIRED'
  ) {
    return language === 'my'
      ? 'လုပ်ငန်းရွေးချယ်မှုကို App နှင့် ချိတ်ဆက်နေဆဲဖြစ်ပါသည်။'
      : 'Company selection is not yet connected to the application.';
  }

  return tr(
    language,
    'loginInvalidCredentials'
  );
};

export const Login:
  React.FC<LoginProps> = ({
    language,
    setLanguage,
    onLogin,
    onAuthenticated,
  }) => {
    const [
      email,
      setEmail,
    ] = useState('');

    const [
      password,
      setPassword,
    ] = useState('');

    const [
      error,
      setError,
    ] = useState('');

    const [
      isSubmitting,
      setIsSubmitting,
    ] = useState(false);

    const handleLogin = async (
      e: React.FormEvent
    ) => {
      e.preventDefault();

      if (isSubmitting) {
        return;
      }

      setError('');
      setIsSubmitting(true);

      try {
        const result =
          await signInMavora(
            email.trim(),
            password
          );

        if (onAuthenticated) {
          onAuthenticated(result);
          return;
        }

        if (
          result.kind === 'session'
          && onLogin
        ) {
          onLogin(result.session);
          return;
        }

        throw new Error(
          'MAVORA_TENANT_SELECTION_HANDLER_REQUIRED'
        );
      } catch (authError) {
        setError(
          getAuthErrorMessage(
            language,
            authError
          )
        );
      } finally {
        setIsSubmitting(false);
      }
    };

    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">

        <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl p-8 space-y-6">

          <div className="text-center">

            <h1 className="text-4xl font-extrabold text-blue-600 mb-2">
              MAVORA
            </h1>

            <p className="text-gray-600 tracking-widest text-sm font-black">
              COMMERCIAL ERP PLATFORM
            </p>

            <p className="text-gray-400 text-xs font-semibold mt-1">
              Production • Manufacturing Pro
            </p>

          </div>

          <h2 className="text-xl font-bold text-center text-gray-800">
            {tr(
              language,
              'loginScreenTitle'
            )}
          </h2>

          <div className="flex items-center justify-between gap-3 bg-slate-50 border border-slate-200 rounded-xl p-2">

            <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
              🌐{' '}
              {tr(
                language,
                'loginLanguage'
              )}
            </span>

            <div className="grid grid-cols-2 gap-1 bg-slate-200 rounded-lg p-1 min-w-[150px]">

              <button
                type="button"
                onClick={() =>
                  setLanguage('my')
                }
                className={`px-3 py-1.5 rounded-md text-xs font-black transition-colors ${
                  language === 'my'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                မြန်မာ
              </button>

              <button
                type="button"
                onClick={() =>
                  setLanguage('en')
                }
                className={`px-3 py-1.5 rounded-md text-xs font-black transition-colors ${
                  language === 'en'
                    ? 'bg-blue-600 text-white shadow'
                    : 'text-slate-600 hover:bg-white'
                }`}
              >
                EN
              </button>

            </div>

          </div>

          {error && (
            <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm font-medium text-center border border-red-200">
              {error}
            </div>
          )}

          <form
            onSubmit={handleLogin}
            className="space-y-4"
          >

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr(
                  language,
                  'loginUsername'
                )}
              </label>

              <input
                type="email"
                value={email}
                onChange={(e) =>
                  setEmail(
                    e.target.value
                  )
                }
                autoComplete="email"
                inputMode="email"
                className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />

            </div>

            <div>

              <label className="block text-sm font-medium text-gray-700 mb-1">
                {tr(
                  language,
                  'loginPassword'
                )}
              </label>

              <input
                type="password"
                value={password}
                onChange={(e) =>
                  setPassword(
                    e.target.value
                  )
                }
                autoComplete="current-password"
                className="w-full border border-gray-300 p-3 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
                required
              />

            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full bg-blue-600 disabled:bg-blue-300 disabled:cursor-not-allowed text-white p-3 rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-md"
            >
              {isSubmitting
                ? language === 'my'
                  ? 'ဝင်ရောက်နေပါသည်...'
                  : 'Signing in...'
                : tr(
                    language,
                    'loginButton'
                  )}
            </button>

          </form>

          <p className="text-center text-[11px] text-slate-400">
            Supabase Auth • Commercial License Verification
          </p>

        </div>

      </div>
    );
  };
