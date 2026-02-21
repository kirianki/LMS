# System Requirements Specification (SRS)

**Project:** MFI & SACCO SaaS Platform (Core Financial Engine)  
**Version:** 1.0.0

---

## 1. Introduction
This document outlines the requirements for a multi-tenant SaaS platform designed for Micro-Finance Institutions (MFIs) and Savings and Credit Co-operatives (SACCOs). The system's primary goal is to automate the loan lifecycle, accounting, and institutional reporting.

---

## 2. Functional Requirements

### 2.1 SaaS Platform Layer (Foundation)
- **T1: Tenant Isolation:** All data must be isolated at the database schema level.
- **T2: Subscription Management:** Support for tiered plans (Basic, Premium, Enterprise) with module-gatekeeping.
- **T3: Branch Management:** Ability to manage multiple branches under a single tenant.

### 2.2 Identity & Access Management (IAM)
- **A1: RBAC:** Role-Based Access Control with granular permissions (e.g., `loan.approve`, `accounting.post`).
- **A2: Approval Limits:** System-enforced limits for loan approval amounts per role.
- **A3: Audit Trail:** Comprehensive logs of every create/update/delete action, including the user and timestamp.

### 2.3 Loan Management System (LMS)
- **L1: Loan Products:** Support for Declining Balance, Flat Rate, and Interest-Only products.
- **L2: Lifecycle Tracking:** States: Pending → Appraised → Approved → Disbursed → Active → Closed/Arrears.
- **L3: Automated Penalties:** Logic to auto-calculate penalties on overdue installments.

### 2.4 Automated Accounting
- **C1: Double-Entry Ledger:** Every transaction must have balanced debits and credits.
- **C2: Real-time Posting:** Automated journal entries triggered by LMS events (Disbursement, Repayment).
- **C3: Financial Reports:** Automated generation of Balance Sheet, P&L, and Trial Balance.

### 2.5 Document Engine
- **D1: Dynamic Templates:** Support for `{{placeholders}}` in user-definable Word/HTML templates.
- **D2: PDF Generation:** Automated conversion of agreements and statements to PDF for client distribution.

---

## 3. Non-Functional Requirements

### 3.1 Security
- Data encryption at rest and in transit (TLS 1.3).
- Multi-factor authentication (MFA) for administrative roles.
- Regular automated backups with point-in-time recovery.

### 3.2 Performance
- API response time < 200ms for core LMS operations.
- Support for concurrent processing of up to 10,000 active tenants.

### 3.3 Compliance
- Adherence to SASRA (Kenya) reporting standards.
- Data privacy as per the Kenya Data Protection Act.

---

## 4. User Roles & Personas
| Role | Responsibility | Key Feature Access |
| :--- | :--- | :--- |
| **Loan Officer** | Onboard clients, apply for loans. | LMS, Clients, Collateral |
| **Branch Manager** | Approve loans, view branch reports. | Approvals, MIS Dashboards |
| **Finance Officer** | Reconcile accounts, process payroll. | Accounting, Payroll |
| **System Admin** | Configure roles, manage institution settings. | IAM, Settings |
