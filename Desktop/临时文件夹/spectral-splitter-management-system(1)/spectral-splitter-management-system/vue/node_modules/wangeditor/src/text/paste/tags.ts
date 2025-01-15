/**
 * @description 粘贴相关的 tags
 * @author wangfupeng
 */

// 忽略的标签
export const IGNORE_TAGS = new Set([
    'doctype',
    '!doctype',
    'html',
    'head',
    'meta',
    'body',
    'script',
    'style',
    'link',
    'frame',
    'iframe',
    'title',
    'svg', // 暂时忽略，有需要再修改
    'center',
    'o:p', // 复制 word 内容包含 o:p 标签
])

// 指定标签必要的属性
export const NECESSARY_ATTRS = new Map([
    ['img', ['src', 'alt']],
    ['a', ['href', 'target']],
    ['td', ['colspan', 'rowspan']],
    ['th', ['colspan', 'rowspan']],
])

// 没有子节点或文本的标签
export const EMPTY_TAGS = new Set([
    'area',
    'base',
    'basefont',
    'br',
    'col',
    'hr',
    'img',
    'input',
    'isindex',
    'embed',
])

// 编辑区域顶级节点
export const TOP_LEVEL_TAGS = new Set([
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'p',
    'ul',
    'ol',
    'table',
    'blockquote', // 引用
    'pre', // 代码
    'hr',
    'form',
])
