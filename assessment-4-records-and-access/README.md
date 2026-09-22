# Assessment 4: The Records and Access Slice

A production-grade records management slice built for Product Engineering Bootcamp Assessment 4. Demonstrates multi-tenant isolation, pre-fetch query scoping, IDOR prevention, non-sequential public identifiers, atomic pre-delete audit logging, and URL-synchronized state.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Setup environment variables
cp .env.example .env

# 3. Initialize SQLite database & seed users
npm run db:init

# 4. Start local development server
npm run dev

# 5. Run automated test suites
npm run test:access
npm run test:queries
```

Open [http://localhost:3004](http://localhost:3004) to access the application.

## Documentation & Review Guide

- Full engineering documentation, concept answers, data models, query optimization tables, attack audit matrices, and visual evidence: [DOCUMENTATION.md](./DOCUMENTATION.md)
- Guide for peer reviewers with test cases and comment taxonomy: [PEER_REVIEW_GUIDE.md](./PEER_REVIEW_GUIDE.md)
