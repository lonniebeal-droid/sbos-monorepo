# JU Medical Connection Coverage Evidence

Checkpoint: 2026-09-10
Rule: no category is called connection-complete while an applicable item is `MISSING`. Production/vendor authorization is never inferred from synthetic tests.

| Category | Current status | Evidence / implementation | External dependency / next test |
|---|---|---|---|
| EHR/EMR + SMART/FHIR | IMPLEMENTED-SYNTHETIC | Unified 12-option integration catalog; FHIR CapabilityStatement test path; Epic, Oracle Health/Cerner, eClinicalWorks, NextGen, Veradigm, generic SMART/FHIR represented; legacy vendor connectors preserved. | Epic client provisioning remains EXTERNAL-HUMAN-GATE. Vendor-specific sandbox credentials/registration required before live OAuth tests. |
| Claims / EDI 270-271 | IMPLEMENTED-SYNTHETIC | X12GeneratorService generates 270 and 271; parser/tests present. | Clearinghouse/payer enrollment + transport credentials for live exchange. |
| Claims / EDI 837P | IMPLEMENTED-SYNTHETIC | Professional claim generator + round-trip test. | Trading-partner certification/enrollment for production. |
| Claims / EDI 837I | IMPLEMENTED-SYNTHETIC | Institutional claim generator exists and now has explicit round-trip test. | Trading-partner certification/enrollment for production. |
| Claims / EDI 276-277 | IMPLEMENTED-SYNTHETIC | Status inquiry/response generators and tests. | Clearinghouse/payer live endpoint + credentials. |
| Claims / EDI 278 | IMPLEMENTED-SYNTHETIC | Synthetic prior-authorization generator and parser coverage added in PR #27. | Payer/clearinghouse implementation guide mapping + certification for live use. |
| Claims / EDI 835 | IMPLEMENTED-SYNTHETIC | ERA generator + parser/test path. | Clearinghouse/payer live endpoint + enrollment. |
| Clearinghouses | IMPLEMENTED-SYNTHETIC | Availity, Change Healthcare/Optum, Generic X12 profiles/connectors; non-FHIR config validation is deliberately local-only. | Credentials, enrollment, MFA/BAA/contract where required. |
| Scheduling/admin FHIR | IMPLEMENTED-SYNTHETIC | Patient, Appointment, Encounter and Coverage are present in connector scopes/registry and existing FHIR flows. | Audit/extend Practitioner, Location, Organization resource workflows before closing category. |
| Generic HL7 v2 / labs | IMPLEMENTED-SYNTHETIC | Generic HL7 v2 profile includes ADT, SIU, ORU capability labels. | Verify parser/transport mapping; Quest/Labcorp direct vendor access remains external if required. |
| MEDITECH | MISSING | No explicit MEDITECH adapter or documented compatibility profile found in current repository audit. | Implement/document generic SMART/FHIR path only where MEDITECH endpoint compatibility is demonstrated; otherwise vendor registration gate. |
| eRx / Surescripts / EPCS | MISSING | No explicit Surescripts/eRx/EPCS connector evidence found in current repository audit. | Product-scope decision plus vendor/identity/legal prerequisites; never simulate EPCS production authority. |
| Imaging / DICOM / PACS / RIS | MISSING | No explicit DICOM/PACS/RIS implementation found in current repository audit. | Add standards adapter or mark N/A only with product-scope evidence. |
| HIE / TEFCA / Carequality / CommonWell | MISSING | No explicit network adapter evidence found in current repository audit. | Determine required network route and onboarding; external participation agreements likely. |
| Provider identity / NPI-NPPES | MISSING | No explicit NPPES verification module found in current repository audit. | Add public NPPES verification client + synthetic tests; DEA/EPCS remains external if required. |
| Patient communications | MISSING | General application notification capability is not enough to prove medical consent/opt-out/audit/fax/voice coverage. | Audit existing notifications; add consent/minimization controls before closing. |
| Payments | MISSING | Billing/payment domain objects do not prove a production payment-processor connection. | Decide processor/in-scope workflow; credentials/merchant onboarding may be external. |
| Telehealth | MISSING | No verified telehealth integration evidence yet. | Scope decision; implement standards/vendor connection or document N/A with evidence. |
| Document exchange / C-CDA / USCDI | MISSING | No explicit C-CDA/USCDI/DocumentReference/Binary exchange coverage verified yet. | Add/document exchange support and synthetic tests. |
| Security / consent / lifecycle | IMPLEMENTED-SYNTHETIC | Existing SMART PKCE/state/token controls, audit logging, disconnect/reconnect semantics, least-privilege scopes; connector tests explicitly separate capability/config validation from authorization. | Finish negative-auth and tenant-isolation evidence review before final close. |

## Count reconciliation
The broader admin documentation names 12 distinct selectable integration options: 9 EHR/PMS/interface options plus 3 clearinghouse/X12 options. Older text saying "11 vendors" was inconsistent because the legacy mock registry omitted Generic SMART on FHIR R4 while the admin dropdown documentation listed it. PR #27 aligns the registries rather than preserving the contradictory count.

## Production boundary
`IMPLEMENTED-SYNTHETIC` means code/test coverage only. It does not mean vendor approval, BAA execution, payer enrollment, EPCS authority, production OAuth authorization, live PHI access, or trading-partner certification.
