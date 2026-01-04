/* eslint-disable max-lines-per-function */

/* eslint-disable no-nested-ternary */
import React, { useState, useCallback, useEffect, useRef } from 'react';
import PropTypes from 'prop-types';
import { FormattedMessage } from 'react-intl';
import { Button, Modal, Space, Select, Empty, Spin, Typography, InputGroup } from '@douyinfe/semi-ui';
import { isString, capitalize, get } from 'lodash-es';
import { IllustrationIdle, IllustrationIdleDark } from '@douyinfe/semi-illustrations';
import { CHANGELOG_TYPE_MAP } from './constant';
import { isVersionBetween } from './utils';
import './index.scss';
import { IconActivity } from '@douyinfe/semi-icons';
const { Option } = Select;
const { Title } = Typography;

const _t = id => <FormattedMessage id={id} />;

const ALL_TYPES = Object.keys(CHANGELOG_TYPE_MAP);
const DEFAULT_MODAL_HEIGHT = 642;
export default function ChangeLogDiff(props) {
    const { style, className, currentVersion = '', currentComponent = '', data = [], onClick } = props;
    const allComponents = Array.from(new Set(data.map(item => item.component)));
    const versionList = Array.from(new Set(data.map(item => item.version)));
    const defaultVersion1 = currentVersion ? currentVersion : versionList[0];
    const [version1, setVersion1] = useState(defaultVersion1);
    const [version2, setVersion2] = useState();
    const [changeComponents, setChangeComponents] = useState(allComponents);
    const [searchComponents, setSearchComponents] = useState(currentComponent.length ? [currentComponent] : []);
    const [visible, setVisible] = useState(false);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState([]);
    const [changeType, setChangeType] = useState([]);
    const [modalHeight, setModalHeight] = useState(DEFAULT_MODAL_HEIGHT);
    const selectRef = useRef();
    useEffect(() => {
        const newVersion = currentVersion ? currentVersion : versionList[0];

        if (newVersion !== version1) {
            setVersion1(newVersion);
        }
    }, [data]);

    const handleCancel = () => {
        setVisible(false);
    };

    const handleShowModal = () => {
        onClick();
        setVisible(true);
        setTimeout(() => {
            selectRef.current.open();
            selectRef.current.focus();
        }, 1000);
    };

    const filterData = useCallback(
        (v1, v2, components, types) => {
            const componentsSet = new Set(components.map(item => capitalize(item)));
            const typesSet = new Set(types);
            return data.filter(item => {
                const { version, component } = item;

                if (componentsSet.has(component) && isVersionBetween(version, v1, v2) && typesSet.has(item.type)) {
                    return true;
                }

                return false;
            });
        },
        [data]
    ); // version 变化时，进行搜索

    const handleSearch = useCallback(
        (v1, v2, components, types) => {
            setLoading(true);
            setTimeout(() => {
                // 更新版本时不过滤组件
                const componentsIsValid = Array.isArray(components) && components.length;
                const filterComponent = componentsIsValid ? components : allComponents;
                const filterType = Array.isArray(types) && types.length > 0 ? types : ALL_TYPES;
                const searchResult = filterData(v1, v2, filterComponent, filterType);
                // searchResult.sort((a, b) => (a.component < b.component ? -1 : 1)); // remove component name sort

                if (!componentsIsValid) {
                    const newComponentList = Array.from(new Set(searchResult.map(item => item.component)));
                    setChangeComponents(newComponentList);
                    setSearchComponents([]);
                }

                setResult(searchResult);

                if (searchResult.length > 15) {
                    setModalHeight('85vh');
                }

                setLoading(false);
            }, 300);
        },
        [filterData, allComponents]
    );

    const handleVersion1Change = version => {
        setVersion1(version);

        if (version2) {
            handleSearch(version, version2, currentComponent ? [currentComponent] : [], changeType);
        }
    };

    const handleVersion2Change = version => {
        setVersion2(version);

        if (version1) {
            handleSearch(version1, version, currentComponent ? [currentComponent] : [], changeType);
        }
    };

    const handleComponentsChange = components => {
        setSearchComponents(components);

        if (version1 && version2) {
            handleSearch(version1, version2, currentComponent ? [currentComponent] : components, changeType);
        }
    };

    const handleTypeChange = types => {
        setChangeType(types);
        handleSearch(version1, version2, searchComponents, types);
    };

    const getDataByType = data => {
        let dataSet = {};

        for (let item of data) {
            const { type } = item;

            if (type in dataSet) {
                dataSet[type].push(item);
            } else {
                dataSet[type] = [item];
            }
        }

        return dataSet;
    };

    const ChangeLogContent = ({ data }) => {
        const typeDataObj = getDataByType(data);
        return Object.entries(typeDataObj)
            .sort((a, b) => {
                const [aType] = a;
                const [bType] = b;
                const aIndex = ALL_TYPES.indexOf(aType);
                const bIndex = ALL_TYPES.indexOf(bType);
                return aIndex - bIndex;
            })
            .map(item => {
                const [type, list] = item;
                const logTitle = get(CHANGELOG_TYPE_MAP, type, capitalize(type));
                return (
                    <section className="changelog-content-section" key={type}>
                        <Title className="changelog-content-type" heading={3}>
                            {logTitle}
                        </Title>
                        <ul className="changelog-content-ul">
                            {list.map((log, index) => (
                                <li
                                    key={index}
                                    className="changelog-content-li"
                                    style={{
                                        marginLeft: (log.level - 1) * 24,
                                    }} // eslint-disable-next-line react/no-danger
                                    dangerouslySetInnerHTML={{
                                        __html: log.content,
                                    }}
                                />
                            ))}
                        </ul>
                    </section>
                );
            });
    };

    const ChangeLog = ({ loading: searching, data }) => {
        if (searching) {
            return (
                <div
                    style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginTop: 48,
                    }}
                >
                    <Spin />
                </div>
            );
        }

        return Array.isArray(data) && data.length ? (
            <ChangeLogContent data={data} />
        ) : (
            <Empty
                image={<IllustrationIdle />}
                darkModeImage={<IllustrationIdleDark />}
                title={_t('changelog.diff.empty')}
                imageStyle={{
                    width: 200,
                }}
                style={{
                    marginTop: 32,
                }}
            />
        );
    };

    const modalTitlePrefix =
        isString(currentComponent) && currentComponent.length ? `${capitalize(currentComponent)} ` : '';
    const modalTitle = (
        <div>
            {modalTitlePrefix}
            {_t('changelog.diff.title')}
        </div>
    );
    const cls = `changelog-diff ${className}`;
    return (
        <div className={cls} style={style}>
            <Button className="changelog-diff-btn" icon={<IconActivity />} onClick={handleShowModal}>
                {_t('changelog.diff.button')}
            </Button>
            <Modal
                className="changelog-diff-modal"
                title={modalTitle}
                visible={visible}
                onCancel={handleCancel}
                width={920}
                height={modalHeight}
                bodyStyle={{
                    height: 'calc(100% - 72px)',
                    minHeight: DEFAULT_MODAL_HEIGHT - 72,
                }}
                closeOnEsc
                footer={null}
            >
                <Space
                    className="changelog-diff-select"
                    style={{
                        marginBottom: 40,
                        marginLeft: 16,
                    }}
                    spacing={12}
                >
                    <InputGroup>
                        <Select
                            style={{
                                width: 182,
                            }}
                            insetLabel={(
                                <div
                                    style={{
                                        marginLeft: 12,
                                    }}
                                >
                                    {_t('changelog.diff.version1.insetLabel')}
                                </div>
                            )}
                            placeholder={_t('changelog.diff.version.placeholder')}
                            value={version1}
                            onChange={handleVersion1Change}
                            filter={true}
                        >
                            {versionList
                                .filter(version => version !== version2)
                                .map(version => (
                                    <Option key={version} value={version}>
                                        {version}
                                    </Option>
                                ))}
                        </Select>
                        <Select
                            style={{
                                width: 182,
                            }}
                            insetLabel={(
                                <div
                                    style={{
                                        marginLeft: 12,
                                    }}
                                >
                                    {_t('changelog.diff.version2.insetLabel')}
                                </div>
                            )}
                            placeholder={_t('changelog.diff.version.placeholder')}
                            onChange={handleVersion2Change}
                            value={version2}
                            ref={selectRef}
                            filter={true}
                        >
                            {versionList
                                .filter(version => version !== version1)
                                .map(version => (
                                    <Option key={version} value={version}>
                                        {version}
                                    </Option>
                                ))}
                        </Select>
                    </InputGroup>
                    {!(modalTitlePrefix.length > 0) && (
                        <Select
                            style={{
                                width: 220,
                            }}
                            multiple
                            maxTagCount={1}
                            insetLabel={(
                                <div
                                    style={{
                                        marginLeft: 12,
                                    }}
                                >
                                    {_t('changelog.diff.change.insetLabel')}
                                </div>
                            )}
                            placeholder={_t('changelog.diff.change.all')}
                            onChange={handleComponentsChange}
                            value={searchComponents}
                            showClear
                        >
                            {changeComponents.map(component => (
                                <Option key={component} value={component}>
                                    {component}
                                </Option>
                            ))}
                        </Select>
                    )}
                    <Select
                        style={{
                            width: 220,
                        }}
                        insetLabel={(
                            <div
                                style={{
                                    marginLeft: 12,
                                }}
                            >
                                {_t('changelog.diff.type.insetLabel')}
                            </div>
                        )}
                        placeholder={_t('changelog.diff.change.all')}
                        value={changeType}
                        onChange={handleTypeChange}
                        multiple
                        maxTagCount={1}
                        showClear
                    >
                        {ALL_TYPES.map(type => (
                            <Option key={type} value={type}>
                                {capitalize(type)}
                            </Option>
                        ))}
                    </Select>
                </Space>
                <div className="changelog-diff-content">
                    {version1 && version2 && <ChangeLog loading={loading} data={result} />}
                </div>
            </Modal>
        </div>
    );
}
ChangeLogDiff.propTypes = {
    style: PropTypes.object,
    className: PropTypes.string,
    currentVersion: PropTypes.string,
    currentComponent: PropTypes.string,
    data: PropTypes.arrayOf(
        PropTypes.shape({
            version: PropTypes.string,
            type: PropTypes.string,
            content: PropTypes.string,
            component: PropTypes.string,
            level: PropTypes.number,
        })
    ),
    onClick: PropTypes.func,
};
