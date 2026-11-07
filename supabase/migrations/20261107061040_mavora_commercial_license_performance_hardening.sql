-- =========================================================
-- MAVORA ERP
-- Phase 10B — Commercial License Performance Hardening
--
-- Purpose:
--   Cover the four foreign-key paths introduced by M40
--   reported by the Supabase performance advisor.
--
-- No business logic changes.
-- No license semantics changes.
-- M40 remains immutable.
-- =========================================================


create index if not exists
product_features_module_code_idx
on app_private.product_features (
  module_code
);


create index if not exists
edition_features_feature_code_idx
on app_private.edition_features (
  feature_code
);


create index if not exists
tenant_licenses_created_by_idx
on app_private.tenant_licenses (
  created_by
);


create index if not exists
tenant_feature_entitlements_created_by_idx
on app_private.tenant_feature_entitlements (
  created_by
);


-- =========================================================
-- END M41
-- =========================================================
