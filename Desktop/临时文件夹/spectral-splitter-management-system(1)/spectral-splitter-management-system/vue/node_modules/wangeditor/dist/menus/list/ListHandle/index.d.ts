import { DomElement } from '../../../utils/dom-core';
import WrapListHandle from './WrapListHandle';
import JoinListHandle from './JoinListHandle';
import StartJoinListHandle from './StartJoinListHandle';
import EndJoinListHandle from './EndJoinListHandle';
import OtherListHandle from './OtherListHandle';
import { HandlerListOptions } from './ListHandle';
export declare type ContainerFragment = HTMLElement | DocumentFragment;
export declare type ListHandleClass = WrapListHandle | JoinListHandle | StartJoinListHandle | EndJoinListHandle | OtherListHandle;
export declare enum ClassType {
    Wrap = "WrapListHandle",
    Join = "JoinListHandle",
    StartJoin = "StartJoinListHandle",
    EndJoin = "EndJoinListHandle",
    Other = "OtherListHandle"
}
export declare function createListHandle(classType: ClassType, options: HandlerListOptions, range?: Range): ListHandleClass;
/**
 * 统一执行的接口
 */
export default class ListHandleCommand {
    private handle;
    constructor(handle: ListHandleClass);
    getSelectionRangeElem(): DomElement;
}
