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
                d="M13.62 5.04a1 1 0 1 0 1.42-1.42L12.7 1.3a1 1 0 0 0-1.42 0L8.96 3.62a1 1 0 0 0 1.42 1.42L11 4.4V11H4.41l.63-.62a1 1 0 1 0-1.42-1.42L1.3 11.3a1 1 0 0 0 0 1.42l2.33 2.33a1 1 0 0 0 1.42-1.42L4.4 13H11v6.59l-.62-.63a1 1 0 0 0-1.42 1.42l2.33 2.33a1 1 0 0 0 1.42 0l2.33-2.33a1 1 0 0 0-1.42-1.42l-.62.63V13h6.59l-.63.62a1 1 0 0 0 1.42 1.42l2.33-2.33a1 1 0 0 0 0-1.42l-2.33-2.33a1 1 0 1 0-1.42 1.42l.63.62H13V4.41l.62.63Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'absolute_stroked');
export default IconComponent;
