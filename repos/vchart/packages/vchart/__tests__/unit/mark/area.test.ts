import { markContext as ctx } from '../../util/context';
import { AreaMark } from '../../../src/mark/area';

describe('Area Mark', () => {
  it('should not mutate existing progressive segments in place', () => {
    const areaMark = new AreaMark('area1', ctx);
    areaMark.created();

    (areaMark as any).renderContext = {
      progressive: {
        currentIndex: 1
      }
    };
    (areaMark as any)._keyGetter = (datum: any) => datum.x;

    const existingSegments = [
      {
        points: [{ x: 0, y: 0, y1: 100 }]
      }
    ];
    const graphic = {
      attribute: {
        segments: existingSegments
      },
      context: {
        data: [
          { x: 1, y: 10, y1: 100 },
          { x: 2, y: 20, y1: 100 }
        ]
      }
    };

    const result = (areaMark as any)._runPointsEncoder(
      {
        x: (datum: any) => datum.x,
        y: (datum: any) => datum.y,
        y1: (datum: any) => datum.y1
      },
      graphic
    );

    expect(existingSegments).toHaveLength(1);
    expect(result.segments).toHaveLength(2);
    expect(result.segments).not.toBe(existingSegments);
  });
});
