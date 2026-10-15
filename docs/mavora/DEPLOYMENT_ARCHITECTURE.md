# MAVORA Deployment Architecture

## Environments

### Development
- Developer testing
- Synthetic/test data
- Development Supabase project
- No production data

### Staging
- Pre-production
- Migration verification
- UAT
- Security and RLS testing
- Separate Supabase project

### Production
- Live customer data
- Separate Supabase project
- Controlled migrations only
- Backup and restore point required before critical migrations

## Deployment Flow

Development
-> Build Test
-> Development Verification
-> Staging Migration
-> UAT
-> RLS/Security Verification
-> Backup / Restore Point
-> Production Migration
-> Production Deployment
-> Smoke Test

## Environment Variables

Frontend:
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_APP_ENV
- VITE_APP_NAME

Privileged keys such as Supabase service-role credentials must never be exposed in frontend code.

## Migration Policy

Database schema changes must be version-controlled as migration files.

No ad-hoc production schema changes.

No direct Development-to-Production deployment.

Legacy MRS/D-Mo/SSY production infrastructure must not be used as the MAVORA development database.
