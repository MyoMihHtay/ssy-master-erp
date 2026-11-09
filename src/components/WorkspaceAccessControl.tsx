import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  X,
  ShieldCheck,
  RefreshCw,
  Search,
  Lock,
  Save,
  UserCog,
} from 'lucide-react';

import { mavoraSupabase } from '../mavoraSupabase';
import type { AppLanguage } from '../i18n';

type AccessLevel =
  | 'full'
  | 'read_only'
  | 'restricted'
  | 'blocked'
  | 'custom';

interface WorkspaceAccessRow {
  auth_user_id: string;
  email: string | null;
  display_name: string;
  user_role: string;

  access_level: AccessLevel;

  can_view: boolean;
  can_send: boolean;
  can_upload: boolean;
  can_delete_own: boolean;
  can_delete_others: boolean;
  can_view_sensitive: boolean;
  can_manage_members: boolean;

  is_workspace_owner: boolean;

  note: string | null;
  updated_at: string | null;
}

interface WorkspaceAccessControlProps {
  open: boolean;
  onClose: () => void;

  language: AppLanguage;

  tenantId: string;
  authUserId: string;

  theme: 'light' | 'dark';

  onSaved?: () => void;
}

interface ToggleProps {
  label: string;
  description?: string;

  checked: boolean;
  disabled?: boolean;
  danger?: boolean;

  onChange:
    (checked: boolean) => void;
}

const label = (
  language: AppLanguage,
  myanmar: string,
  english: string
) =>
  language === 'en'
    ? english
    : myanmar;

const Toggle = ({
  label: toggleLabel,
  description,
  checked,
  disabled,
  danger,
  onChange,
}: ToggleProps) => {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() =>
        onChange(!checked)
      }
      className={`mavora-permission-toggle flex items-center justify-between gap-4 rounded-xl border p-3 text-left transition ${
        disabled
          ? 'cursor-not-allowed border-slate-100 bg-slate-50 opacity-60'
          : checked
            ? danger
              ? 'border-red-200 bg-red-50'
              : 'border-emerald-200 bg-emerald-50'
            : 'border-slate-200 bg-white hover:border-slate-300'
      }`}
    >
      <div className="min-w-0">
        <div
          className={`text-sm font-bold ${
            checked && danger
              ? 'text-red-700'
              : checked
                ? 'text-emerald-800'
                : 'text-slate-700'
          }`}
        >
          {toggleLabel}
        </div>

        {description && (
          <div className="mt-0.5 text-[11px] font-medium leading-relaxed text-slate-400">
            {description}
          </div>
        )}
      </div>

      <div
        className={`relative h-6 w-11 shrink-0 rounded-full transition ${
          checked
            ? danger
              ? 'bg-red-500'
              : 'bg-emerald-500'
            : 'bg-slate-300'
        }`}
      >
        <div
          className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
            checked
              ? 'left-6'
              : 'left-1'
          }`}
        />
      </div>
    </button>
  );
};

export const WorkspaceAccessControl = ({
  open,
  onClose,
  language,
  tenantId,
  authUserId,
  theme,
  onSaved,
}: WorkspaceAccessControlProps) => {
  const isDark =
    theme === 'dark';
  const [
    rows,
    setRows,
  ] = useState<WorkspaceAccessRow[]>([]);

  const [
    loading,
    setLoading,
  ] = useState(false);

  const [
    savingId,
    setSavingId,
  ] = useState<string | null>(null);

  const [
    search,
    setSearch,
  ] = useState('');

  const [
    errorMessage,
    setErrorMessage,
  ] = useState('');

  const [
    successMessage,
    setSuccessMessage,
  ] = useState('');

  const [
    ownerVerified,
    setOwnerVerified,
  ] = useState(false);

  const loadRows =
    useCallback(
      async () => {
        setLoading(true);
        setErrorMessage('');
        setSuccessMessage('');

        try {
          const {
            data: {
              user,
            },
            error: authError,
          } =
            await mavoraSupabase
              .auth
              .getUser();

          if (authError) {
            throw authError;
          }

          if (
            !user
            || user.id
              !== authUserId
          ) {
            throw new Error(
              'MAVORA_WORKSPACE_AUTH_MISMATCH'
            );
          }

          const {
            data,
            error,
          } =
            await mavoraSupabase
              .rpc(
                'get_workspace_access_admin',
                {
                  p_tenant_id:
                    tenantId,
                }
              );

          if (error) {
            throw error;
          }

          const loadedRows: WorkspaceAccessRow[] =
            Array.isArray(data)
              ? (data as WorkspaceAccessRow[])
              : [];

          const selfRow =
            loadedRows.find(
              (
                row
              ) =>
                row.auth_user_id
                  === authUserId
            );

          if (
            !selfRow
            ?.is_workspace_owner
          ) {
            setRows([]);
            setOwnerVerified(
              false
            );

            throw new Error(
              'WORKSPACE_OWNER_REQUIRED'
            );
          }

          setOwnerVerified(
            true
          );

          setRows(
            loadedRows
          );
        } catch (
          error: any
        ) {
          console.error(
            'Workspace admin access load failed:',
            error
          );

          setRows([]);
          setOwnerVerified(
            false
          );

          const raw =
            String(
              error?.message
              || ''
            );

          if (
            raw.includes(
              'WORKSPACE_OWNER_REQUIRED'
            )
            || raw
              .toLowerCase()
              .includes(
                'permission'
              )
          ) {
            setErrorMessage(
              label(
                language,
                'Workspace Access Control ကို Workspace Owner သာ စီမံနိုင်ပါသည်။',
                'Only the Workspace Owner can manage Workspace Access Control.'
              )
            );
          } else {
            setErrorMessage(
              raw
              || label(
                language,
                'Workspace Permission Registry ရယူ၍ မရပါ။',
                'Unable to load the Workspace Permission Registry.'
              )
            );
          }
        } finally {
          setLoading(
            false
          );
        }
      },
      [
        authUserId,
        language,
        tenantId,
      ]
    );

  useEffect(() => {
    if (!open) {
      setSearch('');
      setErrorMessage('');
      setSuccessMessage('');
      setSavingId(null);

      return;
    }

    void loadRows();
  }, [
    loadRows,
    open,
  ]);

  const filteredRows =
    useMemo(
      () => {
        const keyword =
          search
            .trim()
            .toLowerCase();

        if (!keyword) {
          return rows;
        }

        return rows.filter(
          (
            row
          ) =>
            [
              row.display_name,
              row.email,
              row.user_role,
              row.access_level,
            ]
              .filter(Boolean)
              .some(
                (
                  value
                ) =>
                  String(
                    value
                  )
                    .toLowerCase()
                    .includes(
                      keyword
                    )
              )
        );
      },
      [
        rows,
        search,
      ]
    );

  const patchRow = (
    authUserIdToPatch:
      string,
    patch:
      Partial<WorkspaceAccessRow>
  ) => {
    setRows(
      (
        current
      ) =>
        current.map(
          (
            row
          ) =>
            row.auth_user_id
              === authUserIdToPatch
              ? {
                  ...row,
                  ...patch,
                }
              : row
        )
    );
  };

  const patchPermission = (
    row:
      WorkspaceAccessRow,
    patch:
      Partial<WorkspaceAccessRow>
  ) => {
    if (
      row.is_workspace_owner
    ) {
      return;
    }

    if (
      'can_manage_members'
      in patch
    ) {
      return;
    }

    patchRow(
      row.auth_user_id,
      {
        ...patch,
        access_level:
          'custom',
      }
    );
  };

  const applyPreset = (
    row:
      WorkspaceAccessRow,
    level:
      AccessLevel
  ) => {
    if (
      row.is_workspace_owner
    ) {
      return;
    }

    if (
      level === 'full'
    ) {
      patchRow(
        row.auth_user_id,
        {
          access_level:
            'full',

          can_view:
            true,

          can_send:
            true,

          can_upload:
            true,

          can_delete_own:
            true,

          can_delete_others:
            true,

          can_view_sensitive:
            true,

          can_manage_members:
            false,
        }
      );

      return;
    }

    if (
      level === 'read_only'
    ) {
      patchRow(
        row.auth_user_id,
        {
          access_level:
            'read_only',

          can_view:
            true,

          can_send:
            false,

          can_upload:
            false,

          can_delete_own:
            false,

          can_delete_others:
            false,

          can_view_sensitive:
            false,

          can_manage_members:
            false,
        }
      );

      return;
    }

    if (
      level === 'restricted'
      || level === 'blocked'
    ) {
      patchRow(
        row.auth_user_id,
        {
          access_level:
            level,

          can_view:
            false,

          can_send:
            false,

          can_upload:
            false,

          can_delete_own:
            false,

          can_delete_others:
            false,

          can_view_sensitive:
            false,

          can_manage_members:
            false,
        }
      );

      return;
    }

    patchRow(
      row.auth_user_id,
      {
        access_level:
          'custom',

        can_manage_members:
          false,
      }
    );
  };

  const saveRow =
    async (
      row:
        WorkspaceAccessRow
    ) => {
      if (
        row.is_workspace_owner
      ) {
        return;
      }

      if (
        !ownerVerified
      ) {
        setErrorMessage(
          label(
            language,
            'Workspace Owner verification မပြီးသေးပါ။',
            'Workspace Owner verification is incomplete.'
          )
        );

        return;
      }

      setSavingId(
        row.auth_user_id
      );

      setErrorMessage('');
      setSuccessMessage('');

      try {
        const {
          data: {
            user,
          },
          error:
            authError,
        } =
          await mavoraSupabase
            .auth
            .getUser();

        if (authError) {
          throw authError;
        }

        if (
          !user
          || user.id
            !== authUserId
        ) {
          throw new Error(
            'MAVORA_WORKSPACE_AUTH_MISMATCH'
          );
        }

        const {
          error,
        } =
          await mavoraSupabase
            .rpc(
              'update_workspace_user_access_admin',
              {
                p_tenant_id:
                  tenantId,

                p_auth_user_id:
                  row.auth_user_id,

                p_access_level:
                  row.access_level,

                p_can_view:
                  row.can_view,

                p_can_send:
                  row.can_send,

                p_can_upload:
                  row.can_upload,

                p_can_delete_own:
                  row.can_delete_own,

                p_can_delete_others:
                  row.can_delete_others,

                p_can_view_sensitive:
                  row.can_view_sensitive,

                // Client never delegates
                // workspace administration.
                p_can_manage_members:
                  false,

                p_note:
                  row.note
                  || null,
              }
            );

        if (error) {
          throw error;
        }

        setSuccessMessage(
          language === 'en'
            ? `${row.display_name}'s Workspace permissions were saved.`
            : `${row.display_name} ၏ Workspace Permission ကို သိမ်းပြီးပါပြီ။`
        );

        await loadRows();

        onSaved?.();
      } catch (
        error: any
      ) {
        console.error(
          'Workspace access update failed:',
          error
        );

        setErrorMessage(
          error?.message
          || label(
            language,
            'Permission ပြောင်းရာတွင် အမှားရှိပါသည်။',
            'An error occurred while updating permissions.'
          )
        );
      } finally {
        setSavingId(
          null
        );
      }
    };

  const accessLevelStyle = (
    level:
      AccessLevel
  ) => {
    if (
      level === 'full'
    ) {
      return 'bg-emerald-100 text-emerald-700';
    }

    if (
      level === 'read_only'
    ) {
      return 'bg-blue-100 text-blue-700';
    }

    if (
      level === 'blocked'
    ) {
      return 'bg-red-100 text-red-700';
    }

    if (
      level === 'custom'
    ) {
      return 'bg-violet-100 text-violet-700';
    }

    return 'bg-amber-100 text-amber-700';
  };

  if (!open) {
    return null;
  }

  return (
    <div
      className={`mavora-access-overlay ${
        isDark
          ? 'mavora-access-dark'
          : 'mavora-access-light'
      } fixed inset-0 z-[200] flex items-center justify-center p-3 backdrop-blur-sm md:p-6`}
    >
      <div className="mavora-access-panel flex max-h-[94vh] w-full max-w-6xl flex-col overflow-hidden rounded-[28px] shadow-2xl">
        <div className="mavora-access-header shrink-0 px-5 py-5 md:px-7">
          <div className="flex items-start justify-between gap-5">
            <div className="flex min-w-0 items-start gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-400/30">
                <ShieldCheck size={26} />
              </div>

              <div>
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <span className="rounded-full bg-emerald-400/15 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
                    Secure Access Control
                  </span>

                  <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-300">
                    Owner Only
                  </span>
                </div>

                <h2 className="text-xl font-black tracking-tight md:text-2xl">
                  Workspace Access Control
                </h2>

                <p className="mt-1 max-w-2xl text-xs font-medium leading-relaxed text-slate-300 md:text-sm">
                  {label(
                    language,
                    'User တစ်ယောက်ချင်းစီအလိုက် View, Send, Upload, Delete နှင့် Sensitive Information Permission များကို သီးသန့်ထိန်းချုပ်နိုင်ပါသည်။',
                    'Control View, Send, Upload, Delete, and Sensitive Information permissions for each user.'
                  )}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={
                onClose
              }
              className="rounded-full bg-white/10 p-2.5 text-white transition hover:bg-white/20"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        <div className="mavora-access-toolbar shrink-0 border-b px-5 py-4 md:px-7">
          <div className="flex flex-col gap-3 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search
                size={18}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
              />

              <input
                value={
                  search
                }
                onChange={(
                  event
                ) =>
                  setSearch(
                    event.target.value
                  )
                }
                placeholder="Search name, email, role, access level..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-100"
              />
            </div>

            <button
              type="button"
              onClick={() =>
                void loadRows()
              }
              disabled={
                loading
              }
              className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
            >
              <RefreshCw
                size={16}
                className={
                  loading
                    ? 'animate-spin'
                    : ''
                }
              />

              Refresh
            </button>
          </div>

          {errorMessage && (
            <div className="mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2.5 text-sm font-bold text-red-700">
              {errorMessage}
            </div>
          )}

          {successMessage && (
            <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-bold text-emerald-700">
              {successMessage}
            </div>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-4 md:p-6">
          {loading
            && rows.length === 0
            ? (
              <div className="flex min-h-[320px] items-center justify-center">
                <div className="text-center">
                  <RefreshCw
                    size={28}
                    className="mx-auto animate-spin text-indigo-500"
                  />

                  <p className="mt-3 text-sm font-bold text-slate-500">
                    Permission Registry Loading...
                  </p>
                </div>
              </div>
            )
            : (
              <div className="space-y-4">
                {filteredRows.map(
                  (
                    row
                  ) => {
                    const locked =
                      row.is_workspace_owner;

                    const saving =
                      savingId
                        === row.auth_user_id;

                    return (
                      <div
                        key={
                          row.auth_user_id
                        }
                        className={`mavora-access-card overflow-hidden rounded-2xl border shadow-sm ${
                          locked
                            ? 'border-emerald-300 ring-1 ring-emerald-100'
                            : 'border-slate-200'
                        }`}
                      >
                        <div className="border-b border-slate-100 p-4 md:p-5">
                          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                            <div className="flex min-w-0 items-start gap-3">
                              <div
                                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                                  locked
                                    ? 'bg-emerald-100 text-emerald-700'
                                    : 'bg-indigo-50 text-indigo-600'
                                }`}
                              >
                                {locked
                                  ? (
                                    <Lock size={20} />
                                  )
                                  : (
                                    <UserCog size={20} />
                                  )}
                              </div>

                              <div className="min-w-0">
                                <div className="flex flex-wrap items-center gap-2">
                                  <h3 className="truncate text-base font-black text-slate-900">
                                    {row.display_name}
                                  </h3>

                                  {locked && (
                                    <span className="rounded-full bg-emerald-100 px-2 py-1 text-[9px] font-black uppercase tracking-wider text-emerald-700">
                                      Master Owner
                                    </span>
                                  )}

                                  <span
                                    className={`rounded-full px-2 py-1 text-[9px] font-black uppercase tracking-wider ${accessLevelStyle(
                                      row.access_level
                                    )}`}
                                  >
                                    {row.access_level.replace(
                                      '_',
                                      ' '
                                    )}
                                  </span>
                                </div>

                                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium text-slate-500">
                                  <span>
                                    {row.email
                                      || 'No email'}
                                  </span>

                                  <span>•</span>

                                  <span>
                                    {row.user_role}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <select
                              value={
                                row.access_level
                              }
                              disabled={
                                locked
                              }
                              onChange={(
                                event
                              ) =>
                                applyPreset(
                                  row,
                                  event.target.value as AccessLevel
                                )
                              }
                              className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                            >
                              <option value="full">
                                Full
                              </option>

                              <option value="read_only">
                                Read Only
                              </option>

                              <option value="restricted">
                                Restricted
                              </option>

                              <option value="blocked">
                                Blocked
                              </option>

                              <option value="custom">
                                Custom
                              </option>
                            </select>
                          </div>
                        </div>

                        <div className="grid gap-3 p-4 md:grid-cols-2 md:p-5 xl:grid-cols-3">
                          <Toggle
                            label="View"
                            checked={
                              row.can_view
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_view:
                                    checked,
                                }
                              )
                            }
                          />

                          <Toggle
                            label="Send"
                            checked={
                              row.can_send
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_send:
                                    checked,
                                }
                              )
                            }
                          />

                          <Toggle
                            label="Upload"
                            checked={
                              row.can_upload
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_upload:
                                    checked,
                                }
                              )
                            }
                          />

                          <Toggle
                            label="Delete Own"
                            checked={
                              row.can_delete_own
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_delete_own:
                                    checked,
                                }
                              )
                            }
                          />

                          <Toggle
                            label="Delete Others"
                            danger
                            checked={
                              row.can_delete_others
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_delete_others:
                                    checked,
                                }
                              )
                            }
                          />

                          <Toggle
                            label="View Sensitive"
                            checked={
                              row.can_view_sensitive
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              checked
                            ) =>
                              patchPermission(
                                row,
                                {
                                  can_view_sensitive:
                                    checked,
                                }
                              )
                            }
                          />
                        </div>

                        <div className="border-t border-slate-100 p-4 md:p-5">
                          <textarea
                            value={
                              row.note
                              || ''
                            }
                            disabled={
                              locked
                            }
                            onChange={(
                              event
                            ) =>
                              patchRow(
                                row.auth_user_id,
                                {
                                  note:
                                    event.target.value,
                                }
                              )
                            }
                            placeholder="Permission note..."
                            rows={2}
                            className="w-full resize-none rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm font-medium text-slate-700 outline-none focus:border-indigo-400 disabled:cursor-not-allowed disabled:bg-slate-100"
                          />

                          <div className="mt-3 flex items-center justify-between gap-3">
                            <div className="text-[11px] font-medium text-slate-400">
                              {locked
                                ? label(
                                    language,
                                    'Master Owner Permission ကို ပြောင်းလဲ၍ မရပါ။',
                                    'Master Owner permissions are protected.'
                                  )
                                : label(
                                    language,
                                    'Manage Members permission ကို အခြား user ထံ မလွှဲပေးပါ။',
                                    'Manage Members permission is never delegated.'
                                  )}
                            </div>

                            {!locked && (
                              <button
                                type="button"
                                disabled={
                                  saving
                                  || !ownerVerified
                                }
                                onClick={() =>
                                  void saveRow(
                                    row
                                  )
                                }
                                className="flex shrink-0 items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-indigo-700 disabled:opacity-50"
                              >
                                {saving
                                  ? (
                                    <RefreshCw
                                      size={16}
                                      className="animate-spin"
                                    />
                                  )
                                  : (
                                    <Save size={16} />
                                  )}

                                Save
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                )}

                {!loading
                  && filteredRows.length === 0
                  && !errorMessage && (
                    <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm font-bold text-slate-400">
                      No Workspace users found.
                    </div>
                  )}
              </div>
            )}
        </div>
      </div>
    </div>
  );
};
