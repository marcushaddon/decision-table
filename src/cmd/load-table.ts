import * as fs from "fs";
import * as path from "path";

import { validate } from "jsonschema";
import YAML from "yaml";

import { Table } from "../alg";
import { docToTable } from "./model";

export const getSchema = () => {
  const schemaPath = path.join(path.dirname(__filename), "doc-schema.json");
  const raw = fs.readFileSync(schemaPath).toString();
  return JSON.parse(raw);
}

export const loadTable = (tablePath: string): Table | null => {
  const docSchema = getSchema();
  const raw = fs.readFileSync(tablePath).toString();
  const parsed = YAML.parse(raw);

  const res = validate(parsed, docSchema, {
    required: true,
  });
  
  if (res.errors.length > 0) {
    for (const err of res.errors) {
      console.error(err.toString());
    }
    return null;
  }

  const table = docToTable(parsed);
  
  return table;
}