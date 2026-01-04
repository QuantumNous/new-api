import { Anchor } from '@douyinfe/semi-ui';
import React from 'react';
import sha1 from 'sha1';
import './index.scss';

const makeAnchorId = id => {
    if (typeof id === 'object') {
        return null;
    }
    if (!id) {
        return null;
    }
    return 'sha1' + sha1(id);
};

const PageAnchor = props => {
    const { layer = 1 } = {};
    const { data = [] } = props;

    const getAnchorLink = (data, currentLayer = 1) => {
        if (currentLayer > Number(layer)) {
            return null;
        }

        return data.map(item => {
            if (layer && Array.isArray(item.items)) {
                return (
                    <span
                        key={item.title}
                        onClickCapture={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const iframeDOM = document.querySelector('iframe');
                            const dom = iframeDOM?.contentWindow?.document?.querySelector(
                                '#' + makeAnchorId(item.title)
                            );
                            dom?.scrollIntoView();
                        }}
                    >
                        <Anchor.Link href={'#' + makeAnchorId(item.title)} title={item.title} key={item.title}>
                            {getAnchorLink(item.items, currentLayer + 1)}
                        </Anchor.Link>
                    </span>
                );
            } else {
                return (
                    <span
                        key={item.title}
                        onClickCapture={e => {
                            e.preventDefault();
                            e.stopPropagation();
                            const iframeDOM = document.querySelector('iframe');
                            const dom = iframeDOM?.contentWindow?.document?.querySelector(
                                '#' + makeAnchorId(item.title)
                            );
                            dom?.scrollIntoView();
                        }}
                    >
                        <Anchor.Link href={'#' + makeAnchorId(item.title)} title={item.title} key={item.title} />
                    </span>
                );
            }
        });
    };

    return (
        <Anchor showTooltip scrollMotion offsetTop={200} className="category-anchor" targetOffset={100}>
            {getAnchorLink(data)}
        </Anchor>
    );
};

export default PageAnchor;
