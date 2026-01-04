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
                d="M3 12a9 9 0 0 1 18 0 1 1 0 1 0 2 0 11 11 0 1 0-11 11 1 1 0 1 0 0-2 9 9 0 0 1-9-9Zm5.17-5.2a1 1 0 0 1 1.41 0L12 9.2l2.42-2.42a1 1 0 1 1 1.41 1.42l-2.3 2.29h2.22a1 1 0 1 1 0 2H13v1h2.75a1 1 0 1 1 0 2H13v2a1 1 0 1 1-2 0v-2H8.25a1 1 0 1 1 0-2H11v-1H8.25a1 1 0 1 1 0-2h2.21l-2.3-2.3a1 1 0 0 1 0-1.4Zm11.8 8.92c.3-.3.77-.3 1.06 0l1.5 1.5A.75.75 0 0 1 22 18.5h-6a.75.75 0 0 1 0-1.5h4.19l-.22-.22a.75.75 0 0 1 0-1.06Zm-3 7.06a.75.75 0 1 0 1.06-1.06l-.22-.22H22a.75.75 0 0 0 0-1.5h-6a.75.75 0 0 0-.53 1.28l1.5 1.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'money_exchange_stroked');
export default IconComponent;
