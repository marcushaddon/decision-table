import { Table, ActionRule, isConcrete, VarRule, enumerateVar, crossProducts, Condition } from "./alg";
/**
 * Idea: Instead of asking users to impelement a function that takes type of
 * Condition and returns type of TestResult<Action> (with all its "directInputs bookeeping")
 * we just ask them to provide a uut (a function of type I1 -> O1) and an input map or ( { I2 -> I1 }) and an output map ({ O1 -> O2 }).
 * Then in our test driver, we do the mapping for them, noting the results of their own maps, and returning it for them.
 */

// This will be generated
type MyCondition = {
  BIZ: "T" | "F";
  FOO: "FOOBAR" | "FOOBAZ";
  
};

type MyAction = "PROCEED" | "STOP";

type MyInput = {
  foo: "bar" | "baz"
  biz: boolean;
};

type MyOutput = true | false | undefined;

type ValueOf<T> = T extends { [k: string]: infer V } ? V : T;

type UnionMap<A extends string, B extends string> = {
  [k in A]: B
}

type StringRec = Record<string, string>;
type AnyRec = Record<string, any>;

type ObjectMap<A extends StringRec, B extends AnyRec> = {
  [AKey in keyof A]: {
    [BKey in keyof B]?: UnionMap<A[AKey], B[BKey]>
  }
}

type DeleteMe4 = ObjectMap<MyCondition, MyInput>

const objectMap2: ObjectMap<MyCondition, MyInput> = {
  FOO: {
    foo: {
      FOOBAR: "bar",
      FOOBAZ: "baz"
    }
  },
  BIZ: {
    biz: {
      T: true,
      F: false
    }
  }
}

const conditionToInput =
  <ConditionType extends StringRec, InputType extends AnyRec>(
    map: ObjectMap<ConditionType, InputType>,
    condition: ConditionType
  ): InputType => {
  const mappedInput = Object.entries(condition)
    .reduce((input, [conditionVar, conditionVarVal]) => {
      const anyMap = map as any;
      const varMap = anyMap[conditionVar];
      // We cant enforce this with types, but this map can only have one key
      const varNames = Object.keys(varMap);
      if (varNames.length !== 1) {
        throw new Error("Error in glue code: table and application models not properly mapped");
      }
      const inputVarName = varNames[0] as keyof MyInput;
      const valMap = varMap[inputVarName];
      if (valMap === undefined) {
        throw new Error("Error in glue code: table and application models not properly mapped");
      }
      const inputVal = valMap[conditionVarVal];
      return {
        ...input,
        [inputVarName]: inputVal
      }
    }, {} as InputType);

    return mappedInput;
};

const enumerateRule = (table: Table, rule: ActionRule) => {
  const populated = rule.rule.map(
    varRule => isConcrete(varRule) ? varRule : table.model[varRule.name]
  );

  const varConditions = populated.map(varRule => enumerateVar(varRule));

  return crossProducts(varConditions);
};

type TestCase<C, A> = {
  condition: C,
  action: A
}

const generateTestConditions = <C, A>(table: Table): TestCase<C, A>[] => {
  const ruleCases = table.rules.map(rule => {
    const conditions = enumerateRule(table, rule);
    return conditions.map(condition => ({
      action: rule.action as A,
      input: toInput(condition) as C
    }))
  });

  return ruleCases.flatMap(e => e);
}

console.log(conditionToInput(objectMap2, condition));
