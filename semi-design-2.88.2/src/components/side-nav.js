import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { Nav, Icon, Tag } from '@douyinfe/semi-ui';
import { withPrefix, Link } from 'gatsby';
import { getLocale } from 'utils/locale';
import IconMap from '../images/docIcons';

const SideNav = ({ location = null, type = null, itemsArr, edges, style, hasBanner }) => {
    const [selectedKeys, setSelectedKeys] = useState([]);
    const [subNavMotion, setSubNavMotion] = useState(false);

    const [openKeys, setOpenKeys] = useState(itemsArr.map(item => item.itemKey));

    let localeCode = getLocale(location.pathname);

    function getNavData(itemsArr) {
        let navData = itemsArr.map(item => {
            let text = localeCode === 'zh-CN' ? item.text : item.textUs;
            return { ...item, maxHeight: 2500, text };
        });
        edges.forEach(item => {
            let { node } = item;
            const IconNode = IconMap[node.frontmatter.icon];
            const categoryIndex = navData.findIndex(item => item.itemKey === node.fields.type);
            let shouldInsert = false;
            if (localeCode === 'zh-CN') {
                shouldInsert = localeCode === node.frontmatter.localeCode || !node.frontmatter.localeCode;
            } else {
                shouldInsert = localeCode === node.frontmatter.localeCode;
            }
            if (shouldInsert) {
                navData[categoryIndex].items = navData[categoryIndex].items || [];
                navData[categoryIndex].items.push({
                    itemKey: `/${node.fields.slug}`,
                    text: node.frontmatter.showNew ? <div style={{ display: 'flex', alignItems: 'center' }}><span>{node.frontmatter.title}</span> <Tag color='purple' size='small' style={{ marginLeft: 4 }}>New</Tag></div> : node.frontmatter.title,
                    icon: <Icon svg={<IconNode />} size={'extra-large'} aria-hidden={true} /> || '',
                    order: node.frontmatter.order || 0,
                    // link: `/${node.fields.slug}`,
                    // linkOptions: {
                    //     onClick: (e) => {
                    //         e.preventDefault();
                    //     }
                    // },
                    category: navData[categoryIndex].text || navData[categoryIndex].textUs,
                });
                navData[categoryIndex].items.sort((a, b) => a.order - b.order);
            }
        });
        return navData.map(category=>{
            const { items, ...rest } = category;
            return (
                <Nav.Sub {...rest} key={rest.itemKey}>
                    {items?.map(item=>{
                        return (
                            <Link to={item.itemKey} key={item.itemKey} >
                                <Nav.Item {...item} tabIndex={-1} />
                            </Link>
                        );
                    })}
                </Nav.Sub>
            );
        });
    }

    const computedNavData = useMemo(() => getNavData(itemsArr), [itemsArr, localeCode]);

    useEffect(() => {
    // build: should be /dv/zh-CN/components/button
    // dev: should be /zh-CN/components/button

        const { pathname } = window.location;
        let newSelectedKeys = [];
        if (process.env.NODE_ENV === 'development') {
            newSelectedKeys = [pathname];
        } else {
            let prefix = withPrefix('/');
            let path = pathname.replace(prefix, '/');
            newSelectedKeys = [path];
        }
        if (JSON.stringify(selectedKeys) !== JSON.stringify(newSelectedKeys)) {
            setSelectedKeys(newSelectedKeys);
        }
    }, [location]);

    useEffect(() => {
        setSubNavMotion(true);
    }, []);


    const onNavSelect = ({ itemKey, selectedKeys }) => {
        window?.__semi__?.Tea?.eventHappened('mainSiteNavClicked', itemKey);
    };

    const onOpenChange = ({ openKeys }) => {
        setOpenKeys([...openKeys]);
    };

    return (
        <div id="side-nav" className={'side-nav'} style={style}>
            <Nav
                style={{
                    width: '100%',
                    height: hasBanner ? 'calc(100% - 92px)' : 'calc(100% - 60px)',
                    minWidth: 240,
                    maxWidth: 280,
                }}
                subNavMotion={subNavMotion}
                bodyStyle={{ height: '100%' }}
                onSelect={onNavSelect}
                selectedKeys={selectedKeys}
                onOpenChange={onOpenChange}
                defaultOpenKeys={computedNavData.map(item => item.itemKey)}
                openKeys={openKeys}
            >
                {computedNavData}
            </Nav>
        </div>
    );
};

export default SideNav;
