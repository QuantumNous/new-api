import React, { useState, useEffect, useMemo, ReactElement } from 'react';
import axios from 'axios';
import { Tabs, Table } from '@douyinfe/semi-ui';
import { useIntl } from 'react-intl';
import { Link } from 'gatsby';
import lodash from 'lodash-es';
interface Props {
    componentName?: string;
    isColorPalette?: boolean;
    reg?: RegExp;
    isAnimation?: boolean;
    hasTab?: boolean;
    sameWidth?: boolean
}

interface Token {
    key: string;
    value: string;
    category: string;
    raw: string
}

interface DesignToken {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    global: {
        global: {
            light: Token[];
            dark: Token[]
        };
        palette: {
            light: Token[];
            dark: Token[]
        };
        normal: Token[];
        animation: Token[]
    };
    [key: string]: Token[]

}


interface TokenMayWithColor extends Token {
    color?: string
}


const JumpLink = ({ value, availableKeySet }: { value: string; availableKeySet: Set<string> }): ReactElement => {
    const { locale } = useIntl();
    const originValue = value;
    if (value.startsWith('var')) {
        const { length } = value;
        value = value.slice(4, length - 1);
    }
    const params = new URLSearchParams();
    params.append('token', lodash.trim(value, '$'));
    if (availableKeySet.has(value)) {
        return <Link to={`/${locale}/basic/tokens?${params.toString()}`} style={{ display: 'block' }}>{originValue}</Link>;
    } else {
        return <div>{originValue}</div>;
    }
};

const TokenTable = ({ tokenList, designToken, currentTab, mode = 'light', sameWidth }: { mode?: 'light' | 'dark'; tokenList: TokenMayWithColor[]; designToken: DesignToken; currentTab?: string; sameWidth?: boolean }): React.ReactElement => {
    const intl = useIntl();
    const globalTokenJumpAvailableSet = useMemo(() => {
        const global = designToken?.global;
        const set = new Set(global?.global?.light.map(token => token.key)
            .concat(global?.normal?.map(token => token.key)));
        return set;
    }, [designToken]);
    const columns = useMemo(() => [
        {
            title: intl.formatMessage({ id: 'designToken.variable' }),
            dataIndex: 'key',
            render: (text: string, record: TokenMayWithColor): React.ReactElement => {
                const { color } = record;
                if (color) {
                    return (
                        <div data-token={lodash.trim(text, '$')} style={{ fontWeight: 600 }}> <div style={{
                            width: 16, height: 16, display: 'inline-block', borderRadius: 3, background: color,
                            transform: 'translateY(0.3rem)', marginRight: 8
                        }} className={mode === 'dark' ? 'semi-always-dark' : 'semi-always-light'}
                        /> {text}
                        </div>
                    );
                } else {
                    return <div data-token={lodash.trim(text, '$')} style={{ fontWeight: 600 }}>{text}</div>;
                }

            },
            width: sameWidth ? '33%' : 'undefined'
        },
        {
            title: intl.formatMessage({ id: 'designToken.defaultValue' }),
            dataIndex: 'value',
            render: (text: string): React.ReactElement => <JumpLink availableKeySet={globalTokenJumpAvailableSet} value={text} />,
            width: sameWidth ? '33%' : 'undefined'
        },
        {
            title: intl.formatMessage({ id: 'designToken.usage' }),
            dataIndex: 'comment',
            width: sameWidth ? '33%' : 'undefined',
            render: (text: string): React.ReactElement =>
                <div>{text || intl.formatMessage({ id: 'designToken.WIP' })}</div>
        },

    ], [intl.locale, mode]);
    if (!tokenList) {
        return null;
    }
    return <Table key={currentTab} columns={columns} dataSource={tokenList} />;
};

const TokenTab = ({ designToken, componentName }: { designToken: DesignToken; componentName: string }): React.ReactElement => {
    const componentDesignTokenList = useMemo(() => designToken[componentName], [designToken, componentName]);
    const tabList = useMemo(() => {
        const categorySet = new Set();
        componentDesignTokenList?.forEach(oneToken => categorySet.add(oneToken.category));
        return Array.from(categorySet).sort().map(category => ({ tab: category, itemKey: category }));
    }, [componentDesignTokenList]);
    const [currentTab, setCurrentTab] = useState(tabList[0]?.itemKey);

    const tokenList = useMemo(() =>
        designToken[componentName]?.filter((token: Token) => token.category === currentTab), [currentTab]);

    return (
        <div>
            <Tabs tabList={tabList} onChange={(key: string): void => setCurrentTab(key)}>
                <TokenTable designToken={designToken} tokenList={tokenList} currentTab={currentTab as string} />
            </Tabs>
        </div>
    );
};

const GlobalTokenTab = ({ designToken, isColorPalette = false, reg, hasTab: hasTabInProps = true, sameWidth }: { designToken: DesignToken; isColorPalette?: boolean; reg: RegExp; hasTab?: boolean; sameWidth?: boolean }): React.ReactElement => {
    const { global, palette, normal } = designToken.global;
    const [currentTab, setCurrentTab] = useState<'light' | 'dark'>('light');
    const [hasTab, setHasTab] = useState(true);
    const tokenList: TokenMayWithColor[] = useMemo(() => {
        if (!isColorPalette) {
            const modeFilteredTokenListOfGlobal: Token[] = global[currentTab].filter((token: Token) => reg.test(token.key));
            const normalTokenList: Token[] = normal.filter((token: Token) => reg.test(token.key));
            if ((modeFilteredTokenListOfGlobal.length !== 0) !== hasTab) {
                setHasTab(!hasTab);
            }
            return [...modeFilteredTokenListOfGlobal, ...normalTokenList].map((token: TokenMayWithColor): TokenMayWithColor => {
                if (token.key.startsWith('--semi-color')) {
                    token.color = token.value;
                }
                return token;
            });
        } else {
            return [];
        }
    }, [currentTab]);

    return (
        <>
            {hasTab && hasTabInProps ? (
                <Tabs defaultActiveKey={'light'} tabList={[{ tab: 'Light', itemKey: 'light' }, { tab: 'Dark', itemKey: 'dark' }]} onChange={(key: typeof currentTab): void => setCurrentTab(key)}>
                    <TokenTable designToken={designToken} tokenList={tokenList} mode={currentTab} sameWidth={sameWidth}/>
                </Tabs>
            ) : <TokenTable designToken={designToken} tokenList={tokenList} mode={currentTab} />}
        </>
    );
};


const GlobalAnimationToken = ({ designToken }: { designToken: DesignToken }) => {
    const animationList = useMemo(() => designToken?.global?.animation ?? [], [designToken]);
    const tokenMap = useMemo(() => {
        const tokenMap = {};
        animationList.forEach(token => {
            const tab = token['key'].match(/--semi-transition_([\w\W]+)-/)?.[1] ?? "other";
            tokenMap[tab] = [...(tokenMap[tab] ?? []), token];
        });
        return tokenMap;
    }, [animationList]);



    return <>
        <Tabs defaultActiveKey={Object.keys(tokenMap)[0]} >
            {Object.entries(tokenMap).map(([category, tokenList]) => {
                return <Tabs.TabPane tab={category} itemKey={category} key={category}>
                    <TokenTable designToken={designToken} tokenList={tokenList} />
                </Tabs.TabPane>;
            })}
        </Tabs>
    </>;




};


const DesignToken = (props: Props): React.ReactElement => {

    const [componentName, setComponentName] = useState(props.componentName?.toLowerCase());
    const [designToken, setDesignToken] = useState<DesignToken>(null);
    useEffect(() => {
        if (!componentName) {
            const componentNameFromUrl = lodash.nth(window.location.pathname.split('/'), -1);
            setComponentName(componentNameFromUrl.toLowerCase());
        }
    }, []);

    useEffect(() => {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        if (window?.__semi__?.designToken) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            setDesignToken(window?.__semi__?.designToken);
        } else {
            (async (): Promise<void> => {
                const { data: designTokenFromServer } = await axios.get('/designToken.json');
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                window.__semi__ = {
                    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                    // @ts-ignore
                    ...window.__semi__,
                    designToken: designTokenFromServer
                };
                setDesignToken(designTokenFromServer);
            })();
        }
    }, []);

    return (
        <div>
            {designToken && componentName && !props.isAnimation && (props.componentName === 'global' ?
                <GlobalTokenTab designToken={designToken} reg={props.reg} isColorPalette={props.isColorPalette} hasTab={props?.hasTab} sameWidth={props?.sameWidth}/> :
                <TokenTab designToken={designToken} componentName={componentName} />)}

            {
                props.isAnimation && <GlobalAnimationToken designToken={designToken} />
            }
        </div>
    );
};

export default DesignToken;
