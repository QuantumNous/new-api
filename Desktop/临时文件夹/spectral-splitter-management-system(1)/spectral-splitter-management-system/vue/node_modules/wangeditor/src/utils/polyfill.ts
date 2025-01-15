/**
 * @description polyfill 【注意，js 语法的兼容，都通过 babel transform runtime 支持】
 * @author wangfupeng
 */

if (!Element.prototype.matches) {
    Element.prototype.matches = function (s) {
        let matches: NodeListOf<Element> = this.ownerDocument.querySelectorAll(s)
        let i: number = matches.length
        for (i; i >= 0; i--) {
            if (matches.item(i) === this) break
        }
        return i > -1
    }
}

// 有的第三方库需要原生 Promise ，而 IE11 又没有原生 Promise ，就报错
if (!window.Promise) {
    window.Promise = Promise
}
