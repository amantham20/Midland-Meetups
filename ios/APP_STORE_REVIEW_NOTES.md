# App Store review information — Midland Meetups (iOS)

Everything below is drawn from the `ios/` target, `firestore.rules`, and the web app's
`/privacy` and `/terms` pages. Placeholders in `<ANGLE BRACKETS>` are the only things
I could not determine from the repo.

---

## 1. The reply itself

Both paste-ready blocks — the full reply to the reviewer and the condensed version
for the 4,000-character Notes field — live in [response.md](../response.md). This
file is the working checklist behind them.

---

## 2. What only you can supply

**The screen recording (item 1).** Physical device, latest iOS, starting at launch.
Apple asks specifically for registration, login, and account deletion; purchases;
user-generated content with its reporting and blocking mechanisms; and every
permission prompt. Suggested take, in order:

1. Cold launch → Happenings loads signed out (proves no login wall).
2. Tap an event → detail → **Add to Calendar** → the write-only calendar permission
   prompt appears → Allow → the confirmation toast.
3. More → Sign in → **Create an account** → register with a fresh email → signed in.
4. Back to an event → **I'm going** → your name appears on the RSVP list.
5. More → Submit an Event → fill and **Send Submission** → the "Awaiting approval"
   badge (this is the UGC pre-moderation story).
6. Sign out → sign in as the organizer → More → Admin queue → **Approve** → the event
   appears on Happenings. Also show a reject/delete.
7. Lore → Add to the Letter, and Squad → profile with a photo from the picker.
8. Any event → **Report this event** → pick a reason → **Send report**, then as the
   organizer, More → Admin queue → **Reports** → **Mark reviewed** or **Delete
   content**. This is the reporting mechanism Apple asks to see.
9. More → **Delete account** → the confirmation alert → the account is gone and the
   app drops back to signed out. Use a throwaway account for this take.

**The site URL** for the privacy and terms links. The deployed domain is not
committed anywhere in the repo, so it is still a placeholder in two spots.

**Item 2 is filled in:** iPhone 15 Pro Max (iOS 27) and iPhone 16 Pro (iOS 26), both
physical devices. See gap #5 — that list is iPhone-only while the app still ships as
universal.

**Demo credentials for both account types.** Create them fresh rather than reusing a
real member's account — a reviewer will post test content and approve/delete things.
The organizer account needs admin rights, which means either the `admin` custom claim
or its UID added to `isBootstrapAdmin()` in [firestore.rules](../firestore.rules) and
to `NEXT_PUBLIC_ADMIN_UIDS`. Add both accounts' emails to one audience group so the
reviewer can see restricted events too.

---

## 3. Gaps to close before resubmitting

These came out of reading the code, and each maps to a guideline Apple has rejected
on before. The first two are fixed; the rest are still open.

### 1. ~~No in-app account deletion~~ — Guideline 5.1.1(v) — **DONE**

Shipped. More → **Delete account**, behind a confirmation alert, in
[MoreView.swift](MidlandMeetups/Features/Account/MoreView.swift). It calls
`DataStore.erasePersonalData` and then `SessionStore.deleteAccount`, in that order —
Firestore first, because the rules match every deletion against the signed-in uid and
once the Auth user is gone there is no way back in to finish the cleanup.

What it removes: the Auth user (Identity Toolkit `accounts:delete`), the squad
profile with its photo, email, bio and social link, every RSVP, and every submission
still awaiting approval. Published events and stories stay on the board, because
other members' RSVPs hang off them, with the byline rewritten to "Former member" and
the uid link cleared. The one thing left is `createdBy`, a uid that no longer
resolves to an account.

[firestore.rules](../firestore.rules) gained the permissions this needs: an owner may
delete their own unapproved event, an author their own unapproved memory, and a
member their own squad profile; an author may also rewrite the `author` field on a
published memory and nothing else. Verified against the Firestore emulator — the six
deletion paths succeed and eight boundaries still hold (an owner still cannot delete
a published event, edit a memory's text through the byline rule, or touch anyone
else's content).

**Deploy the rules with the build**, or the flow fails on everything but RSVPs:

```bash
firebase deploy --only firestore:rules
```

### 2. ~~No in-app report~~ — Guideline 1.2 — **DONE** (block is still open)

Events, stories, squad profiles and RSVP names are all user-generated. The strong
defense is that everything is pre-moderated: nothing is visible to anyone else until
an organizer approves it, enforced in the rules. That satisfies the filtering
requirement, and the reply leads with it. 1.2 also asks for a mechanism to report
content and a mechanism to block abusive users; **reporting now ships, blocking does
not.**

Reporting, in both apps. A **Report** action sits on the event detail and on each
Lore story. The always-available path is **More → Report content or a user** on iOS
and `/report` on the web (linked in the footer) — that's the one that covers a member
or the person behind a profile, along with anything else that has no single document
to attach to. The sheet takes a reason from a fixed list plus optional details, and
every screen also offers the mail fallback to hey@amantham.com prefilled with what's
being reported. Files:
[ReportSheet.swift](MidlandMeetups/Features/Report/ReportSheet.swift) and
[ReportDialog.tsx](../src/components/ReportDialog.tsx).

Reports land in `reports` and surface in the in-app organizer queue — Admin →
Reports on both platforms — where an organizer marks one reviewed, hides what it
points at from every user, deletes it, or dismisses the report. A report keeps its
target's title, so the queue still reads after the content is gone.

Taking content down, in both apps. Organizers hide or delete any event, Lore story or
squad profile from **Admin → Events / Lore Letter / Reports**. Hiding writes
`approved: false`, the same flag that gates a brand-new submission, so the read rule
in [firestore.rules](../firestore.rules) — not just the UI — puts it out of every
member's reach; it's reversible, which is what makes it the right first move on a
report. Deleting removes the document outright.

[firestore.rules](../firestore.rules) makes the queue write-only for members:
creating one requires an account and is pinned to `request.auth.uid` with
`status == 'open'`, and **only admins can read** — a reporter can't read back even
their own report. Verified against the Firestore emulator: 19 report cases (create,
read, resolve) and 4 regressions on the untouched collections all hold.

**Deploy the rules with the build.** Until they are deployed the collection is
unreadable and unwritable: reports fail to send, and the queue shows "Couldn't read
the reports queue" instead of the reports (the rest of the admin page still loads).

```bash
firebase deploy --only firestore:rules
```

Still open: **blocking**. There is no way for a member to hide another member's
content or RSVP name. [terms/page.tsx](../src/app/terms/page.tsx) is now specific
about the reporting path and keeps blocking and muting conditional ("where the
Application provides them"), so the terms no longer promise a control the app
lacks — but a reviewer holding the app to the letter of 1.2 may still ask. A local
block list (on-device, hiding a blocked member's events, stories, profile and RSVP
name) is the cheapest way to close it.

### 3. No Privacy Policy or Terms link inside the app

The web app has both pages, but the More tab links to neither. Add two rows. The
privacy policy URL is separately required in App Store Connect metadata.

### 4. Calendar purpose string could be stronger — Guideline 5.1.1

Current, from the project file: "Midland Meetups adds events you choose to your
calendar." Apple asks for the reason plus an example of use. Suggested replacement
for `INFOPLIST_KEY_NSCalendarsWriteOnlyAccessUsageDescription`:

> Midland Meetups saves meetups you pick to your calendar — for example, tapping
> "Add to Calendar" on a cookout adds that event to your default calendar. The app
> never reads your existing events.

### 5. iPad is in scope

`TARGETED_DEVICE_FAMILY = "1,2"` means the app is submitted for iPad as well, so it
must be tested on a physical iPad and needs iPad screenshots. If iPad support is not
intended, drop it to `"1"` before submitting.

### 6. Screenshots — Guideline 2.3.3

Apple called this out in the same message. Make sure the store screenshots show
Happenings, an event detail with RSVPs, Lore and Squad in use — not the sign-in
screen or a splash.
