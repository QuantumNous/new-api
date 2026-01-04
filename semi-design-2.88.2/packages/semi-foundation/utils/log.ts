import { get } from 'lodash';

const log = (text: any, ...rest: any[]) => {
    if (get(process, 'env.NODE_ENV') === 'development') {
        console.log(text, ...rest);
    }
};
export default log;