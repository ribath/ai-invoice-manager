# Automated Invoice Intake System

Automated Invoice Processing & Human-in-the-Loop Review System for Sample Trading Co., Ltd.

## Project Structure

```
.
├── docker-compose.yml       # Orchestrates all 3 services
├── invoices/                # 12 sample invoices (PDFs and scanned JPGs)
├── mock-api/                # Mock Accounting System API (Python)
│   ├── accounting_api.py
│   └── Dockerfile
├── backend/                 # NestJS AI Backend & Verification Engine
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── frontend/                # Next.js Human-in-the-loop Review Dashboard
│   ├── src/
│   ├── package.json
│   └── Dockerfile
├── TAKE_HOME.md             # Original Assignment Specification
└── SUBMISSION.md            # Submission Document
```

## Quick Start (Single Command)

To build and run all 3 services simultaneously:

```bash
docker compose up --build
```

### Services & Endpoints:
- **Frontend Dashboard:** [http://localhost:3000](http://localhost:3000)
- **Backend API:** [http://localhost:3001](http://localhost:3001) (`/health`, etc.)
- **Mock Accounting API:** [http://localhost:8080](http://localhost:8080) (`/health`, `/partners`, `/invoices`)
