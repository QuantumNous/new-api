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
                d="M3.5 2.5C4.33 2.5 5 3.17 5 4v6.5h6V4a1.5 1.5 0 0 1 3 0v16a1.5 1.5 0 0 1-3 0v-6.5H5V20a1.5 1.5 0 0 1-3 0V4c0-.83.67-1.5 1.5-1.5Z"
                fill="currentColor"
            />
            <path
                d="M16.8 19.82c0 .76.53 1.28 1.33 1.28.54 0 .92-.26 1.22-.82l2.8-5.32c.43-.82.58-1.34.58-1.95 0-.8-.58-1.34-1.43-1.34h-4.65c-.8 0-1.3.44-1.3 1.12 0 .68.5 1.1 1.3 1.1h3.19v.02l-2.82 5.16c-.15.27-.23.52-.23.75Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'h7');
export default IconComponent;
