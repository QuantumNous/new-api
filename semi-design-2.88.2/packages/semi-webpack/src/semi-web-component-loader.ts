const fs = require('fs');
import componentDependentTree from './componentDependentTree';

function getAllComponents(components: string[]) {
    const originComponents = new Set(components);
    const resultComponents = new Set();
    // 对特殊组件做特殊处理，因为这些组件的样式文件名和组件名不一致，需要手动映射
    const specialCaseBefore = {
        'AvatarGroup': 'Avatar',
        'CheckboxGroup': 'Checkbox',
        'TagGroup': 'Tag',
        'ButtonGroup': 'Button',
        'SplitButtonGroup': 'Button',
    };

    /*
    对特殊组件做特殊处理，因为这些组件的样式文件名和组件名不一致，需要手动映射
    同时由于以下原因：
    1. 组件所依赖组件和被映射的组件不同，因此应该在获取到依赖组件之后，再做映射
      e.g InputGroup 依赖 Form 组件，其样式存储在 input.scss 中，
      而 Input 不依赖 Form 组件，因此对于 InputGroup，需要拿到依赖组件，再做映射
    2. 由于组件是其他组件的依赖组件，因此需要在获取到依赖组件之后，再做映射
      e.g 比如 Row 是 Form 组件的依赖，因此需要在获取到依赖组件之后，再做映射
  */
    const specialCaseAfter = {
        "InputGroup": "Input",
        'Row': 'Grid',
        'Col': 'Grid',
    };

    Object.keys(specialCaseBefore).map(keyComponent => {
        if (originComponents.has(keyComponent)) {
            originComponents.delete(keyComponent);
            originComponents.add(specialCaseBefore[keyComponent]);
        }
    });

    function getDependentComponents(components: string[]) {
        components.forEach((component) => {
            if (!resultComponents.has(component)) {
                const dependents = componentDependentTree[component];
                dependents?.forEach((element: string) => {
                    getDependentComponents([element]);
                });
                resultComponents.add(component);
            }
        });
    }

    getDependentComponents(Array.from(originComponents) as string[]);

    Object.keys(specialCaseAfter).map(keyComponent => {
        if (resultComponents.has(keyComponent)) {
            resultComponents.delete(keyComponent);
            resultComponents.add(specialCaseAfter[keyComponent]);
        }
    });

    return Array.from(resultComponents);
}

function getScssImportPaths(components: string[]) {
    const pathsObj = {
        IconPath: '@douyinfe/semi-icons/lib/es/styles/icons.scss',
        basePath: '@douyinfe/semi-ui/lib/es/_base/base.scss',
        foundationPath: '@douyinfe/semi-foundation/lib/es/'
    };
    const specialCase = {
        'Icon': pathsObj.IconPath,
        'Base': pathsObj.basePath,
        'Portal': `${pathsObj.foundationPath}_portal/portal.scss`,
        "TextArea": `${pathsObj.foundationPath}input/textarea.scss`,
        "IconButton": `${pathsObj.foundationPath}button/iconButton.scss`,
        "SplitButtonGroup": `${pathsObj.foundationPath}button/SplitButtonGroup.scss`,
    };
    const cssPaths = ["Base", ...components].map(componentName => {
        const lowFirstLetter = componentName.slice(0, 1).toLowerCase() + componentName.slice(1);
        let pathName = '';
        if (specialCase[componentName]) {
            pathName = specialCase[componentName];
        } else {
            pathName = `${pathsObj.foundationPath}${lowFirstLetter}/${lowFirstLetter}.scss`;
        }
        return pathName;
    });

    const importFuncName = `
async function importSemiComponentStyle(componentsStr, root, cb){
  const modules = await Promise.all([
    ${cssPaths.map(path => `import("${path}")`).join(',')}
  ]);
  const styleStr = modules.map(module => {
    const cssContent = module.default;
    return cssContent;
  });
  styleStr.reverse().forEach(css => {
    const style = document.createElement('style');
    style.innerHTML = css;
    root.prepend(style);
  });
  if(typeof cb === 'function') {
    cb();
  }
}
  `;
    return importFuncName;
}

export default function semiWebComponentLoader(source: string) {
    /*SEMI_INSERT_STYLE_BEGIN[需要插入样式的组件]SEMI_INSERT_STYLE_END*/
    const beginContent = 'SEMI_INSERT_STYLE_BEGIN';
    const beginIndex = source.indexOf(beginContent);
    if (beginIndex !== -1) {
        const endIndex = source.indexOf('SEMI_INSERT_STYLE_END');
        if (endIndex === -1) {
            throw new Error('SEMI_INSERT_STYLE_END not found');
        }
        const componentsStr = source.slice(beginIndex + beginContent.length, endIndex);
        const componentsArr = JSON.parse(componentsStr);
        const allComponents = getAllComponents(componentsArr);
        // console.log('allComponents', allComponents);

        const importFuncName = getScssImportPaths(allComponents as string[]);
        const result = source + importFuncName;
        // console.log('result', result);
        return result;
    }
    return source;
}
