import { isString, isArray, isNumber } from 'lodash';

/**
 * Get the splited array.
 * We expect separators to be string | string[] | null, but users
 * are also allowed to pass in other types. 
 */
const getSplitedArray = (originString: string, separators: string | string[] | null) => {
    let splitedValue: string | string[] = [];
    if (isString(separators) || isNumber(separators)) {
        splitedValue = originString.split(separators as string);
    } else if (isArray(separators)) {
        const tempChar = separators[0]; // temporary splitter
        splitedValue = originString;
        for (let i = 1; i < separators.length; i++) {
            splitedValue = splitedValue.split(separators[i]).join(tempChar);
        }
        splitedValue = splitedValue.split(tempChar);
    } else {
        splitedValue.push(originString);
    }
    return splitedValue;
};

export default getSplitedArray;
