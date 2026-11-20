# univer-vchart-plugin 介绍

## 关于 Univer

[Univer](https://univer.ai/)是 Office 系列办公套件的开源替代品，包括电子表格、文档和幻灯片。目前提供公式、数字格式、条件格式、数据验证、图文混排等功能。你可以将 Univer 集成到你的系统当中，并基于 Univer 开发个性化的业务需求。

[univer-vchart-plugin](https://github.com/VisActor/univer-vchart-plugin)是基于 Univer 封装的插件，可以让你在 Univer 中快速的插入 vchart 图表。

## 快速上手

### 安装

```
# 使用 npm 安装
npm install @visactor/univer-vchart-plugin

# 使用 yarn 安装
yarn add @visactor/univer-vchart-plugin
```

### 使用

- 注册插件

```typescript
import { UniverVChartPlugin } from '@visactor/univer-vchart-plugin';

export function setupUniver() {
  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: enUS
    }
  });
  univer.registerPlugin(UniverVChartPlugin);
}
```

- 创建 vchart 图表，示例如下：

```typescript
import { CREATE_VCHART_COMMAND_ID } from '@visactor/univer-vchart-plugin';
...

await univerAPI.executeCommand(CREATE_VCHART_COMMAND_ID, {
      spec: { ... },
    });
```

其中创建 vchart 图表，支持如下参数：

```typescript
/**
 * the params of create a vchart instance
 *
 * @param spec spec of vchart
 * @param options options of vchart
 * @param initPosition ths position of vchart layer
 */
export interface CreateVChartParams {
  spec: ISpec;
  options?: Omit<IInitOption, 'dom' | 'renderCanvas'>;
  initPosition?: {
    startX?: number;
    startY?: number;
    endX?: number;
    endY?: number;
  };
}
```

### 一个简单的图表示例

<img src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/univer-vchart-plugin.png" style="width: 800px">

```typescript
import { UniverVChartPlugin, CREATE_VCHART_COMMAND_ID } from '@visactor/univer-vchart-plugin';

export function setupUniver() {
  const univer = new Univer({
    theme: defaultTheme,
    locale: LocaleType.EN_US,
    locales: {
      [LocaleType.EN_US]: enUS
    }
  });
  univer.registerPlugin(UniverVChartPlugin);
}

export function setupVChartDemo($toolbar: HTMLElement, univerAPI: FUniver) {
  const $button = document.createElement('a');
  $button.textContent = 'Create vchart demo';
  $toolbar.appendChild($button);

  $button.addEventListener('click', async () => {
    if (!univerAPI) throw new Error('univerAPI is not defined');

    const activeWorkbook = univerAPI.getActiveWorkbook();
    if (!activeWorkbook) throw new Error('activeWorkbook is not defined');
    const activeSheet = activeWorkbook.getActiveSheet();
    if (!activeSheet) throw new Error('activeSheet is not defined');

    await univerAPI.executeCommand(CREATE_VCHART_COMMAND_ID, {
      spec: {
        type: 'line',
        data: {
          values: [
            {
              time: '2:00',
              value: 8
            },
            {
              time: '4:00',
              value: 9
            },
            {
              time: '6:00',
              value: 11
            },
            {
              time: '8:00',
              value: 14
            },
            {
              time: '10:00',
              value: 16
            },
            {
              time: '12:00',
              value: 17
            },
            {
              time: '14:00',
              value: 17
            },
            {
              time: '16:00',
              value: 16
            },
            {
              time: '18:00',
              value: 15
            }
          ]
        },
        xField: 'time',
        yField: 'value'
      }
    });
  });
}
```

[查看在线 demo](https://stackblitz.com/~/github.com/xile611/univer-vchart-plugin-demo)
