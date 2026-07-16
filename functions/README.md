# Deprecated — Firebase Cloud Functions

This folder is **no longer used**.

Firebase Cloud Functions require the **Blaze (pay-as-you-go)** plan. The app
now runs the same jobs as **Next.js Route Handlers**:

| Old Cloud Function     | Replacement                         |
|------------------------|-------------------------------------|
| `setAdminClaim`        | `POST /api/admin/claim`             |
| `sendEventReminders`   | `GET|POST /api/cron/reminders`      |

See the root README for setup (`FIREBASE_SERVICE_ACCOUNT_JSON`, `CRON_SECRET`).

You can delete this directory when convenient; it is kept only as reference.
