import { Condition, Table, crossProducts,  enumerateVar, isConcrete, ActionRule, ANY, validateOrFail, VarInstance } from "./alg";

// Not to be confused with a test case, our uut or "glue" code is 
// responsible for translating a TestCondition into a test case
export type TestCondition<T> = {
  action: string;
  input: T;
};

export type TestCase = Record<string, any>;

export type TestResult = {
  action: string;
  testCase: Record<string, any>
};

type TestFailure<T> = {
  input: T;
  testCase: TestCase;
  expected: string;
  actual: string;
}

/**
 * The UnitUnderTest is our application specific "glue code".
 * It is responsible for translating a TestCondition into a TestCase,
 * whatever that may look like for our given unit test (ie for pure functions
 * it will likely be a simple mapping, but for integration tests, it may be
 * more complex). It is also responsible with mapping the result of the test 
 * back to the "action" as described by the table. It should return this action,
 * along with the specific test case it mapped from the test condition, so that in 
 * the event of failure, it can be logged.
 */
export type UnitUnderTest<T> =(testCondition: T) => TestResult | Promise<TestResult>;

// TODO: we need a global const
const parseBool = (val: string): string | boolean =>
  val === "T" ? true :
  val === "F" ? false :
  val;

const toInput = (condition: Condition): Record<string, string> =>
  condition.reduce((testCase, varCondition: VarInstance) => ({
    ...testCase,
    [varCondition.name]: parseBool(varCondition.value)
  }), {});

const enumerateRule = (table: Table, rule: ActionRule) => {
  const populated = rule.rule.map(
    varRule => isConcrete(varRule) ? varRule : table.model[varRule.name]
  );

  const varConditions = populated.map(varRule => enumerateVar(varRule));

  return crossProducts(varConditions);
}

const generateTestConditions = <T>(table: Table): TestCondition<T>[] => {
  const ruleCases = table.rules.map(rule => {
    const conditions = enumerateRule(table, rule);
    return conditions.map(condition => ({
      action: rule.action,
      input: toInput(condition) as T
    }))
  });

  return ruleCases.flatMap(e => e);
}

export const test = async <T>(table: Table, uut: UnitUnderTest<T>) => {
  const failures: TestFailure<T>[] = [];
  for (const testCondition of generateTestConditions<T>(table)) {
    const { action, testCase } = await uut(testCondition.input);
    if (action !== testCondition.action) {
      failures.push({
        input: testCondition.input,
        testCase,
        expected: testCondition.action,
        actual: action
      });
    }
  }

  return failures;
}
