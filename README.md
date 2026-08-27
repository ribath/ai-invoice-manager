# Automated Invoice Intake System (InvoiceFlow AI)

Automated Invoice Processing & Human-in-the-Loop Review System for Sample Trading Co., Ltd.

## Project Structure

```
.
├── docker-compose.yml              # Orchestrates PostgreSQL, Mock API, Backend, & Frontend
├── invoices/                       # 12 sample Japanese invoices (PDFs and scanned JPGs)
├── mock-api/                       # Mock Accounting System API (Python 3.9+)
│   ├── accounting_api.py           # Standalone HTTP mock server on port :8080
│   └── Dockerfile
├── backend/                        # NestJS AI Backend & Verification Engine
│   ├── src/
│   │   ├── invoice/
│   │   │   ├── extraction/         # Multimodal LLM Extraction (Gemini 2.0 Flash / OpenAI)
│   │   │   ├── verification/       # Deterministic Math (Floor rounding) & Partner Matching
│   │   │   ├── entities/           # TypeORM Invoice & InvoiceLine entities
│   │   │   ├── dto/                # Request validation schemas
│   │   │   ├── accounting-client.service.ts # REST client for Mock Accounting API
│   │   │   ├── invoice.controller.ts
│   │   │   └── invoice.service.ts
│   │   ├── common/                 # Supabase Storage client & storage services
│   │   ├── app.module.ts
│   │   └── main.ts
│   ├── package.json
│   └── Dockerfile
├── frontend/                       # Next.js 14 Human-in-the-Loop Review Dashboard
│   ├── src/
│   │   ├── app/                    # Next.js App Router (page.tsx, globals.css)
│   │   ├── components/
│   │   │   ├── Navbar.tsx          # Navigation header with full System Reset button
│   │   │   ├── InvoiceUploader.tsx # Drag-and-drop batch uploader & progress cards
│   │   │   ├── InvoiceTable.tsx    # Filterable tabbed invoice table & global search
│   │   │   └── InvoiceReviewModal.tsx # Split-screen PDF/Image preview & verification form
│   │   └── lib/
│   │       ├── api.ts              # Frontend API client
│   │       └── supabase.ts         # Direct client-side file upload utility
│   ├── package.json
│   └── Dockerfile
├── TAKE_HOME.md                    # Original Assignment Specification
└── SUBMISSION.md                   # Complete Submission & Technical Evaluation Document
```

## Quick Start (Single Command)

To build and launch all containers simultaneously:

```bash
docker compose up --build
```

### Services & Endpoints:
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001](http://localhost:3001) (`/invoices`, `/invoices/:id`, etc.)
- **Mock Accounting API:** [http://localhost:8080](http://localhost:8080) (`/partners`, `/tax-codes`, `/invoices`)
- **PostgreSQL Database:** `localhost:5432` (`ai_invoice_manager`)

---

## Testing & System Reset (Navbar Refresh Button)

For fast, repeatable testing during review and evaluation:

- **Navbar Refresh & Reset Button:** Located in the top-right corner of the navigation bar.
- **What it does on click:**
  1. Clears all records from local database tables (`invoice_lines` and `invoices`).
  2. Sends `DELETE http://localhost:8080/invoices` to the Mock Accounting API to purge all registered invoice memory.
  3. Resets the dashboard table back to a clean empty state.
- **Use Case:** Allows you to upload, review, and register sample invoices, and reset the entire system with one click to re-test without restarting containers.
