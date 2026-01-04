import Adapter from 'enzyme-adapter-react-16';
import Enzyme, { shallow, render, mount } from 'enzyme';
import React from 'react';
import sinon from 'sinon';
import enzymeToJson from 'enzyme-to-json';
import jest from 'jest';
import { render as testRender } from '@testing-library/react';
import jsdom from 'jsdom';
import crypto from 'crypto';
import { advanceBy, advanceTo, clear } from 'jest-date-mock';
import { mockRandom } from 'jest-mock-random';
import 'jest-canvas-mock';

import { IntersectionObserver } from '@shopify/jest-dom-mocks';
// window.requestAnimationFrame = function (callback) {
//     setTimeout(callback, 0);
// };
// window.addEventListener = () => {};

// React 16 Enzyme adapter
Enzyme.configure({
    adapter: new Adapter(),
});

class ResizeObserver {
    observe() {
        // do nothing
    }
    unobserve() {
        // do nothing
    }
    disconnect() {
        // do nothing
    }
}

global.ResizeObserver = ResizeObserver;

// Define globals to cut down on imports in test file
global.React = React;
global.shallow = shallow;
global.render = render;
global.mount = mount;
global.sinon = sinon;
global.testRender = testRender

Object.defineProperty(global.self, 'crypto', {
    value: {
        getRandomValues: arr => crypto.randomBytes(arr.length),
    },
});

// 固定每次直接无入参调用new Date()的结果
advanceTo(new Date('2019-08-08 12:00:00'));

// 固定每次调用Math.random的结果
mockRandom([0.1, 0.2, 0.3, 0.6]);

// global.IntersectionObserver = IntersectionObserver;

global.MutationObserver = class {
    // eslint-disable-next-line no-useless-constructor
    constructor(callback) {}
    disconnect() {}
    observe(element, initObject) {}
};

global.IntersectionObserver = class IntersectionObserver {
    disconnect() {
        return null;
    }

    observe() {
        return null;
    }

    takeRecords() {
        return null;
    }

    unobserve() {
        return null;
    }
};

global.matchMedia = global.matchMedia || function () {
    return {
        matches: false,
        addListener() {},
        removeListener() {},
        addEventListener() {},
        removeEventListener() {}
    };
};

global.HTMLElement.prototype.getBoundingClientRect = function () {
    return {
        width: parseFloat(this.style.width) || 0,
        height: parseFloat(this.style.height) || 0,
        top: parseFloat(this.style.marginTop) || 0,
        left: parseFloat(this.style.marginLeft) || 0
    };
};

Object.defineProperties(global.HTMLElement.prototype, {
    offsetWidth: {
        get() {
            return parseFloat(this.style.width) || 0;
        }
    },
    offsetHeight: {
        get() {
            return parseFloat(this.style.height) || 0;
        }
    },
    offsetTop: {
        get() {
            return parseFloat(this.style.marginTop) || 0;
        }
    },
    offsetLeft: {
        get() {
            return parseFloat(this.style.marginLeft) || 0;
        }
    }
});

// const { JSDOM } = jsdom;
// const dom = new JSDOM(`<!doctype html>
//     <html>
//     <body></body>
// </html>`);
// const { window } = dom;
// function copyProps(src, target) {
//   Object.defineProperties(target, {
//     ...Object.getOwnPropertyDescriptors(src),
//     ...Object.getOwnPropertyDescriptors(target),
//   });
// }

// global.window = window;
// global.document = window.document;
// // global.navigator = {
// //   userAgent: 'node.js',
// // };
// global.requestAnimationFrame = function (callback) {
//   return setTimeout(callback, 0);
// };
// global.cancelAnimationFrame = function (id) {
//   clearTimeout(id);
// };
// copyProps(window, global);
