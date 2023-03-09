import {
  ActionRule,
  Rule,
  Table,
  ruleCoversCondition,
  uncoveredConditions,
  ANY,
  validateOrFail,
  Var,
  VarRule,
  computeVarRulesOverlap,
  enumerateModel,
  calcStateSpaceSize
} from "./alg";

const table: Table = {
  name: "test table",
  model: {
    role: { name: "role", values: ["ADMIN", "MODERATOR", "COMMENTER"] },
    multiSite: { name: "multiSite", values: ["T", "F"] }
  },
  rules: [
    {action: "FOO", rule: [{ name: "role", values: ANY }, { name: "multiSite", values: ["T"] }]},
    {action: "BAR", rule: [{ name: "role", values: ANY }, { name: "multiSite", values: ["F"] }]}
  ]
}

it("accurately calculates state space size", () => {
  const bruteForceTotal = enumerateModel(table.model).length;
  const calcedTotal = calcStateSpaceSize(table.model);
  expect(calcedTotal).toEqual(bruteForceTotal);
});

it("evaluates if rule covers a condition", () => {
  const rule: Rule = [
    { name: "foo", values: ["foo1", "foo2"] },
    { name: "bar", values: ANY }
  ];

  expect(ruleCoversCondition(rule, [
    { name: "foo", value: "foo1" },
    { name: "bar", value: "bar1" }
  ])).toBeTruthy();

  expect(ruleCoversCondition(rule, [
    { name: "foo", value: "foo2" },
    { name: "bar", value: "bar2" }
  ])).toBeTruthy();

  expect(ruleCoversCondition(
    [{ name: "multiSite", values: ANY } , { name: "role", values: ["ADMIN", "MODERATOR"] }],
    [{ name: "multiSite", value: "T" }, { name: "role", value: "ADMIN" }]
  )).toBeTruthy();
});

it("detects if a rule does not cover a condition", () => {
  const rule: Rule = [
    { name: "foo", values: ["foo1", "foo2"] },
    { name: "bar", values: ["bar1", "bar2"] }
  ];

  expect(ruleCoversCondition(rule, [
    { name: "foo", value: "foo3" },
    { name: "bar", value: "bar1" }
  ])).toBeFalsy();

  expect(ruleCoversCondition(rule, [
    { name: "foo", value: "foo2" },
    { name: "bar", value: "bar3" }
  ])).toBeFalsy();
})

it("happy path", () => {
  expect(uncoveredConditions(table)).toEqual([]);
});

it("detects uncovered condtions", () => {
  const onlyBarTrueCovered: Table = validateOrFail({
    ...table,
    rules: [
      { action: "test", rule: [{ name: "multiSite", values: ["T"] }, { name: "role", values: ANY }]},
    ]
  });

  const uncovered = uncoveredConditions(onlyBarTrueCovered);

  expect(uncovered.length).toEqual(3); // on for each value of role

  const rules: ActionRule[] = [
    { action: "test1", rule: [{ name: "multiSite", values: ANY } , { name: "role", values: ["ADMIN"] }]},
    { action: "test2", rule: [{ name: "multiSite", values: ANY }, { name: "role", values: ["MODERATOR"]  }]}
  ];

  const commenterUncovered: Table = validateOrFail({
    ...table,
    rules,
  });

  const uncoveredCommenter = uncoveredConditions(commenterUncovered);

  expect(uncoveredCommenter.length).toEqual(2);
});

it("correctly calculates overlap between var rules", () => {
  const variable: Var = { name: "foo", values: ["ADMIN", "MODERATOR", "COMMENTER"]};
  const compareMismatched = () => computeVarRulesOverlap(variable, {
    name: "bar",
    values: ANY
  }, {
    name: "foo",
    values: ANY
  });
  expect(compareMismatched).toThrow();

  const anyRule: VarRule = { name: "foo", values: ANY };
  const adminAndMod: VarRule = { name: "foo", values: ["ADMIN", "MODERATOR"]};

  const anyVSAdminAndMod = computeVarRulesOverlap(variable, anyRule, adminAndMod);
  expect(anyVSAdminAndMod.length).toEqual(2);
  expect(anyVSAdminAndMod).toEqual(expect.arrayContaining([
    { name: "foo", value: "ADMIN" },
    { name: "foo", value: "MODERATOR" }
  ]));

  const modAndCommenter: VarRule = { name: "foo", values: ["MODERATOR", "COMMENTER"]};
  const singleValueOverlap = computeVarRulesOverlap(variable, modAndCommenter, adminAndMod);
  expect(singleValueOverlap.length).toEqual(1);
  expect(singleValueOverlap).toEqual(expect.arrayContaining([
    { name: "foo", value: "MODERATOR" }
  ]));
});
