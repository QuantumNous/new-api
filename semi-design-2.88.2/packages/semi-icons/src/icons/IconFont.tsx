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
                d="M13.37 2.9a1.5 1.5 0 0 0-2.74 0l-7.5 17a1.5 1.5 0 0 0 2.74 1.2L7.68 17h8.64l1.8 4.1a1.5 1.5 0 1 0 2.75-1.2l-7.5-17ZM15 14 12 7.22 9 14h6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'font');
export default IconComponent;
