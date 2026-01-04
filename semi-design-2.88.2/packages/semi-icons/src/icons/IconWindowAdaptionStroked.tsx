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
                d="M14 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v6a1 1 0 1 1-2 0V4h-5a1 1 0 0 1-1-1Zm-4 18a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1v-6a1 1 0 1 1 2 0v5h5a1 1 0 0 1 1 1ZM2 9a1 1 0 0 0 2 0V4h5a1 1 0 1 0 0-2H3a1 1 0 0 0-1 1v6Zm19 5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1h-6a1 1 0 1 1 0-2h5v-5a1 1 0 0 1 1-1ZM8.5 7.5a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-7Zm1 7v-5h5v5h-5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'window_adaption_stroked');
export default IconComponent;
