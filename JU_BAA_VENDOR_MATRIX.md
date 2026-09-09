JU BAA Vendor Matrix
====================

This matrix tracks Business Associate Agreement (BAA) status and HIPAA compliance
for each vendor in the JU medical suite. It distinguishes vendors where a BAA
can be executed from those where code integration exists without a BAA (because
no PHI is transmitted), and documents what is code vs. what requires legal owner action.

==========================================================================
DEFINITIONS
==========================================================================

✅ BAA Executed — Signed Business Associate Agreement on file with vendor
✅ BAA Pending — Vendor BAAs available; execution in progress or planned
❌ No BAA Possible — Vendor does not process PHI; code integration only
✅ HIPAA Covered Entity — Vendor is a HIPAA-covered entity or business associate
❌ Unclear HIPAA Status — HIPAA status not yet confirmed
✅ Code-Integrated — SBOS has provider-neutral connector code implemented
❌ Not Code-Integrated — SBOS connector not yet built

==========================================================================
BAA / HIPAA MATRIX
==========================================================================

| Vendor | Code-Integrated | BAA Status | HIPAA Status | Notes |
|--------|----------------|------------|--------------|-------|
| SimplePractice | ✅ (connector scaffolded) | ❌ BAA Pending | ✅ HIPAA Covered Entity | BAA required for full production; connector uses synthetic data in demo |
| Epic | ❌ Not yet integrated | ❌ BAA Not Started | ✅ HIPAA Covered Entity | Full integration requires BAA; OAuth 2.0 / SMART on FHIR scope |
| athenahealth | ✅ (connector scaffolded) | ❌ BAA Not Started | ✅ HIPAA Covered Entity | Connector scaffolded post-onboarding; AthenaNet API OAuth 2.0 |
| Oracle Health / Cerner | ✅ (connector scaffolded) | ❌ BAA Not Started | ✅ HIPAA Covered Entity | Cerner FHIR OAuth 2.0; BAA required for patient/claims data |
| eClinicalWorks | ✅ (connector scaffolded) | ❌ BAA Not Started | ✅ HIPAA Covered Entity | EWorks SMART on FHIR OAuth; BAA for claims data |
| NextGen | ✅ (connector scaffolded) | ❌ BAA Not Started | ✅ HIPAA Covered Entity | NextGen API OAuth 2.0; connector post-onboarding |
| Veradigm / Allscripts | ✅ (connector scaffolded) | ❌ BAA Not Started | ✅ HIPAA Covered Entity | Veradigm SMART on FHIR; connector post-onboarding |
| Generic SMART on FHIR R4 | ✅ (abstraction layer) | ❌ BAA Not Applicable | ❓ Unclear | SMART on FHIR itself does not transmit PHI; BAA depends on backend |
| Generic HL7 v2 adapter | ✅ (skeleton only) | ❌ BAA Not Applicable | ❓ Unclear | Transport-level only; BAA depends on connected system |

==========================================================================
CLEARINGHOUSE / PAYER MATRIX
==========================================================================

| Clearinghouse | Code-Integrated | BAA Status | HIPAA Status | Notes |
|---------------|----------------|------------|--------------|-------|
| Availity | ✅ (synthetic/demo) | ❌ BAA Pending | ✅ HIPAA Covered Entity | BAA required when transmitting real claims/ERA; synthetic mode code-ready |
| Change Healthcare / Optum | ✅ (synthetic/demo) | ❌ BAA Pending | ✅ HIPAA Covered Entity | BAA required for production claim submission/ERA |
| Generic X12 transport | ✅ (by construction) | ❌ BAA Not Applicable | ❓ Unclear | Pure X12 schema; BAA needed only when connecting to real clearinghouse |

==========================================================================
CODE vs LEGAL GATE — WHAT CODE CAN VS CANNOT DELIVER
==========================================================================

What code can deliver (included in this release):

✅ Provider-neutral connector architecture (abstract base classes, interface contracts)
✅ Synthetic X12 generation and parsing for all four transaction families (270/271, 837P, 276/277, 835)
✅ Admin configuration UI patterns (vendor selection, base URL, practice identifiers)
✅ OAuth/SMART 2.0 authorization state machine (code exchange, refresh, revoke)
✅ Synthetic connectivity testing (no PHI leaves the system)
✅ Synthetic resource sync in demo/test mode (deterministic fixture generation)
✅ Health, last sync, errors, retry guidance display
✅ Reconnect / revoke / disconnect flows
✅ Tenant isolation (every connector action scoped by organizationId)
✅ Audit logging around every connector action
✅ Vendor capability flag mapping (flags per vendor per resource type)
✅ X12 transport generic library (no external enrollment needed)
✅ 837I institutional extension points (code structure, not production-certified)
✅ Status truthfulness: never fake "connected" or "verified" states

What requires owner / external vendor gate (isolated in docs/checklists, not confused with code):

❌ Vendor account registration (partner programs, developer portals)
❌ Client ID / client secret acquisition (vendor-specific; entered via UI, not git)
❌ BAA execution (legal signature with each PHI-processing vendor)
❌ Payer submitter IDs (obtained from each insurance payer)
❌ Payer payer IDs (obtained from each insurance payer)
❌ HIPAA compliance confirmation (vendor-attested; documented in matrix)
❌ MFA completion in vendor portals
❌ Vendor terms of use / developer agreement signing
❌ Redirect URL configuration in vendor portals
❌ Production certification (X12, FHIR, HL7 — separate bodies)
❌ Real API credential provisioning (secrets managed outside git)
❌ Real transmission or PHI processing (blocked in synthetic mode; opt-in required)

==========================================================================
REMAINING EXTERNAL BLOCKERS — NEXT HUMAN GATES
==========================================================================

| Gate | Action Required | Doc Reference |
|------|----------------|---------------|
| Availity partner registration | Register at developer.availity.com; obtain client ID/secret | JU_VENDOR_REGISTRATION_CHECKLIST.md §12 |
| Change Healthcare partner enrollment | Enroll at partner portal; obtain credentials | JU_VENDOR_REGISTRATION_CHECKLIST.md §13 |
| BAA execution | Legal review and signed BAA with Availity/Change Healthcare | JU_BAA_VENDOR_MATRIX.md |
| Payer submitter IDs | Collect from each payer billed | JU_CLEARINGHOUSE_ENROLLMENT_CHECKLIST.md §15 |
| Payer payer IDs | Collect from each insurance plan | JU_CLEARINGHOUSE_ENROLLMENT_CHECKLIST.md §16 |
| HIPAA status confirmation | Verify with each vendor; document in matrix | JU_BAA_VENDOR_MATRIX.md |
| 837I production certification | Separate effort; not in scope for fast onboarding | JU_CLEARINGHOUSE_ENROLLMENT_CHECKLIST.md ⚙️ 837I |
| Vendor-specific OAuth client credentials | Admin enters via UI (not git) | JU_VENDOR_REGISTRATION_CHECKLIST.md §8-11 |
| MFA completion in vendor portals | Authorized user completes MFA | JU_VENDOR_REGISTRATION_CHECKLIST.md §9 |