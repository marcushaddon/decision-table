In addition to `Action`, `Condition`, and `runTests`, generated test files export three more names that can aid in writing "glue" code.

They are: `InputMap`, `OutputMap`, and `runMappedTests`. The first two names are types, and have been generated so that they describe our table as typescript types, and can be imported into our test suite like:

```typescript
import { InputMap, OutputMap, runMappedTests } from "./test.ts"; // <- generated file
```

> IMPORTANT!!!: This file should not be modified directly, as it will/should be regenerated as business requirements (and as a result the decision table spec) are updated

In order to test our code using the function `runTests`, we need to write a bit of "glue code" to translate from the table's model into our application code's model, and to translate the output of our application code back into the table's model. The intended use of the types `InputMap` and `OutputMap` is to guide us in creating our glue code.

By declaring our input and output maps to be of these types (and providing the input and output types of our application code as the type arguments), Typescript will suggest which names are required in the maps, as well as which values can go with what names. It can't prevent all flakiness due to errors in our boilerplate, but it can prevent a lot. Additionally, errors not caught by the type checker should be caught at run (test) time and cause the suite to fail to run before running any tests.

An example:

Our application code in `./decideMeal.ts`
```typescript
export type MealInput = {
  timeOfDay: "morning" | "noon" | "night",
  bloodSugar: "high" | "medium" | "low"
}

export type Food = "Yogurt"  | "eggs"

export const decideMeal = (input: MealInput): Food => {
  // ... our unimplemented application code
  return "Yogurt";
}
```

Our test suite at `./decideMeal.spec.ts`
```typescript
import { decideMeal, MealInput, Food } from "./decideMeal";
import {
  runTests,
  InputMap,
  OutputMap
} from "./test"; // <-- our generated file

// Our glue code
// The form of InputMap is TableVariable -> Application Variable -> Table Value -> Application Value
const inputMap: InputMap<MealInput> = {
  meal: {
    timeOfDay: {
      BREAKFAST: "morning",
      LUNCH: "noon",
      DINNER: "night"
    }
  },
  hungerLevel: {
    bloodSugar: {
      LOW: "low",
      MEDIUM: "medium",
      HIGH: "high",
    }
  }
}

const outputMap: OutputMap<Food> = {
  Yogurt: "YOGURT",
  eggs: "EGGS",
};

it("implements table", async () => {
  const failures = await runTests(decideMeal, inputMap, outputMap);
  expect(failures).toEqual([]);
});

```

In the example above, if `runTests` finds any errors, the expect line will cause jest to print out the errors. Since our function is not yet implemented, it will look something like this:

```bash
 FAIL  src/whatToEat.spec.ts
  ● implements table

    expect(received).toEqual(expected) // deep equality

    - Expected  -  1
    + Received  + 93

    - Array []
    + Array [
    +   Object {
    +     "actualAction": "YOGURT",
    +     "condition": Object {
    +       "hungerLevel": "HIGH",
    +       "meal": "BREAKFAST",
    +     },
    +     "expectedAction": "EGGS",
    +     "input": Object {
    +       "bloodSugar": "high",
    +       "timeOfDay": "morning",
    +     },
    +     "output": "Yorgurn",
    +   },
    +   Object {
    +     "actualAction": "YOGURT",
    +     "condition": Object {
    +       "hungerLevel": "LOW",
    +       "meal": "LUNCH",
    +     },
    +     "expectedAction": "SOUP",
    +     "input": Object {
    +       "bloodSugar": "low",
    +       "timeOfDay": "noon",
    +     },
    +     "output": "Yorgurn",
    +   } ...
```

The exact method of documenting the failures and causing the test to fail is left to you.