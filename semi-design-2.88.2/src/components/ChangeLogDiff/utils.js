import { get } from 'lodash-es';
import { gt, lte } from 'semver';

// eslint-disable-next-line max-len
export const isVersionBetween = (version, version1, version2) => (
    gt(version, version1) && lte(version, version2) ||
    gt(version, version2) && lte(version, version1)
);

export const getVersion = str => {
    const versionReg = /.*((\d{1,2}\.){2}\d{1,2}(-\w+\.\d+)?)/;
    let result = versionReg.exec(str);
    const version = get(result, '1', undefined);
    return version;
};