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
                d="M12 3a3 3 0 0 0-3 3v2h9a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V10c0-1.1.9-2 2-2h1V6a5 5 0 0 1 10 0h-2a3 3 0 0 0-3-3ZM6 20h12V10H6v10Zm8-5a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'unlock_stroked');
export default IconComponent;
