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
                d="M21 4a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2h18ZM6 8a1 1 0 0 0 0 2h1v5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1H6Zm10 0a1 1 0 1 0 0 2h1v5a1 1 0 1 0 2 0V9a1 1 0 0 0-1-1h-2Zm-3.5 5a1 1 0 1 0 0 2 1 1 0 0 0 0-2Zm0-4a1 1 0 1 0 0 2 1 1 0 0 0 0-2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'real_size');
export default IconComponent;
