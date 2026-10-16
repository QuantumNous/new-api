// import { Stage } from 'vutil'
import { VChart } from '@visactor/harmony-vchart';
// import { VisActor } from './canvas';
import { router } from '@kit.ArkUI';
import promptAction from '@ohos.promptAction';
import lineSpec from './data/line';

interface IRouterParams {
  label: string,
  spec: Object
}

const params: IRouterParams = router.getParams() as IRouterParams;

@Entry
@Component
struct Chart {
  @State spec: Object | null = null;
  private t: number = 0;
  @State delta: number = 0;

  onPageShow(): void {
    this.spec = params.spec;
  }

  build() {
    Row() {
      Column() {
        Text($r(`app.string.name_${params.label}`))
          .fontSize(50)
          .fontWeight(FontWeight.Bold)
        // Stage({ bg: 'red', h: 500 })
        VChart({
          spec: this.spec, w: 300, h: 300,
          onChartInitCb: () => {},
          onChartReadyCb: () => {},
          initOption: {
            beforeRender: () => {
              this.t = Date.now();
            },
            afterRender: () => {
              this.delta = Date.now() - this.t;
            }
          }
        });
        Text(`每一帧耗时：${this.delta}`)
        // VisActor()
      }
      .width('100%')
    }
    .height('100%')
  }
}
