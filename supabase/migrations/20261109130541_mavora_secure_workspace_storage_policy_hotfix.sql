-- =========================================================
-- MAVORA ERP
-- Phase 10C-2E3 — Secure Workspace Storage Policy Hotfix
--
-- Fixes:
--   1. storage.objects.name shadowing inside tenant subqueries
--   2. missing Workspace foreign-key covering indexes
--   3. explicit deny-all direct access policy for
--      workspace_user_access (RPC-only table)
--
-- No legacy MRS objects are modified.
-- =========================================================


-- =========================================================
-- 1. SAFE STORAGE PATH -> TENANT PERMISSION HELPER
-- =========================================================

create or replace function
app_private.workspace_can_storage_path(
  p_object_name text,
  p_permission text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select exists (
    select 1
    from public.tenants t

    where t.id::text =
      split_part(
        coalesce(
          p_object_name,
          ''
        ),
        '/',
        1
      )

      and app_private.workspace_can(
        t.id,
        p_permission
      )
  );

$function$;


revoke all
on function
app_private.workspace_can_storage_path(
  text,
  text
)
from public, anon;


grant execute
on function
app_private.workspace_can_storage_path(
  text,
  text
)
to authenticated, service_role;


-- =========================================================
-- 2. REBUILD WORKSPACE STORAGE POLICIES
-- =========================================================

drop policy if exists
workspace_secure_files_select
on storage.objects;


drop policy if exists
workspace_secure_files_insert
on storage.objects;


drop policy if exists
workspace_secure_files_delete
on storage.objects;


create policy
workspace_secure_files_select
on storage.objects

for select
to authenticated

using (
  bucket_id =
    'workspace-secure-files'

  and app_private.workspace_can_storage_path(
    name,
    'view'
  )

  and (
    split_part(
      name,
      '/',
      2
    ) <> 'sensitive'

    or app_private.workspace_can_storage_path(
      name,
      'view_sensitive'
    )
  )
);


create policy
workspace_secure_files_insert
on storage.objects

for insert
to authenticated

with check (
  bucket_id =
    'workspace-secure-files'

  and split_part(
    name,
    '/',
    3
  ) = auth.uid()::text

  and split_part(
    name,
    '/',
    2
  ) in (
    'general',
    'sensitive'
  )

  and app_private.workspace_can_storage_path(
    name,
    'upload'
  )

  and (
    split_part(
      name,
      '/',
      2
    ) = 'general'

    or app_private.workspace_can_storage_path(
      name,
      'view_sensitive'
    )
  )
);


create policy
workspace_secure_files_delete
on storage.objects

for delete
to authenticated

using (
  bucket_id =
    'workspace-secure-files'

  and (
    (
      split_part(
        name,
        '/',
        3
      ) = auth.uid()::text

      and app_private.workspace_can_storage_path(
        name,
        'delete_own'
      )
    )

    or app_private.workspace_can_storage_path(
      name,
      'delete_others'
    )
  )
);


-- =========================================================
-- 3. EXPLICIT RPC-ONLY DENY POLICY
-- =========================================================
-- workspace_user_access is intentionally not directly readable
-- or writable by browser users. Owner/admin access is through
-- controlled Workspace RPCs only.
-- =========================================================

drop policy if exists
workspace_user_access_no_direct_access
on public.workspace_user_access;


create policy
workspace_user_access_no_direct_access
on public.workspace_user_access

for all
to authenticated

using (
  false
)

with check (
  false
);


-- =========================================================
-- 4. FOREIGN-KEY COVERING INDEXES
-- =========================================================

create index if not exists
workspace_posts_sender_user_idx
on public.workspace_posts (
  sender_user_id
);


create index if not exists
workspace_user_access_user_idx
on public.workspace_user_access (
  user_id
);


create index if not exists
workspace_user_access_updated_by_idx
on public.workspace_user_access (
  updated_by
);


-- =========================================================
-- 5. SECURITY NOTES
-- =========================================================
-- Storage authorization now receives the storage object path
-- as an explicit function argument. This prevents SQL name
-- resolution from accidentally selecting public.tenants.name.
--
-- Direct workspace_user_access table access remains denied.
-- Access remains controlled through secure Workspace RPCs.
-- =========================================================
