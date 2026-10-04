# Morning report: demo-app3

_Run ap_ad299c42 · 2026-10-04 17:47 · status **done**_

**9 of 9 steps done** · 0 failed · 0 blocked · 0 pending · $5.06 coder ($5.47 with judge, planning and advice) · 65.7 min · resumed 2×

**Next:** Every step finished. Run Check everything, read the report, then ship.

## Steps

| # | Step | Status | Tries | Fixes | Advice | Judge | Cost |
|---|---|---|---|---|---|---|---|
| 1 | Repository, gates and protected acceptance tests | done | 2 | judge | ok | accept | $0.60 |
| 2 | Database schema and data module | done | 2 | finding | ok | accept | $0.50 |
| 3 | Registration, login, logout and the 10-member cap | done | 1 |  | warn | accept | $0.52 |
| 4 | Shared task list and add task | done | 1 |  | ok | accept | $0.41 |
| 5 | Mark done and reopen | done | 1 |  | warn | accept | $0.32 |
| 6 | Reassign a task | done | 1 |  | warn | accept | $0.20 |
| 7 | Done section, ordering and delete by creator | done | 3 | finding, judge | warn | accept | $1.64 |
| 8 | Security hardening and offline guarantees | done | 1 |  | warn | accept | $0.43 |
| 9 | End-to-end scenario, run instructions and backup note | done | 1 |  | ok | accept | $0.45 |

### Step 1: Repository, gates and protected acceptance tests

### Step 2: Database schema and data module

### Step 3: Registration, login, logout and the 10-member cap

### Step 4: Shared task list and add task

### Step 5: Mark done and reopen

### Step 6: Reassign a task

### Step 7: Done section, ordering and delete by creator

### Step 8: Security hardening and offline guarantees

### Step 9: End-to-end scenario, run instructions and backup note

## Findings (medium or worse)

- **medium** step 1 `eslint.config.js` no test file mentions this module
- **medium** step 3 `tests/acceptance/criteria.test.js`:20 hard-coded credential in a test file (a fixture?)
- **medium** step 3 `tests/auth.test.js`:8 hard-coded credential in a test file (a fixture?)
- **medium** step 3 `tests/auth.test.js`:76 hard-coded credential in a test file (a fixture?)
- **medium** step 3 `tests/auth.test.js`:85 hard-coded credential in a test file (a fixture?)
- **medium** step 3 `src/server.js` no test file mentions this module
- **medium** step 4 `tests/tasks-create.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 4 `src/server.js` no test file mentions this module
- **medium** step 4 `src/views.js` no test file mentions this module
- **medium** step 5 `tests/acceptance/criteria.test.js`:20 hard-coded credential in a test file (a fixture?)
- **medium** step 5 `tests/acceptance/criteria.test.js`:37 hard-coded credential in a test file (a fixture?)
- **medium** step 5 `tests/acceptance/criteria.test.js`:41 hard-coded credential in a test file (a fixture?)
- **medium** step 5 `tests/tasks-done.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 5 `tests/tasks-done.test.js`:7 hard-coded credential in a test file (a fixture?)
- **medium** step 5 `src/views.js` no test file mentions this module
- **medium** step 6 `tests/acceptance/criteria.test.js`:20 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/acceptance/criteria.test.js`:37 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/acceptance/criteria.test.js`:41 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/acceptance/criteria.test.js`:57 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/acceptance/criteria.test.js`:62 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/tasks-reassign.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `tests/tasks-reassign.test.js`:7 hard-coded credential in a test file (a fixture?)
- **medium** step 6 `src/views.js` no test file mentions this module
- **medium** step 7 `tests/acceptance/criteria.test.js`:20 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:37 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:41 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:57 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:62 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:76 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/acceptance/criteria.test.js`:77 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/tasks-delete.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/tasks-delete.test.js`:7 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/tasks-done-list.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/tasks-done.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `tests/tasks-done.test.js`:7 hard-coded credential in a test file (a fixture?)
- **medium** step 7 `src/views.js` no test file mentions this module
- **medium** step 8 `tests/security.test.js`:6 hard-coded credential in a test file (a fixture?)
- **medium** step 8 `tests/security.test.js`:7 hard-coded credential in a test file (a fixture?)
- **medium** step 8 `src/server.js` no test file mentions this module
- **medium** step 8 `src/views.js` no test file mentions this module
- **medium** step 9 `tests/acceptance/criteria.test.js`:19 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:36 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:40 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:56 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:61 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:75 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:76 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:106 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/acceptance/criteria.test.js`:114 hard-coded credential in a test file (a fixture?)
- **medium** step 9 `tests/e2e.test.js`:12 hard-coded credential in a test file (a fixture?)

## Protected tests

1 file(s); none weakened

## Trail

- 16:41 step 1 started
- 16:42 judge and coder are from the same vendor; pick another judge model for an independent opinion
- 16:42 step 1: fix attempt 2 of 3 (judge)
- 16:43 step 1: the coder asked 2 question(s); answer them in Decisions, then resume
- 16:43 paused: The coder stopped to ask before changing anything: Protection mechanism is undefined—cannot verify this step's core requirement
- 17:17 resumed
- 17:17 paused: 6 product question(s) are open. Decide them in the Prompt pack panel; the autopilot never fills a blank for you.
- 17:26 resumed
- 17:26 step 1 started
- 17:26 step 1 done
- 17:26 step 2 started
- 17:29 step 2: fix attempt 2 of 3 (finding)
- 17:30 step 2 done
- 17:30 step 3 started
- 17:33 step 3 done
- 17:33 step 4 started
- 17:35 step 4 done
- 17:35 step 5 started
- 17:37 step 5 done
- 17:37 step 6 started
- 17:38 step 6 done
- 17:38 step 7 started
- 17:40 step 7: fix attempt 2 of 3 (finding)
- 17:41 step 7: fix attempt 3 of 3 (judge)
- 17:42 step 7 done
- 17:42 step 8 started
- 17:44 step 8 done
- 17:44 step 9 started
- 17:47 step 9 done
- 17:47 done
