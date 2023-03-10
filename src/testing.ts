import { Condition, Table, crossProducts,  enumerateVar, isConcrete, ActionRule, ANY, validateOrFail, VarInstance } from "./alg";

// Not to be confused with a test case, our uut or "glue" code is 
// responsible for translating a TestCondition into a test case
export type TestCondition<I, A> = {
  action: A;
  input: I;
};

export type DirectInputs = Record<string, any>;

export type TestResult<A> = {
  action: A;
  directInputs: DirectInputs
};

type TestFailure<I, A> = {
  input: I;
  directInputs: DirectInputs;
  expected: A;
  actual: A;
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
export type UnitUnderTest<I, A> =(testCondition: I) => TestResult<A> | Promise<TestResult<A>>;

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

const generateTestConditions = <I, A>(table: Table): TestCondition<I, A>[] => {
  const ruleCases = table.rules.map(rule => {
    const conditions = enumerateRule(table, rule);
    return conditions.map(condition => ({
      action: rule.action as A,
      input: toInput(condition) as I
    }))
  });

  return ruleCases.flatMap(e => e);
}

export const test = async <I, A>(table: Table, uut: UnitUnderTest<I, A>) => {
  const failures: TestFailure<I, A>[] = [];
  for (const testCondition of generateTestConditions<I, A>(table)) {
    const { action, directInputs } = await uut(testCondition.input);
    if (action !== testCondition.action) {
      failures.push({
        input: testCondition.input,
        directInputs,
        expected: testCondition.action,
        actual: action
      });
    }
  }

  return failures;
}
