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
            <path d="M9.65 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor" />
            <path d="M18.65 18a2 2 0 1 1 0 4 2 2 0 0 1 0-4Z" fill="currentColor" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5.5 2c.68 0 1.27.46 1.44 1.11l.03.13.14.79h14.71a1 1 0 0 1 .98 1.21l-1.56 7a1 1 0 0 1-.8.77l-.17.02H8.67L9.02 15h11.14a1 1 0 0 1 0 2H8.6a1.5 1.5 0 0 1-1.48-1.24L5.28 5.2l-.01-.07L5.07 4h-2.9a1 1 0 0 1 0-2H5.5ZM7.8 8.07l.52 2.96h11.14l1.1-5H7.46l.36 2.04Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'cart_stroked');
export default IconComponent;
