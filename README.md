# Sweety – Blood Glucose Tracker (MERN-style React + Express + PostgreSQL)

A beginner-friendly full-stack assignment implementation. React + Vite frontend, Node.js + Express REST API, PostgreSQL database, JWT authentication, bcrypt password hashing, reading validation, reports, seed data, and backend tests.

> Although the assignment title says MERN, its explicit requirements specify PostgreSQL. This project therefore uses PostgreSQL rather than MongoDB.

## Features
- Register and log in with name, email, and password.
- Passwords are hashed with bcrypt.
- JWT-protected API; users can only access their own readings.
- Create, list, update, and delete glucose readings.
- Four slots: `Morning (fasting)`, `After breakfast`, `After lunch`, `After dinner`.
- Validation: integer value 40–600 mg/dL, no future date, one reading per slot/day, max four/day.
- Daily, month-to-date, and previous-month reports.
- Daily report lists readings by slot; empty states are shown in the UI.
- Seed script with demo user and sample readings.
- API tests using Node's built-in test runner and a small validation unit test.

## Requirements
- Node.js 20+ (Node 20 or newer recommended)
- PostgreSQL 14+
- npm

## 1. Set up PostgreSQL
Create a database and user (run in `psql` as a database administrator; adjust credentials if you prefer):

```sql
CREATE USER sweety_user WITH PASSWORD 'change_this_password';
CREATE DATABASE sweety_db OWNER sweety_user;
```

Then copy `server/.env.example` to `server/.env` and update `DATABASE_URL`.
Example:
`DATABASE_URL=postgresql://sweety_user:change_this_password@localhost:5432/sweety_db`

The server automatically creates the required tables on startup.

## 2. Start the API
```bash
cd server
npm install
cp .env.example .env
# Edit .env and set DATABASE_URL and a long random JWT_SECRET
npm run dev
```
API defaults to `http://localhost:5000`. Health check: `http://localhost:5000/api/health`.

## 3. Seed demo data
In another terminal:
```bash
cd server
npm run seed
```
Demo login:
- Email: `demo@sweety.local`
- Password: `SweetyDemo123!`

The seed script is safe to re-run: it creates the demo account if absent and replaces that account's sample readings.

## 4. Start the React client
In another terminal:
```bash
cd client
npm install
cp .env.example .env
npm run dev
```
Open the Vite URL shown (usually `http://localhost:5173`).

## 5. Run tests
Start PostgreSQL and configure `server/.env` first.
```bash
cd server
npm test
```
The tests include validation unit tests and API integration tests. API tests use the configured database and clear their test user records. Use a separate test database if you do not want tests touching your development database.

## Environment variables
Server (`server/.env`):
- `PORT`: API port, default 5000
- `DATABASE_URL`: PostgreSQL connection string
- `JWT_SECRET`: long random secret used to sign tokens
- `CLIENT_ORIGIN`: allowed frontend origin, default `http://localhost:5173`
- `NODE_ENV`: `development` or `production`

Client (`client/.env`):
- `VITE_API_URL`: API base URL, default `http://localhost:5000/api`

## API overview
- `POST /api/auth/register` — `{ name, email, password }`
- `POST /api/auth/login` — `{ email, password }`
- `GET /api/auth/me` — authenticated current user
- `GET /api/readings?date=YYYY-MM-DD` — list readings; optional date filter
- `POST /api/readings` — `{ date, slot, value }`
- `PUT /api/readings/:id` — `{ date, slot, value }`
- `DELETE /api/readings/:id`
- `GET /api/reports/daily?date=YYYY-MM-DD`
- `GET /api/reports/month-to-date?date=YYYY-MM-DD`
- `GET /api/reports/previous-month?date=YYYY-MM-DD`

All reading/report endpoints require `Authorization: Bearer <token>`.

## Validation and assumptions
- Dates are calendar dates in `YYYY-MM-DD` format. The server compares them to the server's local calendar date. For a deployed app, use an explicitly chosen user timezone.
- A reading slot is unique per user and date. Database constraints reinforce API validation.
- The maximum of four readings per day follows from the four unique slots; the API also returns a friendly maximum-count message.
- Updating a reading excludes the current row when checking for slot conflicts.
- The average is rounded to one decimal place. Empty reports return `count: 0` and `summary: null`.
- JWT is stored in `localStorage` for this small demo. For production, consider secure, HttpOnly cookies, CSRF protections, rate limiting, password reset, email verification, audit logging, and stronger deployment configuration.
- This is a tracking application, not a medical device. It does not diagnose or recommend treatment.

## Screenshots 
Run the app and capture:
1. Login page and demo credentials.
2. Dashboard with daily readings and reports.
3. Add/edit validation errors.
4. Empty state for a date without readings.
A 2–3 minute recording can follow this flow: login → add reading → show duplicate-slot validation → edit/delete → compare reports → logout.
