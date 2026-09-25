import type { IBackgroundSpec, IBackgroundStyleSpec } from '../../typings';
export declare function convertBackgroundSpec(bg: IBackgroundSpec): Omit<IBackgroundStyleSpec, 'image'> & {
    background?: IBackgroundStyleSpec['image'];
};
