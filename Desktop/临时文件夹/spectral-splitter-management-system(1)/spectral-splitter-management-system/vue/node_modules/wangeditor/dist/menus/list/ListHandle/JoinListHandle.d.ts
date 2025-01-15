import { Exec, HandlerListOptions, ListHandle } from './ListHandle';
export default class JoinListHandle extends ListHandle implements Exec {
    constructor(options: HandlerListOptions);
    exec(): void;
}
