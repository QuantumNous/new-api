import { Exec, HandlerListOptions, ListHandle } from './ListHandle';
/**
 * 选区在序列内的处理
 */
export default class WrapListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions);
    exec(): void;
}
