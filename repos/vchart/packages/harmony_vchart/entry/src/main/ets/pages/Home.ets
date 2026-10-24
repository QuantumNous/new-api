import { router } from '@kit.ArkUI';
import scatterSpec from './data/scatter';
import lineSpec from './data/line';
import areaSpec from './data/area';
import funnelSpec from './data/funnel';
import barSpec from './data/bar';
import horizontalBarSpec from './data/horizontal-bar';
import radarSpec from './data/radar';
import sankeySpec from './data/sankey';
import pieSpec from './data/pie';
import ringSpec from './data/ring';
import roseSpec from './data/rose';
import wordcloudSpec from './data/wordcloud';
import boxplotSpec from './data/boxplot';
import dualAxisSpec from './data/dual-axis';
import { BusinessError } from '@ohos.base';
import promptAction from '@ohos.promptAction';

class ChartInfo {
  public img: string;
  public label: string;

  constructor(src: string, img: string, label: string) {
    this.img = img;
    this.label = label;
  }
}

interface IConfigItem {
  img: string;
  label: string;
  spec: Object;
}

const configList: IConfigItem[] = [
  {
    img: 'scatter',
    label: 'scatter',
    spec: scatterSpec,
  },
  {
    img: 'line',
    label: 'line',
    spec: lineSpec
  },
  {
    img: 'area',
    label: 'area',
    spec: areaSpec
  },
  {
    img: 'funnel',
    label: 'funnel',
    spec: funnelSpec
  },
  {
    img: 'bar',
    label: 'bar',
    spec: barSpec
  },
  {
    img: 'horizontal_bar',
    label: 'horizontal_bar',
    spec: horizontalBarSpec
  },
  {
    img: 'radar',
    label: 'radar',
    spec: radarSpec
  },
  {
    img: 'sankey',
    label: 'sankey',
    spec: sankeySpec
  },
  {
    img: 'pie',
    label: 'pie',
    spec: pieSpec
  },
  {
    img: 'ring',
    label: 'ring',
    spec: ringSpec
  },
  {
    img: 'rose',
    label: 'rose',
    spec: roseSpec
  },
  {
    img: 'wordcloud',
    label: 'wordcloud',
    spec: wordcloudSpec
  },
  {
    img: 'boxplot',
    label: 'boxplot',
    spec: boxplotSpec
  },
  {
    img: 'dual_axis',
    label: 'dual_axis',
    spec: dualAxisSpec
  }
]

@Entry
@Component
struct Home {
  private images: ChartInfo[] = [];
  scroller: Scroller = new Scroller();

  build() {
    Scroll(this.scroller) {
      Column({ space: 20 }) {
        Row() {
          Image($r('app.media.avatar'))
            .width(56)
            .height(56)
            .borderRadius('50%')
          Text('VisActor')
            .fontSize(26)
            .fontWeight(600)
            .fontColor(Color.Black)
        }.width('100%').justifyContent(FlexAlign.Center).margin({ top: 60 })
        Row() {
          Text($r('app.string.VisActor_desc'))
            .fontSize(16)
            .fontWeight(500)
            .lineHeight(22)
            .fontColor(Color.Grey)
        }
        Flex({ direction: FlexDirection.Row, wrap: FlexWrap.Wrap, justifyContent: FlexAlign.SpaceBetween }) {
          ForEach(configList, (item: IConfigItem) => {
            ImageContainer(item)
          }, (item: IConfigItem) => item.label)
        }
        Button("OhChart")
          .onClick(() => {
            router.pushUrl({url: 'pages/OhChart'})
          })
      }.padding({ left: 16, right: 16 })
    }.scrollable(ScrollDirection.Vertical).scrollBar(BarState.Off).edgeEffect(EdgeEffect.Spring)
  }
}

@Component
struct ImageContainer {
  img: string = '';
  label: string = '';
  spec: Object | null = null;

  build() {
    Column({space: 10}) {
      if (this.img) {
        Image($r(`app.media.${this.img}`))
          .width(80)
          .height(80)
          .margin({ top: 10 })
        Text(this.label)
          .fontSize(13)
          .fontWeight(300)
      }
    }
    .alignItems(HorizontalAlign.Center)
    .margin({ bottom: 20 })
    .borderRadius(6).width(100).height(120).shadow({ offsetX: 0, offsetY: 4, color: '#cecece', radius: 20 })
    .onClick(() => {
      router.pushUrl({
        url: 'pages/Chart',
        params: { label: this.label, spec: this.spec }
      }, router.RouterMode.Standard, err => {
        if (err) {
          promptAction.showToast({ message: err.message });
          console.error('导航发生错误')
        }
      })
    })
  }
}