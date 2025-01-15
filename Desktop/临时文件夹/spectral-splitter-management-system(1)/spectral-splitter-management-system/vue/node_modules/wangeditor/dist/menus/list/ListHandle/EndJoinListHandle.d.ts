import { Exec, HandlerListOptions, ListHandle } from './ListHandle';
export default class EndJoinListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions);
    exec(): void;
}
