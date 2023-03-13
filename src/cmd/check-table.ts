import * as fs from "fs";
import * as path from "path";
import * as process from "process";

import { validateTable } from "../alg";
import { loadTable } from "../common";

const checkTable = () => {
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

  console.table(tableValidationErrs);
};

checkTable();
