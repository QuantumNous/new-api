'use client';
import * as React from 'react';
import { useScrollLock } from '@base-ui/utils/useScrollLock';
import { platform } from '@base-ui/utils/platform';

export default function ScrollLock() {
  const [enabled, setEnabled] = React.useState(false);
  const [bodyScrollY, setBodyScrollY] = React.useState(false);
  const [htmlScrollY, setHtmlScrollY] = React.useState(false);
  const [longContent, setLongContent] = React.useState(true);
  const [webkitScrollbars, setWebkitScrollbars] = React.useState(false);

  useScrollLock(enabled);

  React.useEffect(() => {
    document.body.style.overflowY = bodyScrollY ? 'scroll' : 'visible';
  }, [bodyScrollY]);

  React.useEffect(() => {
    document.documentElement.style.overflowY = htmlScrollY ? 'scroll' : '';
  }, [htmlScrollY]);

  React.useEffect(() => {
    if (platform.engine.webkit && webkitScrollbars) {
      // WORKAROUND:
      // WebKit has a bug where ::-webkit-scrollbar styles are not applied immediately
      const element = document.documentElement;
      const originalOverflow = element.style.overflow;
      element.style.overflow = 'hidden';
      element.getBoundingClientRect();
      element.style.overflow = originalOverflow;
    }
  }, [webkitScrollbars]);

  return (
    <div>
      {webkitScrollbars && (
        <style>
          {`
          ::-webkit-scrollbar {
            width: 0.75rem;
            height: 0.75rem;
          }
          ::-webkit-scrollbar-track {
            background: var(--color-gray-200);
          }
          ::-webkit-scrollbar-thumb {
            background: var(--color-gray-500);
          }
          `}
        </style>
      )}

      <h1>useScrollLock</h1>
      <p>On macOS, enable `Show scroll bars: Always` in `Appearance` Settings.</p>
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          background: 'lightgray',
          textAlign: 'right',
          padding: 5,
        }}
      >
        Fixed content should not shift
      </div>
      <div
        style={{
          position: 'fixed',
          top: 15,
          display: 'flex',
          gap: 10,
          background: 'rgba(0,0,0,0.1)',
          backdropFilter: 'blur(20px)',
          padding: 10,
        }}
      >
        <div>
          <label>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(event) => setEnabled(event.target.checked)}
            />
            Scroll lock
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={bodyScrollY}
              onChange={(event) => setBodyScrollY(event.target.checked)}
            />
            body `overflow`
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={htmlScrollY}
              onChange={(event) => setHtmlScrollY(event.target.checked)}
            />
            html `overflow`
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={longContent}
              onChange={(event) => setLongContent(event.target.checked)}
            />
            Long content
          </label>
        </div>
        <div>
          <label>
            <input
              type="checkbox"
              checked={webkitScrollbars}
              onChange={(event) => setWebkitScrollbars(event.target.checked)}
            />
            Webkit scrollbars
          </label>
        </div>
      </div>
      {[...Array(longContent ? 100 : 10)].map((_, i) => (
        <p key={i}>Scroll locking text content</p>
      ))}
    </div>
  );
}
