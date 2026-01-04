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
                d="M12 2a1 1 0 0 0-1-1H6a2 2 0 0 0-2 2v18c0 1.1.9 2 2 2h12a2 2 0 0 0 2-2V10a1 1 0 0 0-1-1h-5a2 2 0 0 1-2-2V2ZM7 8a1 1 0 0 1 1-1h1a1 1 0 0 1 0 2H8a1 1 0 0 1-1-1Zm0 5a1 1 0 0 1 1-1h8a1 1 0 1 1 0 2H8a1 1 0 0 1-1-1Zm1 4a1 1 0 1 0 0 2h8a1 1 0 1 0 0-2H8Zm11.07-9.5H14.5a1 1 0 0 1-1-1V1.93a.8.8 0 0 1 1.37-.56l4.76 4.76a.8.8 0 0 1-.56 1.37Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'file');
export default IconComponent;
