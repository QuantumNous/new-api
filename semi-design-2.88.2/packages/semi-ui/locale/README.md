### Name
Semi Design locale package

## Description
Component multilingual support

## Usage
```js
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
import { LocaleProvider } from '@douyinfe/semi-ui';

return (
    <LocaleProvider locale={en_GB}>
        <App/>
    </LocaleProvider>
);
```

## How to add a language package
1. Create a language file, add it to source directory(semi-ui/packages/semi-ui/locale/source)

![](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi-lang-file.png)

2. Translation component built-in text

![](https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/root-web-sites/semi-lang-content.jpg)

3. In order to let users know that there is this language package, you need to:
    - Add it to the [LocaleProvider page](./index.md) to let users know that there is this new language package
    - Import this new language file to [demo scope](../../../src/templates/scope.js) so that demo can support it

> Notice: Don't replace key in `${}` which is a dynamic value.


## What the language file should include
- code: language package code
- dateFnsLocale: need to pass date-fns locale object when formatting a date (using dateFns.format or dateFns.parse etc)
- text: components' built-in text

## License

MIT