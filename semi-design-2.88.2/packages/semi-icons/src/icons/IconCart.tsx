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
                d="M.5 4c0-.83.67-1.5 1.5-1.5h3c.74 0 1.37.54 1.48 1.27L6.68 5h15.07a1 1 0 0 1 .98 1.22l-1.56 7a1 1 0 0 1-.97.78H8.06l.23 1.5H19a1.5 1.5 0 0 1 0 3H7a1.5 1.5 0 0 1-1.48-1.27L3.72 5.5H2A1.5 1.5 0 0 1 .5 4ZM9 23a2 2 0 1 0 0-4 2 2 0 0 0 0 4Zm9 0a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'cart');
export default IconComponent;
