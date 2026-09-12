Sequence-Scatter Demo数据说明

一、背景
Sequence-Scatter数据demo，包含两个训练过程，分别为：
- 代码token与文本token对齐任务（Training_process1）；
- 图像分类任务（Training_process2）；

二、训练过程1
2.1 介绍
- 60个样本点，分为2种类别（comment token，code token）
- 30个训练轮次(epoch / iteration)
- 旨在观察高维特征相似的代码token和文本token之间相互靠近的过程

2.2 数据说明
info.json
包含该训练过程的基本信息，结构如下：
{
    "label_text":["comment", "code"], //每个类别的标签，如 0-commend， 1-code
    "label_color":[[144,238,144], [255,165,0]], //每个类别的颜色RGB，该训练过程中由于没有背景，所以仅供参考
    "label_index":[0,0,0,...,1,1,1...] //每个样本的类别下标，从label_text中找对应的标签
}
data.json
包含每个训练轮次(epoch / iteration)的具体数据，包括每个点的坐标，每个点的邻居，结构如下：
{
    "1":{ //轮次编号（共30个轮次）
        "projection":[[x0, y0],[x1,y1]......], //每个样本在该轮次下的坐标
        "intra_similarity":[[n1,n2,n3...],[n4,n5,n6...]...], //每个样本的类内邻居，用样本下标表示，样本下标从0开始
        "inter_similarity":[[m1,m2,m3...],[m4,m5,m6...]...]  //每个样本的类外邻居，用样本下标表示，样本下标从0开始
    },
    "2":{
        "projection":...,
        "intra_similarity":...,
        "inter_similarity":...
    },
    
    ...
    
    "30":{
       ...
    }
}
如上例，可以得出样本0在第1个轮次下，其坐标为[x0,y0]，类内的邻居有[n1,n2,n3...]，类外的邻居有[m1,m2,m3...]。


三、训练过程2
3.1 介绍
- ResNet34在Cifar-10上的图像分类任务训练过程
- 3000个样本点，10个类别
- 20个训练轮次

3.2 数据说明
info.json
同训练过程1， 需要注意的是 "label_color"中给出的类别颜色与背景图片中的颜色对应，不采用可能会与分类背景颜色不一致。

data.json
包含每个训练轮次(epoch / iteration)的具体数据，包括每个点的坐标，每个点的邻居，结构如下：
{
    "1":{ //轮次编号（共20个轮次）
        "projection":[[x0, y0],[x1,y1]......], //每个样本在该轮次下的坐标
        "prediction":[2,1,4,1,5,9,0,...], //每个样本在该轮次中的预测类别
        "confidence":[0.1,0.1,0.5,0.3...] //每个样本预测该类别的置信度，经过softmax，范围在0~1之间
    },
    "2":{
        "projection":...,
        "prediction":...,
        "confidence":...
    },
    
    ...
    
    "20":{
       ...
    }
}

Background
每个训练轮次的分类背景，大小为1000px*800px，保存为.png的形式，四个顶点的坐标分别为(-8,-8),(-8,8),(8,8),(8,-8)，该坐标与数据中点的projection坐标位于同一坐标系，可供参考。
图片链接为： https://lf9-dp-fe-cms-tos.byteorg.com/obj/bit-cloud/sequence-scatter-bgimg-2/${epoch}.png
将${epoch}替换为相应的轮次数（1~30）。