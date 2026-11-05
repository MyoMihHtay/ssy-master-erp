-- =========================================================
-- MAVORA ERP
-- Phase 9B — Manufacturing Cost Policy Performance Hardening
--
-- Purpose:
--   Add covering indexes for the foreign keys introduced
--   by Migration 037.
--
-- Scope:
--   Performance only.
--   No business logic changes.
--   No pricing / margin semantics changes.
--   No RLS / privilege changes.
-- =========================================================


-- ---------------------------------------------------------
-- 1. PRODUCT + TENANT FK COVERING INDEX
-- ---------------------------------------------------------

create index if not exists
manufacturing_cost_policies_product_tenant_fk_idx
on public.manufacturing_cost_policies (
  product_id,
  tenant_id
);


-- ---------------------------------------------------------
-- 2. CREATED BY FK COVERING INDEX
-- ---------------------------------------------------------

create index if not exists
manufacturing_cost_policies_created_by_idx
on public.manufacturing_cost_policies (
  created_by
);


-- =========================================================
-- END MIGRATION 038
-- =========================================================
