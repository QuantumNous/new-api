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
                d="M3 2a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1H3Zm1 5V4h7v3H4Zm8 8a1 1 0 0 0-1 1v5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-5a1 1 0 0 0-1-1h-9Zm1 5v-3h7v3h-7Zm2-17a1 1 0 0 1 1-1h5a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1h-5a1 1 0 0 1-1-1V3Zm2 1v7h3V4h-3ZM3 11a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H3Zm1 9v-7h3v7H4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'component_placeholder_stroked');
export default IconComponent;
