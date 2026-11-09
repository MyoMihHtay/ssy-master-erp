-- =========================================================
-- MAVORA ERP
-- Phase 10C-2D — Secure Multi-Tenant Team Workspace
--
-- MRS Workspace feature parity, translated to MAVORA-native:
--   • UUID tenant architecture
--   • tenant_memberships
--   • role_assignments / OWNER role
--   • active commercial license enforcement
--   • individual workspace permissions
--   • private image/audio storage
--   • signed URL compatible storage
--   • server-side create/edit/delete enforcement
--   • cross-tenant isolation
--
-- Shared by:
--   MAVORA Production
--   MAVORA Manufacturing Pro
--
-- No legacy MRS tables are modified.
-- =========================================================


-- =========================================================
-- 1. WORKSPACE POSTS
-- =========================================================

create table if not exists public.workspace_posts (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  sender_user_id uuid not null
    references auth.users(id)
    on delete restrict,

  sender_name text not null,

  sender_role text not null
    default 'MEMBER',

  post_type text not null
    default 'general',

  content text,

  photo_url text,

  audio_url text,

  is_sensitive boolean not null
    default false,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint workspace_posts_content_check
    check (
      nullif(btrim(coalesce(content, '')), '') is not null
      or photo_url is not null
      or audio_url is not null
    )
);


create index if not exists
workspace_posts_tenant_created_idx
on public.workspace_posts (
  tenant_id,
  created_at
);


create index if not exists
workspace_posts_tenant_sender_idx
on public.workspace_posts (
  tenant_id,
  sender_user_id,
  created_at
);


-- =========================================================
-- 2. INDIVIDUAL WORKSPACE ACCESS
-- =========================================================

create table if not exists public.workspace_user_access (
  id uuid primary key
    default gen_random_uuid(),

  tenant_id uuid not null
    references public.tenants(id)
    on delete cascade,

  user_id uuid not null
    references auth.users(id)
    on delete cascade,

  access_level text not null
    default 'blocked',

  can_view boolean not null
    default false,

  can_send boolean not null
    default false,

  can_upload boolean not null
    default false,

  can_delete_own boolean not null
    default false,

  can_delete_others boolean not null
    default false,

  can_view_sensitive boolean not null
    default false,

  -- Kept for MRS UI parity.
  -- MAVORA never delegates this permission:
  -- OWNER remains the Master Workspace Owner.
  can_manage_members boolean not null
    default false,

  note text,

  updated_by uuid
    references auth.users(id)
    on delete set null,

  created_at timestamptz not null
    default now(),

  updated_at timestamptz not null
    default now(),

  constraint workspace_user_access_level_check
    check (
      access_level in (
        'full',
        'read_only',
        'restricted',
        'blocked',
        'custom'
      )
    ),

  constraint workspace_user_access_tenant_user_uidx
    unique (
      tenant_id,
      user_id
    )
);


create index if not exists
workspace_user_access_tenant_idx
on public.workspace_user_access (
  tenant_id,
  user_id
);


-- =========================================================
-- 3. MASTER WORKSPACE OWNER
-- =========================================================
-- MAVORA derives Master Workspace Owner from the tenant's
-- active OWNER role instead of storing an editable flag.
-- =========================================================

create or replace function
app_private.is_workspace_owner(
  p_tenant_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$

  select exists (
    select 1
    from public.tenant_memberships tm

    join public.role_assignments ra
      on ra.membership_id = tm.id
     and ra.tenant_id = tm.tenant_id

    join public.roles r
      on r.id = ra.role_id
     and r.tenant_id = tm.tenant_id
     and r.is_active = true

    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_user_id
      and tm.status = 'active'
      and r.code = 'OWNER'
  );

$function$;


-- =========================================================
-- 4. CENTRAL WORKSPACE PERMISSION CHECK
-- =========================================================

create or replace function
app_private.workspace_can(
  p_tenant_id uuid,
  p_permission text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_allowed boolean := false;
begin

  if auth.uid() is null
     or p_tenant_id is null
  then
    return false;
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    return false;
  end if;


  if not app_private.tenant_license_allows_access(
    p_tenant_id
  ) then
    return false;
  end if;


  if app_private.is_workspace_owner(
    p_tenant_id,
    auth.uid()
  ) then
    return true;
  end if;


  select
    case lower(
      coalesce(
        p_permission,
        ''
      )
    )

      when 'view'
        then w.can_view

      when 'send'
        then w.can_send

      when 'upload'
        then w.can_upload

      when 'delete_own'
        then w.can_delete_own

      when 'delete_others'
        then w.can_delete_others

      when 'view_sensitive'
        then w.can_view_sensitive

      -- Never delegated in MAVORA.
      when 'manage_members'
        then false

      else false

    end
  into v_allowed
  from public.workspace_user_access w
  where w.tenant_id = p_tenant_id
    and w.user_id = auth.uid()
  limit 1;


  return coalesce(
    v_allowed,
    false
  );

end;
$function$;


-- =========================================================
-- 5. MY WORKSPACE ACCESS — PRIVATE IMPLEMENTATION
-- =========================================================

create or replace function
app_private.get_my_workspace_access_impl(
  p_tenant_id uuid
)
returns table (
  auth_user_id uuid,
  tenant_id uuid,
  access_level text,

  can_view boolean,
  can_send boolean,
  can_upload boolean,
  can_delete_own boolean,
  can_delete_others boolean,
  can_view_sensitive boolean,
  can_manage_members boolean,

  is_workspace_owner boolean,

  note text,

  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
declare
  v_owner boolean;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.is_tenant_member(
    p_tenant_id
  ) then
    raise exception
      'Workspace tenant access denied';
  end if;


  if not app_private.tenant_license_allows_access(
    p_tenant_id
  ) then
    raise exception
      'MAVORA commercial license is not active';
  end if;


  v_owner :=
    app_private.is_workspace_owner(
      p_tenant_id,
      auth.uid()
    );


  return query

  select
    auth.uid(),
    p_tenant_id,

    case
      when v_owner
        then 'full'
      else
        coalesce(
          w.access_level,
          'blocked'
        )
    end,

    case
      when v_owner then true
      else coalesce(w.can_view, false)
    end,

    case
      when v_owner then true
      else coalesce(w.can_send, false)
    end,

    case
      when v_owner then true
      else coalesce(w.can_upload, false)
    end,

    case
      when v_owner then true
      else coalesce(w.can_delete_own, false)
    end,

    case
      when v_owner then true
      else coalesce(w.can_delete_others, false)
    end,

    case
      when v_owner then true
      else coalesce(w.can_view_sensitive, false)
    end,

    v_owner,

    v_owner,

    case
      when v_owner
        then 'Master Workspace Owner'
      else w.note
    end,

    w.updated_at

  from (
    select 1
  ) anchor

  left join public.workspace_user_access w
    on w.tenant_id = p_tenant_id
   and w.user_id = auth.uid();

end;
$function$;


-- =========================================================
-- 6. PUBLIC MY-ACCESS RPC
-- =========================================================

create or replace function
public.get_my_workspace_access(
  p_tenant_id uuid
)
returns table (
  auth_user_id uuid,
  tenant_id uuid,
  access_level text,

  can_view boolean,
  can_send boolean,
  can_upload boolean,
  can_delete_own boolean,
  can_delete_others boolean,
  can_view_sensitive boolean,
  can_manage_members boolean,

  is_workspace_owner boolean,

  note text,

  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$

  select *
  from app_private.get_my_workspace_access_impl(
    p_tenant_id
  );

$function$;


-- =========================================================
-- 7. ADMIN ACCESS LIST — PRIVATE IMPLEMENTATION
-- =========================================================

create or replace function
app_private.get_workspace_access_admin_impl(
  p_tenant_id uuid
)
returns table (
  auth_user_id uuid,

  email text,

  display_name text,

  user_role text,

  access_level text,

  can_view boolean,
  can_send boolean,
  can_upload boolean,
  can_delete_own boolean,
  can_delete_others boolean,
  can_view_sensitive boolean,
  can_manage_members boolean,

  is_workspace_owner boolean,

  note text,

  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $function$
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.workspace_can(
    p_tenant_id,
    'manage_members'
  ) then
    raise exception
      'Workspace permission denied';
  end if;


  return query

  select
    tm.user_id,

    au.email::text,

    coalesce(
      nullif(
        btrim(
          p.display_name
        ),
        ''
      ),
      au.email::text,
      'Workspace User'
    ),

    coalesce(
      (
        select r.code
        from public.role_assignments ra

        join public.roles r
          on r.id = ra.role_id
         and r.tenant_id = ra.tenant_id
         and r.is_active = true

        where ra.membership_id = tm.id
          and ra.tenant_id = tm.tenant_id

        order by
          case
            when r.code = 'OWNER'
              then 0
            else 1
          end,
          r.code

        limit 1
      ),
      'MEMBER'
    ),

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then 'full'
      else
        coalesce(
          w.access_level,
          'blocked'
        )
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_view, false)
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_send, false)
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_upload, false)
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_delete_own, false)
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_delete_others, false)
    end,

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then true
      else coalesce(w.can_view_sensitive, false)
    end,

    app_private.is_workspace_owner(
      p_tenant_id,
      tm.user_id
    ),

    app_private.is_workspace_owner(
      p_tenant_id,
      tm.user_id
    ),

    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then 'Master Workspace Owner'
      else w.note
    end,

    w.updated_at

  from public.tenant_memberships tm

  join auth.users au
    on au.id = tm.user_id

  left join public.profiles p
    on p.id = tm.user_id

  left join public.workspace_user_access w
    on w.tenant_id = tm.tenant_id
   and w.user_id = tm.user_id

  where tm.tenant_id = p_tenant_id
    and tm.status = 'active'

  order by
    case
      when app_private.is_workspace_owner(
        p_tenant_id,
        tm.user_id
      )
        then 0
      else 1
    end,

    coalesce(
      p.display_name,
      au.email::text
    );

end;
$function$;


-- =========================================================
-- 8. PUBLIC ADMIN ACCESS LIST RPC
-- =========================================================

create or replace function
public.get_workspace_access_admin(
  p_tenant_id uuid
)
returns table (
  auth_user_id uuid,

  email text,

  display_name text,

  user_role text,

  access_level text,

  can_view boolean,
  can_send boolean,
  can_upload boolean,
  can_delete_own boolean,
  can_delete_others boolean,
  can_view_sensitive boolean,
  can_manage_members boolean,

  is_workspace_owner boolean,

  note text,

  updated_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $function$

  select *
  from app_private.get_workspace_access_admin_impl(
    p_tenant_id
  );

$function$;


-- =========================================================
-- 9. UPDATE INDIVIDUAL ACCESS — PRIVATE IMPLEMENTATION
-- =========================================================

create or replace function
app_private.update_workspace_user_access_admin_impl(
  p_tenant_id uuid,

  p_auth_user_id uuid,

  p_access_level text,

  p_can_view boolean,
  p_can_send boolean,
  p_can_upload boolean,
  p_can_delete_own boolean,
  p_can_delete_others boolean,
  p_can_view_sensitive boolean,
  p_can_manage_members boolean,

  p_note text
)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_access_id uuid;

  v_before jsonb;

  v_after jsonb;

  v_view boolean;
  v_send boolean;
  v_upload boolean;
  v_delete_own boolean;
  v_delete_others boolean;
  v_sensitive boolean;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.workspace_can(
    p_tenant_id,
    'manage_members'
  ) then
    raise exception
      'Workspace permission denied';
  end if;


  if not exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = p_tenant_id
      and tm.user_id = p_auth_user_id
      and tm.status = 'active'
  ) then
    raise exception
      'Target user is not an active tenant member';
  end if;


  if app_private.is_workspace_owner(
    p_tenant_id,
    p_auth_user_id
  ) then
    raise exception
      'Master Workspace Owner access cannot be modified';
  end if;


  if p_can_manage_members then
    raise exception
      'Manage Members permission cannot be delegated';
  end if;


  if p_access_level not in (
    'full',
    'read_only',
    'restricted',
    'blocked',
    'custom'
  ) then
    raise exception
      'Invalid Workspace access level';
  end if;


  if p_access_level = 'full' then

    v_view := true;
    v_send := true;
    v_upload := true;
    v_delete_own := true;
    v_delete_others := true;
    v_sensitive := true;

  elsif p_access_level = 'read_only' then

    v_view := true;
    v_send := false;
    v_upload := false;
    v_delete_own := false;
    v_delete_others := false;
    v_sensitive := false;

  elsif p_access_level in (
    'restricted',
    'blocked'
  ) then

    v_view := false;
    v_send := false;
    v_upload := false;
    v_delete_own := false;
    v_delete_others := false;
    v_sensitive := false;

  else

    v_view :=
      coalesce(
        p_can_view,
        false
      );

    v_send :=
      coalesce(
        p_can_send,
        false
      );

    v_upload :=
      coalesce(
        p_can_upload,
        false
      );

    v_delete_own :=
      coalesce(
        p_can_delete_own,
        false
      );

    v_delete_others :=
      coalesce(
        p_can_delete_others,
        false
      );

    v_sensitive :=
      coalesce(
        p_can_view_sensitive,
        false
      );

  end if;


  select
    to_jsonb(w)
  into
    v_before
  from public.workspace_user_access w
  where w.tenant_id = p_tenant_id
    and w.user_id = p_auth_user_id;


  insert into public.workspace_user_access (
    tenant_id,
    user_id,
    access_level,

    can_view,
    can_send,
    can_upload,
    can_delete_own,
    can_delete_others,
    can_view_sensitive,

    can_manage_members,

    note,

    updated_by,
    updated_at
  )
  values (
    p_tenant_id,
    p_auth_user_id,
    p_access_level,

    v_view,
    v_send,
    v_upload,
    v_delete_own,
    v_delete_others,
    v_sensitive,

    false,

    nullif(
      btrim(
        coalesce(
          p_note,
          ''
        )
      ),
      ''
    ),

    auth.uid(),
    now()
  )

  on conflict (
    tenant_id,
    user_id
  )

  do update
  set
    access_level =
      excluded.access_level,

    can_view =
      excluded.can_view,

    can_send =
      excluded.can_send,

    can_upload =
      excluded.can_upload,

    can_delete_own =
      excluded.can_delete_own,

    can_delete_others =
      excluded.can_delete_others,

    can_view_sensitive =
      excluded.can_view_sensitive,

    can_manage_members =
      false,

    note =
      excluded.note,

    updated_by =
      auth.uid(),

    updated_at =
      now()

  returning id
  into v_access_id;


  select
    to_jsonb(w)
  into
    v_after
  from public.workspace_user_access w
  where w.id = v_access_id;


  insert into public.audit_logs (
    tenant_id,
    site_id,
    actor_user_id,

    action,

    entity_type,
    entity_id,

    before_data,
    after_data,

    reason,

    metadata
  )
  values (
    p_tenant_id,
    null,
    auth.uid(),

    'workspace.access_update',

    'workspace_user_access',
    v_access_id,

    v_before,
    v_after,

    'Master Workspace Owner updated Workspace access.',

    jsonb_build_object(
      'target_user_id',
      p_auth_user_id,

      'access_level',
      p_access_level
    )
  );

end;
$function$;


-- =========================================================
-- 10. PUBLIC UPDATE ACCESS RPC
-- =========================================================

create or replace function
public.update_workspace_user_access_admin(
  p_tenant_id uuid,

  p_auth_user_id uuid,

  p_access_level text,

  p_can_view boolean,
  p_can_send boolean,
  p_can_upload boolean,
  p_can_delete_own boolean,
  p_can_delete_others boolean,
  p_can_view_sensitive boolean,
  p_can_manage_members boolean,

  p_note text
)
returns void
language sql
security invoker
set search_path = ''
as $function$

  select
    app_private.update_workspace_user_access_admin_impl(
      p_tenant_id,
      p_auth_user_id,
      p_access_level,

      p_can_view,
      p_can_send,
      p_can_upload,
      p_can_delete_own,
      p_can_delete_others,
      p_can_view_sensitive,
      p_can_manage_members,

      p_note
    );

$function$;


-- =========================================================
-- 11. CREATE WORKSPACE POST — PRIVATE IMPLEMENTATION
-- =========================================================

create or replace function
app_private.create_workspace_post_impl(
  p_tenant_id uuid,

  p_post_type text,

  p_content text,

  p_photo_url text
    default null,

  p_audio_url text
    default null,

  p_is_sensitive boolean
    default false
)
returns setof public.workspace_posts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_sender_name text;

  v_sender_role text;

  v_post_id uuid;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  if not app_private.workspace_can(
    p_tenant_id,
    'send'
  ) then
    raise exception
      'Workspace send permission denied';
  end if;


  if (
    nullif(
      btrim(
        coalesce(
          p_content,
          ''
        )
      ),
      ''
    ) is null

    and p_photo_url is null

    and p_audio_url is null
  ) then
    raise exception
      'Message content or attachment is required';
  end if;


  if (
    p_photo_url is not null
    or p_audio_url is not null
  )
  and not app_private.workspace_can(
    p_tenant_id,
    'upload'
  )
  then
    raise exception
      'Workspace upload permission denied';
  end if;


  if p_photo_url is not null
     and p_photo_url not like 'secure:%'
  then
    raise exception
      'Workspace image must use secure storage';
  end if;


  if p_audio_url is not null
     and p_audio_url not like 'secure:%'
  then
    raise exception
      'Workspace audio must use secure storage';
  end if;


  if coalesce(
    p_is_sensitive,
    false
  )
  and not app_private.workspace_can(
    p_tenant_id,
    'view_sensitive'
  )
  then
    raise exception
      'Sensitive Workspace permission denied';
  end if;


  select
    coalesce(
      nullif(
        btrim(
          p.display_name
        ),
        ''
      ),
      nullif(
        auth.jwt() ->> 'email',
        ''
      ),
      'Workspace User'
    )
  into
    v_sender_name
  from public.profiles p
  where p.id = auth.uid();


  v_sender_name :=
    coalesce(
      v_sender_name,
      nullif(
        auth.jwt() ->> 'email',
        ''
      ),
      'Workspace User'
    );


  select
    r.code
  into
    v_sender_role

  from public.tenant_memberships tm

  join public.role_assignments ra
    on ra.membership_id = tm.id
   and ra.tenant_id = tm.tenant_id

  join public.roles r
    on r.id = ra.role_id
   and r.tenant_id = tm.tenant_id
   and r.is_active = true

  where tm.tenant_id = p_tenant_id
    and tm.user_id = auth.uid()
    and tm.status = 'active'

  order by
    case
      when r.code = 'OWNER'
        then 0
      else 1
    end,
    r.code

  limit 1;


  v_sender_role :=
    coalesce(
      v_sender_role,
      'MEMBER'
    );


  insert into public.workspace_posts (
    tenant_id,

    sender_user_id,
    sender_name,
    sender_role,

    post_type,

    content,

    photo_url,
    audio_url,

    is_sensitive
  )
  values (
    p_tenant_id,

    auth.uid(),
    v_sender_name,
    v_sender_role,

    coalesce(
      nullif(
        btrim(
          p_post_type
        ),
        ''
      ),
      'general'
    ),

    nullif(
      btrim(
        coalesce(
          p_content,
          ''
        )
      ),
      ''
    ),

    p_photo_url,
    p_audio_url,

    coalesce(
      p_is_sensitive,
      false
    )
  )

  returning id
  into v_post_id;


  return query

  select wp.*
  from public.workspace_posts wp
  where wp.id = v_post_id;

end;
$function$;


-- =========================================================
-- 12. PUBLIC CREATE WORKSPACE POST RPC
-- =========================================================

create or replace function
public.create_workspace_post_secure(
  p_tenant_id uuid,

  p_post_type text,

  p_content text,

  p_photo_url text
    default null,

  p_audio_url text
    default null,

  p_is_sensitive boolean
    default false
)
returns setof public.workspace_posts
language sql
security invoker
set search_path = ''
as $function$

  select *
  from app_private.create_workspace_post_impl(
    p_tenant_id,

    p_post_type,

    p_content,

    p_photo_url,
    p_audio_url,

    p_is_sensitive
  );

$function$;


-- =========================================================
-- 13. UPDATE OWN WORKSPACE POST
-- =========================================================

create or replace function
app_private.update_workspace_post_impl(
  p_post_id uuid,

  p_content text
)
returns setof public.workspace_posts
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;

  v_sender_user_id uuid;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  select
    wp.tenant_id,
    wp.sender_user_id
  into
    v_tenant_id,
    v_sender_user_id
  from public.workspace_posts wp
  where wp.id = p_post_id;


  if not found then
    raise exception
      'Workspace message not found';
  end if;


  if v_sender_user_id
     is distinct from auth.uid()
  then
    raise exception
      'Only the authenticated sender can edit this message';
  end if;


  if not app_private.workspace_can(
    v_tenant_id,
    'send'
  ) then
    raise exception
      'Workspace edit permission denied';
  end if;


  if nullif(
    btrim(
      coalesce(
        p_content,
        ''
      )
    ),
    ''
  ) is null
  then
    raise exception
      'Message content cannot be empty';
  end if;


  update public.workspace_posts wp
  set
    content =
      btrim(
        p_content
      ),

    updated_at =
      now()

  where wp.id = p_post_id;


  return query

  select wp.*
  from public.workspace_posts wp
  where wp.id = p_post_id;

end;
$function$;


create or replace function
public.update_workspace_post_secure(
  p_post_id uuid,

  p_content text
)
returns setof public.workspace_posts
language sql
security invoker
set search_path = ''
as $function$

  select *
  from app_private.update_workspace_post_impl(
    p_post_id,
    p_content
  );

$function$;


-- =========================================================
-- 14. DELETE WORKSPACE POST
-- =========================================================

create or replace function
app_private.delete_workspace_post_impl(
  p_post_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_tenant_id uuid;

  v_sender_user_id uuid;

  v_is_own boolean;
begin

  if auth.uid() is null then
    raise exception
      'Authentication required';
  end if;


  select
    wp.tenant_id,
    wp.sender_user_id
  into
    v_tenant_id,
    v_sender_user_id

  from public.workspace_posts wp

  where wp.id = p_post_id;


  if not found then
    raise exception
      'Workspace message not found';
  end if;


  v_is_own :=
    (
      v_sender_user_id
      = auth.uid()
    );


  if v_is_own then

    if not app_private.workspace_can(
      v_tenant_id,
      'delete_own'
    ) then
      raise exception
        'Delete-own Workspace permission denied';
    end if;

  else

    if not app_private.workspace_can(
      v_tenant_id,
      'delete_others'
    ) then
      raise exception
        'Delete-other Workspace permission denied';
    end if;

  end if;


  delete from public.workspace_posts wp
  where wp.id = p_post_id;


  return true;

end;
$function$;


create or replace function
public.delete_workspace_post_secure(
  p_post_id uuid
)
returns boolean
language sql
security invoker
set search_path = ''
as $function$

  select
    app_private.delete_workspace_post_impl(
      p_post_id
    );

$function$;


-- =========================================================
-- 15. TABLE SECURITY
-- =========================================================

alter table
public.workspace_posts
enable row level security;


alter table
public.workspace_user_access
enable row level security;


revoke all
on public.workspace_posts
from public, anon, authenticated;


revoke all
on public.workspace_user_access
from public, anon, authenticated;


grant select
on public.workspace_posts
to authenticated;


drop policy if exists
workspace_posts_individual_select
on public.workspace_posts;


create policy
workspace_posts_individual_select
on public.workspace_posts

for select
to authenticated

using (
  app_private.workspace_can(
    tenant_id,
    'view'
  )

  and (
    coalesce(
      is_sensitive,
      false
    ) = false

    or app_private.workspace_can(
      tenant_id,
      'view_sensitive'
    )
  )
);


-- =========================================================
-- 16. PRIVATE STORAGE BUCKET
-- =========================================================

insert into storage.buckets (
  id,

  name,

  public,

  file_size_limit,

  allowed_mime_types
)
values (
  'workspace-secure-files',

  'workspace-secure-files',

  false,

  26214400,

  array[
    'image/*',
    'audio/*'
  ]::text[]
)

on conflict (id)

do update
set
  public = false,

  file_size_limit =
    excluded.file_size_limit,

  allowed_mime_types =
    excluded.allowed_mime_types;


-- =========================================================
-- 17. STORAGE RLS
-- Path:
--   tenant_uuid/general|sensitive/auth_user_uuid/file
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

  and exists (
    select 1
    from public.tenants t

    where t.id::text =
      split_part(
        name,
        '/',
        1
      )

      and app_private.workspace_can(
        t.id,
        'view'
      )

      and (
        split_part(
          name,
          '/',
          2
        ) <> 'sensitive'

        or app_private.workspace_can(
          t.id,
          'view_sensitive'
        )
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

  and exists (
    select 1
    from public.tenants t

    where t.id::text =
      split_part(
        name,
        '/',
        1
      )

      and app_private.workspace_can(
        t.id,
        'upload'
      )

      and (
        split_part(
          name,
          '/',
          2
        ) = 'general'

        or (
          split_part(
            name,
            '/',
            2
          ) = 'sensitive'

          and app_private.workspace_can(
            t.id,
            'view_sensitive'
          )
        )
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

  and exists (
    select 1
    from public.tenants t

    where t.id::text =
      split_part(
        name,
        '/',
        1
      )

      and (
        (
          split_part(
            name,
            '/',
            3
          ) = auth.uid()::text

          and app_private.workspace_can(
            t.id,
            'delete_own'
          )
        )

        or app_private.workspace_can(
          t.id,
          'delete_others'
        )
      )
  )
);


-- =========================================================
-- 18. PRIVATE FUNCTION PRIVILEGES
-- =========================================================

revoke all
on function
app_private.is_workspace_owner(uuid, uuid)
from public, anon, authenticated;


revoke all
on function
app_private.workspace_can(uuid, text)
from public, anon;


revoke all
on function
app_private.get_my_workspace_access_impl(uuid)
from public, anon;


revoke all
on function
app_private.get_workspace_access_admin_impl(uuid)
from public, anon;


revoke all
on function
app_private.update_workspace_user_access_admin_impl(
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
from public, anon;


revoke all
on function
app_private.create_workspace_post_impl(
  uuid,
  text,
  text,
  text,
  text,
  boolean
)
from public, anon;


revoke all
on function
app_private.update_workspace_post_impl(
  uuid,
  text
)
from public, anon;


revoke all
on function
app_private.delete_workspace_post_impl(uuid)
from public, anon;


grant execute
on function
app_private.workspace_can(uuid, text)
to authenticated, service_role;


grant execute
on function
app_private.get_my_workspace_access_impl(uuid)
to authenticated, service_role;


grant execute
on function
app_private.get_workspace_access_admin_impl(uuid)
to authenticated, service_role;


grant execute
on function
app_private.update_workspace_user_access_admin_impl(
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
to authenticated, service_role;


grant execute
on function
app_private.create_workspace_post_impl(
  uuid,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;


grant execute
on function
app_private.update_workspace_post_impl(
  uuid,
  text
)
to authenticated, service_role;


grant execute
on function
app_private.delete_workspace_post_impl(uuid)
to authenticated, service_role;


-- =========================================================
-- 19. PUBLIC RPC PRIVILEGES
-- =========================================================

revoke all
on function
public.get_my_workspace_access(uuid)
from public, anon;


revoke all
on function
public.get_workspace_access_admin(uuid)
from public, anon;


revoke all
on function
public.update_workspace_user_access_admin(
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
from public, anon;


revoke all
on function
public.create_workspace_post_secure(
  uuid,
  text,
  text,
  text,
  text,
  boolean
)
from public, anon;


revoke all
on function
public.update_workspace_post_secure(
  uuid,
  text
)
from public, anon;


revoke all
on function
public.delete_workspace_post_secure(uuid)
from public, anon;


grant execute
on function
public.get_my_workspace_access(uuid)
to authenticated, service_role;


grant execute
on function
public.get_workspace_access_admin(uuid)
to authenticated, service_role;


grant execute
on function
public.update_workspace_user_access_admin(
  uuid,
  uuid,
  text,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  boolean,
  text
)
to authenticated, service_role;


grant execute
on function
public.create_workspace_post_secure(
  uuid,
  text,
  text,
  text,
  text,
  boolean
)
to authenticated, service_role;


grant execute
on function
public.update_workspace_post_secure(
  uuid,
  text
)
to authenticated, service_role;


grant execute
on function
public.delete_workspace_post_secure(uuid)
to authenticated, service_role;


-- =========================================================
-- 20. SECURITY NOTES
-- =========================================================
-- • No anon Workspace access.
-- • No direct authenticated INSERT/UPDATE/DELETE on posts.
-- • Workspace access changes are RPC-only.
-- • Master Workspace Owner derives from OWNER role.
-- • Manage Members cannot be delegated.
-- • Commercial license must be active.
-- • Non-owner users default to BLOCKED until Owner approval.
-- • Storage bucket is PRIVATE.
-- • Storage path includes tenant UUID + authenticated user UUID.
-- • Production and Manufacturing Pro share this Workspace.
-- =========================================================
