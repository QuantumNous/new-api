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
                d="M10.76 1a5.95 5.95 0 0 1-3.84 5.23A5.89 5.89 0 0 1 6.7 4.4a13.56 13.56 0 0 0-4.2 9.33A9.3 9.3 0 0 0 11.85 23a9.3 9.3 0 0 0 9.35-9.26c0-3.1-1.53-6.69-3.9-9.04a5.92 5.92 0 0 1-2.43 4 5.95 5.95 0 0 0-4.1-7.7ZM9.28 9.45a5.9 5.9 0 0 0 0 0Zm-.3 1.65v6.23c0 .65.7 1.05 1.26.72l5.35-3.12a.83.83 0 0 0 0-1.43l-5.35-3.12a.84.84 0 0 0-1.27.72Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'vigo_logo');
export default IconComponent;
