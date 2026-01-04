import { Anchor } from '@douyinfe/semi-ui';
import React from 'react';
import { makeAnchorId } from '../../utils';


const PageAnchor = props => {
    const { layer = 1 } = {};
    const { data = [] } = props;

    const getAnchorLink = (data, currentLayer = 1) => {
        if (currentLayer > Number(layer)) {
            return null;
        }

        return data.map(item => {
            return (
                <span
                    key={item.title}
                >
                    <Anchor.Link href={'#' + makeAnchorId(item.url) } title={item.title} key={item.title} />
                </span>
            );
        });
    };

    return (
        <Anchor showTooltip scrollMotion offsetTop={200} className="category-anchor" targetOffset={100}>
            {getAnchorLink(data)}
        </Anchor>
    );
};

export default PageAnchor;
