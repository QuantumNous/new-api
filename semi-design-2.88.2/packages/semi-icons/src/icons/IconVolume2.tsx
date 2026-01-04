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
                d="M11.43 2.1A1 1 0 0 1 12 3v18a1 1 0 0 1-1.62.78L4.65 17H2a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h2.65l5.73-4.78a1 1 0 0 1 1.05-.12Zm2.52 6.33a1.5 1.5 0 0 1 2.12.02 4.99 4.99 0 0 1 0 7 1.5 1.5 0 1 1-2.14-2.1 1.99 1.99 0 0 0 0-2.8 1.5 1.5 0 0 1 .02-2.12Zm4.9-4.28a1.5 1.5 0 0 0-1.7 2.47 6.5 6.5 0 0 1 0 10.76 1.5 1.5 0 0 0 1.7 2.47 9.5 9.5 0 0 0 0-15.7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'volume_2');
export default IconComponent;
