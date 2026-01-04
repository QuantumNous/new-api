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
                d="M15.33 4a4.59 4.59 0 0 0-4.66 4.5c0 .62.13 1.2.36 1.74l.27.62L5 17.4V20h2.12v-2.5H9.7V15h2.57v-2.37h1l.21.01a2.5 2.5 0 0 1 .3.07l.06.02.46.1c.4.1.8.17 1.03.17 2.6 0 4.67-2.04 4.67-4.5S17.94 4 15.33 4ZM8.67 8.5c0-3.62 3.01-6.5 6.66-6.5A6.58 6.58 0 0 1 22 8.5a6.58 6.58 0 0 1-7.73 6.38V17H11.7v2.5H9.12V22H3v-5.4l5.96-6.2a6.35 6.35 0 0 1-.3-1.9Zm8.33 0a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'key_stroked');
export default IconComponent;
