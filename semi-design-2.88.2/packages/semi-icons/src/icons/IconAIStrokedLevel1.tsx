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
                d="M9.68 5.45c.22-1.1 1.8-1.1 2.02 0a8.79 8.79 0 0 0 6.85 6.85c1.1.22 1.1 1.8 0 2.02a8.79 8.79 0 0 0-6.85 6.85c-.22 1.1-1.8 1.1-2.02 0a8.79 8.79 0 0 0-6.85-6.85c-1.1-.22-1.1-1.8 0-2.02a8.79 8.79 0 0 0 6.85-6.85Zm1.01 2.96a10.73 10.73 0 0 1-4.9 4.9 10.73 10.73 0 0 1 4.9 4.9 10.73 10.73 0 0 1 4.9-4.9 10.73 10.73 0 0 1-4.9-4.9Zm7.47-6.8c.16-.81 1.31-.81 1.48 0a3.54 3.54 0 0 0 2.76 2.75c.8.17.8 1.32 0 1.48a3.54 3.54 0 0 0-2.76 2.76c-.17.8-1.32.8-1.48 0a3.54 3.54 0 0 0-2.76-2.76c-.8-.16-.8-1.31 0-1.48a3.54 3.54 0 0 0 2.76-2.76Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ai_stroked_level_1');
export default IconComponent;
