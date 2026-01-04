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
                d="M2.66 15.62a6.48 6.48 0 0 0 1.93 4.85 6.48 6.48 0 0 0 4.85 1.93 6.03 6.03 0 0 0 3.99-1.58l3.71-3.7c.7-.72 1.37-1.38 1.86-1.87l.58-.58.16-.15.04-.05h.01v-.01a1 1 0 1 0-1.41-1.41h-.01l-.05.05-.16.16-.58.58-1.85 1.86-3.71 3.7A4.48 4.48 0 0 1 6 19.06a4.48 4.48 0 0 1-1.35-3.37c.04-1.16.5-2.14 1-2.64l8.83-8.83a2.7 2.7 0 0 1 1.5-.6 2.9 2.9 0 0 1 2.39.95 2.9 2.9 0 0 1 .95 2.38 2.7 2.7 0 0 1-.6 1.5l-7.07 7.08c-.15.15-.52.34-1 .37-.44.03-.84-.09-1.12-.37-.28-.28-.4-.68-.37-1.13.03-.47.22-.84.37-1l2.92-2.9 1.66-1.67.53-.53.14-.14.04-.04.01-.01a1 1 0 1 0-1.41-1.42l-5.3 5.3c-.56.56-.9 1.43-.96 2.28-.06.88.18 1.9.96 2.67.78.79 1.8 1.02 2.67.96.85-.06 1.72-.4 2.28-.96l7.07-7.07a4.64 4.64 0 0 0 1.17-2.74 4.9 4.9 0 0 0-1.53-3.97 4.9 4.9 0 0 0-3.98-1.53c-1.18.1-2.2.64-2.73 1.17l-8.84 8.84a6.03 6.03 0 0 0-1.58 3.99Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'paperclip_stroked');
export default IconComponent;
