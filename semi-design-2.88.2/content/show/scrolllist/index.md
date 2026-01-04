---
localeCode: zh-CN
order: 78
category: 展示类
title: ScrollList 滚动列表
icon: doc-scrolllist
brief: 滚动列表。
---

## 代码演示

### 如何引入

```jsx import
import { ScrollList, ScrollItem } from '@douyinfe/semi-ui';
```

### 基本使用

滚动列表提供了一个类似于 iOS 操作系统的滚动选择模式，同时支持滚动至指定窗口位置选择与点击选择。

```jsx live=true
import React from 'react';
import { ScrollList, ScrollItem, Button } from '@douyinfe/semi-ui';

class ScrollListDemo extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            selectIndex1: 1,
            selectIndex2: 1,
            selectIndex3: 1,
        };

        this.ampms = [
            {
                value: '上午',
            },
            {
                value: '下午',
            },
        ];

        this.hours = new Array(12).fill(0).map((itm, index) => {
            return {
                value: index + 1,
            };
        });

        this.minutes = new Array(60).fill(0).map((itm, index) => {
            return {
                value: index,
                disabled: Math.random() > 0.5 ? true : false,
            };
        });

        this.onSelectAP = this.onSelectAP.bind(this);
        this.onSelectHour = this.onSelectHour.bind(this);
        this.onSelectMinute = this.onSelectMinute.bind(this);
        this.handleClose = this.handleClose.bind(this);
        this.renderFooter = this.renderFooter.bind(this);
    }

    onSelectAP(data) {
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    onSelectHour(data) {
        console.log('You have choose the hour for: ', data.value);
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    onSelectMinute(data) {
        console.log('You have choose the minute for: ', data.value);
        this.setState({
            ['selectIndex' + data.type]: data.index,
        });
    }

    handleClose() {
        console.log('close');
    }

    renderFooter() {
        return (
            <Button size="small" type="primary" onClick={this.handleClose}>
                Ok
            </Button>
        );
    }

    render() {
        let list = this.list;
        const scrollStyle = {
            border: 'unset',
            boxShadow: 'unset',
        };
        return (
            <ScrollList style={scrollStyle} header={'无限滚动列表'} footer={this.renderFooter()}>
                <ScrollItem
                    mode="wheel"
                    cycled={false}
                    list={this.ampms}
                    type={1}
                    selectedIndex={this.state.selectIndex1}
                    onSelect={this.onSelectAP}
                />
                <ScrollItem
                    mode="wheel"
                    cycled={true}
                    list={this.hours}
                    type={2}
                    selectedIndex={this.state.selectIndex2}
                    onSelect={this.onSelectHour}
                />
                <ScrollItem
                    mode="wheel"
                    cycled={true}
                    list={this.minutes}
                    type={3}
                    selectedIndex={this.state.selectIndex3}
                    onSelect={this.onSelectMinute}
                />
            </ScrollList>
        );
    }
}
```

## API 参考

### ScrollList

| 属性   | 说明       | 类型   | 默认值 |
| ------ | ---------- | ------ | ------ |
| bodyHeight | body高度 | string \| number |   |
| className | 样式类名 | string | ''     |
| footer | 底部 addon | ReactNode | ''     |
| header | 头部 addon | ReactNode | ''     |
| style  | 内联样式 | CSSProperties | {}     |

### ScrollItem

| 属性        | 说明                                                | 类型                                | 默认值 |
| ----------- | -------------------------------------------------- | ----------------------------------- | ------ |
| className   | 样式类名 | string                                   | ''                                  |
| cycled      | 是否为无限循环，仅在 mode 为 "wheel" 时生效 | boolean  | false                                |
| list        | 列表内容                                            | [ItemData](#ItemData)[]              | []     |
| mode        | 模式选择                                            | "normal" \| "wheel"                  | "wheel"|
| motion      | 是否开启滚动动画                                     | Motion                                | true   |
| onSelect    | 选中回调                                            | (data: [ItemData](#ItemData)) => void| NOOP   |
| selectedIndex | 选中项的索引                                         | number                               | 0      |
| style       | 内联样式                                            | CSSProperties                        | {}      |
| transform   | 对选中项的变换，返回值会作为文案进行显示                  | (value: any, text: string) => string | v => v |

#### ItemData

| 属性 | 说明 | 类型 | 默认值 |
| --- | --- | --- | --- |
| disabled | 该项是否被禁止选择 | boolean |  |
| text | 每一项的文案 | string |  |
| transform | 该项处于选中状态时的变换，返回值会作为文案进行显示，ScrollItem 组件如果同时传入会优先选择 ItemData 中的 transform 方法 | (value: any, text: string) => string | v => v |
| value | 每一项的值 | any |  |


## Accessibility

### ARIA

- `ScrollItem` 支持传入 `aria-label`, 指定该列标签
- `ScrollItem` 使用 `aria-disabled` 表示该项目是否被禁用
- `ScrollItem` 使用 `aria-selected` 表示该项目是否被选中

## 设计变量

<DesignToken/>
