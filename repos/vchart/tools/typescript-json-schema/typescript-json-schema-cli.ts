import { exec, getDefaultArgs } from './typescript-json-schema';

export function run() {
  var helpText = 'Usage: typescript-json-schema <path-to-typescript-files-or-tsconfig> <type>';
  const defaultArgs = getDefaultArgs();

  // prettier-ignore
  var args = require("yargs")
        .usage(helpText)
        .demand(2)
        .boolean("refs").default("refs", defaultArgs.ref)
            .describe("refs", "Create shared ref definitions.")
        .boolean("aliasRefs").default("aliasRefs", defaultArgs.aliasRef)
            .describe("aliasRefs", "Create shared ref definitions for the type aliases.")
        .boolean("topRef").default("topRef", defaultArgs.topRef)
            .describe("topRef", "Create a top-level ref definition.")
        .boolean("titles").default("titles", defaultArgs.titles)
            .describe("titles", "Creates titles in the output schema.")
        .boolean("defaultProps").default("defaultProps", defaultArgs.defaultProps)
            .describe("defaultProps", "Create default properties definitions.")
        .boolean("noExtraProps").default("noExtraProps", defaultArgs.noExtraProps)
            .describe("noExtraProps", "Disable additional properties in objects by default.")
        .boolean("propOrder").default("propOrder", defaultArgs.propOrder)
            .describe("propOrder", "Create property order definitions.")
        .boolean("useTypeOfKeyword").default("useTypeOfKeyword", defaultArgs.typeOfKeyword)
            .describe("useTypeOfKeyword", "Use typeOf keyword (https://goo.gl/DC6sni) for functions.")
        .boolean("required").default("required", defaultArgs.required)
            .describe("required", "Create required array for non-optional properties.")
        .boolean("strictNullChecks").default("strictNullChecks", defaultArgs.strictNullChecks)
            .describe("strictNullChecks", "Make values non-nullable by default.")
        .boolean("esModuleInterop").default("esModuleInterop", defaultArgs.esModuleInterop)
            .describe("esModuleInterop", "Use esModuleInterop when loading typescript modules.")
        .boolean("skipLibCheck").default("skipLibCheck", defaultArgs.skipLibCheck)
            .describe("skipLibCheck", "Use skipLibCheck when loading typescript modules.")
        .boolean("ignoreErrors").default("ignoreErrors", defaultArgs.ignoreErrors)
            .describe("ignoreErrors", "Generate even if the program has errors.")
        .alias("out", "o")
            .describe("out", "The output file, defaults to using stdout")
        .array("validationKeywords").default("validationKeywords", defaultArgs.validationKeywords)
            .describe("validationKeywords", "Provide additional validation keywords to include.")
        .boolean("excludePrivate").default("excludePrivate", defaultArgs.excludePrivate)
            .describe("excludePrivate", "Exclude private members from the schema.")
        .boolean("uniqueNames").default("uniqueNames", defaultArgs.uniqueNames)
            .describe("uniqueNames", "Use unique names for type symbols.")
        .array("include").default("*", defaultArgs.include)
            .describe("include", "Further limit tsconfig to include only matching files.")
        .boolean("rejectDateType").default("rejectDateType", defaultArgs.rejectDateType)
            .describe("rejectDateType", "Rejects Date fields in type definitions.")
        .string("id").default("id", defaultArgs.id)
            .describe("id", "ID of schema.")
        .option("defaultNumberType").choices("defaultNumberType", ["number", "integer"])
            .default("defaultNumberType", defaultArgs.defaultNumberType)
            .describe("defaultNumberType", "Default number type.")
        .boolean("tsNodeRegister").default("tsNodeRegister", defaultArgs.tsNodeRegister)
            .describe("tsNodeRegister", "Use ts-node/register (needed for requiring typescript files).")
        .argv;

  exec(args._[0], args._[1], {
    ref: args.refs,
    aliasRef: args.aliasRefs,
    topRef: args.topRef,
    titles: args.titles,
    defaultProps: args.defaultProps,
    noExtraProps: args.noExtraProps,
    propOrder: args.propOrder,
    typeOfKeyword: args.useTypeOfKeyword,
    required: args.required,
    strictNullChecks: args.strictNullChecks,
    esModuleInterop: args.esModuleInterop,
    skipLibCheck: args.skipLibCheck,
    ignoreErrors: args.ignoreErrors,
    out: args.out,
    validationKeywords: args.validationKeywords,
    include: args.include,
    excludePrivate: args.excludePrivate,
    uniqueNames: args.uniqueNames,
    rejectDateType: args.rejectDateType,
    id: args.id,
    defaultNumberType: args.defaultNumberType,
    tsNodeRegister: args.tsNodeRegister
  });
}

if (typeof window === 'undefined' && require.main === module) {
  run();
}
