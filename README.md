# Expense Tracker

A responsive React application backed by Django REST Framework and PostgreSQL. Users can securely manage personal categories and expenses, filter and export transactions, review spending charts, and set a monthly budget.

## Features

- JWT registration, login, token refresh, and username/email-based password recovery.
- Per-user category management, including duplicate-name and in-use deletion protection.
- Expense create, view, edit, and delete with positive-amount and non-future-date validation.
- Search by title; filter by category, month, and date range; sort by date or amount; paginate 10 expenses per page.
- Monthly spending totals, category breakdown and chart, and the five most recent expenses.
- Optional per-month budget with an over-budget warning.
- CSV export respects the current search, filters, and sort order.
- API querysets enforce user-level data isolation.

## Requirements

- Python 3.11 or newer.
- Node.js 20.19+ or 22.12+ (required by Vite 8).
- PostgreSQL 14 or newer.

## PostgreSQL setup

Create a database and a user with permission to connect and create the test database used by Django's test runner:

```sql
CREATE DATABASE expense_tracker;
CREATE USER expense_user WITH PASSWORD 'choose-a-local-password';
GRANT ALL PRIVILEGES ON DATABASE expense_tracker TO expense_user;
ALTER USER expense_user CREATEDB;
```

On PostgreSQL 15+, also grant schema access when needed:

```sql
\c expense_tracker
GRANT ALL ON SCHEMA public TO expense_user;
```

## Backend setup

Run these commands from `backend/` in PowerShell:

```powershell
py -3 -m venv .venv
.\.venv\Scripts\Activate.ps1
python -m pip install -r requirements.txt
Copy-Item .env.example .env
```

Edit `backend/.env` with your PostgreSQL credentials and a unique, private `SECRET_KEY`. Keep `.env` out of version control. Then initialize and start Django:

```powershell
python manage.py migrate
python manage.py runserver
```

The API is available at `http://localhost:8000/api/`. Optional admin access:

```powershell
python manage.py createsuperuser
```

Users can request a password reset with their registered email. ExpenseFlow emails a 6-digit OTP; enter it with a new password on the reset screen. The OTP expires after 10 minutes and only resets the ExpenseFlow password; it does not change the user's Gmail password.

Gmail SMTP does not require a paid purchase. To send password-reset OTPs from Gmail, enable 2-Step Verification on the sending Google account and create a Google App Password. Do not use your normal Gmail password. Keep mail credentials out of the repository: configure these as environment variables on the machine that runs Django (for IIS, use Windows **System** environment variables):

```text
EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_HOST_USER=your-gmail-address@gmail.com
EMAIL_HOST_PASSWORD=your-16-character-google-app-password
EMAIL_USE_TLS=True
DEFAULT_FROM_EMAIL=your-gmail-address@gmail.com
```

On Windows, open **System Properties → Advanced → Environment Variables**, add the variables above under **System variables**, and enter your own Gmail address and newly generated App Password without spaces. Do not put the App Password in source code, `.env`, screenshots, or chat. Restart the Django process so it receives the new environment; for IIS, recycle the backend app pool (restart IIS if it still uses the old process environment). If running Django from VS Code, close and reopen VS Code after changing Windows environment variables.

`EMAIL_HOST_USER` must be the same Google account that created the App Password; `DEFAULT_FROM_EMAIL` only sets the visible From address and does not authenticate SMTP. Environment variables take precedence over `.env`, so check for stale Windows or IIS values if mail login fails.

From the backend folder, run `python manage.py test_email your-gmail-address@gmail.com` in the same environment as Django. A successful result means the test message was accepted by Gmail, so check Inbox and Spam. If Gmail closes or rejects the SMTP login, verify the sender account and its current App Password, then restart the backend (for IIS, recycle the app pool). To use console email locally, explicitly set `EMAIL_BACKEND=django.core.mail.backends.console.EmailBackend`; this prints emails in the Django terminal and does not deliver them to an inbox.

## Frontend setup

Open a second PowerShell window and run from `frontend/`:

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Open the frontend site to use the app: the local Vite server is `http://localhost:5173/`, while an IIS-hosted frontend may use a URL such as `http://localhost:8080/`. Register at `/register` or sign in at `/login`. The Django API runs separately; configure its base URL in `frontend/.env.local` with `VITE_API_URL`.

Configure SMTP environment variables on the machine running Django to deliver password-reset OTPs to users' inboxes. Console email output is for local development only and is not sent to an inbox.

## Tests and production build

From `backend/`, with PostgreSQL running and the configured database user allowed to create test databases:

```powershell
python manage.py test
python manage.py check
```

From `frontend/`:

```powershell
npm run build
npm audit --omit=dev
```

## API overview

Password-reset request and confirmation endpoints are public and do not require an access token.

All routes are prefixed by `/api/`. Except registration and login, requests need `Authorization: Bearer <access-token>`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| POST | `/auth/register/` | Register a user |
| POST | `/auth/login/` | Obtain access and refresh tokens |
| POST | `/auth/refresh/` | Refresh an access token |
| POST | `/auth/password-reset/otp/` | Email a password-reset OTP to a registered email address |
| POST | `/auth/password-reset/otp/confirm/` | Set a new password using the email address and OTP |
| POST | `/auth/password-reset/` | Legacy: send a password-reset link by username or registered email |
| POST | `/auth/password-reset/confirm/` | Legacy: set a new password using the link's UID and token |
| GET | `/auth/me/` | Get the current user |
| GET, POST | `/categories/` | List or create categories |
| GET, PUT, PATCH, DELETE | `/categories/{id}/` | Retrieve or manage a category |
| GET, POST | `/expenses/` | List or create expenses |
| GET, PUT, PATCH, DELETE | `/expenses/{id}/` | Retrieve or manage an expense |
| GET, POST | `/budgets/` | List or create monthly budgets |
| GET, PUT, PATCH, DELETE | `/budgets/{id}/` | Retrieve or manage a monthly budget |
| GET | `/dashboard/summary/?month=YYYY-MM` | Get the selected month's totals, category breakdown, five recent expenses, and budget |

Expense list filters: `category`, `month=YYYY-MM`, `date_from=YYYY-MM-DD`, `date_to=YYYY-MM-DD`, `search`, `ordering` (`date`, `-date`, `amount`, `-amount`), and `page`.

## Request flow

For example, adding an expense starts in the React expense form. Axios attaches the access token and sends a request to Django. Django routes it to the expense viewset, validates it with the serializer, saves the authenticated user's expense through the ORM to PostgreSQL, and returns JSON for the React UI to display.
