---
localeCode: en-US
order: 42
category: Input
title: PinCode
icon: doc-pincode
width: 60%
brief: For easy and intuitive verification code entry
---

## Code demonstration

### How to import

PinCode supported from 2.62.0

```jsx
import { PinCode } from '@douyinfe/semi-ui';
```

### Basic usage


```jsx live=true
import { PinCode } from '@douyinfe/semi-ui';
import React from 'react';

function Demo() {
    return (
        <>
            <PinCode
                size={'small'}
                defaultValue={'123456'}
                onComplete={value => console.log('pincode: ', value)}
                onChange={value => {
                    console.log(value);
                }}
            />
            <br />
            <PinCode
                size={'default'}
                defaultValue={'123456'}
                onComplete={value => console.log('pincode: ', value)}
                onChange={value => {
                    console.log(value);
                }}
            />
            <br />
            <PinCode
                size={'large'}
                defaultValue={'123456'}
                onComplete={value => console.log('pincode: ', value)}
                onChange={value => {
                    console.log(value);
                }}
            />
        </>
    );
}
```

### Controlled

Use value to pass in the verification code string and use it with onChange for controlled use


```jsx live=true
import React from 'react';
import { PinCode, Button } from '@douyinfe/semi-ui';

function Demo() {
    const [value, setValue] = useState('69af41');
    return (
        <>
            <Button onClick={() => setValue(String(parseInt(Math.random() * 100000000)).slice(0, 6))}>
                Set Random Value
            </Button>
            <br />
            <br />
            <PinCode
                format={'mixed'}
                onComplete={value => console.log('pincode: ', value)}
                value={value}
                onChange={v => {
                    console.log(v);
                    setValue(v);
                }}
            />
        </>
    );
}
```


### Limit verification code format

#### Set the number of digits

Set the number of digits through count, the default is 6 digits, the demo below is set to 4 digits


```jsx live=true
import React from 'react';
import { PinCode } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <>
            <PinCode
                size={'large'}
                defaultValue={'6688'}
                count={4}
                onComplete={value => console.log('pincode: ', value)}
                onChange={value => {
                    console.log(value);
                }}
            />
        </>
    );
}
```


#### Set character range

Use format to control the character range that can be entered

- Pass "number" to only allow numbers

- Pass "mixed" to allow numbers and letters
- Pass in a regular expression to only allow characters that can be judged by the regular expression
- Pass in a function, and the verification code will be passed in as parameters in units of characters for verification when entering. When the function returns true, the character is allowed to be entered into the PinCode


```jsx live=true
import React from 'react';
import { PinCode, Button, Typography } from '@douyinfe/semi-ui';

function Demo() {
    return (
        <>
            <Typography.Text>纯数字</Typography.Text>
            <PinCode format={'number'} onComplete={value => console.log('pincode: ', value)} />
            <br />
            <Typography.Text>字母和数字</Typography.Text>
            <PinCode format={'mixed'} onComplete={value => console.log('pincode: ', value)} />
            <br />
            <Typography.Text>只大写字母</Typography.Text>
            <PinCode format={/[A-Z]/} onComplete={value => console.log('pincode: ', value)} />
            <br />
            <Typography.Text>只小写字母(函数判断)</Typography.Text>
            <PinCode
                format={char => {
                    return /[a-z]/.test(char);
                }}
                onComplete={value => console.log('pincode: ', value)}
            />
        </>
    );
}
```

### Manual focus and blur

Use the focus and blur methods on Ref, and the input parameter is the serial number of the corresponding Input



```jsx live=true
import React from 'react';
import { PinCode, Button } from '@douyinfe/semi-ui';

function Demo() {
    const [value, setValue] = useState('69af41');
    const ref = useRef();
    return (
        <>
            <Button onClick={() => ref.current.focus(2)}>Focus Third Input</Button>
            <br />
            <br />
            <PinCode
                format={'mixed'}
                ref={ref}
                onComplete={value => console.log('pincode: ', value)}
                value={value}
                onChange={v => {
                    console.log(v);
                    setValue(v);
                }}
            />
        </>
    );
}
```

## API Reference

| Property | Description | Type | Default value | Version |
| --- | --- | --- | --- | --- |
| autoFocus | Whether to automatically focus on the first element | boolean | true |
| className | Class name | string | |
| count | Number of digits of verification code | number | 6 |
| defaultValue | Default value of input box content | string | |
| disabled | Disable | boolean | false |
| format | Limitation of single character format of verification code | 'number'\| 'mixed‘ \| RegExp \| (char:string)=>boolean | 'number' |
| size | Input box size, large, default, small | string | 'default' |
| style | Style | object | |
| value | Input box content | string | |
| onChange | Input callback | (value:string)=>void | |
| onComplete | Callback after all digits of verification code are entered | (value: string) => void | |

## Methods

Methods bound to component instances can be called through ref to implement certain special interactions

| Attributes | Description |
| ----- | ---------------------------- |
| focus | Focus, the input parameter is the verification code number |
| blur | Remove focus, the input parameter is the verification code number | string |
