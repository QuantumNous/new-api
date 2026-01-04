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
                d="M8.27 8.36c0-2.04.84-3.9 2.19-5.23a9 9 0 1 0 10.4 10.41 7.36 7.36 0 0 1-12.6-5.18Zm2 0a5.36 5.36 0 0 0 9.86 2.93l.08-.11c.4-.51 1.02-.67 1.52-.6.55.08 1.27.52 1.27 1.42A11 11 0 1 1 12 1c.9 0 1.34.72 1.42 1.27.08.53-.1 1.2-.7 1.6a5.36 5.36 0 0 0-2.45 4.5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'moon_stroked');
export default IconComponent;
