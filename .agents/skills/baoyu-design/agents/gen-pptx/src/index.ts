// Public surface for programmatic use. (←Dt runGenPptx + Fe validate.)
export { runGenPptx, type RunOutput } from "./orchestrator/run.ts";
export { PlaywrightDriver, type DriverOptions } from "./orchestrator/driver.ts";
export { writeOutput } from "./orchestrator/output.ts";
export { validate, type SlideHashResult } from "./validate/validate.ts";
export type * from "./types.ts";
