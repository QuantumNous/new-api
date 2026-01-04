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
                d="M17.84 8.06A6.5 6.5 0 1 0 5.18 11 4.5 4.5 0 0 0 5.5 20H17a6 6 0 0 0 .84-11.94Zm-5.52.2a.5.5 0 0 0-.64 0l-5.15 4.3a.25.25 0 0 0 .16.44H10v4.5c0 .28.22.5.5.5h3a.5.5 0 0 0 .5-.5V13h3.31c.23 0 .34-.3.16-.44l-5.15-4.3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'upload');
export default IconComponent;
