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
                d="M11 3a1 1 0 1 1 2 0v2h7a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-7v2h4a1 1 0 0 1 1 1v4a1 1 0 0 1-1 1h-4v2a1 1 0 1 1-2 0v-2H7a1 1 0 0 1-1-1v-4a1 1 0 0 1 1-1h4v-2H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h7V3Zm1 14h4v-2H8v2h4Zm7-8H5V7h14v2Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_h_center_stroked');
export default IconComponent;
