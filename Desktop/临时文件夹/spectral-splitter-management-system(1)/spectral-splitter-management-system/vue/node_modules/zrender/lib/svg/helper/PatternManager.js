import { __extends } from "tslib";
import Definable from './Definable.js';
import * as zrUtil from '../../core/util.js';
import { createOrUpdateImage } from '../../graphic/helper/image.js';
import WeakMap from '../../core/WeakMap.js';
function isPattern(value) {
    return value && (!!value.image || !!value.svgElement);
}
var patternDomMap = new WeakMap();
var PatternManager = (function (_super) {
    __extends(PatternManager, _super);
    function PatternManager(zrId, svgRoot) {
        return _super.call(this, zrId, svgRoot, ['pattern'], '__pattern_in_use__') || this;
    }
    PatternManager.prototype.addWithoutUpdate = function (svgElement, displayable) {
        if (displayable && displayable.style) {
            var that_1 = this;
            zrUtil.each(['fill', 'stroke'], function (fillOrStroke) {
                var pattern = displayable.style[fillOrStroke];
                if (isPattern(pattern)) {
                    var defs = that_1.getDefs(true);
                    var dom = patternDomMap.get(pattern);
                    if (dom) {
                        if (!defs.contains(dom)) {
                            that_1.addDom(dom);
                        }
                    }
                    else {
                        dom = that_1.add(pattern);
                    }
                    that_1.markUsed(displayable);
                    var id = dom.getAttribute('id');
                    svgElement.setAttribute(fillOrStroke, 'url(#' + id + ')');
                }
            });
        }
    };
    PatternManager.prototype.add = function (pattern) {
        if (!isPattern(pattern)) {
            return;
        }
        var dom = this.createElement('pattern');
        pattern.id = pattern.id == null ? this.nextId++ : pattern.id;
        dom.setAttribute('id', 'zr' + this._zrId
            + '-pattern-' + pattern.id);
        dom.setAttribute('x', '0');
        dom.setAttribute('y', '0');
        dom.setAttribute('patternUnits', 'userSpaceOnUse');
        this.updateDom(pattern, dom);
        this.addDom(dom);
        return dom;
    };
    PatternManager.prototype.update = function (pattern) {
        if (!isPattern(pattern)) {
            return;
        }
        var that = this;
        this.doUpdate(pattern, function () {
            var dom = patternDomMap.get(pattern);
            that.updateDom(pattern, dom);
        });
    };
    PatternManager.prototype.updateDom = function (pattern, patternDom) {
        var svgElement = pattern.svgElement;
        if (svgElement instanceof SVGElement) {
            if (svgElement.parentNode !== patternDom) {
                patternDom.innerHTML = '';
                patternDom.appendChild(svgElement);
                patternDom.setAttribute('width', pattern.svgWidth + '');
                patternDom.setAttribute('height', pattern.svgHeight + '');
            }
        }
        else {
            var img = void 0;
            var prevImage = patternDom.getElementsByTagName('image');
            if (prevImage.length) {
                if (pattern.image) {
                    img = prevImage[0];
                }
                else {
                    patternDom.removeChild(prevImage[0]);
                    return;
                }
            }
            else if (pattern.image) {
                img = this.createElement('image');
            }
            if (img) {
                var imageSrc = void 0;
                var patternImage = pattern.image;
                if (typeof patternImage === 'string') {
                    imageSrc = patternImage;
                }
                else if (patternImage instanceof HTMLImageElement) {
                    imageSrc = patternImage.src;
                }
                else if (patternImage instanceof HTMLCanvasElement) {
                    imageSrc = patternImage.toDataURL();
                }
                if (imageSrc) {
                    img.setAttribute('href', imageSrc);
                    img.setAttribute('x', '0');
                    img.setAttribute('y', '0');
                    var hostEl = {
                        dirty: function () { }
                    };
                    var createdImage = createOrUpdateImage(imageSrc, img, hostEl, function (img) {
                        patternDom.setAttribute('width', img.width + '');
                        patternDom.setAttribute('height', img.height + '');
                    });
                    if (createdImage && createdImage.width && createdImage.height) {
                        patternDom.setAttribute('width', createdImage.width + '');
                        patternDom.setAttribute('height', createdImage.height + '');
                    }
                    patternDom.appendChild(img);
                }
            }
        }
        var x = pattern.x || 0;
        var y = pattern.y || 0;
        var rotation = (pattern.rotation || 0) / Math.PI * 180;
        var scaleX = pattern.scaleX || 1;
        var scaleY = pattern.scaleY || 1;
        var transform = "translate(" + x + ", " + y + ") rotate(" + rotation + ") scale(" + scaleX + ", " + scaleY + ")";
        patternDom.setAttribute('patternTransform', transform);
        patternDomMap.set(pattern, patternDom);
    };
    PatternManager.prototype.markUsed = function (displayable) {
        if (displayable.style) {
            if (isPattern(displayable.style.fill)) {
                _super.prototype.markDomUsed.call(this, patternDomMap.get(displayable.style.fill));
            }
            if (isPattern(displayable.style.stroke)) {
                _super.prototype.markDomUsed.call(this, patternDomMap.get(displayable.style.stroke));
            }
        }
    };
    return PatternManager;
}(Definable));
export default PatternManager;
