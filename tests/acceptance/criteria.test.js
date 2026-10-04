// PROTECTED ACCEPTANCE TESTS. One per success criterion in docs/PRD.md.
// Later steps may only un-skip a test (and fill in its body) or add new tests.
// Never weaken, rename or delete these. Each skip reason names the step that makes it pass.
import { describe, test, expect } from 'vitest';

const NOT_BUILT = 'acceptance test body not written yet';

describe('acceptance criteria', () => {
  test.skip('C1 [step 3] up to 10 people register and the 11th is refused', () => {
    expect.fail(NOT_BUILT);
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
