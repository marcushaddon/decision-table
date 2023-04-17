import {
  Table
} from "../alg";
import {
  generateTestCases,
  TestCase,
} from "./common";

export type UUT<Condition, Action> = (condition: Condition) => Action | Promise<Action>;

export type TestFailure<Condition, Action> = {
  condition: Condition;
  expectedAction: Action;
  actualAction: Action;
};

export const test = async <Condition, Action>(
  table: Table,
  uut: UUT<Condition, Action>
): Promise<TestFailure<Condition, Action>[]> => {
  const failures: TestFailure<Condition, Action>[] = [];
  const testCases = generateTestCases<Condition, Action>(table);

  for (const { condition, action: expectedAction } of testCases) {
    const actualAction = await uut(condition);
    if (actualAction !== expectedAction) {
      failures.push({
        condition,
        expectedAction,
        actualAction
      });
    }
  }

  return failures;
};
