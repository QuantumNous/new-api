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
                d="M20 11.3V11c0-3.9-3.1-7-7-7-2.8 0-5.2 1.7-6.3 4-3.2.2-5.7 2.8-5.7 6 0 3.3 2.7 6 6 6h11.5a4.48 4.48 0 0 0 1.5-8.7ZM18.5 18H7a4.01 4.01 0 0 1-.9-7.9c.3-.1.6-.1.9-.1.31 0 .56 0 .84.1.13.04.28-.04.31-.17.13-.59.39-1.1.65-1.63C9.7 6.9 11.2 6 13 6a4.95 4.95 0 0 1 4.69 6.74.2.2 0 0 0 .19.26h.62c.4 0 .8.1 1.1.3a2.48 2.48 0 0 1-1.1 4.7Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'cloud_stroked');
export default IconComponent;
