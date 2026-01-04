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
                d="M5 4.5V9h.5c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5H3V5h-.5a.5.5 0 0 1-.5-.5v-1c0-.28.22-.5.5-.5h2c.28 0 .5.22.5.5v1Zm3 0c0-.28.22-.5.5-.5h12c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-12a.5.5 0 0 1-.5-.5v-1Zm0 10c0-.28.22-.5.5-.5h12c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-12a.5.5 0 0 1-.5-.5v-1ZM8.5 8a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h7a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-7ZM8 18.5c0-.28.22-.5.5-.5h7c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-7a.5.5 0 0 1-.5-.5v-1Zm-6-5c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5v4a.5.5 0 0 1-.5.5H4v1h1.5c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-4c0-.28.22-.5.5-.5H4v-1H2.5a.5.5 0 0 1-.5-.5v-1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'ordered_list_stroked');
export default IconComponent;
