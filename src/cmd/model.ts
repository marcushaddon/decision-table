import { Table, Var, Rule, ActionRule, Model, ANY } from "../alg";

export type TableDoc = {
  name?: string,
  vars: {
    [varName: string]: string[] | "boolean"
  },

  rules: {
    condition: { [varName: string]: string | string[] },
    action: string,
  }[]
}
const docRuleToTableRule = (docRule: TableDoc["rules"][number]): ActionRule => {
  const condition =
    Object.entries(docRule.condition)
      .map(
        ([varName, varVal]) => ({
          name: varName,
          values: varVal === "ANY" ? (ANY as typeof ANY) : Array.isArray(varVal) ? varVal : [varVal]
        })
      );

  return {
    action: docRule.action,
    rule: condition
  }
}

export const docToTable = (td: TableDoc): Table => {
  const model = Object.entries(td.vars).map(([varName, vals]) => ({
    name: varName, 
    values: vals === "boolean" ? ["T", "F"] : vals
  })).reduce((acc, current) => ({
    ...acc,
    [current.name]: current
  }), {} as Model);

  const rules: ActionRule[] = td.rules.map(docRuleToTableRule);

  return {
    name: td.name || "Untitled Table",
    model,
    rules,
  }
}
