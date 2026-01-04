import * as React from 'react';
import ReactDOM from 'react-dom';
import AutoSizer from '../autoSizer';

function render(markup) {
  if (!render._mountNode) {
    render._mountNode = document.createElement('div');

    // Unless we attach the mount-node to body, getBoundingClientRect() won't work
    document.body.appendChild(render._mountNode);

    afterEach(render.unmount);
    // window.ResizeObserver = ResizeObserver;

  }

  return ReactDOM.render(markup, render._mountNode);
}

render.unmount = function () {
  if (render._mountNode) {
    ReactDOM.unmountComponentAtNode(render._mountNode);

    document.body.removeChild(render._mountNode);

    render._mountNode = null;
  }
};

describe('AutoSizer', () => {
  function getAutoSizer({
    defaultHeight = undefined,
    defaultWidth = undefined,
    height = 100,
    width = 200,
  } = {}) {
    const wrapperStyle = {
      boxSizing: 'border-box',
      height,
      width,
    };

    mockOffsetSize(width, height);

    return (
      <div style={wrapperStyle}>
        <AutoSizer
          defaultHeight={defaultHeight}
          defaultWidth={defaultWidth}
        >
          {({ height, width }) => (
            <div style={{
              width,
              height,
            }}>
              {`width:${width}, height:${height}`}
            </div>
          )}
        </AutoSizer>
      </div>
    );
  }

  // AutoSizer uses offsetWidth and offsetHeight.
  // Jest runs in JSDom which doesn't support measurements APIs.
  // refer to https://github.com/bvaughn/react-virtualized-auto-sizer/blob/master/src/__tests__/AutoSizer.js
  function mockOffsetSize(width, height) {
    Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
      configurable: true,
      value: height,
    });
  }

  it('should set the correct initial width and height of ChildComponent or React child', () => {
    // TODO
    // expect(rendered.textContent).toContain('height:100');
    // expect(rendered.textContent).toContain('width:100%');
  });

  async function simulateResize({ element, height, width }) {
    mockOffsetSize(width, height);
    window.dispatchEvent(new Event('resize'));
    // Allow requestAnimationFrame to be invoked before continuing
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  it('should update :height after a resize event', async done => {
    render(
      getAutoSizer({
        height: 100,
      }),
    );
    // 直接使用 mountNode 替代
    const rendered = render._mountNode;
    // expect(rendered.textContent).toContain('height:100');
    await simulateResize({ element: rendered, height: 400, });
    // TODO
    // expect(rendered.textContent).toContain('height:400');
    done();
  });
});