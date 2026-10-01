# Getting Started with VMind Data Video

Data video is a form of video that displays and introduces data content through diagrams, animations, annotations, narrations, etc. It can not only make complex data more understandable, but also guide the audience to obtain useful information and insights from it. Data video is usually used for commercial display, coverage, education and training, etc. It is a very effective way of presenting data and is popular on major short video platforms. Through data video, abstract data can be transformed into intuitive graphic display, which can be displayed in a more interesting form, making it easier for the audience to understand and accept. Data video can allow the audience to understand the story behind the data more deeply, improve the audience's understanding and trust of the information, thereby increasing influence and persuasion.

The production process of data video includes:

1.  Identify Data Sources and Themes
2.  Collect and organize data
3.  Charting, editing and exporting
4.  Video editing

Traditional data video making processes require creators to use professional visualization software to draw data as graphs after collecting data; or use various chart libraries to draw graphs through coding and export them as videos. In the era of short videos, everyone can be the creator of videos. However, non-professional video creators often do not have the ability to visualize data lake as graphs and export them as videos, which greatly raises the threshold for making data videos.

@VisActor/VChart provides a full-process solution from data to presentation, with "visual narrative" and "intelligence" as its core competitiveness. The powerful generation ability of large language models provides VChart with a natural language interactive interface, allowing us to directly call VChart's capabilities through natural language, and complete chart generation and editing with simple, fast and high quality.

@VisActor/VMind is a chart intelligence module based on VChart's large language model, providing intelligent chart generation, intelligent color scheme, conversational chart editing and other capabilities. Using VMind to create data videos, users only need to collect the data and describe the content they want to display in one sentence, then they can directly generate chart animations, and support one-click export as videos and GIFs, which greatly reduces the threshold for creating data videos.

Next, we'll show the complete process of making a chart video with VMind

# Data preparation

First, you need to identify the data source and Theme. Data can come from various sources, such as public data platforms, market research, internal company data, etc. Theme can be any data-related topic, such as sales data analytics, social phenomenon analysis, industry trends, etc.

Here we collect data on domestic car sales from the Internet as what we want to present, including time, car manufacturers, and sales. Here we only show some data:

| Time       | Automakers          | Sales  |
| ---------- | ------------------- | ------ |
| April 2023 | BYD                 | 183534 |
| April 2023 | SAIC Volkswagen     | 96203  |
| April 2023 | FAW-Volkswagen      | 78011  |
| April 2023 | GAC Toyota          | 76925  |
| April 2023 | Changan Automobile  | 76455  |
| April 2023 | FAW Toyota          | 71383  |
| April 2023 | GAC Honda           | 60462  |
| April 2023 | Geely Auto          | 59661  |
| April 2023 | SAIC-GM-Wuling      | 58210  |
| April 2023 | BMW Brilliance      | 53205  |
| May 2023   | BYD                 | 209730 |
| May 2023   | SAIC Volkswagen     | 90193  |
| May 2023   | FAW-Volkswagen      | 83610  |
| May 2023   | Changan Automobile  | 81209  |
| May 2023   | GAC Toyota          | 77513  |
| May 2023   | FAW Toyota          | 70001  |
| May 2023   | Geely Auto          | 67100  |
| May 2023   | SAIC-GM-Wuling      | 63292  |
| May 2023   | Dongfeng Nissan     | 56511  |
| May 2023   | FAW-Volkswagen Audi | 52696  |
| June 2023  | BYD                 | 220600 |
| June 2023  | FAW-Volkswagen      | 98052  |
| June 2023  | SAIC Volkswagen     | 94018  |
| June 2023  | GAC Toyota          | 86345  |
| June 2023  | Changan Automobile  | 86189  |
| June 2023  | Tesla China         | 74212  |
| June 2023  | Geely Auto          | 71726  |
| June 2023  | FAW Toyota          | 70795  |
| June 2023  | GAC Honda           | 65540  |
| June 2023  | FAW-Volkswagen Audi | 64037  |

We want to tell the competition landscape of the domestic auto market by showing the changes in the sales rankings of domestic auto brands.

# Chart generation

After collecting the data and clarifying the video theme, we can use VMind to quickly generate chart videos.

First, we need to install VMind in the project:

```bash
    # using npm
    npm install @visactor/vmind

    # using yarn
    yarn add @visactor/vmind
```

Next, use at the top of the JavaScript file `import` Introducing VMind

```typescript
import VMind from '@visactor/vmind';
```

We can then use VMind in our projects. VMind currently only supports OpenAI GPT-3.5 models, you need to provide [OpenAI API key](https://platform.openai.com/account/api-keys) Can be used. In the future we will support more large models and allow users to customize the method of calling large models.

First, we organize the data into csv format, which can be done with the help of tools such as Excel:

```typescript
const csvData = `Time,Manufacturer,Sales
2022-01,SAIC Volkswagen,124491
2022-01,Changan Automobile,123707
2022-01,Geely Automobile,112325
2022-01,Dongfeng Nissan,110996
2022-01,FAW-Volkswagen,103462
2022-01,GAC Toyota,99707
2022-01,BYD,93363
2022-01,BMW Brilliance,79087
2022-01,GAC Honda,77377
2022-01,Dongfeng Honda,76903
2022-02,BYD,88093
2022-02,SAIC Volkswagen,86076
2022-02,FAW Toyota,75918
2022-02,Dongfeng Nissan,74308
2022-02,FAW-Volkswagen,70638
2022-02,Dongfeng Honda,58954
2022-02,GAC Honda,56734
2022-02,Tesla China,56515
2022-02,Geely Automobile,55357
2022-02,Changan Automobile,53034
2022-03,Changan Automobile,110015
2022-03,SAIC Volkswagen,104200
2022-03,BYD,103852
2022-03,SAIC-GM-Wuling,102951
2022-03,GAC Toyota,96984
2022-03,FAW-Volkswagen,76586
2022-03,GAC Honda,75858
2022-03,Geely Automobile,75447
2022-03,Dongfeng Honda,71074
2022-03,FAW Toyota,69957
2022-04,BYD,105475
2022-04,GAC Toyota,68450
2022-04,Geely Automobile,49137
2022-04,Changan Automobile,47980
2022-04,SAIC-GM-Wuling,44002
2022-04,FAW-Volkswagen,39444
2022-04,Dongfeng Nissan,37636
2022-04,BMW Brilliance,31743
2022-04,FAW Toyota,31443
2022-04,Great Wall Motors,29125
2022-05,BYD,114183
2022-05,FAW-Volkswagen,89025
2022-05,GAC Toyota,83730
2022-05,SAIC Volkswagen,83502
2022-05,SAIC-GM-Wuling,71493
2022-05,Changan Automobile,66091
2022-05,BMW Brilliance,62567
2022-05,Geely Automobile,60197
2022-05,FAW Toyota,57958
2022-05,Dongfeng Nissan,52531
2022-06,BYD,133762
2022-06,FAW-Volkswagen,123358
2022-06,SAIC Volkswagen,122100
2022-06,FAW Toyota,102039
2022-06,GAC Toyota,100794
2022-06,Geely Automobile,91695
2022-06,Changan Automobile,88010
2022-06,SAIC-GM-Wuling,87462
2022-06,Dongfeng Nissan,79570
2022-06,Tesla China,78906
2022-07,BYD,162214
2022-07,SAIC Volkswagen,125450
2022-07,SAIC-GM-Wuling,106483
2022-07,FAW-Volkswagen,100160
2022-07,Changan Automobile,96786
2022-07,GAC Toyota,83940
2022-07,Geely Automobile,83392
2022-07,FAW Toyota,82697
2022-07,Dongfeng Nissan,80439
2022-07,Dongfeng Honda,78239
2022-08,SAIC Volkswagen,180439
2022-08,BYD,173977
2022-08,GAC Toyota,108679
2022-08,SAIC-GM-Wuling,96363
2022-08,GAC Honda,96325
2022-08,Chery Automobile,93720
2022-08,FAW Toyota,93361
2022-08,Geely Automobile,92525
2022-08,FAW-Volkswagen Audi,82348
2022-08,Tesla China,76965
2022-09,BYD,200973
2022-09,SAIC Volkswagen,125484
2022-09,FAW-Volkswagen,114112
2022-09,SAIC-GM-Wuling,105179
2022-09,GAC Toyota,95951
2022-09,Changan Automobile,92616
2022-09,Chery Automobile,86915
2022-09,FAW Toyota,84954
2022-09,Tesla China,83135
2022-09,Geely Automobile,82688
2022-10,BYD,216593
2022-10,SAIC Volkswagen,121973
2022-10,Changan Automobile,109451
2022-10,Geely Automobile,106877
2022-10,SAIC-GM-Wuling,106458
2022-10,FAW-Volkswagen,83332
2022-10,GAC Toyota,80800
2022-10,FAW Toyota,74924
2022-10,Chery Automobile,72512
2022-10,Dongfeng Nissan,71986
2022-11,BYD,224576
2022-11,SAIC-GM-Wuling,129039
2022-11,SAIC Volkswagen,109343
2022-11,Tesla China,100291
2022-11,Geely Automobile,94638
2022-11,Changan Automobile,85776
2022-11,GAC Toyota,85169
2022-11,FAW-Volkswagen,72423
2022-11,FAW Toyota,65837
2022-11,BMW Brilliance,58527
2022-12,BYD,226492
2022-12,SAIC-GM-Wuling,141821
2022-12,Changan Automobile,124609
2022-12,SAIC Volkswagen,118750
2022-12,FAW-Volkswagen,93851
2022-12,Geely Automobile,82623
2022-12,GAC Toyota,74033
2022-12,Dongfeng Honda,60922
2022-12,BMW Brilliance,60117
2022-12,FAW Toyota,59696
2023-01,BYD,133317
2023-01,Changan Automobile,90067
2023-01,SAIC Volkswagen,78000
2023-01,FAW-Volkswagen,70004
2023-01,Geely Automobile,67479
2023-01,GAC Toyota,61105
2023-01,BMW Brilliance,56765
2023-01,SAIC-GM-Wuling,46922
2023-01,FAW Toyota,43787
2023-01,Beijing Benz,42357
2023-02,BYD,169337
2023-02,Changan Automobile,72241
2023-02,SAIC Volkswagen,71450
2023-02,GAC Toyota,66936
2023-02,SAIC-GM-Wuling,65513
2023-02,Geely Automobile,65140
2023-02,FAW-Volkswagen,60710
2023-02,FAW Toyota,49959
2023-02,Dongfeng Nissan,49553
2023-02,BMW Brilliance,49340
2023-03,BYD,181391
2023-03,FAW-Volkswagen,81030
2023-03,SAIC Volkswagen,81009
2023-03,Tesla China,76663
2023-03,Changan Automobile,67379
2023-03,FAW Toyota,62347
2023-03,Geely Automobile,61714
2023-03,GAC Toyota,60498
2023-03,BMW Brilliance,58320
2023-03,SAIC-GM-Wuling,56440
2023-04,BYD,183534
2023-04,SAIC Volkswagen,96203
2023-04,FAW-Volkswagen,78011
2023-04,GAC Toyota,76925
2023-04,Changan Automobile,76455
2023-04,FAW Toyota,71383
2023-04,GAC Honda,60462
2023-04,Geely Automobile,59661
2023-04,SAIC-GM-Wuling,58210
2023-04,BMW Brilliance,53205
2023-05,BYD,209730
2023-05,SAIC Volkswagen,90193
2023-05,FAW-Volkswagen,83610
2023-05,Changan Automobile,81209
2023-05,GAC Toyota,77513
2023-05,FAW Toyota,70001
2023-05,Geely Automobile,67100
2023-05,SAIC-GM-Wuling,63292
2023-05,Dongfeng Nissan,56511
2023-05,FAW-Volkswagen Audi,52696
2023-06,BYD,220600
2023-06,FAW-Volkswagen,98052
2023-06,SAIC Volkswagen,94018
2023-06,GAC Toyota,86345
2023-06,Changan Automobile,86189
2023-06,Tesla China,74212
2023-06,Geely Automobile,71726
2023-06,FAW Toyota,70795
2023-06,GAC Honda,65540
2023-06,FAW-Volkswagen Audi,64037`;
```

Next, we initialize a VMind instance and pass in the OpenAI Key:

```typescript
const vmind = new VMind(openAIKey); //Your OpenAI key as parameter
```

The content we want to show is "Changes in the sales ranking of each brand of cars". Call the generateChart method to pass the data and display content description directly to VMind. VMind currently also supports specifying video duration and color scheme styles. The relevant code is as follows:

```typescript
const describe =
  'display the changes in sales rankings of various car brands, with a duration of 20 seconds and a futuristic style.';
const { spec, time } = await(vmind.generateChart(csvData, describe)); //Intelligent chart generation, input your data and chart description in csv format, and return the chart spec and animation duration.
```

In this way we get the VChart spec and video duration corresponding to the dynamic chart.

VMind currently supports bar charts, pie charts, line charts, scatter charts, word clouds, and dynamic bar charts. you can refer to [Get started quickly with VChart](http://www.visactor.io/vchart/guide/tutorial_docs/Getting_Started). Use VChart to plot it, or continue to use VMind to export it as a video or GIF. In the future, VMind will also support conversational chart editing, applying editing operations directly to charts through natural language for more personalized data video creation.

# Chart video export

Export the generated chart as a GIF or video using the following code:

```typescript
//export as video
const videoSrc = await vmind.exportVideo(spec, time); //passing in the chart spec and video duration, return ObjectURL
//export as GIF
const gifSrc = await vmind.exportGIF(spec, time); //passing in the chart spec and gif duration, return ObjectURL

//create DOM element for downloading files
const a = document.createElement('a');
a.href = videoSrc;
a.download = `${filename}.mp4`; //set the name of the file
a.dispatchEvent(new MouseEvent('click')); //save to local
```

The final exported video is as follows:

<iframe src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/vmind-output.mp4" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" width="700px" height="472px"> </iframe>

You can import the exported video or GIF into the video editing software and continue to complete the production of the data video.

# Edit video

We can import the data video generated by VMind into video generators such as Jianying, Pr, Final Cut, etc., and add subtitles, background music, sound effects, transitions, etc., to make the video more vivid and interesting:

![](https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/cut.png)

In the end we got the following data video clip:

<iframe src="https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/data-video.mp4" scrolling="no" border="0" frameborder="no" framespacing="0" allowfullscreen="true" width="700px" height="472px"> </iframe>

You can post it on various short video platforms such as Tiktok, or insert it into PPT for presentation, reporting, and other purposes, to let more people know about your ideas.

# summarize

This tutorial shows the complete process of using VMind to make data videos, including data preparation, chart generation, chart video export, and editing videos. VMind currently supports bar charts, pie charts, line charts, scatter charts, word clouds, and dynamic bar charts to meet the narrative needs of users. VMind is able to recommend suitable chart types based on user data and exhibition diagrams, and map data fields to suitable visual channels, automatically generate color palettes that meet user requests, helping you easily complete data narratives. In the future, VMind will continue to support more chart types (radar charts, sankey charts, waterfall charts, etc.), and add conversational chart editing functions to further reduce the creation threshold of data videos.
