/* =====================================================================
   THE MIDLAND MIXER — configuration
   Paste your deployed Google Apps Script Web App URL below, between
   the quotes. See apps-script/Code.gs and the README for setup steps.

   It looks like:
   https://script.google.com/macros/s/AKfycb.../exec
   ===================================================================== */

const APPS_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbzUjmfugZe7jkOt_kfbHo902DLnHJx9Hc7U8ICkzWFf17Xtk7RSSSHdlvpGK9FVsFsV/exec";

/* Simple password for the "Submit an Event" page. This is a light gate to
   keep the form from being stumbled on by strangers — not real security.
   Since this is a static site, anyone who views the page source can see
   this value, so don't rely on it for anything sensitive. */
const SUBMIT_PASSWORD = "gatsbymethod";

/* Same idea, gating the Chat page. */
const CHAT_PASSWORD = "ryanisthebest";
