# RFPulse

RFP & Tender Management Platform with a React frontend and PostgreSQL-backed Express API.

## Quick start

1. Install dependencies:
   ```bash
   yarn install
   ```

2. Create a PostgreSQL database:
   ```bash
   createdb rfpulse
   ```

3. Copy the environment file and update it:
   ```bash
   cp .env.example .env
   ```

4. Apply the schema and seed the database:
   ```bash
   psql $DATABASE_URL -f server/schema.sql
   node server/seed.js
   ```

5. Run both the API and the frontend:
   ```bash
   yarn dev:full
   ```

   Or run them separately:
   ```bash
   yarn server:dev   # API on http://localhost:3000
   yarn dev          # Vite on http://localhost:5000
   ```

## Default superadmin

- **Email:** d.sharstabitau@andersenlab.com
- **Password:** Toriabra909