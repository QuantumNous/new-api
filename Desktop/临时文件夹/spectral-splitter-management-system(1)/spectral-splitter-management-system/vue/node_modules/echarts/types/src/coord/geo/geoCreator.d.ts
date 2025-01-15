import Geo from './Geo.js';
import { GeoOption, RegoinOption } from './GeoModel.js';
import { MapSeriesOption } from '../../chart/map/MapSeries.js';
import ExtensionAPI from '../../core/ExtensionAPI.js';
import { CoordinateSystemCreator } from '../CoordinateSystem.js';
import { NameMap } from './geoTypes.js';
import GlobalModel from '../../model/Global.js';
import ComponentModel from '../../model/Component.js';
export declare type resizeGeoType = typeof resizeGeo;
/**
 * Resize method bound to the geo
 */
declare function resizeGeo(this: Geo, geoModel: ComponentModel<GeoOption | MapSeriesOption>, api: ExtensionAPI): void;
declare class GeoCreator implements CoordinateSystemCreator {
    dimensions: string[];
    create(ecModel: GlobalModel, api: ExtensionAPI): Geo[];
    /**
     * Fill given regions array
     */
    getFilledRegions(originRegionArr: RegoinOption[], mapName: string, nameMap: NameMap, nameProperty: string): RegoinOption[];
}
declare const geoCreator: GeoCreator;
export default geoCreator;
