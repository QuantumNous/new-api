import React, { useMemo, useState } from 'react';
import { useStaticQuery, graphql } from 'gatsby';
import { Tabs, TabPane, Input, Typography, Tag } from '@douyinfe/semi-ui';
import { IconSearch } from '@douyinfe/semi-icons';
import { groupBy, toPairs, sortBy, partition } from 'lodash-es';
import { FormattedMessage } from 'react-intl';
import IconCategory from './IconCategory';
import './index.scss';

const _t = id => <FormattedMessage id={id} />;

function sortAIGroup(obj) {
    return [
        ['One Color', obj['One Color']],
        ['Two Color', obj['Two Color']],
        ['Multiple Color', obj['Multiple Color']],
    ];
}

const IconList = props => {

    const data = useStaticQuery(graphql`
        query {
            semiIconNodeType {
                iconData {
                  name
                  category
                }
                iconLabData {
                  name
                  category
                }
                pkgJson {
                  name
                  version
                  description
                  author
                  homepage
                  main
                  module
                  license
                  _unpkg
                }
              }
        }
    `);
    const { iconData, pkgJson, iconLabData } = data.semiIconNodeType;

    const [iconFilterData, setIconFilterData] = useState(iconData);
    const [iconLabFilterData, setIconLabFilterData] = useState(iconLabData);

    const search = keyword => {
        const lowerKeyword = keyword.toLowerCase();
        const res = iconData.filter(icon => icon.name.toLowerCase().includes(lowerKeyword) || icon.category.toLowerCase().includes(lowerKeyword));
        const labRes = iconLabFilterData.filter(icon => icon.name.toLowerCase().includes(lowerKeyword) || icon.category.toLowerCase().includes(lowerKeyword));
        setIconFilterData(res);
        setIconLabFilterData(labRes);
    };

    const { fillGroups, strokedGroups, fillIcons, strokedIcons, labGroups, aiGroups } = useMemo(() => {
        const [aiIcons, otherIcons] = partition(iconFilterData, item => ['One Color', 'Two Color', 'Multiple Color'].includes(item.category));
        const fillIcons = otherIcons.filter(i => !/Stroked$/.test(i.name));
        const strokedIcons = otherIcons.filter(i => /Stroked$/.test(i.name));
        const fillGroups = sortBy(toPairs(groupBy(fillIcons, 'category')), ['0']);
        const strokedGroups = sortBy(toPairs(groupBy(strokedIcons, 'category')), ['0']);
        const aiGroups = sortAIGroup(groupBy(aiIcons, 'category'));

        const labIcons = iconLabFilterData;
        const labGroups = sortBy(toPairs(groupBy(labIcons, 'category')), ['0']);

        return {
            fillGroups,
            strokedGroups,
            fillIcons,
            strokedIcons,
            labGroups,
            aiGroups,
        };
    }, [iconFilterData, iconLabFilterData]);

    return (
        <div className="semi-icons-container">
            <div>
                <img style={{ marginRight: 8 }} src={`https://badgen.net/badge/${encodeURIComponent(pkgJson.name)}/${pkgJson.version}?blue`} alt="" />
                <img src={`https://badgen.net/badge/count/${iconData.length}/blue`} alt="" />
                <img style={{ marginRight: 8, marginLeft: 24 }} src={`https://badgen.net/badge/%40douyinfe%2Fsemi-icons-lab/${pkgJson.version}?color=cyan`} alt="" />
                <img src={`https://badgen.net/badge/count/${iconLabData.length}/cyan`} alt="" />
            </div>
            <Tabs keepDOM >
                <TabPane tab={_t('icon.list.tab.fill')} itemKey="fill"><IconCategory groups={fillGroups} pkgType='default' /></TabPane>
                <TabPane tab={_t('icon.list.tab.stroked')} itemKey="stroked"><IconCategory groups={strokedGroups} pkgType='default' /></TabPane>
                <TabPane tab={<div style={{ display: 'flex', alignItems: 'center', columnGap: 5 }}>{_t('icon.list.tab.ai')}<Tag size="large" shape='square' color='purple'>New</Tag></div>} itemKey="ai"><IconCategory groups={aiGroups} pkgType='default' className="icon-ai"/></TabPane>
            </Tabs>
            <Typography.Title heading={2}>{_t('icon.list.tab.lab')}</Typography.Title>
            <IconCategory groups={labGroups} pkgType='lab' />
        </div>
    );
};

export default IconList;
