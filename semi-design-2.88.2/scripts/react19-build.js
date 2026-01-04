#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * React 19 构建脚本
 * 只进行版本激活，不进行其他操作
 */

const REACT_18_START = /\/\* REACT_18_START \*\/([\s\S]*?)\/\* REACT_18_END \*\//g;
const REACT_19_START = /\/\* REACT_19_START \*\/([\s\S]*?)\/\* REACT_19_END \*\//g;

const outputDir = 'packages/semi-ui-19';

function processReact19Code(content) {
    // 移除 React 18 的代码块
    content = content.replace(REACT_18_START, '');
    
    // 启用 React 19 的代码块（移除注释标记和注释符号）
    content = content.replace(REACT_19_START, (match, codeBlock) => {
        // 移除每行开头的 // （注意处理缩进）
        return codeBlock.replace(/^(\s*)\/\/ /gm, '$1').trim();
    });
    
    return content;
}

function processReact18Code(content) {
    // 移除 React 19 的代码块  
    content = content.replace(REACT_19_START, '');
    
    // 启用 React 18 的代码块（仅移除标记）
    content = content.replace(REACT_18_START, (match, codeBlock) => {
        return codeBlock.trim();
    });
    
    return content;
}

function generateReact19PackageJson(sourcePackageJsonPath, outputPackageJsonPath) {
    const packageJson = JSON.parse(fs.readFileSync(sourcePackageJsonPath, 'utf8'));
    
    // 修改包名
    packageJson.name = '@douyinfe/semi-ui-19';
    
    // 修改描述
    packageJson.description = packageJson.description + ' (React 19 Compatible)';
    
    // 添加 React 19 相关的 peerDependencies
    if (!packageJson.peerDependencies) {
        packageJson.peerDependencies = {};
    }
    packageJson.peerDependencies.react = '^19.0.0';
    packageJson.peerDependencies['react-dom'] = '^19.0.0';
    
    // 添加 React 19 相关的 devDependencies
    if (!packageJson.devDependencies) {
        packageJson.devDependencies = {};
    }
    packageJson.devDependencies['@types/react'] = '^19.0.0';
    packageJson.devDependencies['@types/react-dom'] = '^19.0.0';
    packageJson.devDependencies['react'] = '^19.0.0';
    packageJson.devDependencies['react-dom'] = '^19.0.0';
    
    // 更新 null-loader 版本以兼容 webpack 5
    packageJson.devDependencies['null-loader'] = '4.0.1';
    
    // 添加 React 19 相关的 engines
    if (!packageJson.engines) {
        packageJson.engines = {};
    }
    packageJson.engines.node = '>=18.0.0';
    
    // 添加 React 19 相关的 keywords
    if (!packageJson.keywords) {
        packageJson.keywords = [];
    }
    if (!packageJson.keywords.includes('react-19')) {
        packageJson.keywords.push('react-19', 'react19');
    }
    
    // 写入文件
    fs.writeFileSync(outputPackageJsonPath, JSON.stringify(packageJson, null, 2));
    console.log('  ✅ 生成 package.json (React 19 版本)');
}

/**
 * 生成 React 19 版本的 package.json
 */
function generatePackageJson() {
    const sourcePackageJsonPath = 'packages/semi-ui/package.json';
    const outputPackageJsonPath = path.join(outputDir, 'package.json');
    
    if (fs.existsSync(sourcePackageJsonPath)) {
        generateReact19PackageJson(sourcePackageJsonPath, outputPackageJsonPath);
    } else {
        console.error('❌ 源 package.json 文件不存在');
        process.exit(1);
    }
}
function buildForReact19() {
    const sourceDir = 'packages/semi-ui';
    const targetDir = outputDir;
    
    // 需要过滤的目录
    const excludeDirs = ['node_modules', 'lib', '.git', 'dist', 'build'];
    
    // 确保输出目录存在
    if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
    }
    
    // 递归复制所有文件和目录
    function copyDirectory(src, dest) {
        if (!fs.existsSync(dest)) {
            fs.mkdirSync(dest, { recursive: true });
        }
        
        const items = fs.readdirSync(src);
        
        items.forEach(item => {
            // 跳过需要过滤的目录
            if (excludeDirs.includes(item)) {
                console.log(`  ⏭️  跳过目录 ${item}`);
                return;
            }
            
            const srcPath = path.join(src, item);
            const destPath = path.join(dest, item);
            const stat = fs.statSync(srcPath);
            
            if (stat.isDirectory()) {
                // 递归复制子目录
                copyDirectory(srcPath, destPath);
            } else {
                // 复制文件
                const relativePath = path.relative(sourceDir, srcPath);
                const isTsFile = /\.(ts|tsx)$/.test(item);
                const isScssScript = item.includes('compileScss.js');

                if (isTsFile || isScssScript) {
                    // 对 .ts/.tsx 文件进行 React 19 转换
                    const content = fs.readFileSync(srcPath, 'utf8');
                    const processedContent = processReact19Code(content);
                    fs.writeFileSync(destPath, processedContent);
                } else {
                    // 直接复制其他文件
                    fs.copyFileSync(srcPath, destPath);
                }
            }
        });
    }
    
    // 开始复制整个目录
    console.log('开始复制所有文件...');
    copyDirectory(sourceDir, targetDir);
    
    // 生成 React 19 版本的 package.json（覆盖已复制的）
    generatePackageJson();
    
    console.log('✅ React 19 版本构建完成');
}

function buildForReact18() {
    const sourcePattern = 'packages/semi-ui/**/*.{ts,tsx}';
    
    const files = glob.sync(sourcePattern);
    
    files.forEach(filePath => {
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 只处理版本激活
        const processedContent = processReact18Code(content);
        
        // 直接覆盖原文件
        fs.writeFileSync(filePath, processedContent);
    });
    
    console.log('✅ React 18 版本构建完成');
}

// 命令行参数处理
const args = process.argv.slice(2);
const version = args[0];

if (version === '19') {
    buildForReact19();
} else if (version === '18') {
    buildForReact18();
} else {
    console.log('用法: node scripts/react19-build.js [18|19]');
    console.log('  18: 构建 React 18 兼容版本');
    console.log('  19: 构建 React 19 兼容版本到 packages/semi-ui-19');
} 