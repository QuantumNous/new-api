import env from '../core/env.js';
import { applyTransform } from '../core/vector.js';
import BoundingRect from '../core/BoundingRect.js';
import * as colorTool from '../tool/color.js';
import * as textContain from '../graphic/text/parse.js';
import Displayable from '../graphic/Displayable.js';
import ZRImage from '../graphic/Image.js';
import Text from '../graphic/TSpan.js';
import Path from '../graphic/Path.js';
import PathProxy from '../core/PathProxy.js';
import Gradient from '../graphic/Gradient.js';
import * as vmlCore from './core.js';
var CMD = PathProxy.CMD;
var round = Math.round;
var sqrt = Math.sqrt;
var abs = Math.abs;
var cos = Math.cos;
var sin = Math.sin;
var mathMax = Math.max;
if (!env.canvasSupported) {
    var comma = ',';
    var imageTransformPrefix = 'progid:DXImageTransform.Microsoft';
    var Z = 21600;
    var Z2 = Z / 2;
    var ZLEVEL_BASE = 100000;
    var Z_BASE = 1000;
    var initRootElStyle = function (el) {
        el.style.cssText = 'position:absolute;left:0;top:0;width:1px;height:1px;';
        el.coordsize = Z + ',' + Z;
        el.coordorigin = '0,0';
    };
    var encodeHtmlAttribute = function (s) {
        return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    };
    var rgb2Str = function (r, g, b) {
        return 'rgb(' + [r, g, b].join(',') + ')';
    };
    var append = function (parent, child) {
        if (child && parent && child.parentNode !== parent) {
            parent.appendChild(child);
        }
    };
    var remove = function (parent, child) {
        if (child && parent && child.parentNode === parent) {
            parent.removeChild(child);
        }
    };
    var getZIndex = function (zlevel, z, z2) {
        return (parseFloat(zlevel) || 0) * ZLEVEL_BASE + (parseFloat(z) || 0) * Z_BASE + z2;
    };
    var parsePercent = textHelper.parsePercent;
    var setColorAndOpacity = function (el, color, opacity) {
        var colorArr = colorTool.parse(color);
        opacity = +opacity;
        if (isNaN(opacity)) {
            opacity = 1;
        }
        if (colorArr) {
            el.color = rgb2Str(colorArr[0], colorArr[1], colorArr[2]);
            el.opacity = opacity * colorArr[3];
        }
    };
    var getColorAndAlpha = function (color) {
        var colorArr = colorTool.parse(color);
        return [
            rgb2Str(colorArr[0], colorArr[1], colorArr[2]),
            colorArr[3]
        ];
    };
    var updateFillNode = function (el, style, zrEl) {
        var fill = style.fill;
        if (fill != null) {
            if (fill instanceof Gradient) {
                var gradientType;
                var angle = 0;
                var focus = [0, 0];
                var shift = 0;
                var expansion = 1;
                var rect = zrEl.getBoundingRect();
                var rectWidth = rect.width;
                var rectHeight = rect.height;
                if (fill.type === 'linear') {
                    gradientType = 'gradient';
                    var transform = zrEl.transform;
                    var p0 = [fill.x * rectWidth, fill.y * rectHeight];
                    var p1 = [fill.x2 * rectWidth, fill.y2 * rectHeight];
                    if (transform) {
                        applyTransform(p0, p0, transform);
                        applyTransform(p1, p1, transform);
                    }
                    var dx = p1[0] - p0[0];
                    var dy = p1[1] - p0[1];
                    angle = Math.atan2(dx, dy) * 180 / Math.PI;
                    if (angle < 0) {
                        angle += 360;
                    }
                    if (angle < 1e-6) {
                        angle = 0;
                    }
                }
                else {
                    gradientType = 'gradientradial';
                    var p0 = [fill.x * rectWidth, fill.y * rectHeight];
                    var transform = zrEl.transform;
                    var scale = zrEl.scale;
                    var width = rectWidth;
                    var height = rectHeight;
                    focus = [
                        (p0[0] - rect.x) / width,
                        (p0[1] - rect.y) / height
                    ];
                    if (transform) {
                        applyTransform(p0, p0, transform);
                    }
                    width /= scale[0] * Z;
                    height /= scale[1] * Z;
                    var dimension = mathMax(width, height);
                    shift = 2 * 0 / dimension;
                    expansion = 2 * fill.r / dimension - shift;
                }
                var stops = fill.colorStops.slice();
                stops.sort(function (cs1, cs2) {
                    return cs1.offset - cs2.offset;
                });
                var length = stops.length;
                var colorAndAlphaList = [];
                var colors = [];
                for (var i = 0; i < length; i++) {
                    var stop = stops[i];
                    var colorAndAlpha = getColorAndAlpha(stop.color);
                    colors.push(stop.offset * expansion + shift + ' ' + colorAndAlpha[0]);
                    if (i === 0 || i === length - 1) {
                        colorAndAlphaList.push(colorAndAlpha);
                    }
                }
                if (length >= 2) {
                    var color1 = colorAndAlphaList[0][0];
                    var color2 = colorAndAlphaList[1][0];
                    var opacity1 = colorAndAlphaList[0][1] * style.opacity;
                    var opacity2 = colorAndAlphaList[1][1] * style.opacity;
                    el.type = gradientType;
                    el.method = 'none';
                    el.focus = '100%';
                    el.angle = angle;
                    el.color = color1;
                    el.color2 = color2;
                    el.colors = colors.join(',');
                    el.opacity = opacity2;
                    el.opacity2 = opacity1;
                }
                if (gradientType === 'radial') {
                    el.focusposition = focus.join(',');
                }
            }
            else {
                setColorAndOpacity(el, fill, style.opacity);
            }
        }
    };
    var updateStrokeNode = function (el, style) {
        if (style.lineDash) {
            el.dashstyle = style.lineDash.join(' ');
        }
        if (style.stroke != null && !(style.stroke instanceof Gradient)) {
            setColorAndOpacity(el, style.stroke, style.opacity);
        }
    };
    var updateFillAndStroke = function (vmlEl, type, style, zrEl) {
        var isFill = type === 'fill';
        var el = vmlEl.getElementsByTagName(type)[0];
        if (style[type] != null && style[type] !== 'none' && (isFill || (!isFill && style.lineWidth))) {
            vmlEl[isFill ? 'filled' : 'stroked'] = 'true';
            if (style[type] instanceof Gradient) {
                remove(vmlEl, el);
            }
            if (!el) {
                el = vmlCore.createNode(type);
            }
            isFill ? updateFillNode(el, style, zrEl) : updateStrokeNode(el, style);
            append(vmlEl, el);
        }
        else {
            vmlEl[isFill ? 'filled' : 'stroked'] = 'false';
            remove(vmlEl, el);
        }
    };
    var points = [[], [], []];
    var pathDataToString = function (path, m) {
        var M = CMD.M;
        var C = CMD.C;
        var L = CMD.L;
        var A = CMD.A;
        var Q = CMD.Q;
        var str = [];
        var nPoint;
        var cmdStr;
        var cmd;
        var i;
        var xi;
        var yi;
        var data = path.data;
        var dataLength = path.len();
        for (i = 0; i < dataLength;) {
            cmd = data[i++];
            cmdStr = '';
            nPoint = 0;
            switch (cmd) {
                case M:
                    cmdStr = ' m ';
                    nPoint = 1;
                    xi = data[i++];
                    yi = data[i++];
                    points[0][0] = xi;
                    points[0][1] = yi;
                    break;
                case L:
                    cmdStr = ' l ';
                    nPoint = 1;
                    xi = data[i++];
                    yi = data[i++];
                    points[0][0] = xi;
                    points[0][1] = yi;
                    break;
                case Q:
                case C:
                    cmdStr = ' c ';
                    nPoint = 3;
                    var x1 = data[i++];
                    var y1 = data[i++];
                    var x2 = data[i++];
                    var y2 = data[i++];
                    var x3;
                    var y3;
                    if (cmd === Q) {
                        x3 = x2;
                        y3 = y2;
                        x2 = (x2 + 2 * x1) / 3;
                        y2 = (y2 + 2 * y1) / 3;
                        x1 = (xi + 2 * x1) / 3;
                        y1 = (yi + 2 * y1) / 3;
                    }
                    else {
                        x3 = data[i++];
                        y3 = data[i++];
                    }
                    points[0][0] = x1;
                    points[0][1] = y1;
                    points[1][0] = x2;
                    points[1][1] = y2;
                    points[2][0] = x3;
                    points[2][1] = y3;
                    xi = x3;
                    yi = y3;
                    break;
                case A:
                    var x = 0;
                    var y = 0;
                    var sx = 1;
                    var sy = 1;
                    var angle = 0;
                    if (m) {
                        x = m[4];
                        y = m[5];
                        sx = sqrt(m[0] * m[0] + m[1] * m[1]);
                        sy = sqrt(m[2] * m[2] + m[3] * m[3]);
                        angle = Math.atan2(-m[1] / sy, m[0] / sx);
                    }
                    var cx = data[i++];
                    var cy = data[i++];
                    var rx = data[i++];
                    var ry = data[i++];
                    var startAngle = data[i++] + angle;
                    var endAngle = data[i++] + startAngle + angle;
                    i++;
                    var clockwise = data[i++];
                    var x0 = cx + cos(startAngle) * rx;
                    var y0 = cy + sin(startAngle) * ry;
                    var x1 = cx + cos(endAngle) * rx;
                    var y1 = cy + sin(endAngle) * ry;
                    var type = clockwise ? ' wa ' : ' at ';
                    if (Math.abs(x0 - x1) < 1e-4) {
                        if (Math.abs(endAngle - startAngle) > 1e-2) {
                            if (clockwise) {
                                x0 += 270 / Z;
                            }
                        }
                        else {
                            if (Math.abs(y0 - cy) < 1e-4) {
                                if ((clockwise && x0 < cx) || (!clockwise && x0 > cx)) {
                                    y1 -= 270 / Z;
                                }
                                else {
                                    y1 += 270 / Z;
                                }
                            }
                            else if ((clockwise && y0 < cy) || (!clockwise && y0 > cy)) {
                                x1 += 270 / Z;
                            }
                            else {
                                x1 -= 270 / Z;
                            }
                        }
                    }
                    str.push(type, round(((cx - rx) * sx + x) * Z - Z2), comma, round(((cy - ry) * sy + y) * Z - Z2), comma, round(((cx + rx) * sx + x) * Z - Z2), comma, round(((cy + ry) * sy + y) * Z - Z2), comma, round((x0 * sx + x) * Z - Z2), comma, round((y0 * sy + y) * Z - Z2), comma, round((x1 * sx + x) * Z - Z2), comma, round((y1 * sy + y) * Z - Z2));
                    xi = x1;
                    yi = y1;
                    break;
                case CMD.R:
                    var p0 = points[0];
                    var p1 = points[1];
                    p0[0] = data[i++];
                    p0[1] = data[i++];
                    p1[0] = p0[0] + data[i++];
                    p1[1] = p0[1] + data[i++];
                    if (m) {
                        applyTransform(p0, p0, m);
                        applyTransform(p1, p1, m);
                    }
                    p0[0] = round(p0[0] * Z - Z2);
                    p1[0] = round(p1[0] * Z - Z2);
                    p0[1] = round(p0[1] * Z - Z2);
                    p1[1] = round(p1[1] * Z - Z2);
                    str.push(' m ', p0[0], comma, p0[1], ' l ', p1[0], comma, p0[1], ' l ', p1[0], comma, p1[1], ' l ', p0[0], comma, p1[1]);
                    break;
                case CMD.Z:
                    str.push(' x ');
            }
            if (nPoint > 0) {
                str.push(cmdStr);
                for (var k = 0; k < nPoint; k++) {
                    var p = points[k];
                    m && applyTransform(p, p, m);
                    str.push(round(p[0] * Z - Z2), comma, round(p[1] * Z - Z2), k < nPoint - 1 ? comma : '');
                }
            }
        }
        return str.join('');
    };
    Path.prototype.brushVML = function (vmlRoot) {
        var style = this.style;
        var vmlEl = this._vmlEl;
        if (!vmlEl) {
            vmlEl = vmlCore.createNode('shape');
            initRootElStyle(vmlEl);
            this._vmlEl = vmlEl;
        }
        updateFillAndStroke(vmlEl, 'fill', style, this);
        updateFillAndStroke(vmlEl, 'stroke', style, this);
        var m = this.transform;
        var needTransform = m != null;
        var strokeEl = vmlEl.getElementsByTagName('stroke')[0];
        if (strokeEl) {
            var lineWidth = style.lineWidth;
            if (needTransform && !style.strokeNoScale) {
                var det = m[0] * m[3] - m[1] * m[2];
                lineWidth *= sqrt(abs(det));
            }
            strokeEl.weight = lineWidth + 'px';
        }
        var path = this.path || (this.path = new PathProxy());
        if (this.__dirtyPath) {
            path.beginPath();
            path.subPixelOptimize = false;
            this.buildPath(path, this.shape);
            path.toStatic();
            this.__dirtyPath = false;
        }
        vmlEl.path = pathDataToString(path, this.transform);
        vmlEl.style.zIndex = getZIndex(this.zlevel, this.z, this.z2);
        append(vmlRoot, vmlEl);
        if (style.text != null) {
            this.drawRectText(vmlRoot, this.getBoundingRect());
        }
        else {
            this.removeRectText(vmlRoot);
        }
    };
    Path.prototype.onRemove = function (vmlRoot) {
        remove(vmlRoot, this._vmlEl);
        this.removeRectText(vmlRoot);
    };
    Path.prototype.onAdd = function (vmlRoot) {
        append(vmlRoot, this._vmlEl);
        this.appendRectText(vmlRoot);
    };
    var isImage = function (img) {
        return (typeof img === 'object') && img.tagName && img.tagName.toUpperCase() === 'IMG';
    };
    ZRImage.prototype.brushVML = function (vmlRoot) {
        var style = this.style;
        var image = style.image;
        var ow;
        var oh;
        if (isImage(image)) {
            var src = image.src;
            if (src === this._imageSrc) {
                ow = this._imageWidth;
                oh = this._imageHeight;
            }
            else {
                var imageRuntimeStyle = image.runtimeStyle;
                var oldRuntimeWidth = imageRuntimeStyle.width;
                var oldRuntimeHeight = imageRuntimeStyle.height;
                imageRuntimeStyle.width = 'auto';
                imageRuntimeStyle.height = 'auto';
                ow = image.width;
                oh = image.height;
                imageRuntimeStyle.width = oldRuntimeWidth;
                imageRuntimeStyle.height = oldRuntimeHeight;
                this._imageSrc = src;
                this._imageWidth = ow;
                this._imageHeight = oh;
            }
            image = src;
        }
        else {
            if (image === this._imageSrc) {
                ow = this._imageWidth;
                oh = this._imageHeight;
            }
        }
        if (!image) {
            return;
        }
        var x = style.x || 0;
        var y = style.y || 0;
        var dw = style.width;
        var dh = style.height;
        var sw = style.sWidth;
        var sh = style.sHeight;
        var sx = style.sx || 0;
        var sy = style.sy || 0;
        var hasCrop = sw && sh;
        var vmlEl = this._vmlEl;
        if (!vmlEl) {
            vmlEl = vmlCore.doc.createElement('div');
            initRootElStyle(vmlEl);
            this._vmlEl = vmlEl;
        }
        var vmlElStyle = vmlEl.style;
        var hasRotation = false;
        var m;
        var scaleX = 1;
        var scaleY = 1;
        if (this.transform) {
            m = this.transform;
            scaleX = sqrt(m[0] * m[0] + m[1] * m[1]);
            scaleY = sqrt(m[2] * m[2] + m[3] * m[3]);
            hasRotation = m[1] || m[2];
        }
        if (hasRotation) {
            var p0 = [x, y];
            var p1 = [x + dw, y];
            var p2 = [x, y + dh];
            var p3 = [x + dw, y + dh];
            applyTransform(p0, p0, m);
            applyTransform(p1, p1, m);
            applyTransform(p2, p2, m);
            applyTransform(p3, p3, m);
            var maxX = mathMax(p0[0], p1[0], p2[0], p3[0]);
            var maxY = mathMax(p0[1], p1[1], p2[1], p3[1]);
            var transformFilter = [];
            transformFilter.push('M11=', m[0] / scaleX, comma, 'M12=', m[2] / scaleY, comma, 'M21=', m[1] / scaleX, comma, 'M22=', m[3] / scaleY, comma, 'Dx=', round(x * scaleX + m[4]), comma, 'Dy=', round(y * scaleY + m[5]));
            vmlElStyle.padding = '0 ' + round(maxX) + 'px ' + round(maxY) + 'px 0';
            vmlElStyle.filter = imageTransformPrefix + '.Matrix('
                + transformFilter.join('') + ', SizingMethod=clip)';
        }
        else {
            if (m) {
                x = x * scaleX + m[4];
                y = y * scaleY + m[5];
            }
            vmlElStyle.filter = '';
            vmlElStyle.left = round(x) + 'px';
            vmlElStyle.top = round(y) + 'px';
        }
        var imageEl = this._imageEl;
        var cropEl = this._cropEl;
        if (!imageEl) {
            imageEl = vmlCore.doc.createElement('div');
            this._imageEl = imageEl;
        }
        var imageELStyle = imageEl.style;
        if (hasCrop) {
            if (!(ow && oh)) {
                var tmpImage = new Image();
                var self = this;
                tmpImage.onload = function () {
                    tmpImage.onload = null;
                    ow = tmpImage.width;
                    oh = tmpImage.height;
                    imageELStyle.width = round(scaleX * ow * dw / sw) + 'px';
                    imageELStyle.height = round(scaleY * oh * dh / sh) + 'px';
                    self._imageWidth = ow;
                    self._imageHeight = oh;
                    self._imageSrc = image;
                };
                tmpImage.src = image;
            }
            else {
                imageELStyle.width = round(scaleX * ow * dw / sw) + 'px';
                imageELStyle.height = round(scaleY * oh * dh / sh) + 'px';
            }
            if (!cropEl) {
                cropEl = vmlCore.doc.createElement('div');
                cropEl.style.overflow = 'hidden';
                this._cropEl = cropEl;
            }
            var cropElStyle = cropEl.style;
            cropElStyle.width = round((dw + sx * dw / sw) * scaleX);
            cropElStyle.height = round((dh + sy * dh / sh) * scaleY);
            cropElStyle.filter = imageTransformPrefix + '.Matrix(Dx='
                + (-sx * dw / sw * scaleX) + ',Dy=' + (-sy * dh / sh * scaleY) + ')';
            if (!cropEl.parentNode) {
                vmlEl.appendChild(cropEl);
            }
            if (imageEl.parentNode !== cropEl) {
                cropEl.appendChild(imageEl);
            }
        }
        else {
            imageELStyle.width = round(scaleX * dw) + 'px';
            imageELStyle.height = round(scaleY * dh) + 'px';
            vmlEl.appendChild(imageEl);
            if (cropEl && cropEl.parentNode) {
                vmlEl.removeChild(cropEl);
                this._cropEl = null;
            }
        }
        var filterStr = '';
        var alpha = style.opacity;
        if (alpha < 1) {
            filterStr += '.Alpha(opacity=' + round(alpha * 100) + ') ';
        }
        filterStr += imageTransformPrefix + '.AlphaImageLoader(src=' + image + ', SizingMethod=scale)';
        imageELStyle.filter = filterStr;
        vmlEl.style.zIndex = getZIndex(this.zlevel, this.z, this.z2);
        append(vmlRoot, vmlEl);
        if (style.text != null) {
            this.drawRectText(vmlRoot, this.getBoundingRect());
        }
    };
    ZRImage.prototype.onRemove = function (vmlRoot) {
        remove(vmlRoot, this._vmlEl);
        this._vmlEl = null;
        this._cropEl = null;
        this._imageEl = null;
        this.removeRectText(vmlRoot);
    };
    ZRImage.prototype.onAdd = function (vmlRoot) {
        append(vmlRoot, this._vmlEl);
        this.appendRectText(vmlRoot);
    };
    var DEFAULT_STYLE_NORMAL = 'normal';
    var fontStyleCache = {};
    var fontStyleCacheCount = 0;
    var MAX_FONT_CACHE_SIZE = 100;
    var fontEl = document.createElement('div');
    var getFontStyle = function (fontString) {
        var fontStyle = fontStyleCache[fontString];
        if (!fontStyle) {
            if (fontStyleCacheCount > MAX_FONT_CACHE_SIZE) {
                fontStyleCacheCount = 0;
                fontStyleCache = {};
            }
            var style = fontEl.style;
            var fontFamily;
            try {
                style.font = fontString;
                fontFamily = style.fontFamily.split(',')[0];
            }
            catch (e) {
            }
            fontStyle = {
                style: style.fontStyle || DEFAULT_STYLE_NORMAL,
                variant: style.fontVariant || DEFAULT_STYLE_NORMAL,
                weight: style.fontWeight || DEFAULT_STYLE_NORMAL,
                size: parseFloat(style.fontSize || 12) | 0,
                family: fontFamily || 'Microsoft YaHei'
            };
            fontStyleCache[fontString] = fontStyle;
            fontStyleCacheCount++;
        }
        return fontStyle;
    };
    var textMeasureEl;
    textContain.$override('measureText', function (text, textFont) {
        var doc = vmlCore.doc;
        if (!textMeasureEl) {
            textMeasureEl = doc.createElement('div');
            textMeasureEl.style.cssText = 'position:absolute;top:-20000px;left:0;'
                + 'padding:0;margin:0;border:none;white-space:pre;';
            vmlCore.doc.body.appendChild(textMeasureEl);
        }
        try {
            textMeasureEl.style.font = textFont;
        }
        catch (ex) {
        }
        textMeasureEl.innerHTML = '';
        textMeasureEl.appendChild(doc.createTextNode(text));
        return {
            width: textMeasureEl.offsetWidth
        };
    });
    var tmpRect = new BoundingRect(0, 0, 0, 0);
    var drawRectText = function (vmlRoot, rect, textRect, fromTextEl) {
        var style = this.style;
        this.__dirty && textHelper.normalizeTextStyle(style, true);
        var text = style.text;
        text != null && (text += '');
        if (!text) {
            return;
        }
        if (style.rich) {
            var contentBlock = textContain.parseRichText(text, style);
            text = [];
            for (var i = 0; i < contentBlock.lines.length; i++) {
                var tokens = contentBlock.lines[i].tokens;
                var textLine = [];
                for (var j = 0; j < tokens.length; j++) {
                    textLine.push(tokens[j].text);
                }
                text.push(textLine.join(''));
            }
            text = text.join('\n');
        }
        var x;
        var y;
        var align = style.textAlign;
        var verticalAlign = style.textVerticalAlign;
        var fontStyle = getFontStyle(style.font);
        var font = fontStyle.style + ' ' + fontStyle.variant + ' ' + fontStyle.weight + ' '
            + fontStyle.size + 'px "' + fontStyle.family + '"';
        textRect = textRect || textContain.getBoundingRect(text, font, align, verticalAlign, style.textPadding, style.textLineHeight);
        var m = this.transform;
        if (m && !fromTextEl) {
            tmpRect.copy(rect);
            tmpRect.applyTransform(m);
            rect = tmpRect;
        }
        if (!fromTextEl) {
            var textPosition = style.textPosition;
            if (textPosition instanceof Array) {
                x = rect.x + parsePercent(textPosition[0], rect.width);
                y = rect.y + parsePercent(textPosition[1], rect.height);
                align = align || 'left';
            }
            else {
                var res = this.calculateTextPosition
                    ? this.calculateTextPosition({}, style, rect)
                    : textContain.calculateTextPosition({}, style, rect);
                x = res.x;
                y = res.y;
                align = align || res.align;
                verticalAlign = verticalAlign || res.verticalAlign;
            }
        }
        else {
            x = rect.x;
            y = rect.y;
        }
        x = textContain.adjustTextX(x, textRect.width, align);
        y = textContain.adjustTextY(y, textRect.height, verticalAlign);
        y += textRect.height / 2;
        var createNode = vmlCore.createNode;
        var textVmlEl = this._textVmlEl;
        var pathEl;
        var textPathEl;
        var skewEl;
        if (!textVmlEl) {
            textVmlEl = createNode('line');
            pathEl = createNode('path');
            textPathEl = createNode('textpath');
            skewEl = createNode('skew');
            textPathEl.style['v-text-align'] = 'left';
            initRootElStyle(textVmlEl);
            pathEl.textpathok = true;
            textPathEl.on = true;
            textVmlEl.from = '0 0';
            textVmlEl.to = '1000 0.05';
            append(textVmlEl, skewEl);
            append(textVmlEl, pathEl);
            append(textVmlEl, textPathEl);
            this._textVmlEl = textVmlEl;
        }
        else {
            skewEl = textVmlEl.firstChild;
            pathEl = skewEl.nextSibling;
            textPathEl = pathEl.nextSibling;
        }
        var coords = [x, y];
        var textVmlElStyle = textVmlEl.style;
        if (m && fromTextEl) {
            applyTransform(coords, coords, m);
            skewEl.on = true;
            skewEl.matrix = m[0].toFixed(3) + comma + m[2].toFixed(3) + comma
                + m[1].toFixed(3) + comma + m[3].toFixed(3) + ',0,0';
            skewEl.offset = (round(coords[0]) || 0) + ',' + (round(coords[1]) || 0);
            skewEl.origin = '0 0';
            textVmlElStyle.left = '0px';
            textVmlElStyle.top = '0px';
        }
        else {
            skewEl.on = false;
            textVmlElStyle.left = round(x) + 'px';
            textVmlElStyle.top = round(y) + 'px';
        }
        textPathEl.string = encodeHtmlAttribute(text);
        try {
            textPathEl.style.font = font;
        }
        catch (e) { }
        updateFillAndStroke(textVmlEl, 'fill', {
            fill: style.textFill,
            opacity: style.opacity
        }, this);
        updateFillAndStroke(textVmlEl, 'stroke', {
            stroke: style.textStroke,
            opacity: style.opacity,
            lineDash: style.lineDash || null
        }, this);
        textVmlEl.style.zIndex = getZIndex(this.zlevel, this.z, this.z2);
        append(vmlRoot, textVmlEl);
    };
    var removeRectText = function (vmlRoot) {
        remove(vmlRoot, this._textVmlEl);
        this._textVmlEl = null;
    };
    var appendRectText = function (vmlRoot) {
        append(vmlRoot, this._textVmlEl);
    };
    var list = [RectText, Displayable, ZRImage, Path, Text];
    for (var i = 0; i < list.length; i++) {
        var proto = list[i].prototype;
        proto.drawRectText = drawRectText;
        proto.removeRectText = removeRectText;
        proto.appendRectText = appendRectText;
    }
    Text.prototype.brushVML = function (vmlRoot) {
        var style = this.style;
        if (style.text != null) {
            this.drawRectText(vmlRoot, {
                x: style.x || 0, y: style.y || 0,
                width: 0, height: 0
            }, this.getBoundingRect(), true);
        }
        else {
            this.removeRectText(vmlRoot);
        }
    };
    Text.prototype.onRemove = function (vmlRoot) {
        this.removeRectText(vmlRoot);
    };
    Text.prototype.onAdd = function (vmlRoot) {
        this.appendRectText(vmlRoot);
    };
}
