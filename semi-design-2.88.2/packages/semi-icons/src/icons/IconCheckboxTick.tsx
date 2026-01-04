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
                d="M17.41 7.3c.66.51.78 1.45.28 2.11l-6.5 8.5a1.5 1.5 0 0 1-2.37.01l-3.5-4.5a1.5 1.5 0 1 1 2.36-1.84L10 14.54l5.32-6.95a1.5 1.5 0 0 1 2.1-.28Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'checkbox_tick');
export default IconComponent;
