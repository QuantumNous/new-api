> A Scss compile tool for Semi Design

## Description

There are mainly the following two usage scenarios:

- For Sever side consumption in Semi Design System.When publishing the theme, call the script on the Node side to
  compile the custom theme package into a complete semi.css file
- Before publish `@douyinfe/semi-foundation`,construct a complete semi.css file

## Usage

### Command Line

```shell
npm i -g @douyinfe/semi-scss-compile

semi-build-scss --foundation="path/to/foundation" --theme="path/to/theme" --icon="path/to/'@douyinfe/semi-icons'" --output="path/to/output.css" --min

# or for short

semi-build-scss -f "path/to/foundation" -t "path/to/theme" -i "path/to/'@douyinfe/semi-icons'" -o "path/to/output.css" -m

```

### JS API

```js

const { compile } = require('@douyinfe/semi-scss-compile');
const path = require('path');

function resolve(dir) {
    return path.join(__dirname, '../..', dir);
}

//eg

compile({
    foundationPath: resolve('semi-foundation/'),
    themePath: resolve('semi-theme-default/'),
    iconPath: resolve('node_modules/@douyinfe/semi-icons'),
    outputPath: resolve('semi-ui/dist/css/semi.min.css'),
    isMin: true
});

compile({
    foundationPath: resolve('semi-foundation/'),
    themePath: resolve('semi-theme-default/'),
    iconPath: resolve('node_modules/@douyinfe/semi-icons'),
    outputPath: resolve('semi-ui/dist/css/semi.css'),
    isMin: false
});
```

### Advanced API

```js
const { generateScssMap, writeFile, compilerFromScssMap } = require('@douyinfe/semi-scss-compile');
const fs = require('fs-extra');

const isMin = false;
const scssMap = generateScssMap("path/to/foundation", "path/to/theme", "path/to/'@douyinfe/semi-icons'");
const tempDir = writeFile(scssMap);
const result = compilerFromScssMap(path.join(tempDir, 'index.scss'), isMin);
fs.outputFileSync(outputPath, result.css);

```

## Maintainers

<table>
    <tbody>
        <tr>
            <td align="center"><a href="https://github.com/DouyinFE/semi-design"><img src="https://sf6-cdn-tos.douyinstatic.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/SemiLogo.jpg" width="100px;" alt="" style="max-width:100%;"><br><sub><b>Semi Teams</b></sub></a></td>
        </tr>
    </tbody>
</table>

## License

MIT
