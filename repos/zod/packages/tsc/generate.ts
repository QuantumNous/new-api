import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const ZOD = {
  imports: [`import * as z from "zod/v4";`],
  schemaType: "z.object" as const,
  valueTypes: [`z.string()`],
};

export const ZOD3 = {
  imports: [`import * as z from "zod3";`],
  schemaType: "z.object" as const,
  valueTypes: [`z.string()`],
};

export const VALIBOT = {
  imports: [`import * as v from "valibot";`],
  schemaType: "valibot" as const,
  valueTypes: [`v.string()`],
};

export const ARKTYPE = {
  imports: [`import {type} from "arktype";`],
  schemaType: "arktype" as const,
  valueTypes: [`"string"`],
};

generateExtendChain({
  ...ARKTYPE,
  numSchemas: 25,
  numKeys: 6,
});

interface GenerateObjectsParams {
  // path?: string;
  imports: string[];
  schemaType: "z.object" | "arktype" | "valibot";
  valueTypes: string[];
  methods?: string[];
  numSchemas: number;
  numKeys: number;
  numRefs?: number;
  numOmits?: number;
  numPicks?: number;
  numExtends?: number;
  custom?: string;
}
// Step 4: Write the generated schemas to a file
export function generate(params: GenerateObjectsParams) {
  const {
    imports,
    schemaType,
    numSchemas,
    numRefs = 0,
    numOmits = 0,
    numPicks = 0,
    numExtends = 0,

    custom = "",
  } = params;
  const path = "src/index.ts";
  // console.log(params);
  let file: string[] = [];
  // const file: string[] = params.imports;
  file = file.concat(imports);
  const names = Array.from({ length: numSchemas }, () => randomStr(17));
  const generated: Array<string> = [...names];

  console.log(`Generating ${numSchemas} schemas w/ ${params.numKeys} keys and ${numRefs} refs.`);

  for (const variableName of names) {
    // file.push(`export const ${variableName} = { name: "${variableName}" };`);
    // if (1 > 0) continue;

    // open
    if (schemaType === "arktype") {
      file.push(`export const ${variableName} = type({`);
    } else if (schemaType === "valibot") {
      file.push(`export const ${variableName} = v.object({`);
    } else {
      file.push(`export const ${variableName} = ${schemaType}({`);
    }

    // fields
    const fields = generateFields(params);
    for (const { key, schema } of fields) {
      file.push(`  ${key}: ${schema},`);
    }

    // refs
    if (numRefs > 0 && generated.length > 1) {
      for (let i = 0; i < numRefs; i++) {
        const randomIndex = Math.floor(Math.random() * generated.length);
        const linked = generated[randomIndex];
        if (schemaType === "arktype") {
          throw new Error("References not supported in arktype.");
        } else {
          file.push(`  get ${randomStr(7)}(){ return ${linked} as typeof ${linked}},`);
        }
      }
    }

    file.push("});");
    file.push(``);

    // extracting types
    // file.push(
    //   `export type ${variableName}_input = z.input<typeof ${variableName}>;`
    // );
    // file.push(
    //   `export type ${variableName}_output = z.output<typeof ${variableName}>;`
    // );

    file.push(``);

    const keys = fields.map((field) => field.key);

    // omits
    for (let i = 0; i < numOmits; i++) {
      const varname = randomStr(7);
      const omitKeys = keys.slice(0, keys.length - 1).filter(() => Math.random() > 0.5);
      file.push(`export const ${varname} = ${variableName}.omit({`);
      for (const key of omitKeys) {
        file.push(`  "${key}": true,`);
      }
      file.push(`});`);
    }

    if (numOmits) file.push(``);

    // picks
    for (let i = 0; i < numPicks; i++) {
      const varname = randomStr(7);
      const pickKeys = keys.slice(0, keys.length - 1).filter(() => Math.random() > 0.5);

      file.push(`export const ${varname} = ${variableName}.pick({`);
      for (const key of pickKeys) {
        file.push(`  "${key}": true,`);
      }
      file.push(`});`);
    }

    if (numPicks) file.push(``);

    // extends
    for (let i = 0; i < numExtends; i++) {
      const fields = generateFields({ ...params, numKeys: numExtends });
      // for (const { key, schema } of fields) {
      //   file.push(`  ${key}: ${schema},`);
      // }
      const varname = randomStr(7);
      // const extendKeys = Array(3)
      //   .fill(0)
      //   .map(() => randomStr(7));

      if (schemaType === "z.object") {
        file.push(`export const ${varname} = ${variableName}.extend({`);
        for (const field of fields) {
          file.push(`  "${field.key}": ${field.schema},`);
        }
        file.push(`});`);
      } else if (schemaType === "arktype") {
        file.push(`export const ${varname} = type({`);
        file.push(`  "...": ${variableName},`);
        for (const field of fields) {
          file.push(`  "${field.key}": ${field.schema},`);
        }
        file.push(`});`);
      }
    }

    if (numExtends) file.push(``);

    // generated.push(variableName);
  }

  file.push(custom);

  // Create directory if it doesn't exist
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, file.join("\n"), { flag: "w" });
}

interface GenerateExtendChainParams {
  // path?: string;
  imports: string[];
  schemaType: "z.object" | "arktype" | "valibot";
  valueTypes: string[];
  methods?: string[];
  numSchemas: number;
  numKeys: number;
  // numRefs?: number;
  numOmits?: number;
  numPicks?: number;
  numExtends?: number;
  custom?: string;
}
export function generateExtendChain(params: GenerateExtendChainParams) {
  const {
    imports,
    schemaType,
    numSchemas,

    // numRefs = 0,
    // numOmits = 0,
    // numPicks = 0,
    // numExtends = 0,
    // methods = [""],
    // custom = "",
  } = params;

  // let counter = 0;

  const path = "src/index.ts";
  // console.log(params);
  let file: string[] = [];
  // const file: string[] = params.imports;
  file = file.concat(imports);
  const initialName = randomStr(17);
  // const generated: Array<string> = [...names];

  console.log(`Generating ${numSchemas} chained calls to .extend() w/ ${params.numKeys} keys...`);
  if (schemaType === "arktype") {
    file.push(`export const ${initialName}_0 = type({`);
  } else if (schemaType === "valibot") {
    // throw new Error("Not supported yet.")
    file.push(`export const ${initialName}_0 = v.object({`);
  } else {
    file.push(`export const ${initialName}_0 = ${schemaType}({`);
  }

  // fields
  let fields = generateFields(params);
  for (const { key, schema } of fields) {
    file.push(`  ${key}: ${schema},`);
  }

  file.push("});");

  // while(let counter = 0; counter < numSchemas; counter++) {

  // }
  // let counter = 0;
  let mode: "omit" | "extend" = "omit";

  for (let counter = 1; counter < numSchemas; counter++) {
    file.push(``);
    const prevName = `${initialName}_${counter - 1}`;
    const newName = `${initialName}_${counter}`;
    if (mode === "omit") {
      // omit three keys from `fields`
      const omitFields = fields.slice(0, 3); //.filter(() => Math.random() > 0.5);

      if (schemaType === "arktype") {
        file.push(
          `export const ${newName} = ${prevName}.omit(${omitFields.map((field) => `"${field.key}"`).join(",")});`
        );
        // continue
      } else if (schemaType === "valibot") {
        file.push(
          `export const ${newName} = v.omit(${prevName}, [${omitFields.map((field) => `"${field.key}"`).join(",")} ]);`
        );
      } else {
        file.push(`export const ${newName} = ${prevName}.omit({`);
        for (const field of omitFields) {
          file.push(`  "${field.key}": true,`);
        }
        file.push(`});`);
      }

      fields = fields.slice(3);
      mode = "extend";
    } else if (mode === "extend") {
      // extend three keys to `fields`
      const newFields = generateFields({ ...params, numKeys: 3 });
      if (schemaType === "arktype") {
        file.push(`export const ${newName} = type({ "...": ${prevName},`);
        for (const field of newFields) {
          file.push(`  "${field.key}": ${field.schema},`);
        }
        file.push(`});`);
        file.push(`export type ${newName} = typeof ${newName}.out;`);
      } else if (schemaType === "valibot") {
        file.push(`export const ${newName} = v.object({ ...${prevName}.entries,`);
        for (const field of newFields) {
          file.push(`  "${field.key}": ${field.schema},`);
        }
        file.push(`});`);
      } else {
        // super slow
        file.push(`export const ${newName} = ${prevName}.extend({`);

        // even slower somehow
        // file.push(`export const ${newName} = z.extend(${prevName}, {`);

        // much faster...spread
        // file.push(`export const ${newName} = ${schemaType}({`);
        // file.push(`  ...${prevName}.shape,`);
        for (const field of newFields) {
          file.push(`  "${field.key}": ${field.schema},`);
        }
        file.push(`});`);
        file.push(`export type ${newName} = z.infer<typeof ${newName}>;`);
      }
      fields = fields.concat(newFields);
      mode = "omit";
    }
  }

  // Create directory if it doesn't exist
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, file.join("\n"), { flag: "w" });
}

// Step 2: Generate a random string for keys and variable names
function randomStr(length: number) {
  const charset = "abcdefghijklmnopqrstuvwxyz";
  let result = "";
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * charset.length);
    result += charset[randomIndex];
  }
  return result;
}

// Step 3: Generate a random Zod schema
function generateFields(
  params: Pick<GenerateObjectsParams, "numKeys" | "valueTypes" | "methods">
): { key: string; schema: string }[] {
  //Math.floor(Math.random() * 30) + 1; // 1-30 keys
  const { methods = [""] } = params;

  // const keys = [];
  const fields: { key: string; schema: string }[] = [];
  for (let i = 0; i < params.numKeys; i++) {
    const key = randomStr(8); // Key name of 8 chars
    // keys.push(key);
    const randomTypeIndex = Math.floor(Math.random() * params.valueTypes.length);
    const randomChainMethodIndex = Math.floor(Math.random() * methods.length);
    const randomType = params.valueTypes[randomTypeIndex]!;
    // const randomChance = Math.random();
    // if (randomChance > 0.98) {
    //   const { schema: nestedSchema } = generateRandomZodSchema();
    //   schema += ` ${key}: ${nestedSchema},`;
    //   continue;
    // }
    const type = randomType + methods[randomChainMethodIndex]!;

    fields.push({ key, schema: type });
    // schema += ` ${key}: ${type},`;
  }

  // schema += " })";
  return fields;
}
