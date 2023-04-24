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

Running `% npx generate-table-tests ./what-to-eat.yaml` will output a file `test.ts` alongside our spec. This file exports several names, the most immediately useful of which are `Condition`, `Action` and `runTests`.

`Condition` and `Action` are types that have been generated to match the model described in your spec file. Given that we have generated tests for `what-to-eat.yaml`, they would have the following form:

```typescript
export type Condition = {
  meal: "BREAKFAST" | "LUNCH" | "DINNER";
  hungerLevel: "LOW" | "MEDIUM" | "HIGH";
};

export type Action = "YOGURT" | "EGGS" | "SOUP" | "ROASTED_VEGETABLES" | "PASTA";
```
while `runTests` has the type:

```typescript
((condition: Condition) => Action | Promise<Action>) => Promise<TestFailure<Condition, Action>[]>
```

To allow the library to run test for and check that our code implements each rule described by our spec, we need to implement a function accepting a single argument of type `Condition`, and returning or resolving to a value of type `Decision`.

In the case of testing a pure function, this function might simply map between the generated types and the types in your application code. For a test that needs to mock external dependencies, this function could map the input to a set of values for your mocks to return, or for an integration test this function could serve as input to a function that performs test set up and teardown. Each comes with it's own tradeoffs, and finding the right balance is left to you.

Once we have done this, we can pass this function to the `runTests` function exported by the generated test file, and the library will exhaustively check that the provided function behaves according to spec. For any rules that our provided function does not implement, runTests will resolve a `TestFailure`, which can be logged or persisted according to your use case. 

The presence of test failures in the result of `runTests` should cause your test suite to fail.

```typescript
import { applicationFunction } from "./applicationFunction";
import {
  Action,
  Condition,
  runTests
} from "___test-table___.ts";

const wrapper = async (condition: Condition): Promise<Action> => {
  const input = //... map condition to test input or setup
  const result = applicationFunction(input);
  const action = // ... map result to action

  return action;
};

it("implements decision table spec", async () => {
  const failures = await runTests(wrapper);
  expect(failures).toEqual([]);
});

```
