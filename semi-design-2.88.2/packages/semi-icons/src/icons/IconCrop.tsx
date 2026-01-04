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
                d="M21.5 19a1.5 1.5 0 0 0 0-3H19V8c0-1.5-1.5-3-3-3H8V2.5a1.5 1.5 0 1 0-3 0V5H2.5a1.5 1.5 0 1 0 0 3H5v8c0 1.5 1.5 3 3 3h8v2.5a1.5 1.5 0 0 0 3 0V19h2.5ZM16 16V9a1 1 0 0 0-1-1H8v7a1 1 0 0 0 1 1h7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'crop');
export default IconComponent;
