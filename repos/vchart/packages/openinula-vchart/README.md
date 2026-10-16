# @visactor/openinula-vchart

`@visactor/openinula-vchart` 是由 [VisActor](visactor.io) 为您提供的 Openinula 封装版本 VChart 图表库。它提供了一系列易于使用的 Openinula 组件，用于方便的在 Openinula 开发环境中创建各种类型的图表，包括折线图、柱状图、饼图等。`@visactor/openinula-vchart` 的组件具有高度的可定制性和可扩展性，可以通过传递不同的参数和配置来实现不同的图表效果。

`@visactor/openinula-vchart` 的主要特点包括：

- **易于使用**：`@visactor/openinula-vchart` 提供了一系列易于使用的 Openinula 组件，可以快速创建各种类型的图表。
- **可定制性强**：`@visactor/openinula-vchart` 的组件具有高度的可定制性，可以通过传递不同的参数和配置来实现不同的图表效果。
- **可扩展性强**：`@visactor/openinula-vchart` 的组件可以轻松地扩展和定制，可以根据需要添加新的功能和特性。
- **兼容性好**：`@visactor/openinula-vchart` 完全继承了 VChart 的可视化能力，可以在不同的浏览器和设备上运行。
- **支持多种图表类型**：`@visactor/openinula-vchart` 支持多种类型的图表，包括折线图、柱状图、饼图、雷达图等。

`@visactor/openinula-vchart` 在能力上完全对齐 VChart，并且 API 配置也与 VChart 几乎一致，关于图表的定义和配置可参考[VChart](https://www.visactor.io/vchart)。

## 开发指引

### Build

```bash
# root directory
$ rush build
```

### Development

```bash
# root directory
$ rush openinula
```

or

```bash
$ cd packages/openinula-vchart
$ rushx start
```

## 文档指引

项目文档位于 `@visactor/openinula-vchart` 目录中的 [docs](./docs) 路径。

1. [快速开始](./docs/1.%20%E5%BF%AB%E9%80%9F%E5%BC%80%E5%A7%8B.md)
   - 环境要求
   - 安装
   - 引入 `@visactor/openinula-vchart`
   - 绘制一个简单的柱状图
2. 入门
   - [API 设计](./docs/2.1%20API%E8%AE%BE%E8%AE%A1.md)
   - [统一图表标签](./docs//2.2%20%E7%BB%9F%E4%B8%80%E5%9B%BE%E8%A1%A8%E6%A0%87%E7%AD%BE.md)
   - [语法化标签](./docs/2.3%20%E8%AF%AD%E6%B3%95%E5%8C%96%E6%A0%87%E7%AD%BE.md)
3. [事件交互](./docs/3.%20%E4%BA%8B%E4%BB%B6%E4%BA%A4%E4%BA%92.md)
4. [主题样式](./docs/4.%20%E4%B8%BB%E9%A2%98%E6%A0%B7%E5%BC%8F.md)
5. [FAQ](./docs/5.%20FAQ.md)
6. [更新日志](./docs/6.%20%E6%9B%B4%E6%96%B0%E6%97%A5%E5%BF%97.md)
