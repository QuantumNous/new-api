import { BaseMarkPoint } from '../../../../../src/component/marker/mark-point/base-mark-point';
import { ComponentTypeEnum } from '../../../../../src/component/interface/type';

class TestMarkPoint extends BaseMarkPoint {
  static type = ComponentTypeEnum.markPoint;
  type = ComponentTypeEnum.markPoint;
  name = 'markPoint';

  _computePointsAttr() {
    return {};
  }
  _computeOptions() {
    return {} as any;
  }
  _markerLayout() {}
  _initDataView() {}
  getMarkerComponent() {
    // Initialize internal properties that _createMarkerComponent might need
    (this as any)._markerData = {} as any;
    (this as any)._markAttributeContext = {} as any;
    (this as any)._relativeSeries = {
      getRegion: () => ({ width: 100, height: 100 })
    } as any;
    // @ts-ignore
    return this._createMarkerComponent();
  }
}

describe('MarkPoint Style', () => {
  it('should use itemContent.text.style.fontSize', () => {
    const spec = {
      itemContent: {
        type: 'text',
        text: {
          text: 'Hello',
          style: {
            fontSize: 20,
            fill: 'red'
          }
        }
      },
      itemLine: {}
    };

    const ctx: any = {
      getChart: () => ({
        getTheme: () => ({})
      })
    };

    const markPoint = new TestMarkPoint(spec as any, ctx);
    const component = markPoint.getMarkerComponent() as any;

    // Check the attribute of the created component
    // component.attribute.itemContent.style is the transformed style
    // The structure depends on what transformStyle returns and what MarkPointComponent expects
    // Usually for text it puts it into textStyle
    const textStyle = component.attribute.itemContent.style.textStyle;

    expect(textStyle.fontSize).toBe(20);
    expect(textStyle.fill).toBe('red');
  });

  it('should transform rich textStyle to richText item content', () => {
    const richText = [
      {
        text: 'RICHTEXT',
        fontWeight: 'bold',
        fontSize: 25,
        fill: '#3f51b5'
      },
      {
        text: '替代方案',
        fontStyle: 'italic',
        textDecoration: 'underline',
        fill: '#3f51b5'
      }
    ];
    const spec = {
      itemContent: {
        textStyle: {
          type: 'rich',
          text: richText
        }
      },
      itemLine: {}
    };

    const ctx: any = {
      getChart: () => ({
        getTheme: () => ({})
      })
    };

    const markPoint = new TestMarkPoint(spec as any, ctx);
    const component = markPoint.getMarkerComponent() as any;
    const itemContent = component.attribute.itemContent;

    expect(itemContent.type).toBe('richText');
    expect(itemContent.style.textConfig).toEqual(richText);
    expect(itemContent.style.text).toBeUndefined();
  });
});
