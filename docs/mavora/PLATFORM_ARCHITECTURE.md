# MAVORA Manufacturing ERP
## Smart Factory Management Platform

### Platform Architecture
MAVORA is designed as a multi-tenant manufacturing ERP platform.

Hierarchy:

MAVORA Platform
- Organization
  - Tenant / Company
    - Site / Factory / Branch
      - Department
      - Warehouse
      - Work Center
      - Production Line
    - Users
      - Tenant Membership
        - Roles
          - Capabilities

### Core Principles
1. Every tenant-owned business record must contain tenant_id.
2. Site-specific records must contain site_id.
3. Authentication uses Supabase Auth.
4. Passwords must never be stored in application tables.
5. Authorization uses Role -> Capability -> Scope.
6. RLS is the database security boundary.
7. Tenant isolation must be enforced at database level.
8. Approved transactions are reversed or voided, not silently deleted.
9. Sensitive actions must be auditable.
10. Sat Sat Yo is the first MAVORA tenant, not the platform itself.

### Platform Brand
MAVORA Manufacturing ERP

Tagline:
Smart Factory Management Platform
