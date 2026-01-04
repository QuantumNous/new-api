import React, { useEffect, useRef, useState } from 'react';
import { useIntl } from 'react-intl';
import { useStaticQuery, graphql, withPrefix, navigate } from 'gatsby';

function processData(data) {
    let res = {};
    for (let item of data.allMdx.edges) {
        res[item.node.frontmatter.title] = item.node.fields.slug;
    }
    return res;
}

const ComponentCard = props => {
    const intl = useIntl();
    const data = processData(
        useStaticQuery(graphql`
            query {
                allMdx {
                    edges {
                        node {
                            fields {
                                slug
                            }
                            frontmatter {
                                title
                            }
                        }
                    }
                }
            }
        `)
    );

    const specialUrl = {
        'AIIcon 图标': 'zh-CN/basic/tokens',
        'AIButton 按钮': 'zh-CN/basic/button#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%8C%89%E9%92%AE',
        "AITag 标签": "zh-CN/show/tag#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%A0%87%E7%AD%BE",
        "AIFloatButton 悬浮按钮": "zh-CN/basic/floatbutton#AI%20%E9%A3%8E%E6%A0%BC%20-%20%E5%A4%9A%E5%BD%A9%E6%82%AC%E6%B5%AE%E6%8C%89%E9%92%AE",
        'AIIcon': 'en-US/basic/icon',
        'AIButton': 'en-US/basic/button#AI%20style%20-%20Colorful%20buttons',
        "AITag": "en-US/show/tag#AI%20style%20-%20colorful%20labels",
        "AIFloatButton": "en-US/basic/floatbutton#AI%20style%20-%20Colorful%20floating%20buttons"
    };
    
    const enName = props.name ? props.name.trim().split(' ')[0] : '';
    const locale = intl.locale;
    let lowerCaseEnName = enName.slice(0, 1).toLowerCase() + enName.slice(1);
    let url = '/' + data[props.name.trim()];

    if (lowerCaseEnName === 'icon') {
        lowerCaseEnName = 'icons';
    }

    if (lowerCaseEnName === 'localeProvider') {
        lowerCaseEnName = 'locale';
    }

    // chart在导航栏中的标题并非是组件名称，较特殊，此处单独处理
    if (props.name.trim() === 'VChart 图表') {
        url = '/' + data['Data Visualization 数据可视化'];
    } else if (props.name.trim() === 'VChart') {
        url = '/' + data['Data Visualization'];
    }

    if (specialUrl[props.name.trim()]) {
        url = '/' + specialUrl[props.name.trim()];
    }

    const [inDarkmode, _setInDarkmode] = useState(false);
    const ref = useRef({ inDarkmode: false });
    const setInDarkmode = inDarkmode => {
        _setInDarkmode(inDarkmode);
        ref.current.inDarkmode = inDarkmode;
    };
    let imgUrl = `https://lf3-static.bytednsdoc.com/obj/eden-cn/ptlz_zlp/ljhwZthlaukjlkulzlp/${
        inDarkmode ? 'components-dark' : 'components'
    }/${enName}.${inDarkmode ? 'png' : 'jpg'}`;
    useEffect(() => {
        const targetNode = document.body;
        const listenerConfig = { attributes: true };
        const callback = () => {
            const mode = targetNode.getAttribute('theme-mode');
            if (mode === 'dark' && !ref.current.inDarkmode) {
                setInDarkmode(true);
            } else if (mode === null && ref.current.inDarkmode) {
                setInDarkmode(false);
            }
        };
        const observer = new MutationObserver(callback);
        observer.observe(targetNode, listenerConfig);
        return () => observer.disconnect();
    }, []);
    return (
        <a 
            href={url} 
            onClickCapture={(e) => {
                e.preventDefault();
            }}
        >
            <div
                onClick={(e) => {
                    navigate(url);
                    e.stopPropagation();
                }}
                className="semi-overview-card"
            >
                <img src={imgUrl} className="semi-overview-card-image" />
                <div className="semi-overview-card-text">{props.name}</div>
            </div>
        </a>
    );
};

export default ComponentCard;
