import * as fs from "fs";
import * as TJS from "typescript-json-schema";

const program = TJS.getProgramFromFiles(["./src/cmd/model.ts"]);

const schema = TJS.generateSchema(program, "TableDoc", { required: true });

fs.writeFileSync("./doc-schema.json", JSON.stringify(schema, null, 2));
