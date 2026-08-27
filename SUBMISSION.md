# Submission

- Name: Asif Ibtihaj Mohammad Ribath
- Submission date (YYYY-MM-DD): 2026-08-27
- Hours actually spent: ~8 hours
- Repository / how to run it: Run `docker compose up --build` and open `http://localhost:3000`

## 1. Understanding the request

The client (Sample Trading Co., Ltd.) suffers from month-end closing bottlenecks and manual data-entry fatigue caused by typing diverse Japanese invoices (PDFs with text layers, scanned copier images, and handwritten annotations) into their legacy accounting system. Last month, human entry error nearly triggered a duplicate payment.

The CEO asked if AI can automate invoice intake. While the initial request suggests end-to-end automation, blindly inserting unverified AI extractions into financial ledgers introduces severe compliance and accounting risks (e.g. invalid tax codes, rounding mismatches, duplicate payments, or incorrect partner associations under Japan's Qualified Invoice System).

The real problem to solve -
Build an automated ingestion and verification pipeline with a human-in-the-loop review workflow that:
1. Employs a multimodal Vision LLM to parse heterogeneous Japanese document layouts into structured invoice schemas.
2. Automatically executes rigorous mathematical recalculation (line item sums, tax-code-specific floor rounding, date integrity) and fuzzy partner matching against the master record.
3. Provides an intuitive split-screen verification interface where accountants can visually verify the original document alongside pre-validated data before committing changes with a single click.

## 2. What you would have asked the client

**Question 1:** Is it possible that you can onboard your partners into the system as partner role, so that they upload the invoices directly themselves?
- **Assumption:** Invoices are currently collected and uploaded centrally by internal staff/accountants rather than through a self-service vendor portal.
- **Reason:** A vendor-facing portal requires external authentication, vendor onboarding flows, and strict permission boundaries. Starting with an internal intake tool solves the immediate operational bottleneck while keeping the architecture open for a vendor upload endpoint later.

**Question 2:** Will there be multiple users who will use this system or just one user?
- **Assumption:** Designed as a shared internal dashboard for an accounting team (multi-reviewer capable) without complex per-user RBAC or role partitioning in this initial phase.
- **Reason:** Multiple accountants can review, edit, and register invoices concurrently without state locking, while avoiding the overhead of multi-tenant user management during MVP validation.

**Question 3:** After registering is done, as invoice data is stored into the system, do you want the file to be removed or saved? If saved, then for how long?
- **Assumption:** Retain all uploaded files indefinitely in secure cloud storage (Supabase Storage) accessible via signed URLs.
- **Reason:** Under the Japanese Electronic Bookkeeping Act (電子帳簿保存法) and standard tax compliance laws, businesses are legally required to preserve original electronic invoice documents for 7 to 10 years for audit purposes.

## 3. Scoping decisions

**What you built:**
1. **Multimodal Vision LLM Extraction Engine:** Uses Gemini 2.5 Flash / OpenAI vision models with specialized Japanese invoice prompts to extract supplier name, tax registration number, dates, line items, unit prices, quantities, and tax codes (`T10`/`T08`).
2. **Deterministic Verification Engine:** Automated recalculation of subtotals (`∑ lines`), tax calculations per tax code with integer floor rounding (`Math.floor(subtotal_rate * rate)`), total amounts, date consistency (`due_date >= issue_date`), and partner master fuzzy/alias matching.
3. **Split-Screen Human Review UI:** Side-by-side view with original document preview on the left and pre-populated editable form on the right with partner selection, match status indicators, and one-click registration to `ACC-xxxx`.
4. **Categorized Dashboard & Global Search:** Organized tabs separating *All Invoices*, *Ready for Review*, *Registered*, and *Issues* (Extraction Errors, Registration Failures, and Duplicate Invoices) with real-time multi-field search across file name, supplier, partner code, invoice number, and accounting ID.
5. **Strict Pre-Registration Form Validation:** Client- and server-side validation guardrails blocking submission if required fields are missing, if due date precedes issue date, or if partner/line items are incomplete, ensuring no invalid or corrupted invoice reaches the accounting ledger.
6. **Zero-Load Direct Cloud Storage & URL-Based LLM Ingestion:** Delegated all heavy file upload and download operations entirely to Supabase Storage using temporary signed URLs. The backend server never handles or buffers heavy binary file streams; instead, the LLM and client browser fetch files directly via signed URLs, keeping our application server completely load-free, memory-efficient, and responsive.
7. **Single-Command Docker Deployment:** Complete containerized setup (`docker compose up --build`) orchestrating PostgreSQL, Mock Accounting API, NestJS backend, and Next.js frontend.

**What you left out, and why:**
1. **Asynchronous Event-Driven AI Extraction (AWS Lambda / Serverless Functions + SQS):** Currently, AI extraction runs synchronously immediately upon file upload. An event-driven serverless queue using AWS Lambda triggered via S3/R2 event notifications (or SQS) would decouple uploads from processing. Users could upload large batches and leave, while serverless functions spin up in parallel to extract data, save to the database, and push real-time updates via WebSockets/SSE with zero standing worker compute cost.
2. **Advanced Multi-Dimensional Filtering:** Ability for users to filter invoices by date ranges (issue/due dates), specific partner masters, total amount ranges, and tax amount brackets.
3. **Paginated Invoice List:** Server-side pagination and infinite scroll for handling high-volume datasets (thousands of invoices per month).
4. **OAuth Login & API Authentication:** OAuth authentication, and secure session management for enterprise multi-user environments.
5. **AWS S3 / Cloudflare R2 Cloud Object Storage:** AWS S3 or Cloudflare R2 would be the ideal choice for enterprise-scale storage, but they require credit card registration. Supabase Storage was used as an accessible, secure alternative that provides identical signed URL capabilities without billing barriers.
6. **Centralized Logging & Observability (Grafana Loki + Grafana):** In production, centralized logging and telemetry (e.g. Grafana Loki for log aggregation paired with Prometheus/Grafana dashboards) is essential to monitor extraction latencies, track LLM token consumption, detect HTTP error spikes, and alert on accounting sync failures.

## 4. Design and technology choices

- **Frontend:** Next.js 14 (App Router) + Vanilla CSS design system. Clean, responsive, glassmorphic UI with zero UI framework bloat.
- **Backend:** NestJS 10 + TypeORM + PostgreSQL 16. Modular architecture separating storage, LLM extraction, math verification, and accounting client services.
- **File Storage:** Supabase Storage (private bucket) with temporary signed URLs for secure, zero-binary backend pass-through (S3/Cloudflare R2 would be used in production, but Supabase was selected to avoid credit card setup requirements).
- **Vision LLM:** Google Gemini 2.5 Flash (via Google AI API) chosen for state-of-the-art multimodal document OCR speed, exceptional accuracy on complex Japanese kanji/eras, structured JSON mode, and cost effectiveness, with configurable fallback to OpenAI GPT-4o.
- **Accounting System:** Integrated directly with the provided Python Mock Accounting API at `:8080`, adhering strictly to authentication (`X-API-Key`) and business rule envelopes.

## 5. How you used AI, and how you checked it

**What you delegated to AI:**
- Reading handwritten or scanned documents without fixed templates.
- Identifying seller vs. buyer names (distinguishing `御中` addressee from issuing supplier).
- Parsing Japanese date formats (e.g. `令和8年1月7日` -> `2026-01-07`).
- Categorizing items by tax rate (`T10` for standard 10%, `T08` for reduced 8% items like beverages/food).

**How you verified the output:**
- **Deterministic Math Engine:** The LLM's returned subtotals and taxes are never taken at face value. Our `VerificationService` recalculates `sum(line.amount)`, computes `Math.floor(subtotal_T10 * 0.10)` and `Math.floor(subtotal_T08 * 0.08)`, and flags any discrepancy.
- **Master Data Reconciliation:** Extracted supplier names and `T+13` registration numbers are cross-referenced with `GET /partners`.
- **Human-in-the-Loop Confirmation:** The accountant reviews all fields in the split-screen modal before sending `POST /invoices/:id/register`.

**A case where the AI got it wrong:**
none

## 6. Integrating with the accounting system

### How it Works
1. **Sync Master Data:** Pre-fetches partners (`GET /partners`) and tax codes (`GET /tax-codes`) with `X-API-Key` authentication.
2. **Review & Validate:** Reviewer confirms extracted data in the modal; math and dates are verified automatically.
3. **Register:** Sends payload to `POST /invoices`, saves assigned `accounting_id` (e.g. `ACC-xxxx`), and sets status to `REGISTERED`.

### Edge Cases Handled

> **Pre-emptive Validation:** Most errors that could fail registration in the Mock Accounting API (missing required fields, unmatched partner codes, inverted dates, and tax calculation discrepancies) are validated directly in the frontend review modal, ensuring invalid payloads are prevented before reaching the backend.

| Edge Case | How It's Handled |
|---|---|
| **Duplicate Invoice (409)** | Flags duplicate invoice numbers, updates status to `Registration Failed`, and moves record to the **Issues** tab. |
| **Unmatched Supplier** | Uses fuzzy/alias matching against partner masters; provides a searchable combobox for manual selection. |
| **Invalid Dates (`due < issue`)** | Disables registration button and shows inline warning if payment due date precedes issue date. |
| **Tax Rounding** | Computes per-rate integer floor rounding (`Math.floor(subtotal * rate)`) matching Japanese tax rules. |
| **Mock API Reset** | Navbar refresh button clears DB tables and calls `DELETE /invoices` to reset mock accounting memory. |


## 7. Cost, limits, and risk in production

### Cost Breakdown (at 1,000 Invoices / Month)

#### 1. Current Architecture (Supabase Storage + Gemini 2.5 Flash + Cloud Run + Postgres)
- **Vision LLM (Gemini 2.5 Flash):** ~$0.30 - $0.50 / month (1,000 invoices × ~1.5k input tokens + ~400 output tokens @ $0.10/1M in, $0.40/1M out).
- **File Storage (Supabase Storage):** $0.00 / month (1,000 invoices × ~500KB = ~500MB, covered within 1GB free tier; ~$0.02/month if scaled).
- **Database (PostgreSQL / Neon / Supabase):** $0.00 - $10.00 / month (free tier for development; ~$10/month for dedicated micro instance).
- **Backend & Frontend Compute (Cloud Run / Render):** ~$5.00 - $15.00 / month (serverless pay-per-request compute).
- **Total Current Architecture:** **~$10 - $25 / month** (less than $0.025 / invoice).

#### 2. Proposed Production Architecture (Cloudflare R2 + AWS Lambda + SQS + Managed Postgres)
- **Vision LLM (Gemini 2.5 Flash / Vertex AI Enterprise):** ~$0.30 - $0.50 / month.
- **File Storage (Cloudflare R2 / S3):** $0.00 / month (500MB storage + 1,000 write operations covered by R2's 10GB free tier and **$0 egress fees**; or <$0.02 on S3).
- **Serverless Extraction Compute (AWS Lambda / Cloud Functions):** $0.00 / month (1,000 executions × 3s × 512MB = 1,500 GB-seconds, completely covered under AWS 400,000 GB-seconds monthly free tier).
- **Queue & Event Orchestration (Amazon SQS / EventBridge):** $0.00 / month (1,000 requests covered under AWS free tier of 1M requests/month).
- **Backend API & WebSockets (Cloud Run / AWS App Runner):** ~$5.00 - $10.00 / month (serverless container for REST endpoints and review dashboard).
- **Frontend Hosting (Vercel / Cloudflare Pages):** $0.00 / month (free tier for static/SSR Next.js).
- **Managed PostgreSQL & Pooling (Neon / Supabase Pro / RDS + Proxy):** ~$5.00 - $15.00 / month.
- **Total Proposed Production Architecture:** **~$10 - $25 / month** (scale-to-zero, instant burst parallelism, zero idle worker costs, and enterprise resilience).

---

### Performance & Reliability
- **Processing time per invoice:** ~1.5 to 3.0 seconds (Gemini multimodal vision inference + mathematical verification + database write).
- **Where this breaks first:** Synchronous rate limits (RPM/TPM) during heavy month-end batch upload spikes (resolved by introducing the proposed AWS Lambda + SQS queue with reserved concurrency and exponential backoff).
- **How you would find out if something was registered incorrectly:** No invoice can get registered incorrectly because the system enforces strict input validation and automatically recalculates all line totals, floor-rounded tax amounts, partner assignments, and date constraints (`due_date >= issue_date`) before submission—blocking the registration action until all values are completely verified and valid.
If an accountant overrides or manually edits a value incorrectly, the database stores the raw AI extraction (`extractedData`) side-by-side with the human-submitted payload and assigned `accounting_id` for line-by-line audit trace.

---

### Limits, Security, and Risks at Scale
- **No API Authentication (Required for Production):** The current MVP does not enforce authentication on intake and extraction endpoints. Production deployment strictly requires OAuth 2.0 / JWT session authentication, API key rate-limiting, and Role-Based Access Control (RBAC).
- **Rate Limits:** Commercial LLM APIs enforce TPM/RPM thresholds. Heavy month-end batching requires asynchronous queue workers to smooth throughput spikes.
- **Data Privacy & Compliance:** Financial invoices contain confidential commercial data. Production must use enterprise zero-data-retention terms (e.g. Google Cloud Vertex AI or Azure OpenAI) complying with the Japanese Electronic Bookkeeping Act (電子帳簿保存法).
