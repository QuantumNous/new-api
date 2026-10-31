@Component
export struct VisActor {
  private settings: RenderingContextSettings = new RenderingContextSettings(true) // 开启抗锯齿
  private context: CanvasRenderingContext2D = new CanvasRenderingContext2D(this.settings)
  private offscreenCtx?: OffscreenCanvasRenderingContext2D;

  build() {
    Canvas(this.context)
      .width(300)
      .height(300)
      .backgroundColor('#F5DC62')
      .onReady(() =>{
        this.context.fillStyle = 'rgb(255, 0, 0)';
        this.context.shadowColor = 'rgba(148, 163, 195, 0.10)';
        this.context.shadowBlur = 30;
        this.context.shadowOffsetX = 0;
        this.context.shadowOffsetY = 4;
        this.context.fillRect(100, 100, 100, 100);
      })
  }
}