# PRD generation

Write `docs/PRD.md` from the interview transcript or notes below. Output Markdown only, no preamble.

Structure (keep the headings exactly; they are checked by the problem gate):

```
# Product requirements

## Who is this for
## What problem exists today
## What must be true for this to have worked
## Explicitly out of scope
## Users
## Core features (5 to 10, ordered by value)
## Edge cases the product must survive
## Non-functional requirements
## Success criteria (what "done" means for v1)
## Undecided
```

Rules
- Every sentence must trace to something the founder said. Do not fill blanks with sensible defaults. If a section cannot be filled from the source, write one line: `UNDECIDED: <the question the founder must answer>` and list the same question under `## Undecided`.
- Product layer only. No layout or interaction words (dashboard, button, modal, dropdown, drag-and-drop, screen, tab). No technical words (table, database, API, bucket, cached, endpoint, auth provider, framework). If the founder used such words, translate them into the capability they imply and park the original wording in a final `## Parked (arrived early)` list.
- No invented precision. No file formats, size limits, counts, durations or prices unless the founder stated them. Where a limit is needed, write `UNDECIDED: <limit>`.
- "Explicitly out of scope" must name at least three adjacent things the product will not do and the reason, in the founder's words where possible.
- Core features: one line each, capability phrased as "<user> can <do>", ordered by the value the founder expressed. Five to ten. If fewer than five were discussed, list what was discussed and add `UNDECIDED` for the rest, do not invent.
- Edge cases: only those that follow from the problem description (network failure mid-action, duplicate submit, empty state, wrong file, unauthorised user). No exotic cases.
- Non-functional: only what the founder committed to (accessibility, privacy law, uptime, response time). Otherwise `UNDECIDED`.
- Success criteria: three to five checkable statements from "what must be true".
- Length: one page. Around 400 to 700 words. Shorter beats padded.

Self-check before output: does any sentence contradict another? Does any sentence contain a number or format the founder did not say? Does any sentence describe how instead of what? Fix, then output.

---

Source:
