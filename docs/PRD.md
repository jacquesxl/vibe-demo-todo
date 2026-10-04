# Product requirements

## Who is this for
A small internal team, a workshop crew of up to 10 people, who coordinate everyday chores and small jobs together.

## What problem exists today
The team tracks who is doing what and by when on a whiteboard and in chat messages. This product replaces the whiteboard. There is nothing to import.

## What must be true for this to have worked
- The team no longer needs the whiteboard to track who is doing what by when.
- Every task has a title, an owner and a due date, and can be marked done.
- Any member can hand a task to another member.
- Finished tasks stay available and can be reopened.
- The team is made up of the first 10 people who register.

## Explicitly out of scope
- Sub-tasks, approval workflows and special fields: the founder wants only "title, owner, due date, done".
- Instant updates for everyone: "No real-time sync. Simple beats fast."
- An admin role: "an admin is not needed". Members are not deleted.
- Payment of any kind: "No subscription, no licence, no analytics."
- Connections to existing logins or other systems: "No existing logins or integrations."
- Importing from the whiteboard: "nothing to import".
- Automatic deletion of finished tasks: "Nothing is deleted automatically."

## Users
- **Team member:** one of the first 10 people to register with an e-mail and a password. All members have the same abilities. There is one team and one shared list.

## Core features (5 to 10, ordered by value)
1. A member can see one shared list of tasks for the whole team.
2. A member can add a task with a title, an owner and a due date.
3. A member can mark a task done.
4. A member can reassign a task to another member. Tasks keep their owner until someone changes it.
5. A member can see done tasks kept apart from open ones, newest first, and reopen them.
6. A member can delete a task they created.
7. A person can register and log in with an e-mail and a password.

## Edge cases the product must survive
- An owner leaves the team or goes on vacation: any member can reassign their tasks, and until then the tasks keep that owner.
- An 11th person registers: only the first 10 registrations are the team.
- A member tries to delete a task someone else created: only the creator can delete it.
- A done task is reopened.
- A person who is not registered or not logged in asks for the list. UNDECIDED: what should they get?
- No tasks exist yet. UNDECIDED: what should a member be shown?
- An action is interrupted midway or submitted twice. UNDECIDED: what should happen to the task?

## Non-functional requirements
- Changes do not need to reach other members instantly.
- No analytics are collected.
- Accessibility: UNDECIDED: what standard, if any, must it meet?
- Privacy law: UNDECIDED: which rules apply to the stored e-mails and passwords?
- Availability: UNDECIDED: when must the product be reachable?

## Success criteria (what "done" means for v1)
1. Up to 10 people can register with an e-mail and a password, and the first 10 registrations form the team.
2. Every task has a title, an owner and a due date, and can be marked done.
3. Any member can reassign a task to another member, and the task keeps its owner until then.
4. Done tasks remain available, newest first, and can be reopened. A member can delete a task they created.
5. The team no longer uses the whiteboard to track who is doing what.

## Undecided
- What should a person who is not logged in get when they ask for the list?
- What should a member be shown when there are no tasks?
- What should happen to a task when an action is interrupted or submitted twice?
- "Newest first" for done tasks: newest by completion or by creation?
- Which accessibility standard, if any, must it meet?
- Which privacy rules apply to the stored e-mails and passwords?
- When must the product be reachable?

## Parked (arrived early)
- "Polling or a page refresh is fine": how other members' changes arrive.
- "'Done' heading": how finished tasks are presented.
- "runs on one machine on the local network": hosting.
