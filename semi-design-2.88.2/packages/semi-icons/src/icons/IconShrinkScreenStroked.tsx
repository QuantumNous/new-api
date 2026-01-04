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
                d="M3.7 2.3a1 1 0 0 0-1.4 1.4l5.79 5.8H4.5a1 1 0 0 0 0 2h6a1 1 0 0 0 1-1v-6a1 1 0 1 0-2 0v3.59l-5.8-5.8Zm8.88 10.82a1 1 0 0 0-.08.38v6a1 1 0 1 0 2 0v-3.59l5.8 5.8a1 1 0 0 0 1.4-1.42l-5.79-5.79h3.59a1 1 0 1 0 0-2h-6a1 1 0 0 0-.7.29l-.01.01a1 1 0 0 0-.21.32Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'shrink_screen_stroked');
export default IconComponent;
