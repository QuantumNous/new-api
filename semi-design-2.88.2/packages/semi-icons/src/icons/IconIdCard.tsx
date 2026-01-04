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
                d="M4 4a3 3 0 0 0-3 3v11a3 3 0 0 0 3 3h16a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3H4Zm5.8 8.17c-.47 1.18-1.33 1.97-2.3 1.97-.97 0-1.83-.79-2.3-1.97-.3-.12-.58-.47-.7-.94-.17-.6-.14-1.14.31-1.31C4.86 7.82 5.71 7 7.5 7s2.64.81 2.69 2.92c.45.17.48.7.32 1.31-.13.47-.41.82-.7.94Zm2.03 3.86c.42.42 0 .97-.61.97H3.78c-.6 0-1.03-.55-.61-.97.81-.84 2.45-1.41 4.33-1.41s3.52.57 4.33 1.4ZM14 10a1 1 0 0 1 1-1h5a1 1 0 1 1 0 2h-5a1 1 0 0 1-1-1Zm1 3a1 1 0 1 0 0 2h3a1 1 0 1 0 0-2h-3Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'id_card');
export default IconComponent;
