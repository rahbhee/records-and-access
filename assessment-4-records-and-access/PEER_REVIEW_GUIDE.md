# Peer Review Guide — Assessment 4: The Records and Access Slice

Welcome! This guide is designed to help peer reviewers quickly set up, test, and evaluate this Pull Request according to the **Task 4 (Code Review)** and **Assessment 4 (Records and Access Slice)** rubrics.

---

## 🚀 1. Quick Setup & Running Locally

To review this branch locally on your machine, run:

```bash
# 1. Switch to project directory
cd assessment-4-records-and-access

# 2. Install dependencies
npm install

# 3. Create environment file from template
cp .env.example .env

# 4. Initialize SQLite database & seed multi-tenant accounts
npm run db:init

# 5. Start development server
npm run dev
```

Open **[http://localhost:3004](http://localhost:3004)** in your browser.

---

## 🧪 2. Automated Test Suites to Run

We have included two automated test suites to verify core security and query performance:

```bash
# Test multi-tenant isolation, IDOR defense & pre-delete audit logging
npm run test:access

# Measure and verify query count reductions across List, View, and Delete actions
npm run test:queries
```

---

## 🔍 3. What to Test (Things to Try)

Per the Task 4 review requirement (*"Try one thing the author probably did not test"*), here are key interactive flows to test:

1. **Multi-Tenant Isolation**:
   - Switch between **Alice** (`alice@company.com`) and **Bob** (`bob@company.com`) using the tenant switcher in the top bar.
   - Verify Alice sees only her records, and Bob sees only his records.
2. **IDOR & Cross-Tenant URL Tampering**:
   - While logged in as Bob, copy a record ID (e.g. `rec_...`).
   - Switch to Alice, paste Bob's record ID into the URL parameter (`?record=rec_...`), and press Enter.
   - Verify that an honest **403 Forbidden** security alert is shown and no confidential data leaks.
3. **Session Persistence on Page Refresh**:
   - Select Bob, click one of his records, and refresh the browser.
   - Verify that the page reloads as Bob and displays his record cleanly.
4. **Atomic Pre-Delete Audit Trail**:
   - Delete a record.
   - Check the **Audit Trail** table at the bottom of the page to verify that a `RECORD_DELETED` snapshot was persisted before the record was removed.
5. **Genuine Empty State**:
   - Delete all records for Bob until count is 0.
   - Verify the UI renders a genuine empty state without placeholder/dummy data.

---

## ⚠️ 4. Intentional Scope & "Do Not Build" Boundaries

Please note that the following features were **deliberately not built** per the assessment brief:
- ❌ **No editing / updating records** (strictly Create, List, View, Delete)
- ❌ **No search bars, tags, or filters**
- ❌ **No sharing, collaboration, or landing pages**

*Feedback requesting these features is outside the scope of this slice.*

---

## 📝 5. BootCamp Code Review Structure

When writing your review comments, please use the 4 mandatory tags required by the Bootcamp:

- **`[Blocking]`**: Critical security leaks (e.g. un-scoped queries, raw database ID leaks), data corruption, or crashing bugs that must be fixed before merging.
- **`[Should fix]`**: Code quality, missing edge cases, performance issues, or architectural improvements for future maintainability.
- **`[Question]`**: Questions regarding design choices, tradeoffs, or rationale.
- **`[Praise]`**: At least one positive comment highlighting something done well (e.g. clean transaction handling, query scoping, UI polish).

Please conclude your review with a **one-paragraph summary** and an explicit decision (**Approve**, **Request Changes**, or **Comment**).
