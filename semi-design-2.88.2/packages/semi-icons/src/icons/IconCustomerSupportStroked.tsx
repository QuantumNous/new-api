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
                d="M7 8a5 5 0 0 1 10 0v8a5 5 0 0 1-2.17 4.12.5.5 0 0 0-.33-.12h-4a.5.5 0 0 0-.5.5v2c0 .28.22.5.5.5h4a.5.5 0 0 0 .5-.5v-.17A7 7 0 0 0 18.93 17H21a1 1 0 0 0 1-1v-6a1 1 0 0 0-1-1h-2V8A7 7 0 1 0 5 8v1H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1V8Zm-3 7v-4h1v4H4Zm15-4v4h1v-4h-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'customer_support_stroked');
export default IconComponent;
