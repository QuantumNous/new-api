import aStyleUrl from './a/index.css?url';
import bStyleUrl from './b/index.css?url';
import externalStyleUrl from '../shared/external.css?url';
import urlLeadingQueryUrl from './url-leading-query.css?other=value&url';
import urlTrailingQueryUrl from './url-trailing-query.css?url&other=value';
import urlValueQueryUrl from './url-value-query.css?url=1';
import styleUrl from './style.css?url';

const target = document.createElement('div');
target.id = 'target';
target.className = 'url-query-class';
target.textContent = 'CSS URL query';
document.body.appendChild(target);

window.getCssUrlResult = async () => ({
  aStyleContent: await fetch(aStyleUrl).then((res) => res.text()),
  aStyleUrl,
  bStyleContent: await fetch(bStyleUrl).then((res) => res.text()),
  bStyleUrl,
  externalStyleContent: await fetch(externalStyleUrl).then((res) => res.text()),
  externalStyleUrl,
  styleUrl,
  styleContent: await fetch(styleUrl).then((res) => res.text()),
  urlLeadingQueryContent: await fetch(urlLeadingQueryUrl).then((res) => res.text()),
  urlLeadingQueryUrl,
  urlTrailingQueryContent: await fetch(urlTrailingQueryUrl).then((res) => res.text()),
  urlTrailingQueryUrl,
  urlValueQueryContent: await fetch(urlValueQueryUrl).then((res) => res.text()),
  urlValueQueryUrl,
  targetColor: getComputedStyle(target).color,
});
