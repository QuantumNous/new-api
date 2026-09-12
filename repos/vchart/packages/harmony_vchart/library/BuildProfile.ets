/**
 * Use these variables when you tailor your ArkTS code. They must be of the const type.
 */
export const HAR_VERSION = '1.13.5';
export const BUILD_MODE_NAME = 'debug';
export const DEBUG = true;
export const TARGET_NAME = 'default';

/**
 * BuildProfile Class is used only for compatibility purposes.
 */
export default class BuildProfile { 
	static readonly HAR_VERSION = HAR_VERSION;
	static readonly BUILD_MODE_NAME = BUILD_MODE_NAME;
	static readonly DEBUG = DEBUG;
	static readonly TARGET_NAME = TARGET_NAME;
}