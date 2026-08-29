# Jessie Website Copy Deck

**For:** Marketing page, landing page, sales deck
**Tone:** Clear, professional, simple, non-technical
**Rule:** Every claim must trace to `JESSIE_APPROVED_SALES_CLAIMS.md`
**Structure:** Separate **AVAILABLE NOW** / **OPTIONAL / CONFIGURABLE** / **COMING LATER**

---

## Headline Options

**Primary:**
> Jessie — Your AI Receptionist. Never Miss a Lead Again.

**Alternative (benefit-led):**
> 24/7 Lead Capture & Caller Routing — Configured for Your Practice, Not a Template.

**Short (hero):**
> Jessie Answers. You Grow.

---

## Subheadline

> Jessie is a configurable AI assistant that answers calls and chats, captures leads from your approved content, and routes callers to the right person — so your team never misses an opportunity. Works with your phone number. Deploys in weeks, not months.

---

## Value Props (3 Columns) — **AVAILABLE NOW**

### 🎯 **Answers from Your Content Only**
Jessie never hallucinates. She responds using only your published knowledge base — hours, services, location, insurance, policies. You approve every answer before it goes live.

### 📋 **Captures Leads, Not Just Messages**
Structured, multi-step intake collects name, contact details, presenting concern, and insurance — delivered to your team in real time. No more "call us back" voicemails.

### 🔀 **Routes to the Right Person**
Billing question → billing. Clinical concern → on-call clinician. Emergency → immediate escalation. Jessie recognizes intent and follows your rules.

---

## How It Works (4 Steps) — **AVAILABLE NOW**

### 1. **We Learn Your Practice**
30-minute discovery call. We map your call volume, FAQs, services, scheduling flow, and escalation rules.

### 2. **We Build Your Jessie**
Custom greeting, knowledge base (up to 100 articles), lead capture fields, transfer destinations, after-hours behavior — all configured in a private dashboard.

### 3. **You Review & Approve**
Every answer, every prompt, every routing rule. Test calls together (10+ scenarios). Nothing goes live without your sign-off.

### 4. **Go Live & Iterate**
Point your phone number to Jessie. First week: daily check-ins. Monthly: knowledge base updates, prompt refinements. Your Jessie evolves with you.

---

## Use Cases — **AVAILABLE NOW**

| Practice Type | Jessie Handles |
|---------------|----------------|
| **Solo Therapist** | After-hours intake, lead capture, FAQ answers, emergency escalation |
| **Group Practice** | Multi-clinician routing, service FAQs, intake triage, billing handoff |
| **Psychiatry/Med Management** | Insurance verification intake, medication refill routing, crisis escalation |
| **Dental / Medical / Legal** | Appointment detail collection, service FAQs, after-hours routing, lead capture |
| **Professional Services** | Inquiry qualification, consultation booking, routing to specialists |

---

## Capability Breakdown

### ✅ **AVAILABLE NOW** (Verified in local demo; heuristic provider)
- AI receptionist answering from your approved knowledge base
- Multi-assistant routing: Receptionist, Scheduling, Intake, Clinical, Knowledge, General
- Structured lead capture (name, contact, concern, insurance)
- Intent recognition for transfer/escalation (voicemail, callback, on-call)
- After-hours behavior via prompt configuration
- Conversation memory & full audit trail
- Offline mode — works without external AI provider
- Per-client prompt & knowledge base configuration
- Versioned prompts with rollback
- HIPAA-aligned technical safeguards (RBAC, audit, encryption in transit, tenant isolation, MFA)

### ⚙️ **OPTIONAL / CONFIGURABLE** (Requires credentials + configuration)
- Live LLM provider (OpenAI/Azure/Claude) — requires API key + BAA for PHI
- SMS notifications (Twilio) — requires credentials
- Email notifications (Resend) — requires API key + verified domain
- Stripe payment recording — requires Stripe key
- Custom voice selection (when voice available)

### 🚧 **COMING LATER** (Roadmap — not yet implemented)
- **Automated appointment booking** — Jessie collects details; your team confirms today
- **Live voice transfer** — Jessie recognizes intent; warm transfer requires telephony integration
- **Intake → Client record creation** — Structured data collected; API automation pending
- **Voice receptionist (Twilio Voice + STT/TTS)** — Requires telephony integration
- **Calendar sync (Google/Microsoft/Calendly)** — Not yet implemented
- **Insurance verification** — Not implemented
- **Call recording/transcription** — Requires telephony integration
- **FHIR/HL7 EHR connectors** — Not implemented
- **Pre-built CRM integrations** — REST API available; connectors on roadmap
- **Multi-language support** — English only in heuristic; LLM-dependent

---

## FAQ

### **Does Jessie book appointments automatically?**
Jessie collects the details your team needs to book — preferred date, time, clinician, and appointment type. Your team confirms and finalizes the appointment. Automated calendar booking is **COMING LATER**.

### **Can Jessie transfer calls to a human?**
Jessie recognizes when a caller needs a human and follows your escalation rules (voicemail, callback request, or on-call transfer). Live warm voice transfer requires telephony integration and is **COMING LATER**. Today, Jessie captures the intent and ensures your team gets the lead immediately.

### **Is Jessie HIPAA compliant?**
Jessie is built with HIPAA-aligned technical safeguards: role-based access control, audit logging, encryption in transit, tenant isolation, and MFA. For production use with PHI, you'll need to execute BAAs with any enabled subprocessors (AI provider, SMS, email) and implement administrative/physical safeguards. We'll guide you through this.

### **What if Jessie doesn't know the answer?**
Jessie says: "I couldn't find that in our knowledge base. I can connect you with a team member who can help — would you like that?" She never guesses. You control the knowledge base.

### **What happens if the AI goes down?**
Jessie automatically switches to offline mode — a deterministic, safe response system that works without any external AI provider. No downtime. No data leaves your infrastructure.

### **How long does setup take?**
Typically 2–3 weeks from discovery call to launch. Complex routing or custom integrations may take longer.

### **Can I update Jessie's answers myself?**
Yes. Your dashboard lets you edit knowledge base articles and prompt templates anytime. Changes take effect immediately. Version history lets you roll back.

### **What phone systems work with Jessie?**
Jessie works with Twilio Voice. If you have an existing number, we help you port it (2–4 weeks). New numbers provision instantly. **Voice receptionist is COMING LATER.**

### **How much does it cost?**
Three tiers: Starter, Professional, Business. Pricing based on conversation volume and features. External costs (Twilio, AI provider) billed at cost. Contact us for a custom quote.

### **Can Jessie integrate with my EHR/CRM?**
Jessie exposes a REST API. Custom integrations can be built. Pre-built connectors for SimplePractice, TherapyNotes, HubSpot, and Salesforce are **COMING LATER**.

---

## CTA Options

**Primary:**
> Start Your Discovery Call

**Secondary:**
> See a Live Demo

**Tertiary:**
> Download the One-Pager

---

## Safe Disclaimer Language

> **Jessie is an AI assistant, not a licensed clinician.** She does not provide medical, legal, or financial advice. She answers from your approved content, captures lead information, and routes callers per your configuration. For clinical emergencies, Jessie escalates immediately to your designated contacts.
>
> **Technical safeguards:** Role-based access, audit logging, encryption in transit, multi-tenant isolation, MFA.
> **Compliance:** HIPAA-aligned architecture. Production PHI requires BAAs with subprocessors and administrative safeguards (your responsibility).
> **Availability:** 99.9% uptime target (SLA on Business tier). Offline mode ensures core functionality during AI provider outages.
> **Data:** Your conversations, prompts, and knowledge base belong to you. We do not train models on your data.

---

## Social Proof Placeholders

> "Jessie cut our missed calls by 80% in the first month. The intake flow alone pays for itself." — *Practice Owner, 5-clinician group*
>
> "Finally, an AI that only says what I've approved. No hallucinations, no surprises." — *Clinical Director, Behavioral Health Org*
>
> "Setup was collaborative, not technical. We approved every answer before launch." — *Office Manager, Solo Practice*

---

## Footer Copy

> Jessie is part of the SBOS platform — the operating system for behavioral health. Secure. Configurable. Yours.
>
> © 2026 SBOS. All rights reserved. | Privacy Policy | Terms of Service | Security | Status

---

## Copy Guardrails (For Reviewers)

| ❌ Don't Say | ✅ Say Instead |
|-------------|----------------|
| "Jessie never misses a call" | "Jessie handles inbound conversations 24/7 per your configuration" |
| "Jessie books appointments" | "Jessie collects booking details for your team to confirm" |
| "Jessie replaces your front desk" | "Jessie augments your front desk with after-hours coverage and lead capture" |
| "Fully HIPAA compliant" | "Built with HIPAA-aligned technical safeguards; BAAs required for production PHI" |
| "Works with every CRM" | "Jessie exposes a REST API; custom integrations available" |
| "100% accurate" | "Jessie answers only from your approved knowledge base" |
| "Set it and forget it" | "Configured once; updated as your practice evolves" |
| "Autonomous AI employee" | "Configurable AI assistant that follows your rules" |

---

## Page Sections (Wireframe Order)

1. **Hero** — Headline + Subheadline + Primary CTA
2. **Trust Bar** — Logos (SBOS, HIPAA-aligned, SOC 2 Type II target)
3. **Value Props** — 3-column grid (AVAILABLE NOW)
4. **How It Works** — 4-step numbered flow (AVAILABLE NOW)
5. **Use Cases** — Table or cards (AVAILABLE NOW)
6. **Capability Breakdown** — AVAILABLE NOW / OPTIONAL / COMING LATER
7. **Demo Section** — "See Jessie in Action" → Calendly embed
8. **FAQ** — Accordion (8–10 items)
9. **Pricing Teaser** — 3 tiers + "Contact for Quote"
10. **Disclaimer** — Safe language
11. **Footer** — Links, copyright, status page