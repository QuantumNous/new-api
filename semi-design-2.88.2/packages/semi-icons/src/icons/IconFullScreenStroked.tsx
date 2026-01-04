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
                d="M11.2 11.2a1 1 0 0 1-1.4 0L4 5.42V9a1 1 0 1 1-2 0V3a1 1 0 0 1 .29-.7v-.01A1 1 0 0 1 3 2H9a1 1 0 0 1 0 2H5.41l5.8 5.8a1 1 0 0 1 0 1.4Zm1.6 1.6a1 1 0 0 1 1.4 0l5.8 5.79V15a1 1 0 1 1 2 0v6a1 1 0 0 1-.29.7v.01a1 1 0 0 1-.7.29H15a1 1 0 1 1 0-2h3.59l-5.8-5.8a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'full_screen_stroked');
export default IconComponent;
