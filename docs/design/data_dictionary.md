# Data Dictionary

This document defines the core entities and their fields.

---

## 1. Tenants (Public Schema)

### `tenants`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `name` | VARCHAR(255) | Institution name |
| `schema_name` | VARCHAR(63) | PostgreSQL schema identifier |
| `kra_pin` | VARCHAR(20) | Tax registration |
| `status` | ENUM | active, suspended, pending |
| `created_at` | TIMESTAMP | Record creation time |

---

## 2. Users & Roles (Tenant Schema)

### `users`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `email` | VARCHAR(255) | Unique login identifier |
| `password_hash` | TEXT | Bcrypt hash |
| `first_name` | VARCHAR(100) | User's first name |
| `last_name` | VARCHAR(100) | User's last name |
| `branch_id` | UUID | FK to `branches` |
| `is_active` | BOOLEAN | Account status |

### `roles`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `name` | VARCHAR(100) | Role name (e.g., Loan Officer) |
| `approval_limit` | DECIMAL | Max loan approval amount |

---

## 3. Clients

### `clients`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `national_id` | VARCHAR(20) | Government ID |
| `first_name` | VARCHAR(100) | First name |
| `last_name` | VARCHAR(100) | Last name |
| `phone` | VARCHAR(15) | Primary contact |
| `email` | VARCHAR(255) | Email address |
| `group_id` | UUID | FK to `groups` (nullable) |

---

## 4. Loans

### `loans`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `client_id` | UUID | FK to `clients` |
| `product_id` | UUID | FK to `loan_products` |
| `principal` | DECIMAL(15,2) | Loan amount |
| `interest_rate` | DECIMAL(5,4) | Annual rate (e.g., 0.24) |
| `term_months` | INT | Loan duration |
| `status` | ENUM | pending, approved, disbursed, closed, default |
| `disbursed_at` | TIMESTAMP | Disbursement date |

### `repayment_schedule`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `loan_id` | UUID | FK to `loans` |
| `due_date` | DATE | Installment due date |
| `principal_due` | DECIMAL | Principal portion |
| `interest_due` | DECIMAL | Interest portion |
| `paid` | BOOLEAN | Payment status |

---

## 5. Accounting

### `chart_of_accounts`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `code` | VARCHAR(20) | Account code (e.g., 1001) |
| `name` | VARCHAR(255) | Account name |
| `type` | ENUM | asset, liability, equity, income, expense |

### `ledger_entries`
| Field | Type | Description |
| :--- | :--- | :--- |
| `id` | UUID | Primary key |
| `journal_id` | UUID | FK to `journals` |
| `account_id` | UUID | FK to `chart_of_accounts` |
| `debit` | DECIMAL | Debit amount |
| `credit` | DECIMAL | Credit amount |
