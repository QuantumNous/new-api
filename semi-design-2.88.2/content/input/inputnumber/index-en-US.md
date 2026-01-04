---
localeCode: en-US
order: 41
category: Input
title:  InputNumber
subTitle: InputNumber
icon: doc-inputnumber
brief: Through the mouse or keyboard, input the value in the range. Unlike Input, it has a stepper operation area for digital scenes, and it can display more complex content formats when used with Parser.
---


## When to Use

When you need to get a standard value.

## Demos

### How to import

```jsx import 
import { InputNumber } from '@douyinfe/semi-ui';
```


### Basic Input Box

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <div style={{ width: 280 }}>
                <label>Simple</label>
                <InputNumber />
                <br/><br/>

                <label>Set step to 2 </label>
                <InputNumber step={2} />
                <br/><br/>

                <label>Press shift key and click the button to increase/decrease the step size </label>
                <InputNumber shiftStep={100} />
                <br/><br/>

                <label>Set min to 1, max to 10</label>
                <InputNumber min={1} max={10} Default Value={1} />
                <br/><br/>
            </div>
        );
    }
}
```

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <div style={{ width: 280 }}>
                <label>Set defaultValue to 1 </label>
                <InputNumber defaultValue={1} />
                <br/><br/>

                <label>Set disabled to true</label>
                <InputNumber defaultValue={2} disabled />
                <br/><br/>

                <label>Set precision to 2 </label>
                <InputNumber precision={2} defaultValue={1.234} />
                <br/><br/>

                <label>Set innerButtons=true </label>
                <InputNumber innerButtons={true} suffix={'Hour'} defaultValue={1} style={{ width: 190 }} />
                <br/>

            </div>
        );
    }
}
```


### Inner Buttons

With `innerButtons`, you can hide the buttons on the right into the interior, which will only be displayed when hover occurs

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

() => (
    <InputNumber innerButtons style={{ width: 190 }} />
);
```

Set `hidebuttons` to `true` to hide the buttons completely

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

() => (
    <InputNumber hideButtons style={{ width: 190 }} />
);

```

### Size

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

class App extends React.Component {
    render() {
        return (
            <div style={{ width: 180 }}>
                <label>size=default</label>
                <InputNumber />
                <br/><br/>

                <label>size=large</label>
                <InputNumber size="large" />
                <br/><br/>

                <label>size=small</label>
                <InputNumber size="small" />
                <br/>

            </div>
        );
    }
}
```

### Custom Display Format and Resolution

> A pair of methods for `formatter` and `parser`, which generally need to be set at the same time, otherwise the value cannot be resolved correctly.

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

class App extends React.Component {
    log(v) {
        console.log(`Changed to: [${typeof v}] ${v}`);
    }

    render() {
        return (
            <div style={{ width: 180 }}>
                <label>RMB</label>
                <InputNumber
                    onChange={this.log}
                    defaultValue={1000}
                    min={0}
                    formatter={value => `￥ ${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={value => value.replace(/\￥\s?|(,*)/g, '')}
                />
                <br/><br/>

                <label>Custom string</label>
                <InputNumber
                    onChange={this.log}
                    defaultValue={1111}
                    formatter={value => String(value).split('').join('-')}
                    parser={value => value.replace(/\-/g, '')}
                />
                <br/>

            </div>
        );
    }
}
```

### Can Only Enter Numbers
With formatter and onNumberChange(**>=v1.9.0**), a pure digital input box can be implemented.

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

function Demo () {
    return (
        <InputNumber
            formatter={value => `${value}`.replace(/\D/g, '')}
            onNumberChange={number => console.log(number)}
            min={0}
            max={Number.MAX_SAFE_INTEGER}
        />
    );
}
```

### Currency Display
Version 2.77.0 supports currency display. In internationalization mode, enable currency={true} and the component will automatically display the corresponding currency type according to localeCode. (Note that the component key value needs to be updated after switching the language type)

```jsx live=true
import React from 'react';
import zh_CN from '@douyinfe/semi-ui/lib/es/locale/source/zh_CN';
import en_GB from '@douyinfe/semi-ui/lib/es/locale/source/en_GB';
import en_US from '@douyinfe/semi-ui/lib/es/locale/source/en_US';
import ko_KR from '@douyinfe/semi-ui/lib/es/locale/source/ko_KR';
import ja_JP from '@douyinfe/semi-ui/lib/es/locale/source/ja_JP';
import ar from '@douyinfe/semi-ui/lib/es/locale/source/ar';
import vi_VN from '@douyinfe/semi-ui/lib/es/locale/source/vi_VN';
import ru_RU from '@douyinfe/semi-ui/lib/es/locale/source/ru_RU';
import id_ID from '@douyinfe/semi-ui/lib/es/locale/source/id_ID';
import ms_MY from '@douyinfe/semi-ui/lib/es/locale/source/ms_MY';
import th_TH from '@douyinfe/semi-ui/lib/es/locale/source/th_TH';
import tr_TR from '@douyinfe/semi-ui/lib/es/locale/source/tr_TR';
import pt_BR from '@douyinfe/semi-ui/lib/es/locale/source/pt_BR';
import zh_TW from '@douyinfe/semi-ui/lib/es/locale/source/zh_TW';
import sv_SE from '@douyinfe/semi-ui/lib/es/locale/source/sv_SE';
import pl_PL from '@douyinfe/semi-ui/lib/es/locale/source/pl_PL';
import nl_NL from '@douyinfe/semi-ui/lib/es/locale/source/nl_NL';
import es from '@douyinfe/semi-ui/lib/es/locale/source/es';
import it from '@douyinfe/semi-ui/lib/es/locale/source/it';
import de from '@douyinfe/semi-ui/lib/es/locale/source/de';
import fr from '@douyinfe/semi-ui/lib/es/locale/source/fr';
import ro from '@douyinfe/semi-ui/lib/es/locale/source/ro';
import { LocaleProvider, InputNumber, Select } from '@douyinfe/semi-ui';

class I18nDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            locale: zh_CN,
            localeCode: 'zh_CN',
        };
        this.onLanguageChange = this.onLanguageChange.bind(this);
    }

    onLanguageChange(code) {
        let language = {
            'zh_CN': zh_CN,
            'en_GB': en_GB,
            'en_US': en_US,
            'ko_KR': ko_KR,
            'ja_JP': ja_JP,
            'ar': ar,
            'vi_VN': vi_VN,
            'ru_RU': ru_RU,
            'id_ID': id_ID,
            'ms_MY': ms_MY,
            'th_TH': th_TH,
            'tr_TR': tr_TR,
            'pt_BR': pt_BR,
            'zh_TW': zh_TW,
            'es': es,
            'sv_SE': sv_SE,
            'pl_PL': pl_PL,
            'nl_NL': nl_NL,
            de,
            it,
            fr,
            ro
        };
        this.setState({ locale: language[code], localeCode: code });
    }

    render() {
        const { locale, localeCode } = this.state;
        return (
            <>
                <div style={{ paddingBottom: 20 }}>
                    <Select onChange={this.onLanguageChange} insetLabel='切换语言' style={{ width: 250 }} defaultValue='zh_CN'>
                        <Select.Option value='zh_CN'>Chinese</Select.Option>
                        <Select.Option value='en_GB'>English</Select.Option>
                        <Select.Option value='ja_JP'>Japanese</Select.Option>
                        <Select.Option value='ko_KR'>Korean</Select.Option>
                        <Select.Option value='ar'>Arabic</Select.Option>
                        <Select.Option value='vi_VN'>Vietnamese</Select.Option>
                        <Select.Option value='ru_RU'>Russian</Select.Option>
                        <Select.Option value='id_ID'>Indonesian</Select.Option>
                        <Select.Option value='ms_MY'>Malay</Select.Option>
                        <Select.Option value='th_TH'>Thai</Select.Option>
                        <Select.Option value='tr_TR'>Turkish</Select.Option>
                        <Select.Option value='es'>Spanish</Select.Option>
                        <Select.Option value='de'>German</Select.Option>
                        <Select.Option value='it'>Italian</Select.Option>
                        <Select.Option value='fr'>French</Select.Option>
                        <Select.Option value='ro'>Romanian</Select.Option>
                        <Select.Option value='sv_SE'>Swedish</Select.Option>
                        <Select.Option value='pl_PL'>Polish</Select.Option>
                        <Select.Option value='nl_NL'>Dutch</Select.Option>
                    </Select>
                </div>
                <LocaleProvider locale={locale}>
                    <InputNumber key={localeCode} currency={true} defaultValue={123456.78} />
                </LocaleProvider>
            </>
        );
    }
}

```
You can also specify the currency to be displayed by manually passing localeCode and currency.

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';

() => {
    const defaultValue = 123456.78;
    return (
        <div>
            <div>🇨🇳 CNY</div>
            <InputNumber localeCode="zh-CN" currency="CNY" defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇪🇺 EUR</div>
            <InputNumber localeCode="de-DE" currency="EUR" defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇯🇵 JPY</div>
            <InputNumber localeCode="ja-JP" currency="JPY" defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇻🇳 VND</div>
            <InputNumber localeCode="vi-VN" currency="VND" defaultValue={defaultValue} />
            <br />
            <br />
        </div>
    );
};
```
Supports three display modes: symbol, code, and name. It is controlled by the currencyDisplay property. The currency symbol is displayed by default. Set showCurrencySymbol to false to hide the display of currency symbol/code/name

```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';    

() => {
    const defaultValue = 123456.78;
    return (
        <div>
            <div>🇨🇳 CNY ➕ code</div>
            <InputNumber currency="CNY" currencyDisplay="code" defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇨🇳 CNY ➕ symbol</div>
            <InputNumber currency="CNY" currencyDisplay="symbol" defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇨🇳 CNY ➕ name</div>
            <InputNumber currency="CNY" currencyDisplay="name" defaultValue={defaultValue} />
            <br />
            <br />
            <div>Hide display of currency symbols/codes/names</div>
            <InputNumber currency="CNY" currencyDisplay="name" defaultValue={defaultValue} showCurrencySymbol={false}/>
            <br />
            <br />
        </div>
    );
};
```

Hide the display of currency symbols/codes/names, and display the currency symbol through the prefix/suffix
```jsx live=true
import React from 'react';
import { InputNumber } from '@douyinfe/semi-ui';    

() => {
    const defaultValue = 123456.78;
    return (
        <div>
            <div>🇨🇳 CNY ➕ code</div>
            <InputNumber style={{ width: 200 }} currency="CNY" prefix="CNY" showCurrencySymbol={false} defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇨🇳 CNY ➕ symbol</div>
            <InputNumber style={{ width: 200 }} currency="CNY" prefix="￥" showCurrencySymbol={false} defaultValue={defaultValue} />
            <br />
            <br />
            <div>🇨🇳 CNY ➕ name</div>
            <InputNumber style={{ width: 200 }} currency="CNY" suffix="人民币" showCurrencySymbol={false} defaultValue={defaultValue} />
            <br />
            <br />
        </div>
    );
};
```

## API Reference

| Properties   | Instructions                                                                                    | type                              | Default   | Version    |
| ------------ | ----------------------------------------------------------------------------------------------- | --------------------------------- | --------- | ---------- |
| autofocus    | Automatic access to focus                                                                       | boolean                           | false     |            |
| className    | class name of InputNumber                                                               | string  | -      |
| clearIcon    | Can be used to customize the clear button, valid when showClear is true                       | ReactNode                       |     | 2.25.0 |
| currency | Currency type. In international mode, currency={true} is enabled. The component will automatically display the corresponding currency type according to the locale. You can also manually pass in localeCode and currency to specify the currency type to display. The optional values ​​of currency are `CNY`,`EUR`,`USD`, etc. | boolean\|string | false | **2.77.0** |
| currencyDisplay | Currency display method. Optional values: symbol, code, name | string | symbol | **2.77.0** |
| defaultValue | Default                                                                                         | number                            |           |            |
| disabled     | Disabled status                                                                                 | boolean                           | false     |            |
| formatter    | Specifies the format of the input box to display the value                                      | (value: number\|string) => string | -         |            |
| hideButtons  | Hide the "up/down" button when passing `true`                                                   | boolean                           | false     | **1.0.0**  |
| innerButtons  | Show the "up/down" button in input box when passing `true`                                 | boolean                           | false         | **1.5.0** |
| keepFocus    | Keep the input box focused when you click the button                                        | boolean                 |     false               | **1.10.0** |
| localeCode | Used to specify the country code in currency mode. Optional values ​​include `zh-CN`, `en-US`, `en-GB`, `ja-JP`, `ko-KR`, `ar`, `vi-VN`, `ru-RU`, `id-ID`, `ms-MY`, `th-TH`, `tr-TR`, `pt-BR`, `zh-TW`, `es`, `de`, `it`, `fr`, `ro`, `sv-SE`, `pl-PL`, `nl-NL`, etc. | string | - | **2.77.0** |
| max          | Limit maximum value                                                                             | number                            | Infinity  |            |
| min          | Limit minimum value                                                                             | number                            | -Infinity |            |
| parser       | Specifies how to convert back number string from formatter and use them in conjunction with formatter | (value: string) => string         | -         |      |
| precision    | Numerical precision                                                                             | number                            | -         |            |
| prefix    | Prefix content                                                                                  | string\|ReactNode                 |           |            |
| pressInterval| How often will the click event be triggered when the button is long pressed, in milliseconds                                   | number                 |   250        |           |
| pressTimeout | When the button is long pressed, how long will the click event be triggered after the delay, in milliseconds                                               | number                 |     250      |           |
| preventScroll | Indicates whether the browser should scroll the document to display the newly focused element, acting on the focus method inside the component, excluding the component passed in by the user | boolean |  |  |
| shiftStep    | Step size for pressing the shift key, it can be a decimal. The default value was adjusted from 1 to 10 in v2.13                     | number                            | 10         | **1.5.0** |
| showClear    | Do you show the clear button?                                                                   | boolean                           | false     | **0.35.0** |
| showCurrencySymbol | Whether to display the currency symbol/code/name, only valid in currency mode | boolean | true | **2.77.0** |
| size         | Enter box size, optional value: "default"\|"small"\|"large"                                     | string                            | 'default' |            |
| step         | Each time you change the number of steps, it can be a decimal.                                  | number                            | 1         |            |
| style        | Inline style of InputNumber                                                             | CSSProperties  | -      |
| suffix       | Custom suffix                                                                                   | ReactNode                         |           |            |
| value        | Current value                                                                                   | number                            |           |            |
| onBlur       | Callback when focus is lost                                                                     | (e: domEvent) => void             | () => {}  | **1.0.0**  |
| onChange     | Change callback                                                                                 | (value: number\|string) => void   | -         |            |
| onFocus      | Callback when focus is obtained                                                                 | (e: domEvent) => void             | () => {}  | **1.0.0**  |
| onNumberChange | Number change callback                                                 | (value: number) => void   |   -         |     **1.9.0**      |

## Methods

Some internal methods provided by InputNumber can be accessed through ref:

| Name    | Description     |
| ------- | --------------- |
| blur()  | Move the focus. |
| focus() | Get the focus.  |

## Accessibility

Guideline: https://www.w3.org/WAI/ARIA/apg/patterns/spinbutton/

### ARIA

- InputNumber has `spinbutton` role
- spinbutton uses `aria-valuenow` for current value, `aria-valuemax` for acceptable maximum value, and `aria-valuemin` for acceptable minimum value
- When InputNumber is used in Form, the value of the input box's `aria-labeledby` reference is Field label

### Keyboard and Focus

- InputNumber can get focus, keyboard users can use `Tab` and `Shift + Tab` to switch focus (Increase and decrease buttons are not focusable)
- Keyboard users can press up key ⬆️ or down key ⬇️ and the input value will increase or decrease by `step` (default is 1)
- Hold down Shift + Up ⬆️ or Down ⬇️ , the input value will increase or decrease by `shiftStep` (default is 10)

## Design Tokens
<DesignToken/>