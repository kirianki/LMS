# API Design Document

**Project:** MFI & SACCO SaaS Platform  
**API Version:** v1

---

## 1. API Standards

| Aspect | Standard |
| :--- | :--- |
| **Protocol** | HTTPS only |
| **Format** | JSON |
| **Auth** | Bearer JWT |
| **Versioning** | URL prefix (`/api/v1/`) |
| **Pagination** | Cursor-based |

---

## 2. Core Endpoints

### A. Authentication
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| POST | `/api/v1/auth/login/` | Obtain JWT |
| POST | `/api/v1/auth/refresh/` | Refresh token |
| POST | `/api/v1/auth/logout/` | Invalidate session |

### B. Clients (Members)
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/v1/clients/` | List clients (paginated) |
| POST | `/api/v1/clients/` | Create client |
| GET | `/api/v1/clients/{id}/` | Retrieve client |
| PATCH | `/api/v1/clients/{id}/` | Update client |

### C. Loans
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/v1/loans/` | List loans |
| POST | `/api/v1/loans/` | Create loan application |
| GET | `/api/v1/loans/{id}/` | Retrieve loan |
| POST | `/api/v1/loans/{id}/approve/` | Approve loan |
| POST | `/api/v1/loans/{id}/disburse/` | Disburse loan |
| POST | `/api/v1/loans/{id}/repay/` | Record repayment |

### D. Accounting
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| GET | `/api/v1/accounts/` | List Chart of Accounts |
| GET | `/api/v1/journals/` | List journals |
| GET | `/api/v1/reports/trial-balance/` | Generate Trial Balance |

---

## 3. Request/Response Examples

### Create Loan Application
```json
// POST /api/v1/loans/
{
  "client_id": "uuid",
  "product_id": "uuid",
  "principal": 50000.00,
  "term_months": 12,
  "purpose": "Business expansion"
}
```

### Response
```json
{
  "id": "uuid",
  "status": "pending",
  "client": { "id": "uuid", "name": "John Doe" },
  "principal": 50000.00,
  "created_at": "2026-01-14T09:00:00Z"
}
```

---

## 4. Error Handling
```json
{
  "error": {
    "code": "INSUFFICIENT_COLLATERAL",
    "message": "Loan-to-Value ratio exceeds 80%.",
    "details": { "ltv": 0.92 }
  }
}
```
