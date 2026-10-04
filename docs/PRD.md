# Product requirements

Page one is the problem, not the app. Write it before any prompt; let the agent interview you to fill it, but do not let it propose features yet. Everything downstream gets checked against this page.

## Who is this for
Specific enough to predict behaviour. Not "clients": "small business owners who are not comfortable with software, send documents two or three times a year, and phone us when confused".

## What problem exists today
The situation as it is, including the workaround people currently use.

## What must be true for this to have worked
Things you can check in a few months, not revenue targets.

## Explicitly out of scope
The most valuable section. One sentence here refuses dozens of helpful suggestions later. Example: "does not do billing, scheduling, e-signature or messaging; email remains how we communicate".

## Users
3 to 5 personas: name, context, goal, frustration.

## Core features (5 to 10, ordered by value)
1.
2.

## Edge cases the product must survive
- Network failure mid-action
- Duplicate submit
- Empty and maximum input
- Unauthorised user hitting every screen

## Non-functional requirements
- Performance: p95 page load under 1 s, p95 API under 200 ms
- Accessibility: WCAG 2.1 AA
- Privacy: GDPR (data export and deletion), minimal collection
- Availability target:

## Success criteria (what "done" means for v1)
-
