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
                d="M12 2c2.72 0 3.06.01 4.12.06 1.07.05 1.8.22 2.43.46.66.26 1.22.6 1.77 1.16.51.5.9 1.1 1.16 1.77.24.64.41 1.36.46 2.43.05 1.06.06 1.4.06 4.12s-.01 3.06-.06 4.12a7.4 7.4 0 0 1-.46 2.43 4.88 4.88 0 0 1-1.16 1.77c-.5.51-1.1.9-1.77 1.16-.64.24-1.36.41-2.43.46-1.06.05-1.4.06-4.12.06s-3.06-.01-4.12-.06a7.4 7.4 0 0 1-2.43-.46 4.89 4.89 0 0 1-1.77-1.16c-.51-.5-.9-1.1-1.16-1.77a7.36 7.36 0 0 1-.46-2.43C2.01 15.06 2 14.72 2 12s.01-3.06.06-4.12c.05-1.07.22-1.8.46-2.43.26-.67.65-1.27 1.16-1.77.5-.51 1.1-.9 1.77-1.16a7.36 7.36 0 0 1 2.43-.46C8.94 2.01 9.28 2 12 2Zm0 5a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm6.5-.25a1.25 1.25 0 1 0-2.5 0 1.25 1.25 0 0 0 2.5 0ZM12 9a3 3 0 1 1 0 6 3 3 0 0 1 0-6Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'instagram');
export default IconComponent;
