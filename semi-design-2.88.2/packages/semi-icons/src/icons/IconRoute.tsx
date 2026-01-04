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
                fillRule="evenodd"
                clipRule="evenodd"
                d="m10.14 1.88-8.26 8.26a3 3 0 0 0 0 4.24l8.26 8.26a3 3 0 0 0 4.24 0l8.26-8.26a3 3 0 0 0 0-4.24l-8.26-8.26a3 3 0 0 0-4.24 0Zm4.82 5.67a1 1 0 1 0-1.41 1.41l1.3 1.3h-5.6a1 1 0 0 0-1 1v5a1 1 0 0 0 2 0v-4h4.6l-1.3 1.29a1 1 0 1 0 1.41 1.41l3-3a1 1 0 0 0 0-1.41l-3-3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'route');
export default IconComponent;
