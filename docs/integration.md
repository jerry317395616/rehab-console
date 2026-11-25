# Frappe integration

## Development backend

The console is served under `/console/`. Requests use same-origin `/api/` URLs. During development, `REHAB_API_TARGET` sets the proxied Frappe origin, with `http://127.0.0.1:8001` as the default.

Use a compatible Rehab deployment for authenticated business workflows. A plain Frappe installation provides native login and logout. The Rehab application supplies session and navigation endpoints and the clinical, scheduling, and billing methods called by `src/pages/Application`.

| Endpoint | Purpose |
| --- | --- |
| `POST /api/method/login` | Native Frappe sign-in and verification |
| `GET /api/method/rehab.frontend_auth.get_session` | Current System User and CSRF token |
| `GET /api/method/rehab.frontend_auth.get_apps` | Applications allowed by the current session |
| `GET /api/method/rehab.frontend_auth.get_application` | Authorized modules and menu items for one application |
| `POST /api/method/logout` | Native Frappe sign-out |

Frappe owns the session cookie. Client writes send the CSRF token from the active session. The development proxy rewrites the cookie for local HTTP. Production should forward the native cookie unchanged and use HTTPS.

## Build and install the assets

```bash
npm ci
npm run build
node scripts/package-rehab-console.mjs
```

The package script prints the output directory and creates a SHA-256 manifest alongside the assets under `rehab/public/console/`. An optional first argument selects a new output directory. Copy the assets into the compatible Rehab app as part of its release. The backend must serve the shell for `/console/*` and serve the built assets from `/assets/rehab/console/` on the same origin.

For validation, use synthetic patient and billing data on an isolated site. Confirm that unauthenticated requests cannot read business records, and check one authorized and one unauthorized role for workflows you change.
