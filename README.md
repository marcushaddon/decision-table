# decision-table
## What is this?
This is a node module for programmatically evaluating, validating, and documenting decision tables ([wikipedia](https://en.wikipedia.org/wiki/Decision_table)). It additionally allows for generating and, with a bit of "glue code", running tests that verify correct implementation of a given decision table specification.

## Usage
### Specification
The tool takes as input a decision table specification as expressed in a `.yaml` file. The file has the following format:

```yaml
type: object
properties:
  name:
    type: string
  vars:
    type: object
    additionalProperties:
      anyOf:
      - type: array
        items:
          type: string
      - enum:
        - boolean
        type: string
  rules:
    type: array
    items:
      type: object
      properties:
        condition:
          type: object
          additionalProperties:
            anyOf:
            - type: array
              items:
                type: string
            - type: string
        action:
          type: string
      required:
      - action
      - condition
required:
- rules
- vars
```

A small example:
```yaml
name: My first decision table
# vars are the 'header cells' of our table
vars:
  foo:
    - bar
    - baz
    - biz
  myBool: boolean # 'boolean' provided as a string value is shorthand for the enum T | F

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

Additionally, if the table contains overlapping rules specifying the *same* action, it will display a warning, since this is valid and sometimes useful for making the table understandable, but if done unintentionally, may signal confusion about the business logic.

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

# Testing
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

Now assume we have a function somehwere in our codebase, `whatToEat: (hungerLevel: number, meal: string) => string` that should implement this logic. We can use the command `generate-table-tests` to generate test driver code.

Running `% npx generate-table-tests ./what-to-eat.yaml` will output a file `test.ts` with the following contents:

```typescript 
import { loadTable, test, UnitUnderTest } from "decision-table";

export type Condition = {
  meal: "BREAKFAST" | "LUNCH" | "DINNER";
  hungerLevel: "LOW" | "MEDIUM" | "HIGH";
};

export type Action = "YOGURT" | "EGGS" | "SOUP" | "ROASTED_VEGETABLES" | "PASTA";

export const runTests = (uut: UnitUnderTest<Condition, Action>) => {
  const table = loadTable("what-to-eat.yaml");
  if (table === null) {
    throw new Error("Cannot find table document");
  }

  return test(table, uut);
};

```

> IMPORTANT!!!: This file should not be modified directly, as it will/should be regenerated as business requirements (and as a result the decision table spec) are updated

The intended use of the types `Condition` and `Action` and the function `runTests` is to be imported into a test suite, for example `whatToEat.spec.ts` like:

```typescript
import { Condtion, Action, runTests } from "./test.ts";
```

In order to test our code using this function, we need to write a bit of "glue code" to translate from the table's model into our application codes model, and to translate the output of our application code back into the table's model. 

This is achieved by providing a function wrapping our "unit under test" that maps between our application types and the generated "table types". This function will be of type `UnitUnderTest<Condition, Action>`. The `UnitUnderTest` is just a function accepting one type and returning another, and the `Condition` and `Action` types are generated to match our table spec in order to give a degree of type safety to our glue code (for example if a variable is renamed or a new value added to the spec, typescript can fail our build until we have updated our tests, without causing our tests to flake).

An example:
```typescript
import { whatToEat } from "services/meals";
import { Condtion, Action, runTests } from "./test.ts";

// Here we are assuming our application function whatToEat has type (hungerLevel: number, meal: string) => string

const wrapper = (condition: Condition): Action => {
  // Translate from our table's model to our applicaiton code's model
  const translatedInput = translateInput(condition);
  // Get the result of the function
  const result = whatToEat(translatedInput);
  // Translate from our application model back into our table's model
  const translatedOutput = translateOutput(result);

  return translatedOuput;
};

const translateInput = (condition: Condition): string => {
  switch (condition)
}

```