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
Object.defineProperty(exports, "__esModule", { value: true });
/* eslint-disable no-sync */
var fs = __importStar(require("fs"));
var __1 = require("..");
function test(language, code) {
    it("should color " + language + " correctly", function () {
        var highlighted = __1.highlight(code);
        if (process.env.OUTPUT_CODE_SAMPLES) {
            console.log(language + ':\n\n' + highlighted);
        }
        expect(highlighted).toMatchSnapshot();
    });
}
describe('highlight()', function () {
    var fixtures = fs.readdirSync(__dirname + "/__fixtures__");
    for (var _i = 0, fixtures_1 = fixtures; _i < fixtures_1.length; _i++) {
        var fixture = fixtures_1[_i];
        var fixturePath = __dirname + "/__fixtures__/" + fixture;
        if (fs.statSync(fixturePath).isFile()) {
            var language = fixture.split('.')[0];
            test(language, fs.readFileSync(fixturePath, 'utf8'));
        }
    }
});
describe('listLanguages()', function () {
    it('should list the supported languages', function () {
        var languages = __1.listLanguages();
        expect(languages).toBeInstanceOf(Array);
        expect(languages.length).toBeGreaterThan(0);
    });
});
describe('supportsLanguage()', function () {
    it('should return true if the language is supported', function () {
        var supports = __1.supportsLanguage('json');
        expect(supports).toBe(true);
    });
    it('should return false if the language is not supported', function () {
        var supports = __1.supportsLanguage('notsupported');
        expect(supports).toBe(false);
    });
});
//# sourceMappingURL=test.js.map