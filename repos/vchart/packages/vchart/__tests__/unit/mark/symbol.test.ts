import { markContext as ctx } from '../../util/context';
import { SymbolMark } from '../../../src/mark/symbol';
import { OrdinalScale } from '@visactor/vscale';
import { LayoutZIndex } from '../../../src/constant/layout';

test('symbol initial style', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();
  const visible = symbolMark.getAttribute('visible', {});
  const zindex = symbolMark.getAttribute('zIndex', {});
  const x = symbolMark.getAttribute('x', {});
  const y = symbolMark.getAttribute('y', {});
  const dx = symbolMark.getAttribute('dx', {});
  const dy = symbolMark.getAttribute('dy', {});
  const symbolType = symbolMark.getAttribute('symbolType', {});
  const stroke = symbolMark.getAttribute('stroke', {});
  const strokeWidth = symbolMark.getAttribute('lineWidth', {});
  const strokeDash = symbolMark.getAttribute('lineDash', {});
  const strokeOpacity = symbolMark.getAttribute('strokeOpacity', {});
  const size = symbolMark.getAttribute('size', {});
  const fillOpacity = symbolMark.getAttribute('fillOpacity', {});
  const fill = symbolMark.getAttribute('fill', {});
  const cursor = symbolMark.getAttribute('cursor', {});
  const borderSize = symbolMark.getAttribute('borderSize', {});
  const borderOpacity = symbolMark.getAttribute('borderOpacity', {});
  const borderSpacing = symbolMark.getAttribute('borderSpacing', {});

  // mark zindex
  expect(symbolMark.getMarkConfig().zIndex).toEqual(LayoutZIndex.Mark);

  expect(visible).toEqual(true);
  expect(zindex).toEqual(undefined);
  expect(x).toEqual(0);
  expect(y).toEqual(0);
  expect(dx).toEqual(undefined);
  expect(dy).toEqual(undefined);
  expect(symbolType).toEqual('circle');
  expect(size).toEqual(1);
  expect(stroke).toEqual(undefined);
  expect(strokeOpacity).toEqual(undefined);
  expect(strokeWidth).toEqual(0);
  expect(strokeDash).toEqual(undefined);
  expect(fill).toEqual(undefined);
  expect(fillOpacity).toEqual(undefined);
  expect(cursor).toEqual(undefined);
  expect(borderSize).toEqual(undefined);
  expect(borderOpacity).toEqual(undefined);
  expect(borderSpacing).toEqual(undefined);
});

test('symbol setAttribute support constant value.', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();

  symbolMark.setAttribute('y', 100, 'hover');
  const y = symbolMark.getAttribute('y', {});
  const y_hover = symbolMark.getAttribute('y', {}, 'hover');

  expect(y).toEqual(0);
  expect(y_hover).toEqual(100);
});

test('symbol setAttribute support function.', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();

  // setHoverStyle as function
  symbolMark.setAttribute('y', (datum: any) => (datum.hover ? 100 : 20), 'hover');
  let y_hover = symbolMark.getAttribute('y', {}, 'hover');
  expect(y_hover).toEqual(20);
  y_hover = symbolMark.getAttribute('y', { hover: 1 }, 'hover');
  expect(y_hover).toEqual(100);
});

test('symbol setAttribute support scaleField type.', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();

  symbolMark.setAttribute('y', 1, 'hover');
  symbolMark.setAttribute('y', 100, 'hover', 100);
  symbolMark.setAttribute('y', 50, 'hover', 50);
  const y = symbolMark.getAttribute('y', {});
  const y_hover = symbolMark.getAttribute('y', {}, 'hover');

  expect(y).toEqual(0);
  expect(y_hover).toEqual(100);
});

test('symbol setAttribute support level compare.', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();
  symbolMark.setAttribute(
    'y',
    {
      scale: new OrdinalScale().domain([true, false, undefined]).range([100, 20, 20]),
      field: 'hover'
    },
    'hover'
  );
  let y_hover = symbolMark.getAttribute('y', {}, 'hover');
  expect(y_hover).toEqual(20);
  y_hover = symbolMark.getAttribute('y', { hover: true }, 'hover');
  expect(y_hover).toEqual(100);

  symbolMark.setAttribute(
    'y',
    {
      scale: new OrdinalScale().domain([true, false, undefined]).range([10, 5, 5]),
      field: 'hover'
    },
    'hover'
  );
  y_hover = symbolMark.getAttribute('y', {}, 'hover');
  expect(y_hover).toEqual(5);
  y_hover = symbolMark.getAttribute('y', { hover: true }, 'hover');
  expect(y_hover).toEqual(10);

  symbolMark.setAttribute(
    'y',
    {
      scale: new OrdinalScale().domain([true, false, undefined]).range([10, 5, 5]),
      field: 'hover1'
    },
    'hover'
  );
  y_hover = symbolMark.getAttribute('y', {}, 'hover');
  expect(y_hover).toEqual(5);
  y_hover = symbolMark.getAttribute('y', { hover: true }, 'hover');
  expect(y_hover).toEqual(5);
});

test('symbol setAttribute support refer mark.', () => {
  const symbolMark = new SymbolMark('symbol0', ctx);
  symbolMark.created();
  const symbolMark1 = new SymbolMark('symbol1', ctx);
  symbolMark1.created();

  symbolMark1.setAttribute('y', 1);
  symbolMark1.setAttribute('y', 100, 'hover');
  symbolMark.setReferer(symbolMark1);

  const y = symbolMark.getAttribute('y', {});
  const y_hover = symbolMark.getAttribute('y', {}, 'hover');

  expect(y).toEqual(1);
  expect(y_hover).toEqual(100);
});
