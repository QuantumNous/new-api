import styleUrl from './style.scss?url';

const target = document.createElement('div');
target.className = 'url-query-sass';
target.textContent = 'Sass URL query';
document.body.appendChild(target);

window.getSassUrlResult = async () => ({
  styleContent: await fetch(styleUrl).then((res) => res.text()),
  styleUrl,
  targetColor: getComputedStyle(target).color,
});
