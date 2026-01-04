import React, { useState, useCallback } from 'react';
import { set, get, isString } from 'lodash-es';
import ChangeLogDiff from '../ChangeLogDiff';
import { getVersion } from '../ChangeLogDiff/utils';
import { getLocale } from '../../utils/locale';
import { getChangeLogData as getChangeLogDataReq } from '../../services';

export default function SemiSiteChangeLogDiff(props) {
    const { style, hoverContent, currentComponent, ...rest } = props;
    const [data, setData] = useState([]);
    const locale = getLocale();
    const version = isString(hoverContent) ? getVersion(hoverContent) : undefined;

    const handleClick = useCallback(() => {
        if (window.__semi__ && window.__semi__.changeLog) {
            setData(window.__semi__.changeLog);
        } else {
            (async () => {
                const totalData = await getChangeLogDataReq();
                const localeChangeLogData = get(totalData, locale, []);
                setData(localeChangeLogData);
                set(window, '__semi__.changeLog', localeChangeLogData);
            })();
        }
    }, [locale]);

    return (
        <ChangeLogDiff
            {...rest}
            currentVersion={version}
            currentComponent={currentComponent}
            style={style}
            data={data}
            onClick={handleClick}
        />
    );
}
