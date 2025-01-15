"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    Object.defineProperty(o, k2, { enumerable: true, get: function() { return m[k]; } });
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
var fs = __importStar(require("mz/fs"));
var path = __importStar(require("path"));
var yargs_1 = __importDefault(require("yargs"));
var _1 = require(".");
var theme_1 = require("./theme");
yargs_1.default
    .option('theme', {
    alias: 't',
    nargs: 1,
    description: 'Use a theme defined in a JSON file',
})
    .usage(['', 'Usage: highlight [options] [file]', '', 'Outputs a file or STDIN input with syntax highlighting'].join('\n'))
    .option('language', {
    alias: 'l',
    nargs: 1,
    description: 'Set the langugage explicitely\nIf omitted will try to auto-detect',
})
    .version()
    .help('help')
    .alias('help', 'h')
    .alias('version', 'v');
var argv = yargs_1.default.argv;
var file = argv._[0];
var codePromise;
if (!file && !process.stdin.isTTY) {
    // Input from STDIN
    process.stdin.setEncoding('utf8');
    var code_1 = '';
    process.stdin.on('readable', function () {
        var chunk = process.stdin.read();
        if (chunk !== null) {
            code_1 += chunk;
        }
    });
    codePromise = new Promise(function (resolve) {
        process.stdin.on('end', function () {
            var chunk = process.stdin.read();
            if (chunk !== null) {
                code_1 += chunk;
            }
            resolve(code_1);
        });
    });
}
else if (file) {
    // Read file
    codePromise = fs.readFile(file, 'utf-8');
}
else {
    yargs_1.default.showHelp();
    process.exit(1);
}
Promise.all([codePromise, argv.theme ? fs.readFile(argv.theme, 'utf8') : undefined])
    .then(function (_a) {
    var code = _a[0], theme = _a[1];
    var options = {
        ignoreIllegals: true,
        theme: (theme && theme_1.parse(theme)) || undefined,
    };
    if (file) {
        var extension = path.extname(file).slice(1);
        if (extension && _1.supportsLanguage(extension)) {
            options.language = extension;
        }
    }
    options.language = argv.language;
    return new Promise(function (resolve, reject) {
        return process.stdout.write(_1.highlight(code, options), function (error) { return (error ? reject(error) : resolve()); });
    });
})
    .then(function () {
    process.exit(0);
})
    .catch(function (error) {
    console.error(error);
    process.exit(1);
});
//# sourceMappingURL=cli.js.map