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
                d="M3 4a2 2 0 0 0-2 2v12c0 1.1.9 2 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2H3Zm0 3.23V18h18V7.23l-8.41 6.08a1 1 0 0 1-1.18 0L3 7.23ZM19.3 6H4.7l7.3 5.27L19.3 6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'mail_stroked');
export default IconComponent;
