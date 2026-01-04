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
                d="M3.5 2.5C4.33 2.5 5 3.17 5 4v6.5h6V4a1.5 1.5 0 0 1 3 0v16a1.5 1.5 0 0 1-3 0v-6.5H5V20a1.5 1.5 0 0 1-3 0V4c0-.83.67-1.5 1.5-1.5Z"
                fill="currentColor"
            />
            <path
                d="M14.95 16.3c0 1.49.37 2.76 1.07 3.6.7.86 1.72 1.3 2.96 1.3 2.2 0 3.7-1.35 3.7-3.4 0-1.77-1.18-3-2.87-3-.97 0-1.81.5-2.15 1.3h-.06c0-1.57.53-2.45 1.57-2.45.38 0 .68.1 1.1.37.45.28.72.38 1.07.38.62 0 1.04-.39 1.04-.96 0-.46-.31-.94-.84-1.3a4.35 4.35 0 0 0-2.4-.63c-2.67 0-4.19 1.74-4.19 4.79Zm2.94 1.6c0-.66.46-1.15 1.07-1.15.6 0 1.04.48 1.04 1.15 0 .7-.44 1.18-1.04 1.18-.6 0-1.07-.49-1.07-1.18Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h6');
export default IconComponent;
