import { markContext as ctx } from '../../util/context';
import { RuleMark } from '../../../src/mark/rule';
import { LayoutZIndex } from '../../../src/constant/layout';

test('rule mark initial style', () => {
  const ruleMark = new RuleMark('rule0', ctx);
  ruleMark.created();
  const visible = ruleMark.getAttribute('visible', {});
  const zindex = ruleMark.getAttribute('zIndex', {});

  const x = ruleMark.getAttribute('x', {});
  const y = ruleMark.getAttribute('y', {});
  const x1 = ruleMark.getAttribute('x1', {});
  const y1 = ruleMark.getAttribute('y1', {});
  const stroke = ruleMark.getAttribute('stroke', {});
  const strokeWidth = ruleMark.getAttribute('lineWidth', {});
  const lineDash = ruleMark.getAttribute('lineDash', {});
  const strokeOpacity = ruleMark.getAttribute('strokeOpacity', {});
  const lineCap = ruleMark.getAttribute('lineCap', {});
  const cursor = ruleMark.getAttribute('cursor', {});
  const borderSize = ruleMark.getAttribute('borderSize', {});
  const borderOpacity = ruleMark.getAttribute('borderOpacity', {});
  const borderSpacing = ruleMark.getAttribute('borderSpacing', {});

  // mark zindex
  expect(ruleMark.getMarkConfig().zIndex).toEqual(LayoutZIndex.Mark);

  expect(visible).toEqual(true);
  expect(zindex).toEqual(undefined);
  expect(x).toEqual(0);
  expect(y).toEqual(0);
  expect(x1).toEqual(0);
  expect(y1).toEqual(0);
  expect(stroke).toEqual(undefined);
  expect(strokeOpacity).toEqual(undefined);
  expect(strokeWidth).toEqual(undefined);
  expect(lineDash).toEqual(undefined);
  expect(lineCap).toEqual(undefined);
  expect(cursor).toEqual(undefined);
  expect(borderSize).toEqual(undefined);
  expect(borderOpacity).toEqual(undefined);
  expect(borderSpacing).toEqual(undefined);
});
