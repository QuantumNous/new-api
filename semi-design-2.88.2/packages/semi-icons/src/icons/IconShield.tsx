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
                d="m2.68 3.8 8.75-2.63a2 2 0 0 1 1.14 0l8.74 2.62c.41.13.7.5.7.93.03 2.63-.03 11.72-2.01 14.28-1.98 2.55-6.38 3.66-7.65 3.93-.23.05-.47.05-.7 0C10.4 22.65 6.12 21.55 4 19 1.87 16.44 1.92 7.32 1.98 4.7c0-.42.3-.78.7-.9ZM12 4v16s3.97-.73 5.6-2.9c1.61-2.2 1.39-11.2 1.39-11.2L12 4H12Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'shield');
export default IconComponent;
