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
                d="M16 21a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h8Zm3-10.5a1 1 0 0 1 1 1 8 8 0 1 1-16 0 1 1 0 1 1 2 0 6 6 0 0 0 12 0 1 1 0 0 1 1-1ZM12 1a4.5 4.5 0 0 1 4.5 4.5v6a4.5 4.5 0 1 1-9 0v-6A4.5 4.5 0 0 1 12 1Zm0 2a2.5 2.5 0 0 0-2.5 2.5v6a2.5 2.5 0 0 0 5 0v-6A2.5 2.5 0 0 0 12 3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'microphone_stroked');
export default IconComponent;
