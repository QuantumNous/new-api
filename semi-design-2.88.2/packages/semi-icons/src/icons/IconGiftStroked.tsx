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
                d="M8 3a3 3 0 0 0-2.83 4H3a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8h1a1 1 0 0 0 1-1V8a1 1 0 0 0-1-1h-2.17A3 3 0 0 0 16 3h-2c-.77 0-1.47.29-2 .76A2.99 2.99 0 0 0 10 3H8Zm5 6h7v2h-7V9Zm-2 0H4v2h7V9Zm0 4H6v7h5v-7Zm2 7h5v-7h-5v7ZM11 6v1H8a1 1 0 0 1 0-2h2a1 1 0 0 1 1 1Zm6 0a1 1 0 0 1-1 1h-3V6a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'gift_stroked');
export default IconComponent;
