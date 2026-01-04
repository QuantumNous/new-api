---
localeCode: en-US
order: 24
category: Basic
title:  Divider
icon: doc-divider
brief: Divider is a linear, lightweight component used to logically organize element content and page structure or areas.
---

## Demos

### How to import

```jsx import
import { Divider } from '@douyinfe/semi-ui';
```

### Basic Usage

```jsx live=true
import React from 'react';
import { Divider } from '@douyinfe/semi-ui';

() => {

    return (
        <div>
            <h3>Horizontal Solid Line</h3>
            <span>Semi Design is a design system.</span>
            <Divider margin='12px'/>
            <span>It defines a set of components.</span>

            <h3 style={{ "marginTop": "40px" }}>Horizontal Dashed Line</h3>
            <span>Semi Design is a design system.</span>
            <Divider dashed={true} margin='12px'/>
            <span>It defines a set of components.</span>

            <h3 style={{ "marginTop": "40px" }}>Vertical Solid Line</h3>

            <div>
                <span>Left</span>
                <Divider layout="vertical" margin='12px'/>
                <span>Middle</span>
                <Divider layout="vertical" margin='12px'/>
                <span>Right</span>
            </div>

            <h3 style={{ "marginTop": "40px" }}>Vertical Dashed Line</h3>
            <div>
                <span>Left</span>
                <Divider layout="vertical" dashed={true} margin='12px'/>
                <span>Middle</span>
                <Divider layout="vertical" dashed={true} margin='12px'/>
                <span>Right</span>
            </div>

        </div>
    );
};

```

### With Children

```jsx live=true
import React from 'react';
import { Divider, Typography } from '@douyinfe/semi-ui';
import { IconSemiLogo } from '@douyinfe/semi-icons';

() => {

    return (
        <div>
            <Divider margin='12px' align='left'>
                Left Text
            </Divider>

            <Divider margin='12px' align='center'>
                Center Text
            </Divider>

            <Divider margin='12px' align='right'>
                Right Text
            </Divider>

            <Divider margin='12px'>
                <IconSemiLogo />
            </Divider>
        </div>
    );
};


```

## API Reference

| Properties        | Instructions                                                            | Type          | Default     | Version | 
|-----------|---------------------------------------------------------------|-------------|---------| --------- | 
| align     | Content Align Mode                                            | left \| center \| right | center      | 2.9.0 | 
| children  | Content                                                       | ReactNode   | -       |  2.9.0 | 
| className | ClassName                                                     | string      | -       | 2.9.0 | 
| dashed    | Whether is dashed                                             | boolean     | false   | 2.9.0 | 
| layout    | Divider Direction                                             | horizontal \| vertical | horizontal    | 2.9.0 | 
| margin    | Vertical (Horizontal if in horizontal mode) margin of divider | number \| string  | -        | 2.9.0 | 
| style     | Custom Style                                                  | CSSProperties | -       | 2.9.0 | 

## Design Tokens
<DesignToken/>
