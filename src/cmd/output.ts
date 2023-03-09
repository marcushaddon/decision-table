import { ActionRule, ANY, Table, TableValidationError } from "../alg";

type VarSorting = {
  idxs: Map<string, number>;
  names: Map<number, string>;
}

const ruleToRow = (rule: ActionRule, varNames: string[]): string => {
  const sorted = varNames.map(vn => {
    const v = rule.rule.find(({ name }) => vn === name)!;
    return v.values === ANY ? " - " : v.values.join(" \\| ")
});

  return "|" + sorted.join("|") + `|${rule.action}|`;
}

export const tableToMD = (tableName: string, table: Table, errors: TableValidationError[]): string => {
  const fatal = errors.filter(err => err.fatal);
  if (fatal.length > 0) {
    return fatal.map(err => `❌ ${err.message}`)
      .join("\n")
  }
  const varCount = Object.keys(table.model).length;
  const varNames = Object.keys(table.model);
  const varSorting: VarSorting = varNames
    .reduce((sorting, varName, idx) => {
      sorting.idxs.set(varName, idx);
      sorting.names.set(idx, varName)
      return sorting;
    }, {
      idxs: new Map<string, number>(),
      names: new Map<number, string>()
    });
  const idxes =  [...Array(varCount).keys()];
  const paddedIdxes = [...Array(varCount+1).keys()];
  const header = "|" + idxes
    .map(i => varSorting.names.get(i))
    .join("|") + "|ACTION|" + "\n" +
  "|" + paddedIdxes.map(_ => "-----").join("|") + "|";

  const ruleRows = table.rules
    .map(rule => ruleToRow(rule, varNames))
    .join("\n");

  const errorRows = errors.length === 0 ? "## ✅ Table passes all checks!" :
    "### Found the following issues\n" +
      errors.map((err, idx) => `❌ ${err.message}\n`)
      .join("\n");

  const variableDisplay = idxes
    .map(idx => {
      // console.log("displaying var " + idx)
      const varName = varSorting.names.get(idx)!;
      const varVals = table.model[varName]
      return `${varName}: ${varVals.values.join(" | ")}`;
    }).join("\n\n");

  const name = tableName || "Untitled Decision Table";

  return `# ${name}\n` +
    "## Model\n" + variableDisplay + "\n\n" +
    "## Specification\n" +
    header + "\n" +
    ruleRows + "\n\n" +
    errorRows;
}
