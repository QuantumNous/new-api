import { Rule } from "eslint";

const SEMI_PACKAGE_REG = /(?<=packages\/|@douyinfe\/|\.\.\/)(semi-[\w-]+)/;
const RELATIVE_PATH_REG = /(..\/)+semi-[\w-]+/;

const rule: Rule.RuleModule = {
    meta: {
        type: "problem",
        docs: {
            description: "disable import statement",
            recommended: true,
            url: "https://github.com/DouyinFE/semi-design"
        },
        fixable: "code",
        messages: {
            unexpected: "Unexpected import statement, semi ui should not be used as a dependency of semi foundation",
            unexpectedLodashES: "Unexpected import statement, please use lodash instead of lodash-es.",
            unexpectedRelativeImport: "Unexpected import statement, please use module name instead of relative path.",
            unexpectedImportSelf: 'Unexpected import statement, please use relative paths to import modules in the same package.',
            unexpectedReactImport: "Unexpected import statement, React should not be used as a dependency of semi foundation"
        },
        schema: [],
    },
    create(context) {
        return {
            ImportDeclaration: (node) => {
                const fileName = context.getFilename();
                const sourceCode = context.getSourceCode();
                const importName = node.source.raw;
                const isFoundationFile = fileName.includes('semi-foundation');
                const isUIFile = fileName.includes('semi-ui');
                const importText = sourceCode.getText(node);

                if (isFoundationFile) {
                    if (importName.includes('semi-ui')) {
                        context.report({ node, messageId: "unexpected" });
                    }
                    if (importName.includes('react') || importName.includes('react-dom')) {
                        context.report({ node, messageId: "unexpectedReactImport" });
                    }
                }

                if (isFoundationFile || isUIFile) {
                    if (importName.includes('lodash-es')) {
                        const fixedSource = importText.replace('lodash-es', 'lodash');
                        context.report({
                            node,
                            messageId: "unexpectedLodashES",
                            fix: (fixer) => {
                                return fixer.replaceText(node, fixedSource);
                            }
                        });
                    } else if (importName.includes('semi-')) {
                        if (isImportRelativePackage({ path: importName, fileName })) {
                            const importPackageName = SEMI_PACKAGE_REG.exec(importName)[0];
                            const fixedSource = importText.replace(RELATIVE_PATH_REG, `@douyinfe/${importPackageName}`);
                            context.report({
                                node,
                                messageId: "unexpectedRelativeImport",
                                fix: (fixer) => {
                                    return fixer.replaceText(node, fixedSource);
                                }
                            });
                        } else if (isImportSelf({ path: importName, fileName })) {
                            if (!fileName.includes('story')) {
                                context.report({
                                    node,
                                    messageId: "unexpectedImportSelf",
                                });
                            }
                        }
                    }
                }
            }
        };
    }
};

function isRelativePath(path: string) {
    return path.includes('../');
}

function isImportRelativePackage(options: { path: string; fileName: string }) {
    const { path, fileName } = options;
    const currentPackageName = SEMI_PACKAGE_REG.exec(fileName)[0];
    const importPackageName = SEMI_PACKAGE_REG.exec(path)[0];
    return currentPackageName !== importPackageName && isRelativePath(path);
}

function isImportSelf(options: { path: string; fileName: string }) {
    const { path, fileName } = options;
    const currentPackageName = SEMI_PACKAGE_REG.exec(fileName)[0];
    const importPackageName = SEMI_PACKAGE_REG.exec(path)[0];
    return currentPackageName === importPackageName;
}

export default rule;