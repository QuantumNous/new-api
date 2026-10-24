import { markContext as ctx } from '../../util/context';
import { LineMark } from '../../../src/mark/line';

describe('Line Mark', () => {
  it('enableSegments', () => {
    const lineMark1 = new LineMark('line1', ctx);
    lineMark1.created();
    //FIXME: 不能将类型“() => void”分配给类型“FunctionType<string | IGradient | undefined>”
    lineMark1.initStyleWithSpec({
      style: {
        stroke: undefined
      }
    });
    expect((lineMark1 as any)._segmentStyleKeys.length).toBe(0);

    const lineMark2 = new LineMark('line1', ctx);
    lineMark2.created();
    //FIXME: 不能将类型“{ strokeDash: { type: string; }; }”分配给类型“ConvertToMarkStyleSpec<ILineMarkSpec>”。
    lineMark2.initStyleWithSpec({
      style: {
        lineDash: {
          type: 'linear',
          field: 'value',
          domain: [0, 1],
          range: [
            [4, 4],
            [4, 0]
          ]
        }
      }
    });
    expect((lineMark2 as any)._segmentStyleKeys).toEqual(['lineDash']);

    const lineMark3 = new LineMark('line1', ctx);
    lineMark3.created();
    //FIXME: 不能将类型“{ strokeDash: { scale: {}; }; }”分配给类型“ConvertToMarkStyleSpec<ILineMarkSpec>”。
    lineMark3.initStyleWithSpec({
      style: {
        lineDash: undefined
      }
    });
    expect((lineMark3 as any)._segmentStyleKeys.length).toBe(0);

    const lineMark4 = new LineMark('line1', ctx);
    lineMark4.created();
    lineMark4.initStyleWithSpec({
      style: {
        x: 0,
        y: 0,
        stroke: 'red'
      }
    });
    expect((lineMark4 as any)._segmentStyleKeys.length).toBe(0);
  });

  it('should not mutate existing progressive segments in place', () => {
    const lineMark = new LineMark('line1', ctx);
    lineMark.created();

    (lineMark as any).renderContext = {
      progressive: {
        currentIndex: 1
      }
    };
    (lineMark as any)._keyGetter = (datum: any) => datum.x;

    const existingSegments = [
      {
        points: [{ x: 0, y: 0 }]
      }
    ];
    const graphic = {
      attribute: {
        segments: existingSegments
      },
      context: {
        data: [
          { x: 1, y: 10 },
          { x: 2, y: 20 }
        ]
      }
    };

    const result = (lineMark as any)._runPointsEncoder(
      {
        x: (datum: any) => datum.x,
        y: (datum: any) => datum.y
      },
      graphic
    );

    expect(existingSegments).toHaveLength(1);
    expect(result.segments).toHaveLength(2);
    expect(result.segments).not.toBe(existingSegments);
  });

  // FIXME: 'fill' does not exist in type 'IMarkSpec<ILineMarkSpec>'
  // it('ignoreAttributes', () => {
  //   const lineMark = new LineMark('line', ctx);
  //   lineMark.created();

  //   lineMark.initStyleWithSpec({
  //     fill: 'red',
  //     fillOpacity: 0
  //   });

  //   expect(lineMark.getStyle('fill')).toBeUndefined();
  //   expect(lineMark.getStyle('fillOpacity')).toBeUndefined();
  // });
});
