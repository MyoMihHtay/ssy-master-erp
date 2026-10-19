-- MAVORA Manufacturing ERP
-- Migration 007
-- Access Privilege Hardening
--
-- Purpose:
--   1. Remove Supabase broad default table privileges from application roles.
--   2. Keep RLS as the row-level authorization layer.
--   3. Add SQL GRANT as a second least-privilege layer.
--   4. Prevent future public tables/functions from receiving broad app-role
--      privileges automatically.
--
-- IMPORTANT:
--   - service_role is intentionally untouched.
--   - RLS policies are intentionally unchanged.
--   - No business data is modified.

-- =========================================================
-- 1. REMOVE BROAD EXISTING TABLE / SEQUENCE PRIVILEGES
-- =========================================================

revoke all privileges
on all tables in schema public
from public, anon, authenticated;

revoke all privileges
on all sequences in schema public
from public, anon, authenticated;

-- =========================================================
-- 2. AUTHENTICATED — READ-ONLY TABLES
-- =========================================================
-- These tables currently have SELECT-only RLS policies.

grant select
on table
  public.audit_logs,
  public.capabilities,
  public.inventory_balances,
  public.inventory_movements,
  public.organizations,
  public.platform_modules,
  public.tenants
to authenticated;

-- =========================================================
-- 3. AUTHENTICATED — SELECT + UPDATE
-- =========================================================
-- INSERT / DELETE remain unavailable at the SQL privilege layer.

grant select, update
on table
  public.profiles,
  public.tenant_modules,
  public.tenant_settings
to authenticated;

-- =========================================================
-- 4. AUTHENTICATED — SELECT + INSERT + UPDATE
-- =========================================================
-- DELETE remains unavailable.
-- RLS capability policies still decide which rows/actions are allowed.

grant select, insert, update
on table
  public.departments,
  public.expense_categories,
  public.inventory_lots,
  public.positions,
  public.product_categories,
  public.production_lines,
  public.products,
  public.roles,
  public.sites,
  public.tenant_memberships,
  public.unit_conversions,
  public.units,
  public.warehouses,
  public.work_centers
to authenticated;

-- =========================================================
-- 5. AUTHENTICATED — SELECT + INSERT + DELETE
-- =========================================================
-- These are assignment/link tables whose current RLS model uses
-- controlled add/remove operations rather than direct UPDATE.

grant select, insert, delete
on table
  public.membership_sites,
  public.membership_warehouse_access,
  public.role_assignments,
  public.role_capabilities
to authenticated;

-- =========================================================
-- 6. FUTURE TABLE / SEQUENCE DEFAULTS
-- =========================================================
-- New objects created by postgres in public must NOT automatically
-- become accessible to anon/authenticated.
--
-- Future migrations must explicitly GRANT the minimum required
-- privileges after RLS/policies are defined.

alter default privileges
for role postgres
in schema public
revoke all privileges on tables
from public, anon, authenticated;

alter default privileges
for role postgres
in schema public
revoke all privileges on sequences
from public, anon, authenticated;

-- =========================================================
-- 7. EXISTING PUBLIC FUNCTION PRIVILEGES
-- =========================================================
-- Current public-schema functions are not client RPC endpoints.
-- Remove broad EXECUTE from application/public roles.
-- Function owners/service_role behavior is not changed.

revoke execute
on all functions in schema public
from public, anon, authenticated;

-- =========================================================
-- 8. FUTURE FUNCTION DEFAULTS
-- =========================================================
-- PostgreSQL normally grants EXECUTE on new functions to PUBLIC.
-- Remove that default for future public-schema functions.
--
-- Migration 008 inventory posting functions will explicitly grant
-- EXECUTE only to the intended role(s).

alter default privileges
for role postgres
in schema public
revoke execute on functions
from public, anon, authenticated;

