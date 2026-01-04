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
                d="M5 2a3 3 0 0 0-3 3v3h20c0-2-1-4-3-4h-6.45a3 3 0 0 1-1.87-.66l-1.13-.9A2 2 0 0 0 8.3 2H5Z"
                fill="currentColor"
            />
            <path d="M22 10H2v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9Z" fill="currentColor" />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'folder');
export default IconComponent;
