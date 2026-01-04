import React from 'react';
import Anchor, { AnchorProps, AnchorState } from '.';

export type AnchorContextType = Pick<AnchorProps, 'showTooltip' | 'position' | 'autoCollapse' | 'size'>
& Pick<AnchorState, 'activeLink'>
& Pick<Anchor, 'addLink' | 'removeLink' | 'childMap'>
& {
    onClick: Anchor['handleClick']
};

const AnchorContext = React.createContext<AnchorContextType>(null);

export default AnchorContext;
