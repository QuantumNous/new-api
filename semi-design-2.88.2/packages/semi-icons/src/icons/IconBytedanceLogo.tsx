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
                d="m18.6 3 3.4.87V19.5l-3.4.99V3ZM2 4l3.33.8v13.9L2 19.63V4Zm5.5 6.94 3.33.93v7.26l-3.34.94v-9.13Zm8.94-2.23-3.27.8v7.33l3.27 1V8.7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'bytedance_logo');
export default IconComponent;
