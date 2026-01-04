import React, { useState, useEffect, ReactNode } from 'react';
import Collapsible from '../collapsible';

interface NodeCollapsibleProps {
    key?: string;
    open?: boolean;
    motion?: boolean;
    duration?: number;
    onMotionEnd?: () => void;
    children?: ReactNode
}

function NodeCollapsible(props: NodeCollapsibleProps) {
    const { open, children, ...rest } = props;
    const [isOpen, setIsOpen] = useState(props.open);

    useEffect(() => {
        // Why do we need to change isOPen value in setTimeout？
        // Because when NodeCollapsible ComponentDidMount, the domHeight in Collapsible has not been given
        setTimeout(() => {
            setIsOpen(!props.open);
        }, 0);
    }, []);
    
    return (<Collapsible
        {...rest}
        isOpen={isOpen}
    >
        {children}
    </Collapsible>);
}

export default NodeCollapsible;
