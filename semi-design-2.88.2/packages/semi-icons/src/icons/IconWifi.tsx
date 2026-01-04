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
                d="M12 6C8.73 6 5.7 7.62 3.5 9.61A1.5 1.5 0 0 1 1.48 7.4C4.03 5.07 7.76 3 12 3c4.24 0 7.97 2.07 10.52 4.39A1.5 1.5 0 0 1 20.5 9.6C18.3 7.61 15.27 6 12 6Zm2.5 12.5a2.5 2.5 0 1 1-5 0 2.5 2.5 0 0 1 5 0Zm-7.52-4.13A7.16 7.16 0 0 1 12 12.5c1.7 0 3.33.4 5.02 1.87a1.5 1.5 0 1 0 1.96-2.26A10.15 10.15 0 0 0 12 9.5c-2.3 0-4.67.6-6.98 2.6a1.5 1.5 0 0 0 1.96 2.27Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'wifi');
export default IconComponent;
