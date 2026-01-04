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
                d="M8.06 1.94a1.5 1.5 0 1 0-2.12 2.12L7.88 6H5a3 3 0 0 0-3 3v10a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V9a3 3 0 0 0-3-3h-2.88l1.94-1.94a1.5 1.5 0 0 0-2.12-2.12L12 5.88 8.06 1.94Zm1.94 9v6.13c0 .4.45.63.78.41l4.6-3.06a.5.5 0 0 0 0-.84l-4.6-3.06a.5.5 0 0 0-.78.41Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'live');
export default IconComponent;
