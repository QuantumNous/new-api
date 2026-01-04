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
                d="M16.07 1h-3.8V16.13A3.17 3.17 0 1 1 10.14 13v-3.9a6.98 6.98 0 1 0 5.94 6.91V8.47a9.05 9.05 0 0 0 5.3 1.7V6.37a5.3 5.3 0 0 1-5.3-5.31V1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'tiktok_logo');
export default IconComponent;
