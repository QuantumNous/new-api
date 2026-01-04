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
                d="M19 10a3 3 0 0 1 3 3v10l-3.33-2H8a3 3 0 0 1-3-3v-5a3 3 0 0 1 3-3h11Z"
                fill="#6A6F7F"
            />
            <path
                d="M11.76 18.04c.35 0 .53-.17.66-.63l.2-.63h1.8l.2.63c.13.45.33.63.67.63.37 0 .62-.22.62-.56 0-.13-.04-.29-.1-.5l-1.19-3.46c-.21-.64-.5-.9-1.07-.9-.56 0-.87.26-1.08.9l-1.18 3.45c-.09.26-.12.41-.12.54 0 .31.24.53.6.53Zm1.13-2.2.6-2.02h.07l.6 2.02h-1.27Z"
                fill="white"
            />
            <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M5 2a3 3 0 0 0-3 3v12l3.53-4H16a3 3 0 0 0 3-3V5a3 3 0 0 0-3-3H5Z"
                fill="#FF7D95"
            />
            <path
                d="M12.18 10.62c.32 0 .54-.23.54-.54 0-.13-.02-.24-.16-.45l-.13-.18c.4-.4.62-1 .62-1.77v-.64c0-1.54-.89-2.47-2.35-2.47-1.49 0-2.36.93-2.36 2.47v.64c0 1.52.86 2.44 2.36 2.44.26 0 .5-.04.71-.1l.13.17c.2.3.4.43.64.43ZM9.63 7.75v-.72c0-.88.4-1.4 1.07-1.4.63 0 1.05.52 1.05 1.4v.72c0 .33-.06.56-.17.75l-.09-.13a.47.47 0 0 0-.36-.17c-.27 0-.47.2-.47.48 0 .1.04.21.09.3l.08.12a.59.59 0 0 1-.2.04c-.63-.04-1-.54-1-1.39Z"
                fill="white"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'faq');
export default IconComponent;
