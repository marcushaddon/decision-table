import {
  Table,
  ActionRule,
  isConcrete,
  enumerateVar,
  crossProducts,
  Condition,
  VarInstance
} from "../alg";



const enumerateRule = (table: Table, rule: ActionRule) => {
  const populated = rule.rule.map(
    varRule => isConcrete(varRule) ? varRule : table.model[varRule.name]
  );

  const varConditions = populated.map(varRule => enumerateVar(varRule));

  return crossProducts(varConditions);
};

export type TestCase<C, A> = {
  condition: C,
  action: A
};

export const toConditionRecord = (conditionArray: VarInstance[]): Condition =>
  conditionArray.reduce((cond, varInstance) => ({
    ...cond,
    [varInstance.name]: varInstance.value
  }), {} as Condition);

export const generateTestCases = <C, A>(table: Table): TestCase<C, A>[] => {
  const ruleCases = table.rules.map(rule => {
    const conditions = enumerateRule(table, rule);
    return conditions.map(condition => ({
      action: rule.action as A,
      condition: toConditionRecord(condition) as C
    }))
  });

  return ruleCases.flatMap(e => e);
}
