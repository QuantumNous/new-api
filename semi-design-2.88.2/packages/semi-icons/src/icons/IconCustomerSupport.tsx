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
                d="M6.08 8a6 6 0 0 1 11.84 0A1 1 0 0 0 17 9v7a1 1 0 0 0 1 1h.53a4.5 4.5 0 0 1-3.67 2.49A1 1 0 0 0 14 19h-4a1 1 0 0 0-1 1v1a1 1 0 0 0 1 1h4a1 1 0 0 0 .87-.51 6.5 6.5 0 0 0 5.84-4.58A3 3 0 0 0 23 14v-3a3 3 0 0 0-3-3h-.06A8 8 0 0 0 4.06 8H4a3 3 0 0 0-3 3v3a3 3 0 0 0 3 3h2a1 1 0 0 0 1-1V9a1 1 0 0 0-.92-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'customer_support');
export default IconComponent;
