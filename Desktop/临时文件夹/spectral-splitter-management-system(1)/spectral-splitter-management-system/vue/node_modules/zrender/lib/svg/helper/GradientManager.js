import { __extends } from "tslib";
import Definable from './Definable.js';
import * as zrUtil from '../../core/util.js';
import * as colorTool from '../../tool/color.js';
function isLinearGradient(value) {
    return value.type === 'linear';
}
function isRadialGradient(value) {
    return value.type === 'radial';
}
function isGradient(value) {
    return value && (value.type === 'linear'
        || value.type === 'radial');
}
var GradientManager = (function (_super) {
    __extends(GradientManager, _super);
    function GradientManager(zrId, svgRoot) {
        return _super.call(this, zrId, svgRoot, ['linearGradient', 'radialGradient'], '__gradient_in_use__') || this;
    }
    GradientManager.prototype.addWithoutUpdate = function (svgElement, displayable) {
        if (displayable && displayable.style) {
            var that_1 = this;
            zrUtil.each(['fill', 'stroke'], function (fillOrStroke) {
                var value = displayable.style[fillOrStroke];
                if (isGradient(value)) {
                    var gradient = value;
                    var defs = that_1.getDefs(true);
                    var dom = void 0;
                    if (gradient.__dom) {
                        dom = gradient.__dom;
                        if (!defs.contains(gradient.__dom)) {
                            that_1.addDom(dom);
                        }
                    }
                    else {
                        dom = that_1.add(gradient);
                    }
                    that_1.markUsed(displayable);
                    var id = dom.getAttribute('id');
                    svgElement.setAttribute(fillOrStroke, 'url(#' + id + ')');
                }
            });
        }
    };
    GradientManager.prototype.add = function (gradient) {
        var dom;
        if (isLinearGradient(gradient)) {
            dom = this.createElement('linearGradient');
        }
        else if (isRadialGradient(gradient)) {
            dom = this.createElement('radialGradient');
        }
        else {
            zrUtil.logError('Illegal gradient type.');
            return null;
        }
        gradient.id = gradient.id || this.nextId++;
        dom.setAttribute('id', 'zr' + this._zrId
            + '-gradient-' + gradient.id);
        this.updateDom(gradient, dom);
        this.addDom(dom);
        return dom;
    };
    GradientManager.prototype.update = function (gradient) {
        if (!isGradient(gradient)) {
            return;
        }
        var that = this;
        this.doUpdate(gradient, function () {
            var dom = gradient.__dom;
            if (!dom) {
                return;
            }
            var tagName = dom.tagName;
            var type = gradient.type;
            if (type === 'linear' && tagName === 'linearGradient'
                || type === 'radial' && tagName === 'radialGradient') {
                that.updateDom(gradient, gradient.__dom);
            }
            else {
                that.removeDom(gradient);
                that.add(gradient);
            }
        });
    };
    GradientManager.prototype.updateDom = function (gradient, dom) {
        if (isLinearGradient(gradient)) {
            dom.setAttribute('x1', gradient.x + '');
            dom.setAttribute('y1', gradient.y + '');
            dom.setAttribute('x2', gradient.x2 + '');
            dom.setAttribute('y2', gradient.y2 + '');
        }
        else if (isRadialGradient(gradient)) {
            dom.setAttribute('cx', gradient.x + '');
            dom.setAttribute('cy', gradient.y + '');
            dom.setAttribute('r', gradient.r + '');
        }
        else {
            zrUtil.logError('Illegal gradient type.');
            return;
        }
        if (gradient.global) {
            dom.setAttribute('gradientUnits', 'userSpaceOnUse');
        }
        else {
            dom.setAttribute('gradientUnits', 'objectBoundingBox');
        }
        dom.innerHTML = '';
        var colors = gradient.colorStops;
        for (var i = 0, len = colors.length; i < len; ++i) {
            var stop_1 = this.createElement('stop');
            stop_1.setAttribute('offset', colors[i].offset * 100 + '%');
            var color = colors[i].color;
            if (color.indexOf('rgba') > -1) {
                var opacity = colorTool.parse(color)[3];
                var hex = colorTool.toHex(color);
                stop_1.setAttribute('stop-color', '#' + hex);
                stop_1.setAttribute('stop-opacity', opacity + '');
            }
            else {
                stop_1.setAttribute('stop-color', colors[i].color);
            }
            dom.appendChild(stop_1);
        }
        gradient.__dom = dom;
    };
    GradientManager.prototype.markUsed = function (displayable) {
        if (displayable.style) {
            var gradient = displayable.style.fill;
            if (gradient && gradient.__dom) {
                _super.prototype.markDomUsed.call(this, gradient.__dom);
            }
            gradient = displayable.style.stroke;
            if (gradient && gradient.__dom) {
                _super.prototype.markDomUsed.call(this, gradient.__dom);
            }
        }
    };
    return GradientManager;
}(Definable));
export default GradientManager;
