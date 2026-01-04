import React from 'react';
import { Resizable } from 'react-resizable';

export interface ResizableHeaderCellProps {
    [x: string]: any;
    onResize?: ResizeFn;
    onResizeStart?: ResizeFn;
    onResizeStop?: ResizeFn;
    width?: number | string;
    /** For compatibility with previous versions, the default value is true. If you don't want to resize, set it to false */
    resize?: boolean
}

class ResizableHeaderCell extends React.PureComponent<ResizableHeaderCellProps> {
    render() {
        const { onResize, onResizeStart, onResizeStop, width, resize, ...restProps } = this.props;

        if (typeof width !== 'number' || resize === false) {
            return <th {...restProps} />;
        }

        let { children } = restProps;

        // Fragment must be used here, otherwise there will be an error (seemingly a react-resizable@1.9.0 problem)
        children = React.Children.map(children, (child, index) => <React.Fragment key={index}>{child}</React.Fragment>);

        return (
            <Resizable
                width={width as number}
                height={0}
                onResize={onResize}
                onResizeStart={onResizeStart}
                onResizeStop={onResizeStop}
                draggableOpts={{ enableUserSelectHack: false }}
                axis='x'
            >
                <th {...restProps}>
                    {children}
                </th>
            </Resizable>
        );
    }
}

export type ResizeFn = (e: React.SyntheticEvent) => any;

export default ResizableHeaderCell;
