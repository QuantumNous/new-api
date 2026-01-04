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
                d="M11.3 2.29a1 1 0 0 1 .95-.26l6.42 1.5c.45.1.77.51.77.98v4.05a1 1 0 0 1-1.23.97L13 8.3v10.18A3.52 3.52 0 0 1 9.48 22H7.52A3.52 3.52 0 0 1 4 18.48v-.46a3.52 3.52 0 0 1 3.52-3.52H11V3a1 1 0 0 1 .3-.71ZM13 6.24l4.44 1.06v-2L13 4.26v1.98ZM7.52 16.5H11v1.98c0 .84-.68 1.52-1.52 1.52H7.52C6.68 20 6 19.32 6 18.48v-.46c0-.84.68-1.52 1.52-1.52Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'music_note_stroked');
export default IconComponent;
