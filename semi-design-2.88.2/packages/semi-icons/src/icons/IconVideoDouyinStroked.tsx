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
                d="M4 2a2 2 0 0 0-2 2v16c0 1.1.9 2 2 2h8a1 1 0 1 0 0-2H4V4h16v7a1 1 0 1 0 2 0V4a2 2 0 0 0-2-2H4Zm5.5 5.13A1 1 0 0 0 8 8v8a1 1 0 0 0 1.5.87l7-4a1 1 0 0 0 0-1.74l-7-4ZM13.98 12 10 14.28V9.72L13.98 12Zm6 2h-1.36v5.4a1.13 1.13 0 1 1-.76-1.11v-1.4a2.5 2.5 0 1 0 2.12 2.47v-2.69c.53.38 1.19.6 1.9.6v-1.35a1.9 1.9 0 0 1-1.9-1.9V14Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'video_douyin_stroked');
export default IconComponent;
