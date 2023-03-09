export const ANY = "__ANY__";
export type Var = {
    name: string;
    values: string[];
};

export type ConcreteVarRule = {
    name: string;
    values: string[];
};

export type AnyVarRule = {
    name: string;
    values: typeof ANY;
};

export type VarRule = ConcreteVarRule | AnyVarRule;

export const isAny = (v: VarRule): v is AnyVarRule => 
    v.values === ANY;

export const isConcrete = (v: VarRule): v is ConcreteVarRule =>
    v.values !== ANY;

export type VarInstance = {
    name: string;
    value: string;
};

export type Model = { [varName: string]: Var };
export type Rule = VarRule[];
export type ActionRule = { rule: Rule, action: string };
export type Table = {
    name: string;
    model: Model;
    rules: ActionRule[];
};

export type Condition = VarInstance[];

export const calcStateSpaceSize = (m: Model) =>
    Object.values(m).reduce ((count, { values }) => count * values.length, 1);

// TODO: ensure varInstance.value is valid value for var
const varRuleCoversVarInstance = (varRule: VarRule, varInstance: VarInstance): boolean =>
    varRule.values === ANY || varRule.values.includes(varInstance.value);

export const ruleCoversCondition = (rule: Rule, condition: Condition): boolean =>
    rule.length === condition.length &&
    condition
    .every(vi => !!rule.find(
        vr => vr.name === vi.name && varRuleCoversVarInstance(vr, vi)
    ));

const crossProduct = <T = unknown>(a: T[], b: T[]): T[][] =>
    a.map(atem => b.map(btem => [atem, btem])).flat();

export const crossProducts = <T = unknown>(items: T[][]): T[][] => {
    if (items.length === 0) return [];
    if (items.length === 1) return items;
    if (items.length === 2) {
        const [a, b] = items;
        return crossProduct(a, b);
    }

    const heads = items[0];
    const tails = crossProducts(items.slice(1));

    return heads.map(head => tails.map(tail => [head, ...tail])).flat();
};

export const enumerateVar = (v: Var): VarInstance[] =>
    v.values.map(value => ({ name: v.name, value }));

export const enumerateModel = (m: Model) => {
    const enumeratedVars = Object.entries(m)
        .map(([ _, varObj ]) => enumerateVar(varObj));
    return crossProducts(enumeratedVars);
};

const showList = (things: any[], oxford = false): string => {
    if (things.length === 0) return "(empty list)";
    if (things.length === 1) return things[0].toString();
    if (things.length === 2) return `${things[0]}${oxford ? "," : ""} & ${things[1]}`;

    return `${things[0]}, ` + showList(things.slice(1), true);
};

const conditionToStr = (cond: Condition): string =>
  cond.map(({ value, name }) => `${name}=${value}`)
  .join(" ");

const coversAllVars = (rule: Rule, model: Model): boolean => {
    const modelVars = [...Object.keys(model)];
    const ruleVars = rule.map(({ name }) => name);

    const uncovered = modelVars.filter(mv => !ruleVars.includes(mv));

    if (uncovered.length > 0) {
        console.error(`Rule does not cover all model variables. Missing: ${uncovered.join(", ")}`);
    }
    
    return uncovered.length === 0;
};

const containsUnknownVars = (rule: Rule, model: Model): boolean => {
    const modelVars = [...Object.keys(model)];
    const ruleVars = rule.map(({ name }) => name);

    const unknown = ruleVars.filter(rv => !modelVars.includes(rv));

    if (unknown.length > 0) {
        console.error(`Rule contains unknown variables. Found: ${showList(unknown)}`);
    }
    
    return unknown.length > 0;
};

const referencesInvalidValues = (rule: Rule, model: Model): boolean => {
    const specifyInvalidValues = rule.filter(({ name, values }) => {
        if (values === ANY) return false;

        const validValues = model[name].values;
        const invalidValues = values.filter(value => !validValues.includes(value));

        if (invalidValues.length > 0) {
            console.error(`Variable rule for "${name}" references invalid value(s) ${showList(invalidValues)}. Allowed values are ${showList(validValues)}`);
        }

        return invalidValues.length > 0;
    });

    return specifyInvalidValues.length > 0;
};

export type TableValidationError = {
  fatal: boolean;
  message: string;
  ruleIdxs?: number[];
  rules?: ActionRule[];
}

const filterIDXes = <T = unknown>(items: T[], predicate: (a: T) => boolean): number[] =>
  items.map((item, idx) => predicate(item) ? idx : -1)
  .filter(n => n >= 0);

export const validateTable = (t: Table): TableValidationError[] => {
  // every rule specifies ever variable
  const incompleteRules = filterIDXes(t.rules, ({ rule }) => !coversAllVars(rule, t.model));
  if (incompleteRules.length > 0) {
    return incompleteRules.map((rIdx) => ({
      fatal: true,
      message: `Not all rules cover all variables in model (TODO: More detail)`,
      ruleIdxs: [rIdx]
    }));
  }

  // no rule specifies unknown variables
  const invalidVars = filterIDXes(t.rules, ({ rule }) => containsUnknownVars(rule, t.model))
  if (invalidVars.length > 0) {
    return invalidVars.map(rIdx => ({
      fatal: true,
      message: "Rules specify variables not included in model (TODO: more detail)",
      ruleIdxs: [rIdx]
    }))
  }

  // TODO: any rules contains invalid values for var
  const invalidRefs = filterIDXes(t.rules, ({ rule }) => referencesInvalidValues(rule, t.model))
  if (invalidRefs.length > 0) {
    return invalidRefs.map(rIdx => ({
      fatal: true,
      message: "Rule references invalid valus for variable",
      ruleIdxs: [rIdx]
    }))
  }

  const errors: TableValidationError[] = [];

  // TODO: no two rules specify same action?
  const actionMap = t.rules.reduce((am, rule, idx) => ({
    ...am,
    [rule.action]: am[rule.action] ? [...am[rule.action], idx] : [idx] 
  }), {} as Record<string, number[]>);

  for (const [action, rules] of Object.entries(actionMap)) {
    if (rules.length > 1) {
      errors.push({
        fatal: false,
        message: `Warning: Action "${action}" covered by rules ${showList(rules)}`,
        ruleIdxs: rules,
      });
    }
  }

  const conflicting = conflictingRules(t);
  for (const conflict of conflicting) {
    errors.push({
      fatal: false,
      message: `Rules ${showList(conflict)} conflict (rules overlap but specify different actions)`,
      ruleIdxs: conflict,
    });
  }

  const uncovered = uncoveredConditions(t);
  for (const uc of uncovered) {
    errors.push({
      fatal: false,
      message: `The following condition is uncovered by rules: ${conditionToStr(uc)}`
    });
  }
  return errors;
};

export const uncoveredConditions = (t: Table): Condition[] => {
  const possibleConditions = enumerateModel(t.model);
  const uncovered = possibleConditions.filter(c => 
    "undefined" === typeof t.rules.find(({ rule }) => ruleCoversCondition(rule, c))
  );

  return uncovered;
};

export const validateOrFail = (t: Table): Table => {
  const errors = validateTable(t);
  if (errors.length > 0) {
    throw new Error(
      "Table is not sound. Found the following problems\n" +
      errors.join("\n")
    )
  }

  return t;
}

export const computeVarRulesOverlap = (v: Var, a: VarRule, b: VarRule): VarInstance[] => {
    const allNames = [v.name, a.name, b.name];
    if (new Set(allNames).size !== 1) {
        throw new Error(`Cannot compute overlap for distinct var rules: ${showList(allNames)}`);
    }
    if (isAny(a) && isAny(b)) {
        return enumerateVar(v);
    }
    if (isAny(a) && isConcrete(b)) {
        return enumerateVar(b);
    }
    if (isAny(b) && isConcrete(a)) {
        return enumerateVar(a as Var);
    }

    if (isConcrete(a) && isConcrete(b)){
        return a.values.filter(value => b.values.includes(value))
            .map(value => ({ name: v.name, value }))
    }

    throw new Error("Assertion error: impossible types for var rules");
};

export const varRulesOverlap = (a: VarRule, b: VarRule): boolean => {
  if (a.name !== b.name) {
    throw new Error(
      `Assertion failed: Comparing vars "${a.name}" and "${b.name}" for overlap`
    );
  }

  return (
    a.values === ANY ||
    b.values === ANY ||
    !!a.values.find(v => b.values.includes(v))
  );
}

// if a contains even one varRule with no overlap with b's corresponding rule
// the rules are disjoint
const rulesAreDisjoint = (m: Model, a: Rule, b: Rule): boolean =>
  rulesIntersection(m, a, b).length === 0;
    // !!!a.find(aRule => {
    //     const bRule = b.find(rule => rule.name === aRule.name);
    //     if (!bRule) throw new Error("Assertion error: comparing incomplete rules");
        
    //     return varRulesOverlap(aRule, bRule);
    // });

export const rulesIntersection = (m: Model, a: Rule, b: Rule): Condition[] => {
    const vars = Object.values(m);
    const overlaps = vars.map((mv) => {
        const aRule = a.find(aRule => aRule.name === mv.name)!;
        const bRule = b.find(bRule => bRule.name === mv.name)!;

        return computeVarRulesOverlap(mv, aRule, bRule);
    });

    return crossProducts(overlaps);
};

export const conflictingRules = (t: Table): [number, number][] => {
  const conflicts: [number, number][] = [];
  for (let i = 0; i < t.rules.length; i++) {
    for (let j = i+1; j < t.rules.length; j++) {
        const aRule = t.rules[i];
        const bRule = t.rules[j];
        if (aRule.action !== bRule.action && !rulesAreDisjoint(t.model, aRule.rule, bRule.rule)) {
            conflicts.push([i, j]);
        }
    }
  }

  return conflicts;
};