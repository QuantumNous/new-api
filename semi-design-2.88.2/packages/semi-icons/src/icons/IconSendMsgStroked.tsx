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
                d="M1 4c0-1.1.9-2 2-2h18a2 2 0 0 1 2 2v13a2 2 0 0 1-2 2h-9.22L7 21.86A1 1 0 0 1 5.5 21v-2H3a2 2 0 0 1-2-2V4Zm20 0H3v13h3c.83 0 1.5.67 1.5 1.5v.73l3.25-1.95a2 2 0 0 1 1.03-.28H21V4Zm-7.7 3.3a1 1 0 0 1 1.4 0l3 3a1 1 0 0 1 0 1.4l-3 3a1 1 0 0 1-1.4-1.4l1.29-1.3H8a1 1 0 1 1 0-2h6.59l-1.3-1.3a1 1 0 0 1 0-1.4Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'send_msg_stroked');
export default IconComponent;
