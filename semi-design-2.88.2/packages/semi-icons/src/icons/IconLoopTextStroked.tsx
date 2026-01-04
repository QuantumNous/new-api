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
                d="M19.64 2.23a1 1 0 0 0-1.28 1.54l.88.73H8a7 7 0 0 0-7 7 1 1 0 1 0 2 0 5 5 0 0 1 5-5h11.24l-.88.73a1 1 0 1 0 1.28 1.54l3-2.5a1 1 0 0 0 0-1.54l-3-2.5ZM22 11a1 1 0 0 1 1 1 7 7 0 0 1-7 7H4.76l.88.73a1 1 0 1 1-1.28 1.54l-3-2.5a1.05 1.05 0 0 1-.11-.1 1 1 0 0 1 .12-1.44l2.99-2.5a1 1 0 1 1 1.28 1.54l-.88.73H16a5 5 0 0 0 5-5 1 1 0 0 1 1-1ZM7 9.5c0-.28.22-.5.5-.5h6c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-6a.5.5 0 0 1-.5-.5v-1Zm8.5-.5a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h2a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-2ZM7 13.5c0-.28.22-.5.5-.5h3c.28 0 .5.22.5.5v1a.5.5 0 0 1-.5.5h-3a.5.5 0 0 1-.5-.5v-1Zm5.5-.5a.5.5 0 0 0-.5.5v1c0 .28.22.5.5.5h5a.5.5 0 0 0 .5-.5v-1a.5.5 0 0 0-.5-.5h-5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'loop_text_stroked');
export default IconComponent;
