import styleUrl from './style.css?url';

window.getCssUrlResult = async () => ({
  styleUrl,
  styleContent: await fetch(styleUrl).then((res) => res.text()),
});
