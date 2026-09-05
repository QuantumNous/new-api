export function createDiv(container: HTMLElement = document.body): HTMLElement {
  const div = document.createElement('div');

  container.appendChild(div);

  return div;
}

export function createCanvas(container: HTMLElement = document.body, style?: CSSStyleSheet): HTMLCanvasElement {
  const canvas = document.createElement('canvas');

  container.appendChild(canvas);

  return canvas;
}

export function removeDom(dom: HTMLElement) {
  const parent = dom.parentNode;

  if (parent) {
    parent.removeChild(dom);
  }
}

export const createButton = (content: string, onclick?: any) => {
  const b = document.createElement('button');
  b.innerHTML = content;
  b.style.marginRight = '5px';
  b.style.marginTop = '5px';
  b.onclick = onclick;
  document.getElementById('chart')?.parentNode?.appendChild(b);
  return b;
};
