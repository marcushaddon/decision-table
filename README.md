# decision-table
## What is this?
This is a node module for programmatically evaluating, validating, and documenting decision tables ([wikipedia](https://en.wikipedia.org/wiki/Decision_table)). It additionally allows for generating and, with a bit of "glue code", running tests that verify correct implementation of a given decision table specification.

## Usage
### <a name="specification">Specification</a>
The tool takes as input a decision table specification as expressed in a `.yaml` file.

Here is an example of a simple specification file:


```yaml
name: My first decision table
# vars are the 'header cells' of our table
vars:
  foo:
    - bar
    - baz
    - biz
  myBool: boolean # 'boolean' is shorthand for the enum T | F

rules:
  # The following rule applies when foo=bar and myBool=T
  - condition:
      foo: bar
      myBool: T
    action: actionA # When a condition satisfies this rule, actionA should be taken
  # Rules may cover multiple values for a variable.
  # This following rule applies when foo=(bar | baz) and myBool=T
  - condition:
      # A subset of a variable's possible values is expressed as an array of values
      # This can also be thought of as a 'union'
      foo:
        - baz
        - biz
      myBool: T
    action: actionB
  # Tables can be made less verbose with the use of the ANY value
  # This rule is satisfied when myBool=F and foo=(bar | baz | biz)
  # ie any of its possible values.
  - condition:
      myBool: F
      foo: ANY
    action: actionC
```

Assuming the above example is saved at `spec.yaml`, we can check and document the table with 

```bash
% npx document-table ./spec.yaml`
```
which creates the following markdown file at `my-first-decision-table.md`:

---

# My first decision table
## Model
foo: bar | baz | biz

myBool: T | F

## Specification
|foo|myBool|ACTION|
|-----|-----|-----|
|bar|T|actionA|
|baz \| biz|T|actionB|
| - |F|actionC|

## ✅ Table passes all checks!       
---

Had the table contained validation errors, they would be reported at the bottom of the markdown document. For example, if we had omitted the third rule (foo=ANY, myBool=T), our table would not have been exhuastive. This would be reflected at the bottom of our document as follows:

---

### Found the following issues
❌ The following condition is uncovered by rules: foo=bar myBool=F

❌ The following condition is uncovered by rules: foo=baz myBool=F

❌ The following condition is uncovered by rules: foo=biz myBool=F

---

The errors that may be reported include:
  - non exhaustive rules
  - conflicting rules (rules satisfiable by overlapping sets of conditions that specify different actions)
  - rules containing unknown variables
  - rules not covering all variables in the model
  - rules specifying invalid values for a given variable. 

Additionally, if the table contains **redundant** rules (two or more rules specifying the *same* action), it will display a warning, since this is valid and sometimes useful for making the table understandable, but if done unintentionally, may signal confusion about the business logic.

If you want to check a table for errors without creating or overwriting an existing document, you can use the command `check-table`:

```bash
% npx check-table ./test.yaml
┌─────────┬───────┬───────────────────────────────────────────────────────────────────┐
│ (index) │ fatal │                              message                              │
├─────────┼───────┼───────────────────────────────────────────────────────────────────┤
│    0    │ false │ 'The following condition is uncovered by rules: foo=bar myBool=F' │
│    1    │ false │ 'The following condition is uncovered by rules: foo=baz myBool=F' │
│    2    │ false │ 'The following condition is uncovered by rules: foo=biz myBool=F' │
└─────────┴───────┴───────────────────────────────────────────────────────────────────┘
```
> (Here, the term "fatal" indicates whether this issue would prevent the table from being able to be documented)

# <a name="testing">Testing</a>
Given a decision table specification document that has passed all checks, this libary also enables testing that application code fully implements the decision table, within your existing test suite. Assume we have decided our app should implement the following logic at `what-to-eat.yaml`:

---

### Model
meal: BREAKFAST | LUNCH | DINNER

hungerLevel: LOW | MEDIUM | HIGH

## Specification
|meal|hungerLevel|ACTION|
|-----|-----|-----|
|BREAKFAST|LOW \| MEDIUM|YOGURT|
|BREAKFAST|HIGH|EGGS|
|LUNCH| - |SOUP|
|DINNER|LOW \| MEDIUM|ROASTED_VEGETABLES|
|DINNER|HIGH|PASTA|

## ✅ Table passes all checks!

---

Now assume we have a function somehwere in our codebase, `chooseFood: (bloodSugarLevel: string, partOfDay: string) => string` that should implement this logic. We can use the command `generate-table-tests` to generate test driver code.

Running `% npx generate-table-tests ./what-to-eat.yaml` will output a file `test.ts` alongside our spec. This file exports three names `InputMap`, `OutputMap`, and `runTests`. The first two names are types, and have been generated so that they describe our table as typescript types, and can be imported into our test suite like:

```typescript
import { InputMap, OutputMap, runTests } from "./test.ts"; // <- generated file
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