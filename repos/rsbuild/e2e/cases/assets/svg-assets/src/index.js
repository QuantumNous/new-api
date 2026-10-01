import svgImg from '@e2e/assets/mobile.svg?url';
import './App.css';

const testEl = document.createElement('div');
testEl.id = 'test';
testEl.innerHTML = 'Hello Rsbuild!';

const testImg = document.createElement('img');
testImg.id = 'test-img';
testImg.src = svgImg;

const testCss = document.createElement('div');
testCss.id = 'test-css';

document.body.appendChild(testEl);
document.body.appendChild(testImg);
document.body.appendChild(testCss);
