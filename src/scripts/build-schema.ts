import * as fs from "fs";
import * as path from "path";
import * as TJS from "typescript-json-schema";

const program = TJS.getProgramFromFiles(["./src/common/table-doc.ts"]);

const schema = TJS.generateSchema(program, "TableDoc", { required: true });
const schemaPath = path.join(path.dirname(__filename), "../common/doc-schema.json");
fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2));
