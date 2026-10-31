(function prehydration() {
  const firstThumb = document.currentScript?.parentElement;
  if (!firstThumb) {
    return;
  }

  const control = firstThumb.closest('[data-base-ui-slider-control]');
  if (!control) {
    return;
  }

  const indicator = control.querySelector('[data-base-ui-slider-indicator]');
  const controlRect = control.getBoundingClientRect();
  const vertical = control.getAttribute('data-orientation') === 'vertical';
  const side = vertical ? 'height' : 'width';
  const inputElems = control.querySelectorAll('input[type="range"]');
  const range = inputElems.length > 1;
  const lastIndex = inputElems.length - 1;

  let startPosition = null;
  let relativeSize = null;

  for (let i = 0; i < inputElems.length; i += 1) {
    const input = inputElems[i];

    const value = parseFloat(input.getAttribute('value') ?? '');

    if (Number.isNaN(value)) {
      return;
    }

    const thumb = input.parentElement;
    if (!thumb) {
      return;
    }

    const max = parseFloat(input.getAttribute('max') ?? '100');
    const min = parseFloat(input.getAttribute('min') ?? '0');

    const thumbRect = thumb?.getBoundingClientRect();

    const controlSize = controlRect[side] - thumbRect[side];
    const thumbValuePercent = ((value - min) * 100) / (max - min);
    const thumbOffsetFromControlEdge =
      thumbRect[side] / 2 + (controlSize * thumbValuePercent) / 100;
    const percent = (thumbOffsetFromControlEdge / controlRect[side]) * 100;

    thumb.style.setProperty(`--position`, `${percent}%`);

    if (Number.isFinite(percent)) {
      thumb.style.removeProperty('visibility');

      if (indicator) {
        if (i === 0) {
          startPosition = percent;
          indicator.style.setProperty('--start-position', `${percent}%`);
          if (!range) {
            indicator.style.removeProperty('visibility');
          }
        } else if (i === lastIndex) {
          relativeSize = percent - (startPosition ?? 0);
          indicator.style.setProperty('--end-position', `${percent}%`);
          indicator.style.setProperty('--relative-size', `${relativeSize}%`);
          indicator.style.removeProperty('visibility');
        }
      }
    }
  }
})();
