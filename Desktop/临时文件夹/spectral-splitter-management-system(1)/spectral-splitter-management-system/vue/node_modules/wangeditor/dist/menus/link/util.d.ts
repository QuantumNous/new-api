/**
 * 获取除了包裹在整行区域的顶级Node
 * @param node 最外层node下的某个childNode
 * @param topText 最外层node中文本内容
 */
declare function getTopNode(node: Node, topText: string): Node;
/**
 * 生成html的string形式
 * @param tagName 标签名
 * @param content 需要包裹的内容
 */
declare function makeHtmlString(node: Node, content: string): string;
/**
 * 生成开始或者结束位置的html字符片段
 * @param topText 选区所在的行的文本内容
 * @param node 选区给出的node节点
 * @param startPos node文本内容选取的开始位置
 * @param endPos node文本内容选取的结束位置
 */
declare function createPartHtml(topText: string, node: Node, startPos: number, endPost?: number): string;
/**
 * 生成需要插入的html内容的字符串形式
 * @param selection 选区对象
 * @param topNode 选区所在行的顶级node节点
 */
declare function insertHtml(selection: Selection, topNode: Node): string;
export { getTopNode, makeHtmlString, createPartHtml, insertHtml };
