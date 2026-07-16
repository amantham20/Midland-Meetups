# Conversions

One-off migration assets from the legacy Google Sheet / Apps Script stack.

## Files

| Path | Purpose |
|------|---------|
| `Midland Meetups Database.xlsx` | Export of Events, Squad, Memories, RSVPs (sanitized) |
| `import_to_firestore.py` | Load that workbook into Firestore |

**Not imported (intentionally removed from the workbook):**

- `Chat` — removed from the product
- `Scores` / `WalterProgress` — games removed; progress sheet had plaintext passwords

## Import into Firestore

```bash
# from repo root
pip install openpyxl firebase-admin

# service account JSON (Firebase Console → Project settings → Service accounts)
export FIREBASE_SERVICE_ACCOUNT_JSON="$(cat /path/to/serviceAccount.json)"

# preview
python3 conversions/import_to_firestore.py --dry-run

# write
python3 conversions/import_to_firestore.py
```

Docs are written with `merge=True` and prefer the spreadsheet `id` columns (`evt-…`, `sqd-…`, `mem-…`) so re-running the script updates the same rows.

Legacy RSVPs use synthetic `userId` values like `legacy_ryan-p` so they appear in the directory without Firebase Auth accounts. New RSVPs from the app still use real Auth UIDs.

Squad rows keep `photoUrl` (Drive / Googleusercontent links). The app prefers `photoBase64` when present, and falls back to `photoUrl`.
