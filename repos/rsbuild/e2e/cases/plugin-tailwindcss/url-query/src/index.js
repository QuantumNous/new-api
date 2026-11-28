import styleUrl from './index.css?url';

window.getTailwindUrlResult = async () => ({
  styleContent: await fetch(styleUrl).then((res) => res.text()),
  styleUrl,
});
