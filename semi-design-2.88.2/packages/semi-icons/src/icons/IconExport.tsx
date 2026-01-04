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
                d="M11.08.82a1.5 1.5 0 0 1 1.84 0l4.5 3.5a1.5 1.5 0 0 1-1.84 2.36L13.5 5.07V7.5a1.5 1.5 0 0 1-3 0V5.07L8.42 6.68a1.5 1.5 0 0 1-1.84-2.36l4.5-3.5Z"
                fill="currentColor"
            />
            <path
                d="M2 11a3 3 0 0 1 3-3h5.5v6.5a1.5 1.5 0 0 0 3 0V8H19a3 3 0 0 1 3 3v9a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3v-9Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'export');
export default IconComponent;
