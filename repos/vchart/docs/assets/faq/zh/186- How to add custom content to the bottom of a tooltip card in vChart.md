---
title: 110. 如何在vChart的tooltip卡片底部添加自定义内容？</br>
---
# 问题描述

我正在使用vChart进行数据可视化的编程，并遇到了一些问题。我想在tooltip的卡片底部新增一些自定义的内容，尤其是一个按钮。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/KURmbG6nJov1O2xb9HoccdRNnyG.gif' alt='' width='1026' height='844'>

但是我发现在vChart.renderAsync().then的时候，似乎无法获取我们定义了className的tooltip，必须要等一段时间才能获取到。我并不希望通过自定义tooltip来实现这个功能，因为我希望保持原有的组件样式。所以，我想问一下，有没有更好的解决方案？</br>
# 解决方案

对于这个问题，可以通过updateElement回调在原有的dom上进行修改。这里有一个示例代码：</br>
```
tooltip: {
...
updateElement: el => {
el.style.width = 'auto';
el.style.height = 'auto';
el.style.minHeight = 'auto';
if (el.lastElementChild?.id !== 'test') {
el.innerHTML = '';
const div = document.createElement('div');
div.id = 'test';
div.style.width = '200px';
div.innerText = 'test';
div.style.color = 'red';
el.appendChild(div);
}
}
}</br>
```
此段代码将在tooltip的原有dom上进行修改。你可以选择清空tooltip内容或者保留原内容。但需要注意的是tooltip的enterable支持可能还不理想，更新tooltip位置时，每次都会执行回调函数。</br>
升级到vchart1.6.0版本后可以使用updateElement功能。</br>
<img src='https://cdn.jsdelivr.net/gh/xuanhun/articles/visactor/img/C7spbeDn9oUTIRx3RdEcO8Rqnge.gif' alt='' width='1998' height='278'>

updateElement第三个参数可以取到params.changePositionOnly，如果为true表示默认tooltip内容没有发生变化。如果自定义的tooltip内容需要和默认tooltip同步更新，可以考虑过滤掉params.changePositionOnly为true的情况。</br>
# 结果展示

经过以上步骤后，我成功在vChart的tooltip卡片的底部添加了一个按钮。</br>


# 相关文档

*  [updateElement文档](https://visactor.bytedance.net/vchart/option/barChart#tooltip.updateElement)</br>