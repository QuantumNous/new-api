---
title: 111. 如何在vchart中设置title的字号为semi的heading-4？</br>
---
# 问题标题

如何在vchart中设置title的字号为semi的heading-4？</br>


# 问题描述

我正在使用@visactor/vchart图表库进行数据可视化。但我遇到了一个问题，我想在vchart中设置title的字号为semi的heading-4字号，但我不知道如何将这个变量传入。</br>


# 解决方案

新版的vchart提供了一个名为vchart-semi-theme的包，它可以自动爬取页面上的 semi css 变量，因此图表的大部分色值都可以使用这个功能。至于字号，虽然目前这个包并未直接提供引入 semi 变量的功能，但你可以手动修改 spec 或者注册主题来达到目标。</br>


使用方法如下：</br>
1. 首先安装vchart-semi-theme包</br>
2. 使用文档：https://visactor.bytedance.net/vchart/guide/tutorial_docs/Theme/Theme_Extension</br>
3. 需要看一些示例可以参考：https://vp4y9p.csb.app/</br>


注意：由于vchart-semi-theme的使用需要爬取页面的css变量，因此请确保你的页面中包含了需要的semi css变量。</br>


# 相关文档

VChart 官网：https://visactor.bytedance.net/vchart</br>
vchart-semi-theme 使用文档：https://visactor.bytedance.net/vchart/guide/tutorial_docs/Theme/Theme_Extension</br>
在线Demo：https://vp4y9p.csb.app/</br>