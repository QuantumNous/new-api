export = processArguments;
/**
 * @param {Record<string, Argument>} args object of arguments
 * @param {any} config configuration
 * @param {Record<string, string | number | boolean | RegExp | (string | number | boolean | RegExp)[]>} values object with values
 * @returns {Problem[] | null} problems or null for success
 */
declare function processArguments(
  args: Record<string, Argument>,
  config: any,
  values: Record<
    string,
    string | number | boolean | RegExp | (string | number | boolean | RegExp)[]
  >
): Problem[] | null;
declare namespace processArguments {
  export { ProblemType, Problem, LocalProblem, ArgumentConfig, Argument };
}
type Argument = {
  description: string;
  simpleType: "string" | "number" | "boolean";
  multiple: boolean;
  configs: ArgumentConfig[];
};
type Problem = {
  type: ProblemType;
  path: string;
  argument: string;
  value?: any | undefined;
  index?: number | undefined;
  expected?: string | undefined;
};
type ProblemType =
  | "unknown-argument"
  | "unexpected-non-array-in-path"
  | "unexpected-non-object-in-path"
  | "multiple-values-unexpected"
  | "invalid-value";
type LocalProblem = {
  type: ProblemType;
  path: string;
  expected?: string | undefined;
};
type ArgumentConfig = {
  description: string;
  path: string;
  multiple: boolean;
  type: "enum" | "string" | "path" | "number" | "boolean" | "RegExp" | "reset";
  values?: any[] | undefined;
};
