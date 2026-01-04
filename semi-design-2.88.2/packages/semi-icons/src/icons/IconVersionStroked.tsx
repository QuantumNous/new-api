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
                d="M5.13 3.13v17.02l6.35-3.29c.33-.16.71-.16 1.04 0l6.36 3.3V3.11H5.13ZM2.88 3C2.88 1.83 3.83.87 5 .87h14c1.17 0 2.13.96 2.13 2.13v19a1.13 1.13 0 0 1-1.65 1L12 19.13 4.52 23a1.13 1.13 0 0 1-1.64-1V3Z"
                fill="currentColor"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M6.88 9c0-.62.5-1.13 1.12-1.13h8a1.13 1.13 0 0 1 0 2.25H8c-.62 0-1.13-.5-1.13-1.12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'version_stroked');
export default IconComponent;
