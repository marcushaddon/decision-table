#! /usr/bin/env node
import * as fs from "fs";
import * as path from "path";
import * as process from "process";

import YAML from "yaml";
import { validate } from "jsonschema";

import { ActionRule, Table, Var, Model, validateTable } from "../alg";
import { docToTable,  TableDoc } from "./model";
import { loadTable } from "./load-table";
import { tableToMD } from "./output";


export const run = () => {
  const [,, fp] = process.argv;

  if (!fp) {
    console.error("Missing required path to table yaml");
    return;
  }

  const table = loadTable(fp);

  if (table === null) {
    return;
  }

  const tableValidationErrs = validateTable(table);

  const specName = (table.name as string) || "Untitled Decision Table";
  const fileName = specName
    .toLocaleLowerCase()
    .split(" ")
    .join("-")
    + ".md";


  const output = tableToMD(table.name, table, tableValidationErrs);
  fs.writeFileSync(fileName, output);

  if (tableValidationErrs.length === 0) {
    console.log(`Decision table summary available at ${fileName}`);
  } else { 
    console.log(`Found ${tableValidationErrs.length} problems with spec, please se ${fileName}`);
  }
};


run();
