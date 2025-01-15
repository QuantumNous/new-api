/**
 * @description 数据整理
 * @author fangzhicong
 */
import { TargetPosition, DiffNodes, Compile } from '../type';
/**
 * 数据类型
 */
export declare function compileType(data: string): "text" | "node" | "attr";
/**
 * 获取当前的文本内容
 */
export declare function compileValue(data: MutationRecord): string | null;
/**
 * addedNodes/removedNodes
 */
export declare function complieNodes(data: MutationRecord): DiffNodes;
/**
 * addedNodes/removedNodes 的相对位置
 */
export declare function compliePosition(data: MutationRecord): TargetPosition;
/**
 * 将 MutationRecord 转换成自定义格式的数据
 */
export default function compile(data: MutationRecord[]): Compile[];
