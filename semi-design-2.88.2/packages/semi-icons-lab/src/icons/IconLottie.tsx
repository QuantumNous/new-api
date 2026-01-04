import * as React from 'react';
import { convertIcon } from '../components/Icon';
function SvgComponent(props: React.SVGProps<SVGSVGElement>) {
    return (
        <svg
            viewBox="0 0 22 18"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            width="1em"
            height="1em"
            focusable={false}
            aria-hidden={true}
            {...props}
        >
            <rect width={22} height={18} rx={2} fill="#F9FCFF" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M18 0h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-2V0Zm3 2v2h-2V2h2Zm0 6V6h-2v2h2Zm0 2v2h-2v-2h2Zm0 6v-2h-2v2h2Z"
                fill="#AEB2BE"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M0 2C0 .9.9 0 2 0h2v18H2a2 2 0 0 1-2-2V2Zm3 0v2H1V2h2Zm0 6V6H1v2h2Zm0 2v2H1v-2h2Zm0 6v-2H1v2h2Z"
                fill="#AEB2BE"
            />
            <path d="M14.5 5c-2 0-4 .36-4 4 0 3.5-1.5 5-4 5" stroke="#AEB2BE" />
            <rect x={14} y={4} width={2} height={2} fill="#F77C93" />
            <rect x={6} y={13} width={2} height={2} fill="#F8CE27" />
            <path
                d="M6.83 9.21c0-.01.03-.02.04 0l.3.51.02.01.6.1c.01 0 .02.03 0 .04l-.51.3-.01.02-.1.6c0 .01-.03.02-.04 0l-.3-.51-.02-.01-.6-.1a.02.02 0 0 1 0-.04l.51-.3.01-.02.1-.6Z"
                fill="#F8CE27"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'lottie');
export default IconComponent;
