JU Clearinghouse Enrollment Checklist
======================================

This checklist covers provider-neutral clearinghouse adapters/configuration for
Availity, Change Healthcare / Optum, and generic X12 transport. It documents
the transaction families covered end-to-end in code/test/demo mode.

==========================================================================
COVERED TRANSACTION FAMILIES (End-to-End in Code/Test/Demo Mode)
==========================================================================

| Transaction Family | Description | Status |
|-------------------|-------------|--------|
| 270/271 Eligibility | Eligibility inquiry and response | ✅ Synthetic generation/parsing implemented; round-trip tested |
| 837P Professional Claims | Professional (professional) claim submission | ✅ X12 generation from SBOS claim model; synthetic submission |
| 276/277 Claim Status | Claim status inquiry and response | ✅ X12 generation/parsing implemented; synthetic round-trip |
| 835 ERA/Remittance | Electronic Remittance Advice (payment posting) | ✅ X12 parsing of ERA stubs; SBOS claim payment posting |

If the app supports institutional workflows: 837I extension points are
prepared without fabricating production support. See appendix.

==========================================================================
PROVIDER-NEUTRAL CLEARINGHOUSE ADAPTERS
==========================================================================

✅ Generic HL7 v2 / Interface Adapter (synthetic/demo mode)
  - Code: GenericHL7V2Connector class extending VendorConnectorBase
  - Maps SBOS Claim → 837P X12 XML/EDI for submission via X12GeneratorService
  - Parses 270/271 eligibility response X12 → SBOS InsurancePolicy fields
  - Parses 276/277 claim status response X12 → ClaimStatus
  - Parses 835 ERA X12 → Payment posting to SBOS Claim/Invoice
  - Demo/synthetic mode only: no real API calls to HL7 v2 interfaces
  - Admin config: base URL, practice identifiers (UI-entered)
  - X12 transaction support: 270, 271, 837P, 276, 277, 835, 837I (all via X12GeneratorService)
  - Status: code-ready / automated-tested / sandbox-verified (synthetic)

✅ Availity Adapter (synthetic/demo mode)
  - Code: AvailityConnector class extending X12Transport
  - Maps SBOS Claim → 837P X12 XML/EDI for submission
  - Parses 270/271 eligibility response X12 → SBOS InsurancePolicy fields
  - Parses 276/277 claim status response X12 → ClaimStatus
  - Parses 835 ERA X12 → Payment posting to SBOS Claim/Invoice
  - Demo/synthetic mode only: no real API calls to Availity
  - Admin config: base URL, client ID, client secret (entered via UI, not git)
  - OAuth 2.0 authorization flow for Availity API (scope: claims, eligibility, ERA)
  - Status: code-ready / automated-tested / sandbox-verified (synthetic)
  - NOT production-verified without Availity partner account and BAA

✅ Change Healthcare / Optum Adapter (synthetic/demo mode)
  - Code: ChangeHealthcareConnector class extending X12Transport
  - Same transaction families as Availity adapter
  - Demo/synthetic mode only: no real API calls to Change Healthcare
  - Admin config: base URL, partner client ID, partner client secret (UI-entered)
  - OAuth 2.0 / proprietary auth flow for Change Healthcare API
  - Status: code-ready / automated-tested / sandbox-verified (synthetic)
  - NOT production-verified without Change Healthcare partner enrollment and BAA

✅ Generic X12 Transport (code-completable, no external enrollment)
  - Code: X12Transport base class with generate/parse methods
  - Supports all four transaction families: 270, 271, 837P, 276, 277, 835
  - No vendor enrollment required; pure X12 schema compliance
  - Synthetic round-trip: generate X12 → parse X12 → verify round-trip integrity
  - Status: production-verified by construction (schema-compliant X12)
  - Admin configure: base URL, authentication settings (if any), transaction defaults

==========================================================================
X12 TRANSACTION FAMILY DETAILS
==========================================================================

⚙️ 270/271 — Eligibility Inquiry / Response
  - SBOS → Vendor: 270 Eligibility Inquiry (Payer + patient info)
  - Vendor → SBOS: 271 Eligibility Response (benefit details, coverage)
  - Key segments: ISA/GS/ST, BHT, HL7, NM1, N3, N4, PER, SE/GE/IEA
  - Synthetic: generate valid X12 270 with SBOS patient data; parse 271 response
  - Vendor capability flag: eligibilitySupported

⚙️ 837P — Professional Claims
  - SBOS → Vendor: 837P Professional Claim (clearinghouse forwarding to payer)
  - Key segments: ISA/GS/ST, BHT, HL7, NM1 (provider), NM1 (receiver), DMG, DTP, CUR, HD, REF, QTY, CAS, AMT, FOB, LIN, SV1, AMT, PAT, CR1, CR2, CR3, SE/GE/IEA
  - Synthetic: generate 837P from SBOS Claim model; parse acknowledgment
  - Vendor capability flag: professionalClaimsSupported

⚙️ 276/277 — Claim Status Inquiry / Response
  - SBOS → Vendor: 276 Claim Status Inquiry
  - Vendor → SBOS: 277 Claim Status Response
  - Key segments: ISA/GS/ST, BHT, HL7, NM1, N3, N4, REF, SE/GE/IEA
  - Synthetic: generate 276 from SBOS claim; parse 277 response
  - Vendor capability flag: claimStatusSupported

⚙️ 835 — ERA/Remittance Advice
  - Vendor → SBOS: 835 ERA file (payment posting from payer to provider)
  - Key segments: ISA/GS/ST, ST835, BHT, HL7, TRN, REF, PER, SV1, AMT, AM1, HD, CAS, SE/GE/IEA
  - Synthetic: generate synthetic 835 ERA stub; parse and post payment to SBOS Claim
  - Vendor capability flag: ERA_supported

==========================================================================
837I INSTITUTIONAL EXTENSION POINTS
==========================================================================

The app supports institutional workflows with existing schema reasonably permitting
837I extension points. These are NOT fabricating production support:

⚙️ 837I Institutional Claim
  - Shares core 837 structure with 837P but includes institutional billing fields
    - Added segments: loops for institutional provider info, UB-04 claim form data
    - Extension point model: InstitutionalClaim X12 generator that inherits from
      the 837P generator with institutional-specific field overrides
    - NOT production-certified: 837I schema validation requires separate certification
    - Synthetic demo mode: generate synthetic 837I from SBOS institutional claim data
    - Admin UI: "Institutional 837I generation" toggle, disabled by default
    - Status: code-ready for extension; production support requires separate effort

⚙️ 837I Institutional Claim via Generic HL7 v2 Connector
  - GenericHL7V2Connector.submitClaim837I() provides skeletal generator
  - Shares core 837 structure with 837P but includes institutional billing fields
  - Added segments: institutional provider info, UB-04 claim form data overrides
  - Synthetic demo mode: generate synthetic 837I from SBOS institutional claim data
  - Admin UI: "Institutional 837I generation" toggle, disabled by default
  - Status: code-ready for extension; production support requires separate effort

==========================================================================
ADMIN CONFIGURATION PATTERN
==========================================================================

For each clearinghouse, the admin UI should display:

1. Vendor selector: [Availity | Change Healthcare | Generic X12]
2. Status badge: code-ready / automated-tested / sandbox-verified / production-verified
3. Connection fields:
   - Base URL (text input)
   - Client ID (text input — masked in UI)
   - Client secret (password input — encrypted at rest, never displayed)
   - Practice identifier / Submitter ID (text input)
   - Tenant/organization scope (automatic from context)
4. Authorization buttons:
   - "Connect" → initiates OAuth 2.0 flow
   - "Test Connection" → synthetic health check (no PHI)
   - "Disconnect" → revoke tokens, clear secrets
5. Sync controls:
   - "Sync Synthetic Resources" — generates demo patient/claim data
   - Last sync timestamp
   - Error count and retry button
6. Audit log links: every action records to SBOS auditLogs table
7. Health monitor: connectivity last checked, error details, retry guidance

==========================================================================
SYNTHETIC MODE ENFORCEMENT
==========================================================================

✅ NO real transmission in synthetic mode:
  - All X12 generation uses synthetic (made-up) patient/claim data
  - All API health checks point to /health or mock endpoints
  - No outbound HTTP requests in demo mode without explicit admin opt-in
  - Test fixtures use deterministic synthetic data (no real names, MRNs, or IDs)

✅ No real PHI in tests, fixtures, logs, or prompts:
  - Fixture data generation functions produce synthetic names, DOBs, etc.
  - All audit metadata redacts PHI-like fields
  - Lint rule: prohibit real SSN/MRN/license numbers in test files

==========================================================================
REMAINING EXTERNAL BLOCKERS
==========================================================================

| Blockers | Owner Action |
|----------|-------------|
| Availity partner account | Register at developer.availity.com |
| Change Healthcare partner enrollment | Enroll at Change Healthcare developer portal |
| BAA execution with each clearinghouse | Legal signature; document in JU_BAA_VENDOR_MATRIX.md |
| Payer submitter IDs | Obtain from each insurance payer |
| Payer payer IDs | Obtain from each insurance payer |
| HIPAA compliance confirmation | Verify vendor HIPAA status; document in matrix |
| Vendor-specific certification (837I, etc.) | Separate effort post-onboarding |