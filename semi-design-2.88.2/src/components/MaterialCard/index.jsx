/* eslint-disable max-lines-per-function */
import React, { useState, useCallback, useMemo, useRef } from 'react';
import * as _ from 'lodash-es';
import PropTypes from 'prop-types';
import classnames from 'classnames';
import { FormattedMessage } from 'react-intl';
import { Icon, Tooltip, Avatar, AvatarGroup, Typography } from '@douyinfe/semi-ui';
import { IconImport } from '@douyinfe/semi-icons';

import styles from './index.module.scss';
import { getLocaleValue, getScreenshot, getColorByName } from './utils';

const { Title, Text } = Typography;

const Block = ({ onClick, data = {}, localeCode = 'zh-CN', type = 1 }) => {
    const [hovering, setHovering] = useState(false);
    const wrapRef = useRef();
    const handleMouseOver = useCallback(
        e => {
            if (!hovering) {
                setHovering(true);
            }
        },
        [hovering]
    );
    const handleMouseOut = useCallback(
        e => {
            if (hovering) {
                setHovering(false);
            }
        },
        [hovering]
    );

    const authors = useMemo(() => {
        const maintainers = [];
        const group = _.get(data, 'group');
        if (group && typeof group === 'object') {
            maintainers.push({ ...group });
        } else {
            maintainers.push(..._.get(data, 'maintainers', []));
        }

        const names = maintainers.map(
            item => getLocaleValue(item, 'nickname', localeCode) || getLocaleValue(item, 'name', localeCode)
        );

        return (
            <>
                <AvatarGroup size={'extra-small'} className={styles.avatar}>
                    {maintainers.map((item, index) => (
                        <Avatar
                            color={getColorByName(item.name, 'cyan')}
                            src={item.avatar}
                            key={item.name}
                        >
                            {_.slice(names[index], 0, 1)}
                        </Avatar>
                    ))}
                </AvatarGroup>
                <span className={styles['author-name']}>{names.join(',')}</span>
            </>
        );
    }, [localeCode, data]);

    // const categoryText = useMemo(() => getLocaleValue(data, 'category.text', localeCode), [data, localeCode]);
    const title = useMemo(() => getLocaleValue(data, 'title', localeCode), [data, localeCode]);
    const version = useMemo(() => `v${getLocaleValue(data, 'npmInfo.latestVersion')}`, [data]);
    const testingStatus = useMemo(() => {
        const latestVersion = _.get(data, 'npmInfo.latestVersion', '');
        const testing = [/beta/i, /alpha/i].some(reg => reg.test(latestVersion));
        return testing ? (
            <Tooltip content={<FormattedMessage id={'app.block.testing'} />}>
                <div className={styles['testing-status']} />
            </Tooltip>
        ) : null;
    }, [data, localeCode]);
    const downloads = useMemo(() => (
        <Text className={styles.downloads}>
            <IconImport className={styles.icon} size={'small'} />
            <span>{_.get(data, 'npmInfo.downloads.all', 0)}</span>
        </Text>
    ), [data, localeCode]);
    const coverUrl = useMemo(() => getScreenshot(data), [data, hovering]);
    const videoIcon = useMemo(() => {
        if (data && data.coverGif) {
            return (
                <div className={styles['video-icon']}>
                    <Icon size={'small'} type={'video'} />
                </div>
            );
        }
        return null;
    }, [data]);

    return (
        <section
            className={styles.block}
            key={data && data.id}
            onMouseOver={handleMouseOver}
            onMouseOut={handleMouseOut}
            ref={wrapRef}
        >
            <div className={styles.content} onClick={onClick}>
                <div className={styles['screenshot-box']}>
                    {videoIcon}
                    {data.coverGif ? (
                        <div
                            className={classnames(styles.screenshot)}
                            style={{ backgroundImage: `url(${data.coverGif})`, display: hovering ? '' : 'none' }}
                        />
                    ) : null}
                    <div
                        className={classnames(styles.screenshot)}
                        style={{ backgroundImage: `url(${coverUrl})`, display: hovering && data.coverGif ? 'none' : '' }}
                    />
                </div>
                <div className={styles['info-box']}>
                    <div className={styles.name}>
                        {testingStatus}
                        <Title heading={5} ellipsis={{ showTooltip: true }} style={{ maxWidth: 144 }}>
                            {title}
                        </Title>
                        <Text className={styles.version} ellipsis={{ showTooltip: true }} style={{ maxWidth: 84 }}>
                            {version}
                        </Text>
                    </div>
                    <div className={styles['stats-wrap']}>
                        <div className={styles.author}>{authors}</div>
                        {downloads}
                    </div>
                </div>
            </div>
        </section>
    );
};

Block.propTypes = {
    onClick: PropTypes.func,
    data: PropTypes.object,
};

export default Block;
