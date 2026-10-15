# MAVORA Security Architecture

## Identity
Supabase Auth is the source of authenticated user identity.

## Authorization
Authorization model:

User
-> Profile
-> Tenant Membership
-> Role Assignment
-> Role
-> Capability

## Scope
Authorization may be scoped by:
- Tenant
- Site
- Warehouse
- Production Line

## Database Security
Row Level Security must enforce tenant isolation.

UI visibility is not considered a security control.

## Auditability
Sensitive actions must record:
- tenant
- site where applicable
- actor
- action
- entity
- before data
- after data
- reason where required
- timestamp

## Secrets
- No plaintext application passwords.
- No service-role keys in frontend code.
- Environment credentials must be isolated between Development, Staging, and Production.

## Transaction Integrity
- Draft records may be deleted where appropriate.
- Approved records should be voided.
- Posted accounting records should use reversal entries.
- Inventory movements should use counter-movements.
- Completed production records require controlled reversal.
