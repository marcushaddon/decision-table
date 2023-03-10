import * as fs from "fs";
import * as path from "path";

import { validate } from "jsonschema";
import YAML from "yaml";

import { Table, ActionRule, Model, ANY } from "../alg";
import { TableDoc } from "./table-doc";

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


export const getSchema = () => {
  const schemaPath = path.join(path.dirname(__filename), "doc-schema.json");
  const raw = fs.readFileSync(schemaPath).toString();
  return JSON.parse(raw);
}

export const loadTableDoc = (docPath: string): TableDoc => {
  const docSchema = getSchema();
  const raw = fs.readFileSync(docPath).toString();
  const parsed = YAML.parse(raw);

  const res = validate(parsed, docSchema, {
    required: true,
  });
  
  if (res.errors.length > 0) {
    const errMessages = res
      .errors
      .map(err => err.toString())
      .join("\n");
    throw new Error(errMessages);
  }

  return parsed as TableDoc;
}

export const loadTable = (docPath: string): Table | null => {
 const tableDoc = loadTableDoc(docPath);

  const table = docToTable(tableDoc);
  
  return table;
}