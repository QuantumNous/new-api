/**
 * @description 所有菜单的构造函数
 * @author wangfupeng
 */

import Bold from './bold/index'
import Head from './head/index'
import Link from './link/index'
import Italic from './italic/index'
import Underline from './underline/index'
import StrikeThrough from './strike-through/index'
import FontStyle from './font-style/index'
import FontSize from './font-size'
import Justify from './justify/index'
import Quote from './quote/index'
import BackColor from './back-color/index'
import FontColor from './font-color/index'
import Video from './video/index'
import Image from './img/index'
import Indent from './indent/index'
import Emoticon from './emoticon/index'
import List from './list/index'
import LineHeight from './lineHeight/index'
import Undo from './undo/index'
import Redo from './redo/index'
import Table from './table/index'
import Code from './code'
import SplitLine from './split-line/index'
import Todo from './todo'

export type MenuListType = {
    [key: string]: any
}

export default {
    bold: Bold,
    head: Head,
    italic: Italic,
    link: Link,
    underline: Underline,
    strikeThrough: StrikeThrough,
    fontName: FontStyle,
    fontSize: FontSize,
    justify: Justify,
    quote: Quote,
    backColor: BackColor,
    foreColor: FontColor,
    video: Video,
    image: Image,
    indent: Indent,
    emoticon: Emoticon,
    list: List,
    lineHeight: LineHeight,
    undo: Undo,
    redo: Redo,
    table: Table,
    code: Code,
    splitLine: SplitLine,
    todo: Todo,
}
