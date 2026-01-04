---
localeCode: en-US
order: 19
category: Basic
title:  Grid
icon: doc-grid
dir: column
brief: 24 grid system.
---


## Overview

The grid system of layout, we define the external framework of information blocks based on row and column (col) to ensure that each area of the page can be robustly arranged.

## Flex layout

Our grid system supports the Flex layout, allowing the horizontal alignment of child elements within the parent node - left, center, right, equal width, scattered arrangement. Between child elements and child elements, support top alignment, vertical center alignment, bottom alignment. At the same time, support the use of `order` To define the order of the elements.

## Demos

### How to import

```jsx import
import { Col, Row } from '@douyinfe/semi-ui';
```
### Basic Usage

From stacking to horizontal arrangement.

Using a single set of Row and Col grid components, you can create a basic grid system. All Col must be placed in the Row.

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid">
        <Row>
            <Col span={24}><div className="col-content">col-24</div></Col>
        </Row>
        <br/>
        <Row>
            <Col span={12}><div className="col-content">col-12</div></Col>
            <Col span={12}><div className="col-content">col-12</div></Col>
        </Row>
        <br/>
        <Row>
            <Col span={8}><div className="col-content">col-8</div></Col>
            <Col span={8}><div className="col-content">col-8</div></Col>
            <Col span={8}><div className="col-content">col-8</div></Col>
        </Row>
        <br/>
        <Row>
            <Col span={6}><div className="col-content">col-6</div></Col>
            <Col span={6}><div className="col-content">col-6</div></Col>
            <Col span={6}><div className="col-content">col-6</div></Col>
            <Col span={6}><div className="col-content">col-6</div></Col>
        </Row>
    </div>
); 
```

### Gutter interval

The grid often needs to work with the interval. You can use Row's `Gutter` Properties, we recommend using (16 + 8n) px as a grid interval. (n is a natural number)

Vertical gutter can be in the form of an array. The first item of the array is horizontal gutter and the second item is vertical gutter.<br/>

If you want to support responsiveness, you can write {xs: 8, sm: 16, md: 24, lg: 32}.<br/>

**Vertical gutter in array form supported from version `1.11.0`**<br/>

Dark for content area, light for spacing

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid grid-gutter">
        <p>horizontal</p>
        <hr />
        <Row gutter={16}>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
        </Row>
        <p>vertical</p>
        <hr />
        <Row gutter={[16, 24]}>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6}>
                <div className="col-content">col-6</div>
            </Col>
        </Row>
    </div>
);
```

### Offset

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid">
        <Row>
            <Col span={8}><div className="col-content">col-8</div></Col>
            <Col span={8} offset={8}>
                <div className="col-content">col-8</div>
            </Col>
        </Row>
        <br/>
        <Row>
            <Col span={6} offset={6}>
                <div className="col-content">col-6</div>
            </Col>
            <Col span={6} offset={6}>
                <div className="col-content">col-6</div>
            </Col>
        </Row>
        <br/>
        <Row>
            <Col span={12} offset={6}>
                <div className="col-content">col-12</div>
            </Col>
        </Row>
    </div>
);
```

### Use Flex layout

Use `row-flex` to define a Flex layout whose child elements are based on different values `start`,`center`,`end`,`space-between`,`space-around`, define their typesetting methods in the parent node respectively.

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid">
        <p>sub-element align left</p>
        <Row type="flex" justify="start">
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
        </Row>

        <p>sub-element align center</p>
        <Row type="flex" justify="center">
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
        </Row>

        <p>sub-element align right</p>
        <Row type="flex" justify="end">
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
        </Row>

        <p>sub-element monospaced arrangement</p>
        <Row type="flex" justify="space-between">
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
        </Row>

        <p>sub-element align full</p>
        <Row type="flex" justify="space-around">
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
            <Col span={4}><div className="col-content">col-4</div></Col>
        </Row>
    </div>
);
```

### Flex subelements vertically aligned

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid grid-flex">
        <p>Align Top</p>
        <Row type="flex" justify="center" align="top">
            <Col span={4}><div className="col-content" value={100}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={50}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={120}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={80}>col-4</div></Col>
        </Row>

        <p>Align Center</p>
        <Row type="flex" justify="space-around" align="middle">
            <Col span={4}><div className="col-content" value={100}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={50}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={120}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={80}>col-4</div></Col>
        </Row>

        <p>Align Bottom</p>
        <Row type="flex" justify="space-between" align="bottom">
            <Col span={4}><div className="col-content" value={100}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={50}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={120}>col-4</div></Col>
            <Col span={4}><div className="col-content" value={80}>col-4</div></Col>
        </Row>
    </div>
);
```

### Flex element sorting

Change the sorting of elements through `order` of the Col.

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid">
        <Row type="flex">
            <Col span={6} order={4}><div className="col-content">col-4</div></Col>
            <Col span={6} order={3}><div className="col-content">col-3</div></Col>
            <Col span={6} order={2}><div className="col-content">col-2</div></Col>
            <Col span={6} order={1}><div className="col-content">col-1</div></Col>
        </Row>
    </div>
);
```

### Responsive

Referring to Bootstrap's responsive design, preset six response sizes:`xs`, `sm`, `md`, `lg`, `Xl`, `xxl`.

```jsx live=true dir="column"
import React from 'react';
import { Col, Row } from '@douyinfe/semi-ui';

() => (
    <div className="grid">
        <Row gutter={{ xs: 16, sm: 16, md: 16, lg: 24, xl: 24, xxl: 24 }}>
            <Col xs={2} sm={4} md={6} lg={8} xl={10}><div className="col-content">Col</div></Col>
            <Col xs={20} sm={16} md={12} lg={8} xl={4}><div className="col-content">Col</div></Col>
            <Col xs={2} sm={4} md={6} lg={8} xl={10}><div className="col-content">Col</div></Col>
        </Row>
        <br/>
        <Row>
            <Col xs={{ span: 5, offset: 1 }} lg={{ span: 6, offset: 2 }}><div className="col-content">Col</div></Col>
            <Col xs={{ span: 11, offset: 1 }} lg={{ span: 6, offset: 2 }}><div className="col-content">Col</div></Col>
            <Col xs={{ span: 5, offset: 1 }} lg={{ span: 6, offset: 2 }}><div className="col-content">Col</div></Col>
        </Row>
    </div>
);
```

## API reference

### Row

| Properties | Instructions  | type | Default |
| ----- | ---- | ---- | ---- |
| align  | Vertical alignment under flex layout: `top` `middle` `bottom` | string  | |
| className | Class name | string| |
| gutter | Grid interval, can be written as pixel value or support responsive object writing `{ xs: 8, sm: 16, md: 24}`, Vertical gutter support from version **1.11.0** | number / object / array |  |
| justify  | Horizontal arrangement under flex layout: `start` `end` `center` `space-around` `space-between` | string  | `start` |
| style | style | CSSProperties | |
| type  | Layout mode, optional `flex`, valid under [Modern Browser](http://caniuse.com/#search=flex)  | string  |  |

### Col

| Properties | Instructions                                                                                        | type           | Default |
| ---------- | --------------------------------------------------------------------------------------------------- | -------------- | ------- |
| lg         | `≥ 992px` responsive grid, which can be a number of grids or an object containing other properties  | number\|object | -       |
| md         | `≥ 768px` responsive grid, which can be a number of grids or an object containing other properties  | number\|object | -       |
| offset     | The number of interval cells on the left side of a grid. There can be no grid in the interval.      | number         | 0       |
| order      | Grid order, effective in `flex` layout mode                                                         | number         | 0       |
| pull       | The grid moves to the left.                                                                         | number         | 0       |
| push       | The grid moves to the right.                                                                        | number         | 0       |
| sm         | `≥ 576px` responsive grid, which can be a number of grids or an object containing other properties  | number\|object | -       |
| span       | The number of grid spaces is equivalent to `display: none` when it is 0                             | number         | -       |
| xl         | `≥ 1200px` responsive grid, which can be a number of grids or an object containing other properties | number\|object | -       |
| xs         | `< 576px` responsive grid, which can be a number of grids or an object containing other attributes  | number\|object | -       |
| xxl        | `≥ 1600px` responsive grid, which can be a number of grids or an object containing other properties | number\|object | -       |

## Design Tokens
<DesignToken/>