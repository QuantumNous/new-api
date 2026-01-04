---
localeCode: zh-CN
order: 55
category: 导航类
title:  Breadcrumb 面包屑
icon: doc-breadcrumb
brief: 面包屑是用户界面中的一种辅助导航，可以显示当前页面在层级架构中的位置，并能返回之前的页面。
---


## 代码演示

### 如何引入

```jsx import
import { Breadcrumb } from '@douyinfe/semi-ui';
```

### 基本用法

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb>
        <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
        <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
        <Breadcrumb.Item>Default</Breadcrumb.Item>
    </Breadcrumb>
);
```

### 带图标的

支持标题只显示图标或者同时显示图标和文本。

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome, IconArticle } from '@douyinfe/semi-icons';

() => (
    <Breadcrumb>
        <Breadcrumb.Item icon={<IconHome size="small" />}></Breadcrumb.Item>
        <Breadcrumb.Item icon={<IconArticle size="small" />}>Breadcrumb</Breadcrumb.Item>
        <Breadcrumb.Item>With Icon</Breadcrumb.Item>
    </Breadcrumb>
);
```

### 尺寸

默认为 `compact`，设置属性为 `false` 可使图标和文字尺寸增加。

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb compact>
            <Breadcrumb.Item icon={<IconHome size="small" />}></Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Loose</Breadcrumb.Item>
        </Breadcrumb>
        <br/>
        <Breadcrumb compact={false}>
            <Breadcrumb.Item icon={<IconHome size="small" />}></Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Loose</Breadcrumb.Item>
        </Breadcrumb>
    </div>
);
```

### 自定义的分隔符

默认为 `/`。

```jsx live=true
import React from 'react';
import { Breadcrumb, Tag } from '@douyinfe/semi-ui';
import { IconArrowRight } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb separator={'>'}>
            <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
        <br/>
        <Breadcrumb separator={<IconArrowRight size={'small'} />}>
            <Breadcrumb.Item>Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
        <br/>
        <Tag>{`v>=1.16.0`}</Tag>
        <br/>
        <Breadcrumb size={'small'} >
            <Breadcrumb.Item separator=":">Semi-ui</Breadcrumb.Item>
            <Breadcrumb.Item>Breadcrumb</Breadcrumb.Item>
            <Breadcrumb.Item>Default</Breadcrumb.Item>
        </Breadcrumb>
    </div>
);
```

### 截断逻辑

在 **0.34.0** 版本之后，当级别名字溢出设定宽度后省略截断。可以通过 `showTooltip` 属性设置相关参数。默认宽度150px，鼠标悬停时显示 Tooltip 完整显示级别名称。

```jsx live=true
import React from 'react';
import { Breadcrumb, Typography } from '@douyinfe/semi-ui';

() => {
    const routes = ['首页', '当这个页面标题很长很长很长时需要省略', '详情页'];
    const { Text } = Typography;
    return (
        <>
            <Text size="small">默认行为</Text>
            <Breadcrumb
                routes={routes}
            />
            <br/>
            <Text size="small">省略但不显示Tooltip</Text>
            <Breadcrumb
                showTooltip={false}
                routes={routes}
            />
            <br/>
            <Text size="small">不截断</Text>
            <Breadcrumb
                showTooltip={{ width: 'auto' }}
                routes={routes}
            />
            <br/>
            <Text size="small">从标题中间开始省略</Text>
            <Breadcrumb
                showTooltip={{ ellipsisPos: 'middle' }}
                routes={routes}
            />
            <br/>
            <Text size="small">自定义 Tooltip 参数</Text>
            <Breadcrumb
                showTooltip={{ opts: { position: 'topLeft' } }}
                routes={routes}
            />
        </>
    );
};
```

当路径层级超过 4 个级别，则：第二层至倒数第三层省略，点击省略号展开显示全部级别；如果过长则自动换行。
在 **v>=1.9.0** 之后，可以通过 `maxItemCount` 来控制超过多少个级别进行折叠。

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
        <Breadcrumb.Item>又一层</Breadcrumb.Item>
        <Breadcrumb.Item>再一层</Breadcrumb.Item>
        <Breadcrumb.Item>上上一层</Breadcrumb.Item>
        <Breadcrumb.Item>上一层</Breadcrumb.Item>
        <Breadcrumb.Item>详情页</Breadcrumb.Item>
    </Breadcrumb>
);
```

### 自定义省略号区域

组件内部提供了两种省略号区域渲染的类型，可通过 `moreType` 来设置，`moreType` 的可选值为 `default` 和 `popover`。

```jsx live=true
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';

() => (
    <Breadcrumb moreType='popover'>
        <Breadcrumb.Item>首页</Breadcrumb.Item>
        <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
        <Breadcrumb.Item>又一层</Breadcrumb.Item>
        <Breadcrumb.Item>再一层</Breadcrumb.Item>
        <Breadcrumb.Item>上上一层</Breadcrumb.Item>
        <Breadcrumb.Item>上一层</Breadcrumb.Item>
        <Breadcrumb.Item>详情页</Breadcrumb.Item>
    </Breadcrumb>
);
```

如果想要为省略号区域自定义其他形式的渲染，则可以使用 `renderMore()` 方法。

```jsx live=true
import React from 'react';
import { Breadcrumb, Popover } from '@douyinfe/semi-ui';
import { IconMore } from '@douyinfe/semi-icons';

function Demo() {
    const separator = '-'; // 用于拼接 restItem 数组项的分隔符
    const renderMore = restItem => {
        const content = (
            <>
                {
                    restItem.map((item, idx) => (
                        <React.Fragment key={`restItem-${idx}`}>
                            {item}
                            {idx !== restItem.length - 1 &&
                                <span style={{ color: 'var(--semi-color-text-2)', marginRight: '6px' }}>
                                    {separator}
                                </span>
                            }
                        </React.Fragment>
                    ))
                }
            </>
        );
        return (
            <Popover
                content={content}
                style={{ padding: 12 }}
                showArrow
            >
                <IconMore />
            </Popover>
        );
    };
    return (
        <>
            <Breadcrumb
                renderMore={restItem => renderMore(restItem)}
                onClick={(item, e) => console.log(item, e)}
            >
                <Breadcrumb.Item>首页</Breadcrumb.Item>
                <Breadcrumb.Item>当层级很多的时候</Breadcrumb.Item>
                <Breadcrumb.Item>又一层</Breadcrumb.Item>
                <Breadcrumb.Item>再一层</Breadcrumb.Item>
                <Breadcrumb.Item>上上一层</Breadcrumb.Item>
                <Breadcrumb.Item>上一层</Breadcrumb.Item>
                <Breadcrumb.Item>详情页</Breadcrumb.Item>
            </Breadcrumb>
        </>
    );
}
```

### 路由对象
Breadcrumb 支持通过 routes 传入路由对象 `route: { name, path, href, icon }` 或字符串组成的数组。可以配合 renderItem 来渲染节点。通过这样实现的 Breadcrumb 同样会进行截断处理。

-   name 为展示的名称，不传入时为空字符串。当 route 为字符串时，默认将字符串设置为名称。
-   path 为路由路径
-   href 为链接目的地，挂载在 a 标签上。
-   icon 为标签的显示图标

```jsx live=true hideInDSM
import React from 'react';
import { Breadcrumb } from '@douyinfe/semi-ui';
import { IconHome, IconArticle } from '@douyinfe/semi-icons';

() => (
    <div>
        <Breadcrumb
            routes={['Semi-ui', 'Breadcrumb', 'Default']}
        />
        <br />
        <Breadcrumb
            routes={
                [
                    {
                        path: '/',
                        href: '/',
                        icon: <IconHome size="small" />
                    },
                    {
                        path: '/breadcrumb',
                        href: '/zh-CN/navigation/breadcrumb',
                        name: 'breadcrumb',
                        icon: <IconArticle size="small" />
                    },
                    'with icon'
                ]
            }
        />
        <br />
        <Breadcrumb
            routes={['首页', '当这个页面标题很长时需要省略', '详情页']}
        />
    </div>
);
```

## API 参考

### Breadcrumb

| 属性       | 说明                                                                                                      | 类型                                       | 默认值 | 版本   |
| ---------- |---------------------------------------------------------------------------------------------------------| ------------------------------------------ | ------ | ------ |
| activeIndex| 受控使用，当前选择的导航序号                                                                                          | - | 2.61.0 |
| autoCollapse      | 是否超出maxItemCount后自动折叠                                                                                   | boolean                                     | true     |    1.9.0   |
| className  | 类名                                                                                                      | string                                     | -      |        |
| compact    | 显示尺寸，是否紧凑                                                                                               | boolean                                    | true   |        |
| maxItemCount      | 超出多少个进行自动折叠                                                                                             | number                                     | 4    | 1.9.0       |
|moreType| 内置的...区域的渲染类型，可选值为 'default'、'popover'                                                                  |string|'default'|1.27.0|
| renderItem | 自定义链接函数，配合 routes 使用                                                                                    | (Route: [Route](#Route)) => ReactNode             | -      | 0.27.0 |
| renderMore| 自定义...区域的渲染                                                                                             |(restItem: ReactNode[]) => ReactNode|-|1.27.0|
| routes     | router 的路由信息，由路由对象或字符串组成的数组，路由对象格式参考: [Route](#Route)                                                   | Array<[Route](#Route) \| string\>                            | -      |        |
| separator  | 自定义的分隔符                                                                                                 | ReactNode                          | '/'    |        |
| showTooltip | 是否展示 Tooltip 及相关配置: width，溢出宽度；   ellipsisPos，截断方式，从中间/末尾截断；                         opts，透传给Tooltip的属性 | boolean \| showToolTipProps             | {width: 150, ellipsisPos: 'end', opts: { autoAdjustOverflow: true, position: "bottomLeft" }}      | 0.34.0 |
| style      | 内联样式                                                                                                    | CSSProperties                                     | -      |        |
| onClick    | 单击事件                                                                                                    | (item: [Route](#Route) , e: Event) => void | -      | 0.27.0 |

### Breadcrumb.Item

| 属性    | 说明           | 类型                            | 默认值 | 版本   |
| ------- | -------------- | ------------------------------- | ------ | ------ |
| href    | 链接的目的地   | string                          | -      |        |
| icon    | 标签的显示图标 | ReactNode                          | -      |        |
| onClick | 单击事件       | function(item: Route, e: Event) | -      | 0.27.0 |
| separator | 分隔符，可以覆盖父级的分隔符     | ReactNode | -      | 1.16.0 |
| noLink    | 移除 hover 和 active 的样式 | boolean | false      | 1.16.0 |

### Route

| 属性 | 说明           | 类型              | 默认值 | 版本   |
| ---- | -------------- | ----------------- | ------ | ------ |
| href | 链接目的地     | string            | -      | 0.27.0 |
| icon | 标签的显示图标 | ReactNode | -      |        |
| name | 路由名         | string            | -      |        |
| path | 路由路径       | string            | -      |        |

**v>=1.16.0** 之后 Route 支持 Breadcrumb.Item 上的相应属性。

## Accessibility

- Breadcrumb 支持传入 `aria-label` 来表示该 Breadcrumb 作用
- Breadcrumb 会对当前项设置 `aria-current='page'`

## 文案规范

- 每个页面链接都应该很简短，并且清楚地反映它链接到的位置或链接的实体
- 按句子大小写书写

## 设计变量
<DesignToken/>

<!-- ## 相关物料
```material
87
``` -->
