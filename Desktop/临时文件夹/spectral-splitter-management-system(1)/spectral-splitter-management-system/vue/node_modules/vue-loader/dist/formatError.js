"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatError = void 0;
const compiler_1 = require("./compiler");
const chalk = require("chalk");
const { generateCodeFrame } = compiler_1.compiler;
function formatError(err, source, file) {
    const loc = err.loc;
    if (!loc) {
        return;
    }
    const locString = `:${loc.start.line}:${loc.start.column}`;
    const filePath = chalk.gray(`at ${file}${locString}`);
    const codeframe = generateCodeFrame(source, loc.start.offset, loc.end.offset);
    err.message = `\n${chalk.red(`VueCompilerError: ${err.message}`)}\n${filePath}\n${chalk.yellow(codeframe)}\n`;
}
exports.formatError = formatError;
