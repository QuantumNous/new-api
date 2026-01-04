import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 24 24"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <path
                d="M17 2a1 1 0 0 0-1 1v16h-2v-9a1 1 0 0 0-1-1h-2a1 1 0 0 0-1 1v9H8V8a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v11H3a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h18a1 1 0 0 0 1-1v-1a1 1 0 0 0-1-1h-1V3a1 1 0 0 0-1-1h-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'histogram');
export default IconComponent;
