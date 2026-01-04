import ReactDOM from 'react-dom';
import React from 'react';
import { omit } from 'lodash';

/**
 * The logic of JS for text truncation is referenced from antd typography
 * https://github.com/ant-design/ant-design/blob/master/components/typography/util.tsx
 * 
 * For more thinking and analysis about this function, please refer to Feishu document
 * https://bytedance.feishu.cn/docs/doccnqovjjyoKm2U5O13bj30aTh
 */

let ellipsisContainer: HTMLElement;

function pxToNumber(value: string) {
    if (!value) {
        return 0;
    }
    const match = value.match(/^\d*(\.\d*)?/);
    return match ? Number(match[0]) : 0;
}

function styleToString(style: CSSStyleDeclaration): string {
    // There are some different behavior between Firefox & Chrome.
    // We have to handle this ourself.
    const styleNames = Array.prototype.slice.apply(style);
    return styleNames.map((name: string) => `${name}: ${style.getPropertyValue(name)};`).join('');
}


const getRenderText = (
    originEle: HTMLElement,
    rows: number,
    content = '',
    fixedContent: {
        expand: Node;
        copy: Node
    },
    ellipsisStr: string,
    suffix: string,
    ellipsisPos: string,
    isStrong: boolean,
) => {
    if (content.length === 0) {
        return '';
    }
    if (!ellipsisContainer) {
        ellipsisContainer = document.createElement('div');
        ellipsisContainer.setAttribute('aria-hidden', 'true');
        document.body.appendChild(ellipsisContainer);
    }

    // Get origin style
    const originStyle = window.getComputedStyle(originEle);
    const originCSS = styleToString(originStyle);
    const lineHeight = pxToNumber(originStyle.lineHeight);
    const maxHeight = Math.round(
        lineHeight * (rows + 1) +
        pxToNumber(originStyle.paddingTop) +
        pxToNumber(originStyle.paddingBottom)
    );

    // Set shadow
    ellipsisContainer.setAttribute('style', originCSS);
    ellipsisContainer.style.position = 'fixed';
    ellipsisContainer.style.left = '0';
    // 当 window.getComputedStyle 得到的 width 值为 auto 时，通过 getBoundingClientRect 得到准确宽度
    // When the width value obtained by window.getComputedStyle is auto, get the exact width through getBoundingClientRect
    if (originStyle.getPropertyValue('width') === 'auto' && originEle.offsetWidth) {
        ellipsisContainer.style.width = `${originEle.offsetWidth}px`;
    } 
    ellipsisContainer.style.height = 'auto';
    ellipsisContainer.style.top = '-999999px';
    ellipsisContainer.style.zIndex = '-1000';
    isStrong && (ellipsisContainer.style.fontWeight = '600');

    // clean up css overflow
    ellipsisContainer.style.textOverflow = 'clip';
    ellipsisContainer.style.webkitLineClamp = 'none';

    // Clear container content
    ellipsisContainer.innerHTML = '';

    // Check if ellipsis in measure div is enough for content
    function inRange() {
        // If content does not wrap due to line break strategy, width should be judged to determine whether it's in range
        const widthInRange = ellipsisContainer.scrollWidth <= ellipsisContainer.offsetWidth;
        const heightInRange = ellipsisContainer.scrollHeight < maxHeight;

        return rows === 1 ? widthInRange && heightInRange : heightInRange;
    }

    // ========================= Find match ellipsis content =========================
    // Create origin content holder
    const ellipsisContentHolder = document.createElement('span');
    const textNode = document.createTextNode(content);
    ellipsisContentHolder.appendChild(textNode);
    if (suffix.length > 0) {
        const ellipsisTextNode = document.createTextNode(suffix);
        ellipsisContentHolder.appendChild(ellipsisTextNode);
    }
    ellipsisContainer.appendChild(ellipsisContentHolder);

    // Expand node needs to be added only when text needTruncated
    Object.values(omit(fixedContent, 'expand')).map(
        node => node && ellipsisContainer.appendChild(node.cloneNode(true))
    );

    function appendExpandNode() {
        ellipsisContainer.innerHTML = '';
        ellipsisContainer.appendChild(ellipsisContentHolder);
        Object.values(fixedContent).map(node => node && ellipsisContainer.appendChild(node.cloneNode(true)));
    }

    function getCurrentText(text: string, pos: number) {
        const end = text.length;
        if (!pos) {
            return ellipsisStr;
        }
        if (ellipsisPos === 'end') {
            return text.slice(0, pos) + ellipsisStr;
        }
        return text.slice(0, pos) + ellipsisStr + text.slice(end - pos, end);
    }

    // Get maximum text
    function measureText(
        textNode: Text,
        fullText: string,
        startLoc = 0,
        endLoc = fullText.length,
        lastSuccessLoc = 0
    ): string {
        const midLoc = Math.floor((startLoc + endLoc) / 2);
        const currentText = getCurrentText(fullText, midLoc);
        textNode.textContent = currentText;
        // console.log('calculating....', currentText);
        if (startLoc >= endLoc - 1 && endLoc > 0) { // Loop when step is small
            for (let step = endLoc; step >= startLoc; step -= 1) {
                const currentStepText = getCurrentText(fullText, step);
                textNode.textContent = currentStepText;
                if (inRange()) {
                    return currentStepText;
                }
            }
        } else if (endLoc === 0) {
            return ellipsisStr;
        }

        if (inRange()) {
            return measureText(textNode, fullText, midLoc, endLoc, midLoc);
        }
        return measureText(textNode, fullText, startLoc, midLoc, lastSuccessLoc);
    }

    let resText = content;
    // First judge whether the total length of fullText, plus suffix (possible)
    // and copied icon (possible) meets expectations？ 
    // If it does not meet expectations, add an expand button to find the largest  content that meets size limit
    // 首先判断总文本长度，加上可能有的 suffix，复制按钮长度，看结果是否符合预期
    // 如果不符合预期，则再加上展开按钮，找最大符合尺寸的内容
    if (!inRange()) {
        appendExpandNode();
        resText = measureText(textNode, content, 0, ellipsisPos === 'middle' ? Math.floor((content.length) / 2) : content.length);
    }
    ellipsisContainer.innerHTML = '';
    return resText;
};

export default getRenderText;
