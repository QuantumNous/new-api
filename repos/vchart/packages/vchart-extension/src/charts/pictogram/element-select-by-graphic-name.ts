import type { IMarkGraphic } from '@visactor/vchart';
import { ElementSelect, Factory } from '@visactor/vchart';

const type = 'element-select-by-graphic-name';

export class ElementSelectByGraphicName extends ElementSelect {
  static type: string = type;
  type: string = type;
  start(markGraphic: IMarkGraphic): void {
    const name = markGraphic?.name;

    if (name) {
      this.getMarks().forEach(mark => {
        mark.getGraphics()?.forEach(g => {
          if (g.name === name) {
            super.start(g);
          }
        });
      });
    }
  }
}

export const registerElementSelectByGraphicName = () => {
  Factory.registerInteractionTrigger(ElementSelectByGraphicName.type, ElementSelectByGraphicName);
};
