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
                d="M11.94 22a1.5 1.5 0 0 1-1.5-1.5v-9.38L8.06 13.5a1.5 1.5 0 1 1-2.12-2.12l4.94-4.94a1.5 1.5 0 0 1 2.12 0l5.06 5.06a1.5 1.5 0 1 1-2.12 2.12l-2.5-2.5v9.38c0 .83-.67 1.5-1.5 1.5Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M19.44 2a1.5 1.5 0 1 1 0 3h-15a1.5 1.5 0 1 1 0-3h15Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'align_top');
export default IconComponent;
