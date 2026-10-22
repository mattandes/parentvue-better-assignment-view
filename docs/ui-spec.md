# UI spec: the popup and the overlay

_Last updated 2026-10-21. Rules for the flags are in `business-rules.md`; this file describes what is on screen and how it behaves._

## The toolbar popup
Clicking the extension's toolbar icon opens a small popup (320px wide, light or dark with the OS). It looks at the current tab and shows one of three states (`PVPortal.describePage`):

| State | When | Shows |
|---|---|---|
| Not supported | not an https page, or not a ParentVUE path (`/PXP2_*`, `/Home_PXP2.aspx`) | "This only works on ParentVUE pages. Open your school's ParentVUE, then click this icon again." No button, and no permission is ever requested |
| Enable | a ParentVUE page on a site not yet approved | "Turn on the better assignment view for <host>?", a note that Chrome will ask to confirm and that nothing is sent anywhere, and **Enable on <host>** |
| Enabled | a ParentVUE page on an approved site | "Enabled on <host>. Open the Grade Book to see the Better assignment view button." and **Disable on this site** |

**Enable** asks Chrome for access to exactly that site (the permission request runs straight from the click), then registers the scripts through the service worker and injects them into the open tab so no reload is needed. If the parent declines, nothing changes ("Permission was not granted, so nothing changed."). **Disable** removes the permission and the registration and says "Disabled. Reload this page to remove the button."

## Entry point
- A floating **Better assignment view** button, bottom-right, fixed, 84px above the bottom edge so it clears the portal's footer. Only on the gradebook page.
- Clicking it opens the overlay (full viewport, above everything). Page scrolling is locked while it is open.
- **Esc** or the ✕ closes it and restores the page. Only one overlay at a time.

## Layout (top to bottom)
1. **Sticky header, row 1:** title "Assignments for <student>" (first name read from the page; "Assignments" if not found); term picker (the portal's terms, for example Q1 to Q4; the current term is selected on open); "As of <time>"; **Legend**, **Dark mode / Light mode**, **Refresh**, **✕**.
2. **Sticky header, row 2:** filter chips (All, Needs attention, Due soon, Below proficient, each with a count); **Type** dropdown; search box ("Search assignments"); **Sort by due date** dropdown (Oldest first, Newest first); **Collapse all / Expand all**.
   **Sticky header, row 3:** a muted line once data has loaded: "Not seeing a recent grade? Sign out of ParentVUE and back in, then reopen this view." (Refresh reuses the same session, so it can't clear stale grades.)
3. **Summary tiles:** Missing, Past due not graded, Due in the next 7 days, Below proficient, Assignments. Zero counts are dimmed; non-zero tiles use the highlight color.
4. **One card per class**, in period order. Collapsible; open by default.
5. **Legend:** standards marks, Traits of Learners, and what the highlight colors mean. The Legend button scrolls to it.

## Class card
- Header: class title; **overall mark** pill (for example `PR (3)`, colored by mark); "Period N · Teacher" followed by an icon-only envelope button (tooltip and accessible name "Email teacher"; dark outline and icon so it stays visible in light mode), a `mailto:` link to the teacher's address with the subject "Student - Class - Period N", using the same first name as the title; no button when the portal has no valid address; clicking it doesn't collapse the card; right-aligned pills for counts (`N missing`, `N not graded`, `N due soon`, `N below proficient`, `N assignments`).
- Table columns: Assignment, Type, Due, Score, Standards, Status.
  - **Assignment:** name; the teacher's comment in quotes below it when there is one; "Only in <period>" when it exists only in another period of the term, named for that period.
  - **Type:** a small pill (Formative, Summative, ...).
  - **Due:** `Thu, Oct 8` with a relative line beneath for ungraded work ("12 days ago", "yesterday", "today", "tomorrow", "in 3 days").
  - **Score:** `5/10` for numeric scores, blank otherwise.
  - **Standards:** one chip per marked standard: the code, then the mark in bold. Only the mark is colored. Hover shows the standard's description and the mark's meaning.
  - **Status:** a pill: red for Missing and Not graded, amber "Due soon", green Graded, grey otherwise.
- Row tint: red with a left bar for needs attention; amber with a left bar for due soon; dimmed text for Excused and Dropped.
- A class with no assignments left after filtering is hidden, except when no filter or search is active.

## Behaviors
- **Term change** loads that term's periods (cached per period); **Refresh** refetches. A response that arrives after a newer request started is ignored, and a request that takes longer than 20 seconds ends with a message.
- **Filters combine:** Type, then chip, then search. The Type filter also changes the tile and chip counts. If the chosen type is absent in another term, the filter resets to All types.
- **Collapse state** is remembered per class while the overlay is open.
- **Theme:** starts from the OS light or dark setting; the toggle overrides and is remembered in the extension's storage (`chrome.storage.local`; failures ignored). Both themes keep red, amber, lavender and green distinguishable.
- **Empty and error states:** "Loading…" while fetching; "No classes or assignments in Q3 yet." for an empty term; "Nothing matches." when filters hide everything; an error box for failures, with these messages:
  - session expired: "Your ParentVUE session has expired. Reload the page and sign in again."
  - network failure: "Could not reach ParentVUE. Check your connection and try Refresh."
  - unexpected response: "ParentVUE returned something unexpected (HTTP n). It may have changed."
  - app error from the portal: "ParentVUE error (<call>): <message>"
- **Narrow windows (under about 820px):** the table rows stack into two columns; the header wraps.

## Accessibility and robustness
- The overlay is a modal dialog (`role="dialog"`, `aria-modal`, labelled). Focus moves into it on open, Tab stays inside it, and focus returns to the page button on close. Controls are real buttons, selects and inputs; smooth scrolling is turned off for people who prefer reduced motion.
- Highlights always have a text equivalent (status text, counts), not color alone.
- All data from the portal is HTML-escaped before display.
- The overlay lives in a shadow root and adds nothing to the page except the button and the overlay host.

## Not in this version
Remembering the term and filters between visits, switching students, printing, and any editing.
