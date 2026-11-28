import type { IComponent } from '../../interface';
import type { ITextGraphicAttribute, IRichTextCharacter, ITextAttribute } from '@visactor/vrender-core';
import type { IOrientType, IPadding } from '../../../typings';
import type { IComponentSpec } from '../../base/interface';

interface ITitleSpecWithoutText extends Omit<IComponentSpec, 'orient'> {
  /**
   * 是否显示标题
   */
  visible?: boolean;
  /**
   * Title位置
   * @default 'top'
   */
  orient?: IOrientType;
  /**
   * 标题左上角x坐标像素值
   */
  x?: number;
  /**
   * 标题左上角y坐标像素值
   */
  y?: number;
  /**
   * 标题宽度
   */
  width?: number;
  /**
   * 标题高度
   */
  height?: number;
  /**
   * 最小宽度，像素值
   */
  minWidth?: number;
  /**
   * 最大宽度，像素值。当文字超过最大宽度时，会自动省略。
   */
  maxWidth?: number;
  /**
   * 最小高度，像素值
   */
  minHeight?: number;
  /**
   * 最大高度，像素值
   */
  maxHeight?: number;
  /**
   * 标题的边距留白
   */
  innerPadding?: IPadding | number | number[];
  /**
   * 文字水平对齐方式
   * 'left' | 'center' | 'right'
   */
  align?: string;
  /**
   * 文字垂直对齐方式
   * 'top' | 'middle' | 'bottom'
   */
  verticalAlign?: string;
  /**
   * 主标题样式
   */
  textStyle?: {
    /**
     * 给主标题设置给定的宽度
     */
    width?: number;
    /**
     * 给主标题设置给定的高度
     */
    height?: number;
    /**
     * 文字水平对齐方式
     * 'left' | 'center' | 'right'
     */
    align?: string;
    /**
     * 文字垂直对齐方式
     * 'top' | 'middle' | 'bottom'
     */
    verticalAlign?: string;
    /**
     * 折行方式
     * 'break-word' | 'break-all' | 'keep-all'
     */
    wordBreak?: ITextAttribute['wordBreak'];
    /**
     * 按照宽度限制自动折行或显示省略号(maxLineWidth)
     * 默认设置为title宽度
     */
    maxLineWidth?: number;
    /**
     * 高度限制控制显示内容及省略号(heightLimit)
     */
    heightLimit?: number;
    /**
     * 按照行数限制显示内容及省略号(lineClamp)
     */
    lineClamp?: number;
    /**
     * 富文本配置（暂时保留旧设置）
     * @deprecated use text & textType instead
     */
    character?: IRichTextCharacter[];
  } & Partial<ITextGraphicAttribute>;
  /**
   * 副标题样式
   */
  subtextStyle?: {
    /** 指定宽度 */
    width?: number;
    /** 指定高度 */
    height?: number;
    /**
     * 文字水平对齐方式
     * 'left' | 'center' | 'right'
     */
    align?: string;
    /**
     * 文字垂直对齐方式
     * 'top' | 'middle' | 'bottom'
     */
    verticalAlign?: string;
    /**
     * 折行方式
     * 'break-word' | 'break-all' | 'keep-all
     */
    wordBreak?: ITextAttribute['wordBreak'];
    /**
     * 按照宽度限制自动折行或显示省略号(maxLineWidth)
     * 默认设置为title宽度
     */
    maxLineWidth?: number;
    /**
     * 高度限制控制显示内容及省略号(heightLimit)
     */
    heightLimit?: number;
    /**
     * 按照行数限制显示内容及省略号(lineClamp)
     */
    lineClamp?: number;
    /**
     * 富文本配置（暂时保留旧设置）
     * @deprecated use subtext & subtextType instead
     */
    character?: IRichTextCharacter[];
  } & Partial<ITextGraphicAttribute>;
}

export type ITitleTextSpec =
  | {
      /**
       * 主标题文本类型
       */
      textType?: 'text';
      /**
       * 主标题文本配置
       */
      text?: string | number | string[] | number[];
    }
  | {
      /**
       * 主标题文本类型（默认类型为text）
       */
      textType: 'rich';
      /**
       * 主标题富文本内容
       */
      text?: IRichTextCharacter[];
    };

export type ISubTitleTextSpec =
  | {
      /**
       * 副标题文本类型
       */
      subtextType?: 'text';
      /**
       * 副标题文本内容
       */
      subtext?: string | number | string[] | number[];
    }
  | {
      /**
       * 副标题文本类型
       */
      subtextType?: 'rich';

      /**
       * 副标题富文本内容
       */
      subtext?: IRichTextCharacter[];
    };

export type ITitleSpec = ITitleSpecWithoutText & ITitleTextSpec & ISubTitleTextSpec;

export type ITitle = IComponent;
