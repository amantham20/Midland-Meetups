# App Review response — Midland Meetups

> **Upload a new build first.** This reply states that the app has in-app account
> deletion and in-app reporting. Both flows were just added (More → Delete account,
> More → Report content or a user) and are not in the binary Apple currently has, so
> send this only against a build that contains them. Deploy the updated
> `firestore.rules` at the same time — account deletion depends on the new
> owner-delete permissions, and reporting fails outright without the `reports` rules.
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
Attached. Recorded on an iPhone 15 Pro Max running iOS 27, beginning with app launch.
It covers the full flow: launch, browsing signed out, the calendar permission prompt,
account registration, sign-in, RSVP, submitting user-generated content, organizer
moderation of that content, and account deletion.

2) DEVICES AND OS VERSIONS TESTED
iPhone 15 Pro Max (iOS 27) and iPhone 16 Pro (iOS 26), both physical devices. The
minimum supported version is iOS 17.0. The app is universal: iPhone is portrait-only,
iPad supports all orientations.

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
content or approve its own submission. Organizers can hide or delete any content in
the app. Reporting is in the app: every event and story has a Report action, and
More > Report content or a user covers anything else, including reporting a member or
the person behind a profile. A report takes a reason and optional details, goes only
to the organizers, and appears in More > Admin queue > Reports, where an organizer
marks it reviewed, hides what it points at from every user, deletes it, or dismisses
the report. Reports can also be sent by email to hey@amantham.com, which is published
in the Terms of Use.
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

It sits at 3,859 characters with seven placeholders still in. Substituting real values
for those (two emails, two passwords, a group name, and the site URL twice) will add
roughly 90, landing near 3,950 — so keep what you type short and re-count if you add
anything.

```
MIDLAND MEETUPS — APP REVIEW NOTES

DEMO ACCOUNTS (two account types)
Standard member — <EMAIL> / <PASSWORD>
Organizer/admin — <EMAIL> / <PASSWORD>
Browsing needs no account; sign-in (More > Sign in) is only needed to RSVP, post, or
moderate. Both are in audience group <GROUP>, so restricted events show.

1) RECORDING: attached with this submission, from app launch.
2) TESTED ON: iPhone 15 Pro Max (iOS 27), iPhone 16 Pro (iOS 26), both physical.
Minimum iOS 17.0. Universal: iPhone portrait-only, iPad all orientations.

3) WHAT IT IS. A free, ad-free community bulletin board for a friend group in
Midland, Michigan, USA. It replaces scattered group texts with one board for the
week's plans, who is coming, and the group's history. Audience: adults in that local
circle; general-audience content. No paid content, purchases, or subscriptions.

4) FEATURES. No setup, configuration, or sample files. Happenings loads at launch,
signed out.
- Happenings: next seven days plus a status ticker. Tap an event for detail. "Add to
Calendar" is the app's only permission prompt (write-only; existing events are never
read). RSVP needs sign-in.
- RSVPs: who is coming to each event, upcoming and past.
- Lore: member-written stories; "Add to the Letter" submits one.
- Squad: member directory; join or edit your profile, optional photo via the system
picker (no permission prompt).
- More: Submit an Event, your submissions (editable), Game (opens Safari), Sign
in/out, Report content or a user, Delete account, and — organizer only — the Admin
queue: approvals, full event edit, reports, audience groups.
End to end: as the member, More > Submit an Event > Send Submission reads "Awaiting
approval" and is invisible to others; as the organizer, More > Admin queue > Approve
puts it on Happenings.

ACCOUNTS. Register and sign in at More > Sign in. Delete in-app at More > Delete
account, behind a confirmation alert: it deletes the Auth user, the squad profile and
photo, every RSVP, and every unapproved submission. Published content stays, bylined
"Former member". No support request needed.

UGC AND MODERATION. Posting requires an account. Every submission — event, story,
profile — is written with approved=false and stays hidden from all other users until
an organizer approves it; Security Rules enforce this server-side, so no
client can create pre-approved content or approve its own. Every event and story
carries a Report action; More > Report content or a user covers anything else,
including a member or the person behind a profile. Reports reach organizers only, who
work them in More > Admin queue > Reports: mark reviewed, hide the content from every
user, delete it, or dismiss. By email: hey@amantham.com.
Terms: <SITE URL>/terms. Privacy: <SITE URL>/privacy.

5) EXTERNAL SERVICES. Firebase Authentication (Google), the only auth service, for
email/password sign-in and account deletion via the Identity Toolkit REST API. Cloud
Firestore (Google), the only datastore (events, RSVPs, stories, profiles, groups,
reports), via the Firestore REST API, access enforced by Security Rules. Apple
EventKit, on-device and write-only, for "Add to Calendar". No third-party SDKs: no
payment processor, ads, attribution, analytics, AI, or data providers. "Game" opens a
web page in Safari.

6) REGIONS. Identical features and content in every region and storefront, English
only. No geo-gating, no region-specific content or pricing, no location detection or
permission. Dates and times use the device's locale and time zone. The events are in
Midland, Michigan, but nothing behaves differently by region.

7) REGULATED INDUSTRY / PROTECTED MATERIAL. None. No health, financial, gambling,
dating, alcohol, or licensed-credential features. All content comes from the app's
own users or its operator; no licensed or protected third-party material, no
third-party trademarks, and the only system artwork is Apple SF Symbols.
```
