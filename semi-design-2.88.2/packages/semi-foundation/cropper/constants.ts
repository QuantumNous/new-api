import { BASE_CLASS_PREFIX } from '../base/constants';

const moduleName = `${BASE_CLASS_PREFIX}-cropper`;

const cssClasses = {
    PREFIX: `${moduleName}`,
    IMG: `${moduleName}-img`,
    IMG_WRAPPER: `${moduleName}-img-wrapper`,
    CROPPER_BOX: `${moduleName}-box`,
    CROPPER_VIEW_BOX: `${moduleName}-view-box`,
    CROPPER_VIEW_BOX_ROUND: `${moduleName}-view-box-round`,
    CROPPER_IMG: `${moduleName}-view-img`,
    MASK: `${moduleName}-mask`,
    CORNER: `${moduleName}-box-corner`,
};

const strings = {
    shape: ['rect', 'round', 'roundRect'],
    corner: ['tl', 'tm', 'tr',
        'ml', 'mr',
        'bl', 'bm', 'br'],
    roundCorner: ['tm', 'ml', 'mr', 'bm'],

};

export { cssClasses, strings };
