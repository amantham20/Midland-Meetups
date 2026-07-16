# Conversions

One-off migration assets from the legacy Google Sheet / Apps Script stack.

## Files

| Path | Purpose |
|------|---------|
| `Midland Meetups Database.xlsx` | Export of Events, Squad, Memories, RSVPs (sanitized) |
| `seed.json` | Same data as JSON (used by Admin → Import) |
| `import_to_firestore.py` | Optional CLI import if you later add a service account |

**Removed from the workbook:** Chat, Scores, WalterProgress (games/chat dropped; progress had passwords).

---

## Recommended: import in the browser (no service account)

1. Deploy latest **Firestore rules** (admins may create docs):
   ```bash
   firebase deploy --only firestore:rules
   ```
2. Sign in on the site with your bootstrap admin account.
3. Open **`/admin`** → **Import spreadsheet seed**.

That writes events, memories, squad, and legacy RSVPs using your signed-in session.  
Seed file served by the app: `public/seed/midland.json` (copied from `seed.json`).

---

## Optional: Python + service account

Only if you want a CLI path later. Create a key under  
Firebase Console → Project settings → Service accounts → **Generate new private key**  
(Spark plan is fine; this is not Cloud Functions / Blaze).

```bash
pip install openpyxl firebase-admin
export FIREBASE_SERVICE_ACCOUNT_JSON="$(cat /path/to/serviceAccount.json)"
python3 conversions/import_to_firestore.py --dry-run
python3 conversions/import_to_firestore.py
```

Legacy RSVPs use synthetic `userId` values like `legacy_ryan-p`. New RSVPs from the app still use real Auth UIDs.
