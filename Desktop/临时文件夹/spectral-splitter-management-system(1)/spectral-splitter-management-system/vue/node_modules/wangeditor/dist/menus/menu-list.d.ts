/**
 * @description 所有菜单的构造函数
 * @author wangfupeng
 */
import Bold from './bold/index';
import Head from './head/index';
import Link from './link/index';
import Italic from './italic/index';
import Underline from './underline/index';
import StrikeThrough from './strike-through/index';
import FontStyle from './font-style/index';
import FontSize from './font-size';
import Justify from './justify/index';
import Quote from './quote/index';
import BackColor from './back-color/index';
import FontColor from './font-color/index';
import Video from './video/index';
import Image from './img/index';
import Indent from './indent/index';
import Emoticon from './emoticon/index';
import List from './list/index';
import LineHeight from './lineHeight/index';
import Undo from './undo/index';
import Redo from './redo/index';
import Table from './table/index';
import Code from './code';
import SplitLine from './split-line/index';
import Todo from './todo';
export declare type MenuListType = {
    [key: string]: any;
};
declare const _default: {
    bold: typeof Bold;
    head: typeof Head;
    italic: typeof Italic;
    link: typeof Link;
    underline: typeof Underline;
    strikeThrough: typeof StrikeThrough;
    fontName: typeof FontStyle;
    fontSize: typeof FontSize;
    justify: typeof Justify;
    quote: typeof Quote;
    backColor: typeof BackColor;
    foreColor: typeof FontColor;
    video: typeof Video;
    image: typeof Image;
    indent: typeof Indent;
    emoticon: typeof Emoticon;
    list: typeof List;
    lineHeight: typeof LineHeight;
    undo: typeof Undo;
    redo: typeof Redo;
    table: typeof Table;
    code: typeof Code;
    splitLine: typeof SplitLine;
    todo: typeof Todo;
};
export default _default;
