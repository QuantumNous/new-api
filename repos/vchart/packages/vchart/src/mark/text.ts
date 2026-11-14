import { Factory } from './../core/factory';
import type { IComposedTextMarkSpec } from '../typings/visual';
import { BaseMark } from './base/base-mark';
import type { IMarkGraphic, IMarkOption, IMarkStyle } from './interface';
// eslint-disable-next-line no-duplicate-imports
import { MarkTypeEnum } from './interface';
import type { ITextMark, ITextSpec } from './interface/mark';
import type { IGraphic, IRichTextGraphicAttribute, ITextGraphicAttribute } from '@visactor/vrender-core';
import { createRichText, createText, registerRichtext, registerShadowRoot, registerText } from '../vrender-bridge';
import { isObject, isValid } from '@visactor/vutils';

export class TextMark extends BaseMark<IComposedTextMarkSpec> implements ITextMark {
  static readonly type = MarkTypeEnum.text;
  readonly type = TextMark.type;

  protected _textType: 'text' | 'rich' = 'text';
  getTextType() {
    return this._textType;
  }

  constructor(name: string, option: IMarkOption) {
    super(name, option);
  }

  protected _getDefaultStyle() {
    const defaultStyle: IMarkStyle<IComposedTextMarkSpec> = {
      ...super._getDefaultStyle(),
      // TODO: 删除后会有显示问题，待排查
      angle: 0,
      textAlign: 'center',
      lineWidth: 0,
      textConfig: []
    };
    return defaultStyle;
  }

  initStyleWithSpec(spec: ITextSpec<IComposedTextMarkSpec>) {
    super.initStyleWithSpec(spec);
    if (spec.textType) {
      this._textType = spec.textType;
    }
  }

  protected _transformGraphicAttributes(g: IMarkGraphic, attrs: any, groupAttrs?: any) {
    const textAttrs = super._transformGraphicAttributes(g, attrs, groupAttrs);

    const { text } = textAttrs;

    if (isObject(text) && isValid((text as any).text) && (this._textType === 'rich' || (text as any).type === 'rich')) {
      textAttrs.textConfig = (text as any).text;
    }

    return textAttrs;
  }

  protected _createGraphic(attrs: ITextGraphicAttribute | IRichTextGraphicAttribute = {}): IGraphic {
    const { text } = attrs;

    return this._textType === 'rich' || (text as any)?.type === 'rich'
      ? createRichText(attrs as IRichTextGraphicAttribute)
      : createText(attrs as ITextGraphicAttribute);
  }
}

export const registerTextMark = () => {
  Factory.registerMark(TextMark.type, TextMark);
  registerShadowRoot();
  registerText();
  registerRichtext();

  Factory.registerGraphicComponent(MarkTypeEnum.text, createText);
  Factory.registerGraphicComponent('richtext', createRichText);
};
