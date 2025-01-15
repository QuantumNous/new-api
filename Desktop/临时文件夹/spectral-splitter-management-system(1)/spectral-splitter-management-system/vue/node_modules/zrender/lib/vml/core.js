import env from '../core/env.js';
var urn = 'urn:schemas-microsoft-com:vml';
var win = typeof window === 'undefined' ? null : window;
var vmlInited = false;
export var doc = win && win.document;
export function createNode(tagName) {
    return doCreateNode(tagName);
}
var doCreateNode;
if (doc && !env.canvasSupported) {
    try {
        !doc.namespaces.zrvml && doc.namespaces.add('zrvml', urn);
        doCreateNode = function (tagName) {
            return doc.createElement('<zrvml:' + tagName + ' class="zrvml">');
        };
    }
    catch (e) {
        doCreateNode = function (tagName) {
            return doc.createElement('<' + tagName + ' xmlns="' + urn + '" class="zrvml">');
        };
    }
}
export function initVML() {
    if (vmlInited || !doc) {
        return;
    }
    vmlInited = true;
    var styleSheets = doc.styleSheets;
    if (styleSheets.length < 31) {
        doc.createStyleSheet().addRule('.zrvml', 'behavior:url(#default#VML)');
    }
    else {
        styleSheets[0].addRule('.zrvml', 'behavior:url(#default#VML)');
    }
}
