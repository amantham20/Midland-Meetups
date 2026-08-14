# App Review response — Midland Meetups

> **Upload a new build first.** This reply states that the app has in-app account
> deletion. That flow was just added (More → Delete account) and is not in the binary
> Apple currently has, so send this only against a build that contains it. Deploy the
> updated `firestore.rules` at the same time — the flow depends on the new
> owner-delete permissions.
>
> Fill in every `<PLACEHOLDER>` before sending. Details on what each one needs are in
> [ios/APP_STORE_REVIEW_NOTES.md](ios/APP_STORE_REVIEW_NOTES.md).

---

## Part 1 — Reply to the reviewer

Paste this into the resolution-center reply, with the screen recording attached.

```
Hello,

Thank you for the detailed guidance. A new build is attached with the account
deletion flow described below, and a screen recording is included. All seven items
are answered here, and I have also added this information to the Notes field of the
App Review Information section for future submissions.

DEMO ACCOUNTS (the app has two account types)
Standard member — <EMAIL> / <PASSWORD>
Organizer / admin — <EMAIL> / <PASSWORD>
Sign in from the More tab > Sign in. No account is needed to browse the app;
sign-in is required only to RSVP, post content, or moderate.

1) SCREEN RECORDING
Attached. Recorded on <DEVICE>, iOS <VERSION>, beginning with app launch. It covers
the full flow: launch, browsing signed out, the calendar permission prompt, account
registration, sign-in, RSVP, submitting user-generated content, organizer moderation
of that content, and account deletion.

2) DEVICES AND OS VERSIONS TESTED
<e.g. iPhone 17 Pro (iOS 26.x), iPhone 14 (iOS 26.x), iPad Air 11-inch M3 (iPadOS
26.x)>. Minimum supported version is iOS 17.0. The app is universal: iPhone is
portrait-only, iPad supports all orientations.

3) WHAT THE APP DOES, AND FOR WHOM
Midland Meetups is a free, ad-free community bulletin board for a local friend group
in Midland, Michigan, USA. The problem it solves: plans for casual get-togethers —
cookouts, game nights, trivia — were scattered across group texts, so people missed
events and nobody knew who was coming. The app gives the group one shared board: the
next seven days of plans, live status changes (rain delay / canceled / relocated), a
public RSVP list, a member directory, and an archive of the group's stories. The
target audience is adults in that local social circle, and all content is
general-audience. There is no paid content, no in-app purchase, and no subscription.

4) SETUP AND HOW TO REACH EVERY FEATURE
No setup, no configuration, and no sample files are required. Launch the app and the
Happenings tab loads immediately, signed out.
- Happenings — the next seven days plus a status ticker. Tap an event for its detail
  page. "Add to Calendar" saves it to the device calendar; this is the app's only
  permission prompt (write-only calendar access — the app never reads existing
  events). "I'm going" / "Can't make it" records an RSVP and requires sign-in.
- RSVPs — upcoming and past events, each with the going and can't-make-it name lists.
- Lore — the archive of member-written stories. "Add to the Letter" submits one
  (sign-in required).
- Squad — the member directory. Join or edit your own profile, with an optional photo
  chosen through the system photo picker (this picker shows no permission prompt).
- More — Submit an Event (and your own submissions, each editable), Game (opens an
  external web page in Safari), Sign in, Sign out, Delete account, and, for the
  organizer account only, the Admin queue.
- Admin queue (organizer account) — approve or delete pending events, stories and
  profiles, edit any event, and manage audience groups.
End-to-end path worth trying: sign in as the standard member, go to More > Submit an
Event > Send Submission. The event is labeled "Awaiting approval" and is invisible to
every other user. Sign out, sign in as the organizer, go to More > Admin queue >
Approve. The event now appears on Happenings.
Some events are restricted to an audience group by the organizer. Both demo accounts
are members of <GROUP NAME>, so all such events are visible to them.

ACCOUNT REGISTRATION, LOGIN AND DELETION
Registration and login are at More > Sign in, which toggles between "Sign in" and
"Create an account" (email, password, display name). Account deletion is initiated
entirely in the app at More > Delete account, behind a confirmation alert. It is a
real deletion, not a deactivation: it deletes the Firebase Authentication user, the
member's squad profile including their photo, email, bio and social link, every RSVP
they have made, and every submission still awaiting approval. Content already
published to the board remains, because other members' plans depend on it, but the
member's name is removed from it and replaced with "Former member". No support
request, email, or website visit is required at any point.

USER-GENERATED CONTENT AND MODERATION
Posting anything requires a signed-in account. Every submission — event, story, or
profile — is written with approved=false and stays hidden from all other users until
an organizer approves it in the in-app Admin queue. This is enforced server-side by
Cloud Firestore Security Rules, not only in the UI: no client can create pre-approved
content or approve its own submission. Organizers can delete any content and disable
any account. Users can report content or an account <IN-APP REPORT PATH> and by email
to hey@amantham.com, which is published in the Terms of Use.
Terms of Use, including the content guidelines: <SITE URL>/terms
Privacy Policy: <SITE URL>/privacy

5) EXTERNAL SERVICES USED
- Firebase Authentication (Google) — email and password sign-in and account deletion,
  called over the Identity Toolkit REST API. This is the only authentication service.
- Cloud Firestore (Google) — the only datastore, holding events, RSVPs, stories,
  profiles and audience groups, called over the Firestore REST API. All access is
  enforced by Firestore Security Rules.
- Apple EventKit — on-device only, write-only, used for "Add to Calendar".
The app bundles no third-party SDKs and no external dependencies of any kind. There
is no payment processor, no in-app purchase or subscription, no advertising or
attribution SDK, no analytics SDK, no AI service, and no third-party data provider.
The "Game" item in the More tab opens a public web page in Safari and is not part of
the app's own functionality.

6) REGIONAL DIFFERENCES
None. The app offers identical features and content in every region and storefront,
in English only. There is no geo-gating, no region-specific content or pricing, and
no location detection or location permission. Dates and times render in the device's
own locale and time zone. The events described take place in Midland, Michigan, so
the content is chiefly of local interest, but nothing in the app behaves differently
by region.

7) REGULATED INDUSTRY OR PROTECTED THIRD-PARTY MATERIAL
Not applicable. The app operates in no regulated industry — it has no health,
medical, financial, insurance, gambling, dating, alcohol or cannabis, or licensed
credential features. All content is created by the app's own users or by its
operator. The app includes no licensed or protected third-party material and no
third-party trademarks or logos; the only system artwork used is Apple SF Symbols. No
authorization or credential is required to operate the service.

Please let me know if anything else would help the review.
```

---

## Part 2 — App Review Information → Notes field

The reply above runs past the Notes field's 4,000-character cap. Paste this condensed
version there instead — it carries the same seven answers and is what Apple asked you
to keep on file for future submissions.

It sits at 3,981 characters with the placeholders still in, so keep what you
substitute short — a long device list will push it over the cap.

```
MIDLAND MEETUPS — APP REVIEW NOTES

DEMO ACCOUNTS (two account types)
Standard member — <EMAIL> / <PASSWORD>
Organizer/admin — <EMAIL> / <PASSWORD>
Browsing needs no account; sign-in (More > Sign in) is only needed to RSVP, post, or
moderate. Both accounts are in audience group <GROUP>, so restricted events are
visible to them.

1) RECORDING: attached with this submission, from app launch.
2) TESTED ON: <DEVICES AND OS>. Minimum iOS 17.0. Universal: iPhone portrait-only,
iPad all orientations.

3) WHAT IT IS. A free, ad-free community bulletin board for a local friend group in
Midland, Michigan, USA. It replaces scattered group texts, where people missed
get-togethers and nobody knew who was coming, with one shared board for the week's
plans, who is coming, and the group's history. Audience: adults in that local social
circle; general-audience content. No paid content, purchases, or subscriptions.

4) FEATURES. No setup, configuration, or sample files. Happenings loads at launch,
signed out.
- Happenings: next seven days plus a status ticker. Tap an event for detail. "Add to
Calendar" saves it to the device calendar — the app's only permission prompt
(write-only; existing events are never read). RSVP buttons need sign-in.
- RSVPs: who is coming to each upcoming and past event.
- Lore: member-written stories; "Add to the Letter" submits one (sign-in needed).
- Squad: member directory; join or edit your profile, optional photo via the system
picker (no permission prompt).
- More: Submit an Event, your own submissions (editable), Game (opens Safari), Sign
in/out, Delete account, and — organizer only — the Admin queue: approve or delete
pending events, stories and profiles, edit any event, manage audience groups.
End to end: as the member, More > Submit an Event > Send Submission — it reads
"Awaiting approval" and is invisible to everyone else. As the organizer, More >
Admin queue > Approve — it appears on Happenings.

ACCOUNTS. Register and sign in at More > Sign in. Delete in-app at More > Delete
account, behind a confirmation alert: it deletes the Auth user, the squad profile and
photo, every RSVP, and every unapproved submission. Published content stays, with the
byline replaced by "Former member". No support request needed.

UGC AND MODERATION. Posting requires an account. Every submission — event, story,
profile — is written with approved=false and stays hidden from all other users until
an organizer approves it; Firestore Security Rules enforce this server-side, so no
client can create pre-approved content or approve its own. Organizers can delete any
content and disable any account. Report content or a user <IN-APP PATH> or at
hey@amantham.com. Terms: <SITE URL>/terms. Privacy: <SITE URL>/privacy.

5) EXTERNAL SERVICES. Firebase Authentication (Google) for email/password sign-in and
account deletion via the Identity Toolkit REST API — the only auth service. Cloud
Firestore (Google), the only datastore (events, RSVPs, stories, profiles, groups),
via the Firestore REST API, access enforced by Security Rules. Apple EventKit,
on-device and write-only, for "Add to Calendar". The app bundles no third-party SDKs
or dependencies: no payment processor, ads, attribution, analytics, AI, or data
providers. The "Game" link opens a public web page in Safari.

6) REGIONS. Identical features and content in every region and storefront, English
only. No geo-gating, no region-specific content or pricing, no location detection or
permission. Dates and times use the device's locale and time zone. Events are in
Midland, Michigan, so the content is of local interest, but nothing behaves
differently by region.

7) REGULATED INDUSTRY / PROTECTED MATERIAL. None. No health, financial, gambling,
dating, alcohol, or licensed-credential features. All content is created by the app's
own users or its operator, with no licensed or protected third-party material and no
third-party trademarks; the only system artwork is Apple SF Symbols.
```
