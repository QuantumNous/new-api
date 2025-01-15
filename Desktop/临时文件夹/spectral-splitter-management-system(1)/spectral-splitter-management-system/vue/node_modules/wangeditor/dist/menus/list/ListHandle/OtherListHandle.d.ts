import { Exec, HandlerListOptions, ListHandle } from './ListHandle';
export default class OtherListHandle extends ListHandle implements Exec {
    range: Range;
    constructor(options: HandlerListOptions, range: Range);
    exec(): void;
}
