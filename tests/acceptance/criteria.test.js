// PROTECTED ACCEPTANCE TESTS. One per success criterion in docs/PRD.md.
// Later steps may only un-skip a test (and fill in its body) or add new tests.
// Never weaken, rename or delete these. Each skip reason names the step that makes it pass.
import { describe, test, expect } from 'vitest';
import request from 'supertest';
import { openDb, countUsers } from '../../src/db.js';
import { createApp } from '../../src/server.js';

const NOT_BUILT = 'acceptance test body not written yet';
const TEAM_SIZE = 10;

describe('acceptance criteria', () => {
  test('C1 [step 3] up to 10 people register and the 11th is refused', async () => {
    const db = openDb(':memory:');
    const app = createApp({ db });
    const join = (n) =>
      request(app)
        .post('/register')
        .type('form')
        .send({ email: `person${n}@example.com`, displayName: `Person ${n}`, password: 'a long password' });
    for (let n = 1; n <= TEAM_SIZE; n += 1) {
      expect((await join(n)).status).toBe(303);
    }
    const eleventh = await join(TEAM_SIZE + 1);
    expect(eleventh.status).toBe(409);
    expect(eleventh.text).toContain('This team is full (10 members).');
    expect(countUsers(db)).toBe(TEAM_SIZE);
  });

  test.skip('C2 [step 5] a task has title, owner and due date and can be marked done', () => {
    expect.fail(NOT_BUILT);
  });

  test.skip('C3 [step 6] reassigning changes the owner, and the owner is unchanged until then', () => {
    expect.fail(NOT_BUILT);
  });

  test.skip('C4 [step 8] done tasks are listed apart from open ones, newest first, can be reopened, and only the creator can delete', () => {
    expect.fail(NOT_BUILT);
  });

  test.skip('C5 [step 9] end-to-end: several members register, add, reassign, finish and reopen tasks using only the app', () => {
    expect.fail(NOT_BUILT);
  });
});
