---
title: 111. How to set the font size of the title in vchart to semi for heading-4?</br>
key words: VisActor,VChart,VTable,VStrory,VMind,VGrammar,VRender,Visualization,Chart,Data,Table,Graph,Gis,LLM
---
# Question title

How to set the font size of title to semi in vchart for heading4?</br>


# Problem description

I am using the @visactor/vchart library for data lake visualization. However, I encountered a problem where I want to set the font size of the title in vchart to semi's heading-4 font size, but I don't know how to pass this variable in.</br>


# Solution

The new version of vchart provides a package called vchart-semi-theme, which can automatically crawl semi CSS variables on the page, so most of the color values of the chart can use this function. As for font size, although this package currently does not directly provide the function of introducing semi variables, you can manually modify the spec or register the theme to achieve the goal.</br>


Usage is as follows:</br>
1. First, install the vchart-semi-theme package</br>
2. Use Documentation: https://visactor.bytedance.net/vchart/guide/tutorial_docs/Theme/Theme_Extension</br>
3. You can refer to some examples: https://vp4y9p.csb.app/</br>


Note: Since the use of vchart-semi-theme requires crawling the CSS variables of the page, please make sure that your page contains the required semi CSS variables.</br>


# Related Documents

VChart official website: https://visactor.bytedance.net/vchart</br>
Vchart-semi-theme documentation: https://visactor.bytedance.net/vchart/guide/tutorial_docs/Theme/Theme_Extension</br>
Online Demo: https://vp4y9p.csb.app/</br>