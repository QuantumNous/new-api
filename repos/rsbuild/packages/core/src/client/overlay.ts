import { registerOverlay } from './hmr.js';
import { logger } from './log.js';

const { HTMLElement = class {} as typeof globalThis.HTMLElement, customElements } =
  typeof window !== 'undefined' ? window : globalThis;

class ErrorOverlay extends HTMLElement {
  init(html: string) {
    const root = this.attachShadow({ mode: 'open' });
    root.innerHTML = html;

    root.querySelector('.close')?.addEventListener('click', this.close);
    // close overlay when click outside
    this.addEventListener('click', this.close);
    root.querySelector('.container')?.addEventListener('click', (e) => {
      if (e.target) {
        const { file } = (e.target as HTMLLinkElement).dataset;
        if (file) {
          fetch(`/__open-in-editor?file=${encodeURIComponent(file)}`);
        }
      }
      e.stopPropagation();
    });

    const onEscKeydown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' || e.code === 'Escape') {
        this.close();
      }
      document.removeEventListener('keydown', onEscKeydown);
    };
    document.addEventListener('keydown', onEscKeydown);
  }

  close = (immediate: unknown = false) => {
    const remove = () => this.parentNode?.removeChild(this);

    if (this.animate && immediate !== true) {
      this.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 300,
        easing: 'ease-out',
      }).addEventListener('finish', remove);
    } else {
      remove();
    }
  };
}

const overlayId = 'rsbuild-error-overlay';

if (customElements && !customElements.get(overlayId)) {
  customElements.define(overlayId, ErrorOverlay);
}

function getOverlayHtml(title: string, content: string) {
  return `
<style>
.root {
  position: fixed;
  z-index: 9999;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  overflow-y: scroll;
  margin: 0;
  background: rgba(0, 0, 0, 0.66);
  cursor: pointer;
}
.container {
  font-family: Menlo, Consolas, monospace;
  line-height: 1.6;
  width: 960px;
  max-width: 85%;
  color: #d8d8d8;
  margin: 32px auto;
  padding: 32px 40px;
  position: relative;
  background: #181818;
  border-radius: 24px;
  box-shadow: 0 19px 38px rgba(0,0,0,0.30), 0 15px 12px rgba(0,0,0,0.22);
  overflow: hidden;
  direction: ltr;
  text-align: left;
  box-sizing: border-box;
  cursor: default;
}
.title {
  margin: 0 0 20px;
  padding-bottom: 12px;
  font-size: 17px;
  font-weight: 600;
  color: #fb6a6a;
  border-bottom: 2px solid rgba(252,94,94,.66);
}
.content {
  margin: 0;
  font-size: 14px;
  font-family: inherit;
  white-space: pre-wrap;
  word-break: break-all;
  scrollbar-width: none;
}
.content::-webkit-scrollbar {
  display: none;
}
.file-link,
.url-link,
.config-link {
  cursor: pointer;
  text-decoration: underline;
  text-underline-offset: 3px;
  &:hover {
    opacity: 0.8;
  }
  &:active {
    opacity: 0.6;
  }
}
.file-link {
  color: #61cfd8;
}
.url-link {
  color: #eff986;
}
.config-link {
  color: inherit;
  text-decoration: none;
}
.close {
  position: absolute;
  top: 27px;
  right: 32px;
  width: 32px;
  height: 32px;
  cursor: pointer;
}
.close:hover {
  opacity: 0.8;
}
.close:active {
  opacity: 0.6;
}
.close:before,
.close:after {
  position: absolute;
  left: 16px;
  top: 8px;
  content: ' ';
  height: 18px;
  width: 2px;
  border-radius: 4px;
  background-color: #b8b8b8;
}
.close:before {
  transform: rotate(45deg);
}
.close:after {
  transform: rotate(-45deg);
}
.footer {
  font-size: 12px;
  color: #7e6a92;
  margin-top: 20px;
  padding-top: 12px;
  border-top: 2px solid rgba(126,106,146,.6);
}
.footer p {
  margin: 4px 0 0;
}
.footer span {
  color: #a88dc3;
}
</style>

<div class="root">
  <div class="container">
    <div class="close"></div>
    <p class="title">${title}</p>
    <pre class="content">${content}</pre>
    <footer class="footer">
      <p><span>Fix error</span>, click outside, or press Esc to close the overlay.</p>
      <p>Disable overlay by setting Rsbuild's <span><a class="config-link" target="_blank" rel="noopener noreferrer" href="https://rsbuild.rs/config/dev/client">dev.client.overlay</a></span> config to false.<p>
    </footer>
  </div>
</div>
`;
}

function createOverlay(title: string, content: string) {
  const warn = () => {
    logger.warn(
      '[rsbuild] Error overlay disabled: Custom Elements not supported in this environment.',
    );
  };
  if (!customElements || !customElements.get(overlayId)) {
    warn();
    return;
  }

  clearOverlay();

  try {
    const overlay = document.createElement(overlayId) as ErrorOverlay;
    overlay.init(getOverlayHtml(title, content));
    document.body.appendChild(overlay);
  } catch {
    warn();
  }
}

function clearOverlay() {
  // use NodeList's forEach api instead of dom.iterable
  document
    .querySelectorAll<ErrorOverlay>(overlayId)
    // close overlay immediately to avoid multiple overlays at the same time
    .forEach((n) => {
      n.close(true);
    });
}

if (typeof document !== 'undefined') {
  registerOverlay(createOverlay, clearOverlay);
} else {
  logger.info(
    '[rsbuild] Error overlay unavailable: Running in non-browser environment. To suppress this message, set `dev.client.overlay: false` in your configuration.',
  );
}
