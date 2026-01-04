---
localeCode: en-US
order: 88
category: Basic
title:  Feedback
icon: doc-feedback
brief: Quick feedback component
showNew: true
---

## Demos

### How to import

Feedback Supported since 2.85.0.

```jsx import
import { Feedback } from '@douyinfe/semi-ui';
```

### Basic usage

Use `visible` to set whether to display or not. The default feedback display content is in emoji form. The currently selected content can be obtained through `onValueChange`.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);
    const onValueChange = useCallback((value) => {
        console.log('emoji value', value);
    });

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show feedback: Popup, emoji
        </Button>
        <Feedback
            title="What is your rating of this product?"
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            onValueChange={onValueChange}
        />
    </>);
};
```

### Text type

Set `type` to `text` to get feedback in the form of a multi-line input box, and set the parameters of the multi-line input box through `textAreaProps`.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show feedback: Popup, text
        </Button>
        <Feedback
            type="text"
            textAreaProps={{ maxCount: 200 }}
            title="What is your suggestion of this product?"
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
        />
    </>);
};
```

### Single choice feedback

Set `type` to `radio` to get feedback in the form of a single selection, and set the parameters of the radio selection through `radioGroupProps`.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show feedback: Popup, radio
        </Button>
        <Feedback
            type="radio"
            radioGroupProps={{
                options: ['Guest', 'Developer', 'Maintainer'],
            }}
            title="What is your role?"
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
        />
    </>);
};
```

### Multiple choice feedback

Set `type` to `checkbox` to obtain feedback in the form of multiple selections, and set the parameters of the multi selection through `checkboxGroupProps`.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show feedback: Popup, checkbox
        </Button>
        <Feedback
            type="checkbox"
            checkboxGroupProps={{
                options: ['Douyin', ' Huoshan', 'doubao']
            }}
            title="Which products you choose?"
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
        />
    </>);
};
```

### Customized feedback content

Set `type` to `custom` to obtain feedback in the form of multiple selections, and set the feedback content through `renderContent`. When using custom feedback, you need to control whether the submit button is disabled or not. Users can set it through `okButtonProps`.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button, TextArea } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const [value, setValue] = useState(value);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);
    const onTextAreaChange = useCallback((value) => {
        setValue(value);
    }, []);
    const renderContent = useCallback(() => {
        return <>
            <span>This is a custom content</span>
            <TextArea
                value={value}
                onChange={onTextAreaChange}
            />
        </>;
    }, [onTextAreaChange]);

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show Feedback: Popup, custom
        </Button>
        <Feedback
            type="custom"
            title="What is your suggestion?"
            okButtonProps={{ disabled: !Boolean(value) }}
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            renderContent={renderContent}
        />
    </>);
};
```

### Modal

The form of feedback can be passed through `mode`, the default is `popup`, set to `modal` to get the display in the form of modal dialog box.

```jsx live=true
import React, { useState, useCallback } from 'react';
import { Feedback, Button } from '@douyinfe/semi-ui';

() => {
    const [visible, setVisible] = useState(false);
    const handleOk = useCallback(() => setVisible(false), []);
    const handleCancel = useCallback(() => setVisible(false), []);
    const onValueChange = useCallback((value) => {
        console.log('emoji value', value);
    });

    return (<>
        <Button onClick={() => setVisible(!visible)} >
            Show: Modal, emoji
        </Button>
        <Feedback
            mode="modal"
            title="Why did you choose this rating?"
            visible={visible}
            onOk={handleOk}
            onCancel={handleCancel}
            onValueChange={onValueChange}
        />
    </>);
};
```

### Feedback completion tips

After the feedback is completed, you can switch to display information to remind the user that the feedback has been completed.

```jsx live=true
import React, { useState, useCallback, useMemo } from 'react';
import { Feedback, Button, Empty, TextArea } from '@douyinfe/semi-ui';
import { IllustrationSuccess, IllustrationSuccessDark } from '@douyinfe/semi-illustrations';

() => {
    const [visible1, setVisible1] = useState(false);
    const [value1, setValue1] = useState('');
    const [showThanks1, setShowThanks1] = useState(false);

    const [visible2, setVisible2] = useState(false);
    const [value2, setValue2] = useState('');
    const [showThanks2, setShowThanks2] = useState(false);

    const handleOk1 = useCallback(() => {
        setShowThanks1(true);
        setTimeout(() => {
            setVisible1(false);
            setTimeout(() => {
                setShowThanks1(false);
            }, 200);
        }, 1500); 
    }, []);

    const hideFeedback1 = useCallback(() => {
        setVisible1(false);
    }, []);

    const onTextAreaChange1 = useCallback((value) => {
        setValue1(value);
    }, []);

    const handleOk2 = useCallback(() => {
        setShowThanks2(true);
        setTimeout(() => {
            setVisible2(false);
            setTimeout(() => {
                setShowThanks2(false);
            }, 200);
        }, 1500); 
    }, []);

    const hideFeedback2 = useCallback(() => {
        setVisible2(false);
    }, []);

    const onTextAreaChange2 = useCallback((value) => {
        setValue2(value);
    }, []);

    const showThankProps = useMemo(() => ({ title: ' ', footer: null }), []);

    return <div>
        <Button onClick={() => setVisible1(!visible1)} >
            Open Feedback: Popup, Custom
        </Button>
        <Feedback
            visible={visible1}
            onOk={handleOk1}
            onCancel={hideFeedback1}
            okButtonProps={{
                disabled: !Boolean(value1),
            }}
            title="What is your feedback on this product?"
            type='custom'
            {...(showThanks1 ? showThankProps : {})}
            renderContent={() => {
                return showThanks1 ? <>
                    <Empty
                        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                        description={'Thanks for your feedback'}
                        style={{ padding: 30 }}
                    />
                </> : <>
                    <span>This is a custom content</span>
                    <TextArea
                        onChange={onTextAreaChange1}
                    />
                </>;
            }}
        />
        <br /><br />
        <Button onClick={() => setVisible2(!visible2)} >
            Open Feedback: Modal, Custom
        </Button>
        <Feedback
            visible={visible2}
            onOk={handleOk2}
            onCancel={hideFeedback2}
            okButtonProps={{
                disabled: !Boolean(value2),
            }}
            title="What is your feedback on this product?"
            type='custom'
            mode='modal'
            {...(showThanks2 ? showThankProps : {})}
            renderContent={() => {
                return showThanks2 ? <>
                    <Empty
                        image={<IllustrationSuccess style={{ width: 150, height: 150 }} />}
                        darkModeImage={<IllustrationSuccessDark style={{ width: 150, height: 150 }} />}
                        description={'Thanks for your feedback'}
                        style={{ padding: 30 }}
                    />
                </> : <>
                    <span>This is a custom content</span>
                    <TextArea
                        onChange={onTextAreaChange2}
                    />
                </>;
            }}
        />
    </div>;
};
```

## API reference

In addition to the parameters listed below, when `mode` is `modal`, FeedbackProps also supports the parameters in [ModalProps](/zh-CN/show/modal#Modal).
When `mode` is `popup`, FeedbackProps also supports the parameters in [SideSheetProps](/zh-CN/show/sidesheet#API%20%E5%8F%82%E8%80%83)

| Properties | Instructions | type | Default |
|-----|-----|------|-------|
| cancelButtonProps | Set the parameters for the cancel button | [ButtonProps](/zh-CN/basic/button#Button) | - |
| checkboxGroupProps | Set parameters for multiple selections | [CheckBoxGroupProps](/en-US/input/checkbox#Checkbox%20Group) | - |
| radioGroupProps | Set radio parameters | [RadioGroupProps](/en-US/input/radio#RadioGroup) | - |
| renderContent | Customized feedback content display | (content: ReactNode) => ReactNode | - |
| ModalProps | When mode is modal, it is used to set modal parameters. | ModalProps | - |
| mode | Display mode, supports popup and modal | boolean | popup |
| okButtonProps | Set the parameters of the submit button. For example, when customizing content, set disabled in okButtonProps to disable submission | [ButtonProps](/zh-CN/input/input#Button) | - |
| onCancel | Cancel callback, the parameter is the shutdown function, and it will automatically close after the promise is resolved. | (e: any) => void \| Promise<any\> | - |
| onOk | Click OK callback, the parameter is the closing function, and it will automatically close after the promise is resolved. | (e: any) => void \| Promise<any\> | - |
| onValueChange | Callback when feedback content changes |function  | (value: string \| string[] \| Object) |
| SideSheetProps | When modal is popup, it is used to set the parameters of the internal SideSheet | SideSheetProps | - |
| type | Type of feedback content, supports text, emoji, radio, checkbox, custom | boolean | emoji |
| textAreaProps | Set parameters of multi-line input box | [TextAreaProps](/en-US/input/input#TextArea) | - |
