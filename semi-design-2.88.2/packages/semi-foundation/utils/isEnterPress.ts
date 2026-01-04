import { get } from 'lodash';
import { ENTER_KEY } from './keyCode';

function isEnterPress<T extends { key: string }>(e: T) {
    return get(e, 'key') === ENTER_KEY ? true : false;
}

export default isEnterPress;