import { markContext as ctx } from '../../util/context';
import { TextMark } from '../../../src/mark/text';
import { LayoutZIndex } from '../../../src/constant/layout';

test('rule mark initial style', () => {
  const textMark = new TextMark('rule0', ctx);
  textMark.created();
  const visible = textMark.getAttribute('visible', {});
  const zindex = textMark.getAttribute('zIndex', {});

  const x = textMark.getAttribute('x', {});
  const y = textMark.getAttribute('y', {});
  const dx = textMark.getAttribute('dx', {});
  const dy = textMark.getAttribute('dy', {});
  const stroke = textMark.getAttribute('stroke', {});
  const strokeWidth = textMark.getAttribute('lineWidth', {});
  const lineDash = textMark.getAttribute('lineDash', {});
  const strokeOpacity = textMark.getAttribute('strokeOpacity', {});
  const cursor = textMark.getAttribute('cursor', {});

  // mark zindex
  expect(textMark.getMarkConfig().zIndex).toEqual(LayoutZIndex.Mark);

  expect(visible).toEqual(true);
  expect(zindex).toEqual(undefined);
  expect(x).toEqual(0);
  expect(y).toEqual(0);
  expect(dx).toEqual(undefined);
  expect(dy).toEqual(undefined);
  expect(stroke).toEqual(undefined);
  expect(strokeOpacity).toEqual(undefined);
  expect(strokeWidth).toEqual(0);
  expect(lineDash).toEqual(undefined);
  expect(cursor).toEqual(undefined);
});
