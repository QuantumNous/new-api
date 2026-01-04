import { strings } from '@douyinfe/semi-foundation/avatar/constants';
import { get, filter } from 'lodash-es';

const DEFAULT_COLORS = filter(strings.COLOR, color => color !== 'white' && color !== 'yellow');

export function getColorByName(name, defuatlColor = '', colors = DEFAULT_COLORS) {
    if (name && typeof name === 'string') {
        const colorLength = colors.length;
        return get(
            colors,
            name
                .split()
                .map((char, index) => (char.charCodeAt(0) % colorLength) + index)
                .reduce((prev, cur) => (prev * cur) % colorLength, 1) % colorLength,
            defuatlColor
        );
    }
    return defuatlColor;
}

/**
 *
 * @param {Object} data
 * @param {string} path
 * @param {string} localeCode
 * @returns {any}
 */
export const getLocaleValue = (data, path, localeCode = 'zh-CN') => {
    const finalPath = path + (localeCode === 'zh-CN' ? '' : `_${ localeCode.replace(/\-/, '_')}`);
    return get(data, finalPath) || get(data, path) || '';
};

export const getScreenshot = data => {
    const latestVersion = get(data, 'npmInfo.latestVersion');
    const latestVersionInfo = get(data, ['npmInfo', 'versions', latestVersion]);
    if (!latestVersionInfo) {
        return '';
    }
    const template = Boolean(latestVersionInfo.templateConfig);
    if (!latestVersionInfo.blockConfig && !latestVersionInfo.templateConfig) {
        return '';
    }
    const cover = get(data, 'cover');

    if (cover) {
        return cover;
    }
    const screenshots = get(latestVersionInfo, [template ? 'templateConfig' : 'blockConfig', 'screenshots']);
    return Array.isArray(screenshots) && screenshots[0]
        ? screenshots[0]
        : `https://unpkg.byted-static.com/${data.name.replace(/@/, '')}/${latestVersion}/screenshots/screenshot.jpg`;
};
