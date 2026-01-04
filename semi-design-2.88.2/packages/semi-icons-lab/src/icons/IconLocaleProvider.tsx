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
            <rect x={2} y={2} width={20} height={20} rx={3} fill="#DDE3E8" />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M8.4 4.14c-.5.3-.68.94-.39 1.44l.25.44H5.13C4.5 6.02 4 6.49 4 7.07c0 .59.5 1.06 1.13 1.06h1.33c0 1.73.6 3.32 1.59 4.58-.78.44-1.68.7-2.64.7a1.06 1.06 0 1 0 0 2.11c1.57 0 3.03-.49 4.22-1.32a7.36 7.36 0 0 0 4.23 1.32 1.06 1.06 0 1 0 0-2.1c-.96 0-1.87-.27-2.64-.71a7.36 7.36 0 0 0 1.58-4.58h1.34c.62 0 1.13-.47 1.13-1.06 0-.58-.5-1.05-1.13-1.05H10.7l-.86-1.5c-.29-.5-.93-.67-1.44-.38Zm2.29 4H8.58c0 1.18.39 2.28 1.05 3.16a5.26 5.26 0 0 0 1.06-3.17Z"
                fill="#4CC3FA"
            />
            <path
                d="M13 19c.58 0 .9-.3 1.11-1.05l.35-1.05h3.03l.34 1.05c.22.74.55 1.05 1.13 1.05.63 0 1.04-.36 1.04-.93 0-.23-.06-.49-.18-.85l-1.98-5.75c-.37-1.05-.87-1.47-1.82-1.47-.95 0-1.46.42-1.82 1.47l-1.99 5.75c-.15.44-.21.68-.21.9 0 .52.4.88 1 .88Zm1.9-3.66L15.94 12h.1l1.02 3.35H14.9Z"
                fill="#324350"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'locale-provider');
export default IconComponent;
