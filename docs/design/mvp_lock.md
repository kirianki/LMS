# MVP Feature Lock (Phase 1)

This document defines the **"Must-Have"** features for the initial release. Anything not on this list is deferred to Phase 2 (Enterprise).

---

## 🚀 IN-SCOPE (Build for MVP)

### 1. SaaS Platform Core
- [ ] **Tenant Provisioning:** Ability to create an institution (tenant) with its own schema.
- [ ] **Institutional Profile:** Branch setup, KRA PIN, logo, and contact info.
- [ ] **User Management:** Super Admin vs. Staff roles.

### 2. Member & Client Management
- [ ] **KYC Onboarding:** Basic details, ID uploads, and contact info.
- [ ] **Group Management:** Ability to group members (essential for SACCO flows).

### 3. Core LMS (The Engine)
- [ ] **Loan Product Builder:** Simple Declining Balance and Flat Rate interest types.
- [ ] **Loan Lifecycle:** Application → Appraisal → Approval → Disbursement.
- [ ] **Penalty Engine:** Automatic late fee calculation (Fixed amount or %).

### 4. Basic Collateral & Guarantees
- [ ] **Asset Registry:** Tracking logbooks, title deeds, or household items.
- [ ] **Guarantor Linking:** Linking other members to a loan as security.

### 5. Document Automation
- [ ] **Core Templates:** Offer Letter and Loan Agreement.
- [ ] **PDF Export:** Immediate download of signed agreements.

### 6. Automated Ledger (Phase 1 Accounting)
- [ ] **Standard Chart of Accounts:** Assets, Liabilities, Equity, Income, Expenses.
- [ ] **Auto-Journaling:** Only for Disbursement and Repayment events.
- [ ] **Basic Reporting:** Trial Balance and Portfolio-at-Risk (PAR) report.

---

## 🚧 OUT-OF-SCOPE (Deferred to Phase 2/3)
❌ **Payroll Management System:** No staff salaries or statutory returns yet.  
❌ **M-Pesa Integration:** Initial repayments will be recorded manually (STK push comes in Phase 2).  
❌ **CRB Checks:** External API integrations are deferred.  
❌ **Referral & Rewards:** No automated commission engine yet.  
❌ **AI Credit Scoring:** Manual appraisal only for now.

---

## ✅ Success Criteria for MVP
1. A tenant can sign up and create a branch.
2. A client can be onboarded with a guarantor.
3. A loan can be disbursed, and the accounting ledger posts the entry automatically.
4. A repayment schedule (PDF) is generated for the client.
