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
                d="M13 4a1 1 0 1 0-2 0v9.59l-2.8-2.8a1 1 0 0 0-1.4 1.42l4.5 4.5a1 1 0 0 0 .7.29 1 1 0 0 0 .7-.29l4.5-4.5a1 1 0 0 0-1.4-1.42L13 13.6V4Zm8 9a1 1 0 0 1 1 1v7a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-7a1 1 0 1 1 2 0v6h16v-6a1 1 0 0 1 1-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'download_stroked');
export default IconComponent;
