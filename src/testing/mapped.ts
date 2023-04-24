/**
 * This API aims to prevent flakiness and simplify the task of 
 * writing "glue code" between the consumer's application code
 * and the generated test driver by providing a well typed InputMap 
 * and OutputMap type for them to implement as a sort of checklist,
 * and to provide some level of type safety when a table is modified.
 */
import {
  Table
} from "../alg";
import {
  generateTestCases,
} from "./common";

type UnionMap<A extends string, B extends string> = {
  [k in A]: B
};

export type TestCondition = Record<string, string>;
export type TestInput = Record<string, any>;

export type TestFailure<C, A, I, O> = {
  condition: C;
  expectedAction: A;
  actualAction: A;
  input: I;
  output: O;
};

export type InputMap<A extends TestCondition, B extends TestInput> = {
  [AKey in keyof A]: {
    [BKey in keyof B]?: UnionMap<A[AKey], B[BKey]>
  }
};

// Just aliasing I guess
export type OutputMap<O extends string, A extends string> = UnionMap<O, A>;

const conditionToInput =
  <ConditionType extends TestCondition, InputType extends TestInput>(
    map: InputMap<ConditionType, InputType>,
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
      const inputVarName = varNames[0] as keyof InputType;
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

export const mapAndTest =
  async <C extends TestCondition, A extends string, I extends TestInput, O extends string>
    (table: Table,
     inputMap: InputMap<C, I>,
     outputMap: OutputMap<O, A>,
     uut: (input: I) => O | Promise<O>
    ) => {
      const failures: TestFailure<C, A, I, O>[] = [];
      const testCases = generateTestCases<C, A>(table);
      for (const testCase of testCases) {
        const input = conditionToInput(inputMap, testCase.condition);
        const output = await uut(input);
        const actionResult = outputMap[output];
        if (actionResult !== testCase.action) {
          failures.push({
            condition: testCase.condition,
            expectedAction: testCase.action,
            actualAction: actionResult,
            input,
            output,
          });
        }
      }

      return failures;
    };