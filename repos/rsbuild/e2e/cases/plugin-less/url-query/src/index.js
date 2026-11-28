import styleUrl from './style.less?url';

const target = document.createElement('div');
target.className = 'url-query-less';
target.textContent = 'Less URL query';
document.body.appendChild(target);

window.getLessUrlResult = async () => ({
  styleContent: await fetch(styleUrl).then((res) => res.text()),
  styleUrl,
  targetColor: getComputedStyle(target).color,
});
