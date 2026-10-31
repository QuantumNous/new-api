import { content } from '@/content';

const testAliasEl = document.createElement('div');
testAliasEl.id = 'content';
testAliasEl.innerHTML = content;
document.body.appendChild(testAliasEl);
