import { expect, vi } from 'vitest';
import * as React from 'react';
import { Avatar } from '@base-ui/react/avatar';
import { act, screen, waitFor } from '@mui/internal-test-utils';
import { describeConformance, createRenderer, isJSDOM } from '#test-utils';

type MockImage = {
  complete: boolean;
  naturalWidth: number;
  onload: (() => void) | null;
  onerror: (() => void) | null;
  referrerPolicy: string;
  crossOrigin: string | null;
  sizes: string;
  src: string;
  srcset: string;
};

/**
 * When `completeOnSet` is true, simulates cached-image behavior: setting a
 * source immediately marks the image as complete before an async load event.
 */
function mockImageLoading({ completeOnSet = false, naturalWidth = 100 } = {}) {
  const OriginalImage = window.Image;
  const images: MockImage[] = [];

  window.Image = function MockImage() {
    let srcValue = '';
    let srcSetValue = '';
    const obj: MockImage = {
      complete: false,
      naturalWidth: 0,
      onload: null,
      onerror: null,
      referrerPolicy: '',
      crossOrigin: null,
      sizes: '',
      get src() {
        return srcValue;
      },
      set src(value: string) {
        srcValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
      get srcset() {
        return srcSetValue;
      },
      set srcset(value: string) {
        srcSetValue = value;
        if (completeOnSet) {
          obj.complete = true;
          obj.naturalWidth = naturalWidth;
        }
      },
    };
    images.push(obj);
    return obj;
  } as unknown as typeof window.Image;

  return {
    images,
    restore() {
      window.Image = OriginalImage;
    },
  };
}

describe('<Avatar.Image />', () => {
  const { render, renderToString } = createRenderer();

  let restoreImage: () => void;

  function installImageMock(options?: Parameters<typeof mockImageLoading>[0]) {
    restoreImage();
    const imageMock = mockImageLoading(options);
    restoreImage = imageMock.restore;
    return imageMock;
  }

  beforeEach(() => {
    restoreImage = mockImageLoading({ completeOnSet: true }).restore;
  });

  afterEach(() => {
    restoreImage();
  });

  describeConformance(<Avatar.Image src="test.png" />, () => ({
    render: (node) => {
      return render(<Avatar.Root>{node}</Avatar.Root>);
    },
    refInstanceof: window.HTMLImageElement,
  }));

  it.skipIf(!isJSDOM)('passes native image props to the rendered image', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image
          crossOrigin="anonymous"
          data-testid="image"
          referrerPolicy="no-referrer"
          sizes="48px"
          src="avatar.png"
          srcSet="avatar.png 1x, avatar@2x.png 2x"
        />
      </Avatar.Root>,
    );

    const image = screen.getByTestId('image');
    expect(image).toHaveAttribute('crossorigin', 'anonymous');
    expect(image).toHaveAttribute('referrerpolicy', 'no-referrer');
    expect(image).toHaveAttribute('sizes', '48px');
    expect(image).toHaveAttribute('srcset', 'avatar.png 1x, avatar@2x.png 2x');
  });

  it.skipIf(!isJSDOM)('shows the image when only srcSet is provided', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image data-testid="image" sizes="48px" srcSet="avatar.png 1x" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(screen.getByTestId('image')).toHaveAttribute('srcset', 'avatar.png 1x');
    expect(screen.queryByText('JD')).toBe(null);
  });

  it.skipIf(!isJSDOM)('passes responsive image props to the loading probe', async () => {
    const imageMock = installImageMock();

    await render(
      <Avatar.Root>
        <Avatar.Image sizes="48px" src="fallback.png" srcSet="avatar.png 1x, avatar@2x.png 2x" />
      </Avatar.Root>,
    );

    expect(imageMock.images[0].sizes).toBe('48px');
    expect(imageMock.images[0].srcset).toBe('avatar.png 1x, avatar@2x.png 2x');
    expect(imageMock.images[0].src).toBe('fallback.png');
  });

  describe.skipIf(!isJSDOM)('prop: onLoadingStatusChange', () => {
    it('fires when the image loads', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      await act(async () => {
        imageMock.images.at(-1)?.onload?.();
      });

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'loaded',
        ]);
      });
    });

    it('fires when the image errors', async () => {
      const imageMock = installImageMock();
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('loading');
      });

      await act(async () => {
        imageMock.images.at(-1)?.onerror?.();
      });

      await waitFor(() => {
        expect(onLoadingStatusChange.mock.calls.map(([status]) => status)).toEqual([
          'loading',
          'error',
        ]);
      });
    });

    it('fires for cached image errors without emitting idle', async () => {
      installImageMock({ completeOnSet: true, naturalWidth: 0 });
      const onLoadingStatusChange = vi.fn();

      await render(
        <Avatar.Root>
          <Avatar.Image src="avatar.png" onLoadingStatusChange={onLoadingStatusChange} />
        </Avatar.Root>,
      );

      await waitFor(() => {
        expect(onLoadingStatusChange).toHaveBeenCalledWith('error');
      });

      expect(onLoadingStatusChange).not.toHaveBeenCalledWith('idle');
    });
  });

  describe.skipIf(isJSDOM)('animations', () => {
    afterEach(() => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = true;
    });

    it('triggers enter animation via data-starting-style when mounting', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      let transitionFinished = false;
      function notifyTransitionFinished() {
        transitionFinished = true;
      }

      const style = `
        .animation-test-image {
          transition: opacity 1ms;
        }

        .animation-test-image[data-starting-style],
        .animation-test-image[data-ending-style] {
          opacity: 0;
        }
      `;

      function Test() {
        const [showImage, setShowImage] = React.useState(false);

        function handleShowImage() {
          setShowImage(true);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleShowImage}>Show image</button>
            <Avatar.Root>
              <Avatar.Image
                className="animation-test-image"
                data-testid="image"
                onTransitionEnd={notifyTransitionFinished}
                src={showImage ? 'avatar.png' : undefined}
              />
            </Avatar.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.queryByTestId('image')).toBe(null);

      await user.click(screen.getByText('Show image'));

      await waitFor(() => {
        expect(transitionFinished).toBe(true);
      });

      expect(screen.getByTestId('image')).not.toBe(null);
    });

    it('applies data-ending-style before unmount', async () => {
      globalThis.BASE_UI_ANIMATIONS_DISABLED = false;

      const style = `
        @keyframes test-anim {
          to {
            opacity: 0;
          }
        }

        .animation-test-image[data-ending-style] {
          animation: test-anim 1ms;
        }
      `;

      function Test() {
        const [showImage, setShowImage] = React.useState(true);

        function handleHideImage() {
          setShowImage(false);
        }

        return (
          <div>
            {/* eslint-disable-next-line react/no-danger */}
            <style dangerouslySetInnerHTML={{ __html: style }} />
            <button onClick={handleHideImage}>Hide image</button>
            <Avatar.Root>
              <Avatar.Image
                className="animation-test-image"
                data-testid="image"
                src={showImage ? 'avatar.png' : undefined}
              />
            </Avatar.Root>
          </div>
        );
      }

      const { user } = await render(<Test />);
      expect(screen.getByTestId('image')).not.toBe(null);

      await user.click(screen.getByText('Hide image'));

      await waitFor(() => {
        const image = screen.queryByTestId('image');
        expect(image).not.toBe(null);
        expect(image).toHaveAttribute('data-ending-style');
      });

      await waitFor(() => {
        expect(screen.queryByTestId('image')).toBe(null);
      });
    });
  });

  describe.skipIf(isJSDOM)('cached images', () => {
    // 1x1 transparent PNG
    const DATA_URI =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    it('does not flash fallback for a cached image during SSR hydration', async () => {
      // Restore real Image so this test exercises actual browser caching
      restoreImage();

      // Pre-load so the browser cache has the decoded image
      await new Promise<void>((resolve, reject) => {
        const img = new window.Image();
        img.onload = () => resolve();
        img.onerror = () => reject(new Error('Failed to preload test image'));
        img.src = DATA_URI;
      });

      // Server render: layout effects don't run, so fallback is in the HTML
      const { hydrate } = renderToString(
        <Avatar.Root>
          <Avatar.Image src={DATA_URI} alt="Jane Doe" />
          <Avatar.Fallback>JD</Avatar.Fallback>
        </Avatar.Root>,
      );

      expect(screen.getByText('JD')).toBeVisible();
      expect(screen.queryByRole('img')).toBe(null);

      // After hydration, the layout effect fires synchronously before paint.
      // For cached images, image.complete is true so status resolves to 'loaded'
      // immediately — no fallback flash.
      //
      // Assert synchronously (no waitFor) to verify the image is available on
      // the first post-hydration render, not after a delayed onload callback.
      hydrate();

      expect(screen.getByRole('img')).toHaveAttribute('src', DATA_URI);
      expect(screen.queryByText('JD')).toBe(null);
    });
  });

  it.skipIf(!isJSDOM)('shows the image immediately for a cached src', async () => {
    await render(
      <Avatar.Root>
        <Avatar.Image src="https://example.com/cached-avatar.png" alt="Jane Doe" />
        <Avatar.Fallback>JD</Avatar.Fallback>
      </Avatar.Root>,
    );

    expect(screen.getByRole('img')).toHaveAttribute('src', 'https://example.com/cached-avatar.png');
    expect(screen.queryByText('JD')).toBe(null);
  });
});
