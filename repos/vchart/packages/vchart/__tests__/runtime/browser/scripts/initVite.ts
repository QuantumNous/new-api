/**
 * 初始化 vite 相关配置
 */
import fs from 'fs';
import path from 'path';

const VCHART_PROJECT_ROOT = process.cwd();
const browserPath = `${VCHART_PROJECT_ROOT}/__tests__/runtime/browser`;

// 初始化 vite 自定义配置
(() => {
  const localFileList: [string, () => string][] = [
    [
      path.resolve(browserPath, 'vite.config.local.ts'),
      () => fs.readFileSync(browserPath + '/scripts/vite.config.local.template.ts', 'utf-8')
    ],
    [
      path.resolve(browserPath, 'index.page.local.ts'),
      () => fs.readFileSync(browserPath + '/scripts/index.page.local.template.ts', 'utf-8')
    ]
  ];
  for (const [localFile, getLocalTemplate] of localFileList) {
    if (!fs.existsSync(localFile)) {
      fs.writeFileSync(localFile, getLocalTemplate());
    }
  }
})();

console.warn(`\x1B[33m
  vite 即将启动，本地配置可在 ${browserPath}/vite.config.local.ts 中修改
\x1B[0m`);
