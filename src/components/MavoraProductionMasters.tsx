import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import type { AppLanguage } from '../i18n';

import {
  createMavoraProductionLine,
  createMavoraWorkCenter,
  updateMavoraProductionLine,
  updateMavoraWorkCenter,
  type MavoraProductionSnapshot,
} from '../production/mavoraProduction';

interface Props {
  tenantId: string;
  language: AppLanguage;
  snapshot: MavoraProductionSnapshot;
  onRefresh: () => Promise<void>;
}

export const MavoraProductionMasters: React.FC<
  Props
> = ({
  tenantId,
  language,
  snapshot,
  onRefresh,
}) => {
  const t = (my: string, en: string) =>
    language === 'my' ? my : en;

  const firstSiteId =
    snapshot.sites[0]?.id || '';

  const [working, setWorking] =
    useState(false);

  const [errorMessage, setErrorMessage] =
    useState('');

  const [successMessage, setSuccessMessage] =
    useState('');

  const [workCenterForm, setWorkCenterForm] =
    useState({
      id: '',
      siteId: firstSiteId,
      departmentId: '',
      code: '',
      name: '',
    });

  const [lineForm, setLineForm] =
    useState({
      id: '',
      siteId: '',
      workCenterId: '',
      code: '',
      name: '',
      capacityPerHour: '',
    });

  useEffect(() => {
    if (
      !workCenterForm.siteId &&
      firstSiteId
    ) {
      setWorkCenterForm((current) => ({
        ...current,
        siteId: firstSiteId,
      }));
    }
  }, [
    firstSiteId,
    workCenterForm.siteId,
  ]);

  const sitesById = useMemo(
    () =>
      new Map(
        snapshot.sites.map((item) => [
          item.id,
          item,
        ])
      ),
    [snapshot.sites]
  );

  const departmentsById = useMemo(
    () =>
      new Map(
        snapshot.departments.map(
          (item) => [
            item.id,
            item,
          ]
        )
      ),
    [snapshot.departments]
  );

  const workCentersById = useMemo(
    () =>
      new Map(
        snapshot.workCenters.map(
          (item) => [
            item.id,
            item,
          ]
        )
      ),
    [snapshot.workCenters]
  );

  const departmentsForSite =
    snapshot.departments.filter(
      (item) =>
        item.site_id ===
        workCenterForm.siteId
    );

  const resetMessages = () => {
    setErrorMessage('');
    setSuccessMessage('');
  };

  const resetWorkCenterForm = () => {
    setWorkCenterForm({
      id: '',
      siteId: firstSiteId,
      departmentId: '',
      code: '',
      name: '',
    });
  };

  const resetLineForm = () => {
    setLineForm({
      id: '',
      siteId: '',
      workCenterId: '',
      code: '',
      name: '',
      capacityPerHour: '',
    });
  };

  const handleWorkCenterSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    const site =
      sitesById.get(
        workCenterForm.siteId
      );

    if (!site) {
      setErrorMessage(
        t(
          'Site ကိုရွေးချယ်ပါ။',
          'Select a valid Site.'
        )
      );
      return;
    }

    if (workCenterForm.departmentId) {
      const department =
        departmentsById.get(
          workCenterForm.departmentId
        );

      if (
        !department ||
        department.site_id !== site.id
      ) {
        setErrorMessage(
          t(
            'Department နှင့် Site မကိုက်ညီပါ။',
            'Department does not belong to the selected Site.'
          )
        );
        return;
      }
    }

    if (
      !workCenterForm.code.trim() ||
      !workCenterForm.name.trim()
    ) {
      setErrorMessage(
        t(
          'Code နှင့် Name ဖြည့်ပါ။',
          'Code and Name are required.'
        )
      );
      return;
    }

    setWorking(true);

    try {
      if (workCenterForm.id) {
        await updateMavoraWorkCenter({
          tenantId,
          id: workCenterForm.id,
          siteId: site.id,
          departmentId:
            workCenterForm.departmentId ||
            null,
          code: workCenterForm.code,
          name: workCenterForm.name,
        });

        setSuccessMessage(
          t(
            'Work Center ကို ပြင်ဆင်ပြီးပါပြီ။',
            'Work Center updated successfully.'
          )
        );
      } else {
        await createMavoraWorkCenter({
          tenantId,
          siteId: site.id,
          departmentId:
            workCenterForm.departmentId ||
            null,
          code: workCenterForm.code,
          name: workCenterForm.name,
        });

        setSuccessMessage(
          t(
            'Work Center အသစ်ဖန်တီးပြီးပါပြီ။',
            'Work Center created successfully.'
          )
        );
      }

      resetWorkCenterForm();
      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save Work Center'
      );
    } finally {
      setWorking(false);
    }
  };

  const handleLineSave = async (
    event: React.FormEvent
  ) => {
    event.preventDefault();
    resetMessages();

    const workCenter =
      workCentersById.get(
        lineForm.workCenterId
      );

    if (!workCenter) {
      setErrorMessage(
        t(
          'Work Center ကိုရွေးချယ်ပါ။',
          'Select a valid Work Center.'
        )
      );
      return;
    }

    if (
      !lineForm.code.trim() ||
      !lineForm.name.trim()
    ) {
      setErrorMessage(
        t(
          'Code နှင့် Name ဖြည့်ပါ။',
          'Code and Name are required.'
        )
      );
      return;
    }

    let capacity: number | null = null;

    if (
      lineForm.capacityPerHour.trim()
    ) {
      capacity = Number(
        lineForm.capacityPerHour
      );

      if (
        !Number.isFinite(capacity) ||
        capacity <= 0
      ) {
        setErrorMessage(
          t(
            'Capacity per hour သည် 0 ထက်ကြီးရပါမည်။',
            'Capacity per hour must be greater than zero.'
          )
        );
        return;
      }
    }

    setWorking(true);

    try {
      if (lineForm.id) {
        await updateMavoraProductionLine({
          tenantId,
          id: lineForm.id,
          siteId: lineForm.siteId,
          code: lineForm.code,
          name: lineForm.name,
          capacityPerHour: capacity,
        });

        setSuccessMessage(
          t(
            'Production Line ကို ပြင်ဆင်ပြီးပါပြီ။',
            'Production Line updated successfully.'
          )
        );
      } else {
        await createMavoraProductionLine({
          tenantId,
          siteId:
            workCenter.site_id,
          workCenterId:
            workCenter.id,
          code: lineForm.code,
          name: lineForm.name,
          capacityPerHour: capacity,
        });

        setSuccessMessage(
          t(
            'Production Line အသစ်ဖန်တီးပြီးပါပြီ။',
            'Production Line created successfully.'
          )
        );
      }

      resetLineForm();
      await onRefresh();
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : 'Unable to save Production Line'
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
          'Work Center နှင့် Production Line ကို production.master_manage အခွင့်အရေးရှိသူသာ Create / Update လုပ်နိုင်ပါသည်။ Delete မဖွင့်ထားပါ။',
          'Work Center and Production Line Create / Update actions require production.master_manage. Delete is not enabled.'
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
          onSubmit={handleWorkCenterSave}
          className="rounded-2xl border bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-black text-slate-800">
                ⚙️{' '}
                {workCenterForm.id
                  ? t(
                      'Work Center ပြင်ဆင်ရန်',
                      'Edit Work Center'
                    )
                  : t(
                      'Work Center အသစ်',
                      'New Work Center'
                    )}
              </div>

              <div className="text-xs font-bold text-slate-400 mt-1">
                {t(
                  'Site အောက်ရှိ ထုတ်လုပ်မှုလုပ်ငန်းစု',
                  'Production process area within a Site'
                )}
              </div>
            </div>

            {workCenterForm.id && (
              <button
                type="button"
                onClick={
                  resetWorkCenterForm
                }
                className="text-xs font-black text-slate-500 underline"
              >
                {t(
                  'မလုပ်တော့ပါ',
                  'Cancel'
                )}
              </button>
            )}
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Site *
            </div>

            <select
              value={
                workCenterForm.siteId
              }
              disabled={
                Boolean(
                  workCenterForm.id
                ) || working
              }
              onChange={(event) =>
                setWorkCenterForm(
                  (current) => ({
                    ...current,
                    siteId:
                      event.target.value,
                    departmentId: '',
                  })
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white disabled:bg-slate-100"
            >
              <option value="">
                {t(
                  'Site ရွေးပါ',
                  'Select Site'
                )}
              </option>

              {snapshot.sites.map(
                (site) => (
                  <option
                    key={site.id}
                    value={site.id}
                  >
                    {site.code} —{' '}
                    {site.name}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              {t(
                'Department (မဖြစ်မနေ မဟုတ်)',
                'Department (Optional)'
              )}
            </div>

            <select
              value={
                workCenterForm.departmentId
              }
              disabled={working}
              onChange={(event) =>
                setWorkCenterForm(
                  (current) => ({
                    ...current,
                    departmentId:
                      event.target.value,
                  })
                )
              }
              className="w-full rounded-xl border p-3 font-bold bg-white"
            >
              <option value="">
                —
              </option>

              {departmentsForSite.map(
                (department) => (
                  <option
                    key={department.id}
                    value={department.id}
                  >
                    {department.code} —{' '}
                    {department.name}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Code *
              </div>

              <input
                value={
                  workCenterForm.code
                }
                disabled={working}
                onChange={(event) =>
                  setWorkCenterForm(
                    (current) => ({
                      ...current,
                      code:
                        event.target.value,
                    })
                  )
                }
                placeholder="FRYING"
                className="w-full rounded-xl border p-3 font-bold uppercase"
              />
            </label>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Name *
              </div>

              <input
                value={
                  workCenterForm.name
                }
                disabled={working}
                onChange={(event) =>
                  setWorkCenterForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="Frying Area"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={
              working ||
              !workCenterForm.siteId
            }
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
          >
            {working
              ? t(
                  'သိမ်းဆည်းနေသည်...',
                  'Saving...'
                )
              : workCenterForm.id
                ? t(
                    'ပြင်ဆင်မှု သိမ်းမည်',
                    'Save Changes'
                  )
                : t(
                    'Work Center ဖန်တီးမည်',
                    'Create Work Center'
                  )}
          </button>
        </form>

        <form
          onSubmit={handleLineSave}
          className="rounded-2xl border bg-white p-5 space-y-4"
        >
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-black text-slate-800">
                🏭{' '}
                {lineForm.id
                  ? t(
                      'Production Line ပြင်ဆင်ရန်',
                      'Edit Production Line'
                    )
                  : t(
                      'Production Line အသစ်',
                      'New Production Line'
                    )}
              </div>

              <div className="text-xs font-bold text-slate-400 mt-1">
                {t(
                  'Work Center အောက်ရှိ အမှန်တကယ်ထုတ်လုပ်သည့် Line',
                  'Operational line assigned to a Work Center'
                )}
              </div>
            </div>

            {lineForm.id && (
              <button
                type="button"
                onClick={resetLineForm}
                className="text-xs font-black text-slate-500 underline"
              >
                {t(
                  'မလုပ်တော့ပါ',
                  'Cancel'
                )}
              </button>
            )}
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              Work Center *
            </div>

            <select
              value={
                lineForm.workCenterId
              }
              disabled={
                working ||
                Boolean(lineForm.id)
              }
              onChange={(event) => {
                const selected =
                  workCentersById.get(
                    event.target.value
                  );

                setLineForm(
                  (current) => ({
                    ...current,
                    workCenterId:
                      event.target.value,
                    siteId:
                      selected?.site_id ||
                      '',
                  })
                );
              }}
              className="w-full rounded-xl border p-3 font-bold bg-white disabled:bg-slate-100"
            >
              <option value="">
                {t(
                  'Work Center ရွေးပါ',
                  'Select Work Center'
                )}
              </option>

              {snapshot.workCenters.map(
                (workCenter) => (
                  <option
                    key={workCenter.id}
                    value={workCenter.id}
                  >
                    {workCenter.code} —{' '}
                    {workCenter.name}
                  </option>
                )
              )}
            </select>
          </label>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Code *
              </div>

              <input
                value={lineForm.code}
                disabled={working}
                onChange={(event) =>
                  setLineForm(
                    (current) => ({
                      ...current,
                      code:
                        event.target.value,
                    })
                  )
                }
                placeholder="FRY-01"
                className="w-full rounded-xl border p-3 font-bold uppercase"
              />
            </label>

            <label className="block">
              <div className="text-xs font-black text-slate-500 mb-1">
                Name *
              </div>

              <input
                value={lineForm.name}
                disabled={working}
                onChange={(event) =>
                  setLineForm(
                    (current) => ({
                      ...current,
                      name:
                        event.target.value,
                    })
                  )
                }
                placeholder="Frying Line 1"
                className="w-full rounded-xl border p-3 font-bold"
              />
            </label>
          </div>

          <label className="block">
            <div className="text-xs font-black text-slate-500 mb-1">
              {t(
                'Capacity / Hour (မဖြစ်မနေ မဟုတ်)',
                'Capacity / Hour (Optional)'
              )}
            </div>

            <input
              type="number"
              min="0.000001"
              step="any"
              value={
                lineForm.capacityPerHour
              }
              disabled={working}
              onChange={(event) =>
                setLineForm(
                  (current) => ({
                    ...current,
                    capacityPerHour:
                      event.target.value,
                  })
                )
              }
              placeholder="100"
              className="w-full rounded-xl border p-3 font-bold"
            />
          </label>

          <button
            type="submit"
            disabled={
              working ||
              !lineForm.workCenterId
            }
            className="w-full rounded-xl bg-orange-500 px-4 py-3 font-black text-white disabled:opacity-50"
          >
            {working
              ? t(
                  'သိမ်းဆည်းနေသည်...',
                  'Saving...'
                )
              : lineForm.id
                ? t(
                    'ပြင်ဆင်မှု သိမ်းမည်',
                    'Save Changes'
                  )
                : t(
                    'Production Line ဖန်တီးမည်',
                    'Create Production Line'
                  )}
          </button>
        </form>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-4 border-b font-black text-slate-800">
          ⚙️ Work Centers
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">
                  Site
                </th>
                <th className="text-left p-3">
                  Code
                </th>
                <th className="text-left p-3">
                  Name
                </th>
                <th className="text-left p-3">
                  Department
                </th>
                <th className="text-left p-3">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {snapshot.workCenters.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t"
                  >
                    <td className="p-3">
                      {sitesById.get(
                        item.site_id
                      )?.code || '—'}
                    </td>

                    <td className="p-3 font-bold">
                      {item.code}
                    </td>

                    <td className="p-3">
                      {item.name}
                    </td>

                    <td className="p-3">
                      {item.department_id
                        ? departmentsById.get(
                            item.department_id
                          )?.name || '—'
                        : '—'}
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          resetMessages();

                          setWorkCenterForm({
                            id: item.id,
                            siteId:
                              item.site_id,
                            departmentId:
                              item.department_id ||
                              '',
                            code: item.code,
                            name: item.name,
                          });
                        }}
                        className="font-black text-blue-600 hover:underline"
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                )
              )}

              {snapshot.workCenters.length ===
                0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center font-bold text-slate-400"
                  >
                    {t(
                      'Work Center မရှိသေးပါ။',
                      'No Work Centers configured yet.'
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-2xl border bg-white overflow-hidden">
        <div className="p-4 border-b font-black text-slate-800">
          🏭 Production Lines
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left p-3">
                  Work Center
                </th>
                <th className="text-left p-3">
                  Code
                </th>
                <th className="text-left p-3">
                  Name
                </th>
                <th className="text-left p-3">
                  Capacity / Hour
                </th>
                <th className="text-left p-3">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {snapshot.productionLines.map(
                (item) => (
                  <tr
                    key={item.id}
                    className="border-t"
                  >
                    <td className="p-3">
                      {item.work_center_id
                        ? workCentersById.get(
                            item.work_center_id
                          )?.code || '—'
                        : '—'}
                    </td>

                    <td className="p-3 font-bold">
                      {item.code}
                    </td>

                    <td className="p-3">
                      {item.name}
                    </td>

                    <td className="p-3">
                      {item.capacity_per_hour ??
                        '—'}
                    </td>

                    <td className="p-3">
                      <button
                        type="button"
                        disabled={working}
                        onClick={() => {
                          resetMessages();

                          setLineForm({
                            id: item.id,
                            siteId:
                              item.site_id,
                            workCenterId:
                              item.work_center_id ||
                              '',
                            code: item.code,
                            name: item.name,
                            capacityPerHour:
                              item.capacity_per_hour ===
                              null
                                ? ''
                                : String(
                                    item.capacity_per_hour
                                  ),
                          });
                        }}
                        className="font-black text-blue-600 hover:underline"
                      >
                        ✏️ Edit
                      </button>
                    </td>
                  </tr>
                )
              )}

              {snapshot.productionLines.length ===
                0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="p-8 text-center font-bold text-slate-400"
                  >
                    {t(
                      'Production Line မရှိသေးပါ။',
                      'No Production Lines configured yet.'
                    )}
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
