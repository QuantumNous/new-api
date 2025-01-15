/**
 * @description 常量
 * @author wangfupeng
 */

export function EMPTY_FN() {}

//用于校验是否为url格式字符串
export const urlRegex = /(http|ftp|https):\/\/[\w\-_]+(\.[\w\-_]+)+([\w\-.,@?^=%&amp;:/~+#]*[\w\-@?^=%&amp;/~+#])?/g

// 编辑器为了方便继续输入/换行等原因 主动生成的空标签
export const EMPTY_P = '<p data-we-empty-p=""><br></p>'

// 用于校验dom中最后 由编辑器主动生成的空标签结构
export const EMPTY_P_LAST_REGEX = /<p data-we-empty-p=""><br\/?><\/p>$/gim

// 用于校验dom中所有 由编辑器主动生成的空标签结构
export const EMPTY_P_REGEX = /<p data-we-empty-p="">/gim
