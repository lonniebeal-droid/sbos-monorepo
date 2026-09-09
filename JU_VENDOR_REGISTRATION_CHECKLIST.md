JU Vendor Registration Checklist
================================

This checklist distinguishes what can be completed by code/configuration vs.
what requires owner signature, vendor account approval, payment, BAA execution,
submitter IDs, payer IDs, MFA, or credentials.

==========================================================================
PROVIDER-NEUTRAL CONNECTOR SETUP (Code-Completable)
==========================================================================

☐ 1. Create vendor profile in SBOS admin panel
    - Select vendor from dropdown (SimplePractice, Epic, athenahealth, Cerner, eClinicalWorks, NextGen, Veradigm, Generic SMART on FHIR R4, Generic HL7 v2, Availity, Change Healthcare, Generic X12)
    - Base URL field (e.g., https://api.simplepractice.com)
    - Tenant/organization identifier field
    - Practice/client ID field (vendor-specific)
    - Scope selector (SMART on FHIR scopes, OAuth 2.0 grants)

☐ 2. Configure base URL / tenant / practice identifiers
    - Code: environment placeholder pattern (no hard-coded secrets)
    - UI: admin form with validation
    - Storage: encrypted at rest, per-tenant isolation

☐ 3. OAuth / SMART authoriaztion initiation
    - Code: generate authorization URL with least-privilege scopes
    - Code: handle OAuth callback and token exchange
    - Code: token refresh using refresh tokens
    - Code: token revocation on disconnect
    - NOTE: Client secret must be entered by admin via UI, not committed to git

☐ 4. Test connectivity without PHI
    - Code: synthetic health-check endpoint (GET /health)
    - Code: validate credentials against vendor sandbox (no real patient data)
    - UI: "Test Connection" button that returns success/failure truthfully

☐ 5. Sync permitted SYNTHETIC resources in test/demo mode
    - Code: generate synthetic patient/appointment/claim records
    - Code: map vendor-specific fields to SBOS internal model
    - UI: "Sync Synthetic Data" button for demo purposes only

☐ 6. See health, last sync, errors, retry guidance
    - Code: audit log entries per connector action
    - UI: connector status panel showing lastSyncAt, error count, retry count
    - Code: exponential backoff on transient failures

☐ 7. Reconnect / revoke / disconnect
    - Code: revoke OAuth tokens at provider endpoint (if supported)
    - Code: clear stored credentials on disconnect
    - UI: "Reconnect" and "Disconnect" buttons
    - Audit: record revoke/disconnect event

==========================================================================
VENDOR-SPECIFIC REGISTRATION GATES (Owner/External)
==========================================================================

☐ 8. Vendor account approval
    - Owner must register with vendor (SimplePractice partner program, etc.)
    - Obtain vendor-specific client ID and client secret
    - Sign vendor terms of use / developer agreement
    - ❌ Code cannot complete this; requires human gate

☐ 9. MFA and credential management
    - Some vendors require MFA for OAuth flows
    - Owner/authorized user must complete MFA in vendor portal
    - Code: support MFA callback where vendor API requires it
    - ❌ Code can scaffold; MFA completion is an owner gate

☐ 10. Scope verification
    - Verify required OAuth scopes are granted (patient/claims/records)
    - Code: scope checklist in admin UI
    - ❌ Vendor portal gates which scopes are available

☐ 11. Redirect/callback URL configuration
    - Owner must configure vendor OAuth redirect URI to match SBOS
    - Code: provide the redirect URL pattern for admin to copy
    - ❌ Owner configures in vendor portal

==========================================================================
CLEARINGHOUSE ENROLLMENT (Code-Completable + External Gates)
==========================================================================

☐ 12. Availity account setup
    - Owner registers at https://developer.availity.com
    - Obtain Availity client ID and client secret
    - ❌ Code can integrate once credentials are obtained; enrollment is owner gate

☐ 13. Change Healthcare / Optum account setup
    - Owner enrolls at Change Healthcare developer portal
    - Obtain partner credentials and testing environment access
    - ❌ Code can integrate once credentials are obtained; enrollment is owner gate

☐ 14. Generic X12 transport configuration
    - Code: X12 message generation/parsing library (included)
    - UI: configure base address, authentication (if any)
    - ❌ No external enrollment needed; pure code component

☐ 15. Payer submitter IDs
    - Owner obtains submitter ID from each payer billed
    - Code: store payer submitterId in Payer reference data model
    - UI: payer lookup and submitter ID entry field
    - ❌ Payer-specific; owner must obtain from each payer

☐ 16. Payer payer IDs
    - Owner obtains payer ID from each insurance plan
    - Code: store in Payer model as payerId field
    - UI: payer edit form includes payerId field
    - ❌ Payer-specific; owner must obtain from each payer

==========================================================================
BAA AND LEGAL (Owner Signature Required)
==========================================================================

☐ 17. Business Associate Agreement (BAA)
    - ❌ REQUIRED: Executed BAA with each vendor that receives/processes PHI
    - Code cannot execute a BAA; legal owner signature required
    - Document which vendors have BAAs executed in JU_BAA_VENDOR_MATRIX.md

☐ 18. HIPAA compliance confirmation
    - ❌ Code cannot certify compliance; owner must verify vendor HIPAA status
    - Cross-reference with JU_BAA_VENDOR_MATRIX.md

☐ 19. Submitter IDs and Payer IDs
    - ❌ Listed above in clearinghouse section
    - Owner collects and enters each payer's unique identifiers

==========================================================================
SUMMARY: Code-Completable vs Owner/External Gates
==========================================================================

Code-completable (SBOS can deliver without external vendor approval):
  ☐ Vendor profile creation + config UI
  ☐ Base URL / tenant / practice identifier configuration
  ☐ OAuth/SMART authorization state machine (code exchange, refresh, revoke)
  ☐ Synthetic connectivity testing (no PHI)
  ☐ Synthetic resource sync in demo mode
  ☐ Health, last sync, errors, retry guidance display
  ☐ Reconnect / revoke / disconnect flows
  ☐ Tenant isolation and audit logging
  ☐ Generic X12 transport generation/parsing
  ☐ X12 transaction family generation (270/271, 837P, 276/277, 835)
  ☐ Vendor capability flag mapping

Owner / External vendor gates (require human action):
  ☐ Vendor account registration and approval
  ☐ Client ID / client secret acquisition
  ☐ MFA completion in vendor portals
  ☐ BAA execution
  ☐ Payer submitter IDs acquisition
  ☐ Payer payer IDs acquisition
  ☐ HIPAA compliance confirmation
  ☐ Vendor terms of use / developer agreement signing
  ☐ Redirect URL configuration in vendor portals