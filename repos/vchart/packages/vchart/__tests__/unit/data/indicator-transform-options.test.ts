import { indicatorMapper, type IIndicatorMapper } from '../../../src/component/indicator/util';
import type { IIndicatorItemSpec } from '../../../src/component/indicator/interface';

describe('indicator transform options', () => {
  test('resolves lazy indicator options on every transform run', () => {
    let title: IIndicatorItemSpec = { visible: true, field: 'oldTitle' };
    let content: IIndicatorItemSpec[] = [{ visible: true, field: 'oldContent' }];
    let datum: Record<string, unknown> = { oldTitle: 'A', oldContent: 1 };
    const options = () =>
      ({
        title,
        content,
        datum: () => datum
      } as IIndicatorMapper);

    const first = indicatorMapper([], options as unknown as IIndicatorMapper);
    expect(first).toMatchObject([
      { type: 'title', spec: { field: 'oldTitle' }, datum },
      { type: 'content', spec: { field: 'oldContent' }, datum }
    ]);

    title = { visible: true, field: 'newTitle' };
    content = [{ visible: true, field: 'newContent' }];
    datum = { newTitle: 'B', newContent: 2 };

    const second = indicatorMapper([], options as unknown as IIndicatorMapper);
    expect(second).toMatchObject([
      { type: 'title', spec: { field: 'newTitle' }, datum },
      { type: 'content', spec: { field: 'newContent' }, datum }
    ]);
  });
});
