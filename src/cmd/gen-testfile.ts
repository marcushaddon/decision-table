#! /usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as process from "process";

import { loadTableDoc } from "../common";

const generateTestTypes = (docPath: string) => {
  const tableDoc = loadTableDoc(docPath);
  // Var types
  const varTypes = Object.entries(tableDoc.vars)
    .map(
      ([ varName, varType]) => {
        const boolOrUnion = varType === "boolean" ?
          "boolean" :
          varType.map(val => `"${val}"`).join(" | ");

        return `${varName}: ${boolOrUnion};`
      }
    )
  // Condition type
  const conditionType =
`type Condition = {
  ${varTypes.join("\n  ")}
};
`;
  
  const actions = tableDoc.rules
    .reduce((unique, { action }) => {
      unique.add(action);
      return unique;
    }, new Set<string>())
  
  const actionType = `type Action = ${[...actions].map(action => `"${action}"`).join(" | ")};`

const types = `
import { loadTable, test, UnitUnderTest } from "decision-table";

export ${conditionType}
export ${actionType}

export const runTests = (uut: UnitUnderTest<Condition, Action>) => {
  const table = loadTable("${docPath}");
  if (table === null) {
    throw new Error("Cannot find table document");
  }

  return test(table, uut);
};

`
const outDir = path.dirname(docPath);
fs.writeFileSync(path.join(outDir, "test-table.ts"), types);
};

const [,, docPath] = process.argv;
generateTestTypes(docPath);
