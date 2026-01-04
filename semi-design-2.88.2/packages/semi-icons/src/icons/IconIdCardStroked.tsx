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
                d="M20 3a3 3 0 0 1 3 3v11a3 3 0 0 1-2.85 3H3.85A3 3 0 0 1 1 17.15V6a3 3 0 0 1 3-3h16ZM4 5a1 1 0 0 0-1 1v11a1 1 0 0 0 1 1h16a1 1 0 0 0 1-1V6a1 1 0 0 0-1-1H4Zm4 8.86c1.67 0 3.13.51 3.85 1.26.37.39 0 .88-.55.88H4.7c-.54 0-.92-.5-.55-.88.72-.75 2.18-1.26 3.85-1.26Zm9-.86a1 1 0 1 1 0 2h-3a1 1 0 1 1 0-2h3ZM8 7c1.6 0 2.35.73 2.39 2.63.4.15.43.64.28 1.18-.11.42-.36.74-.62.84-.42 1.07-1.19 1.78-2.05 1.78-.86 0-1.63-.71-2.05-1.78-.26-.1-.51-.42-.62-.84-.15-.54-.12-1.03.28-1.18C5.65 7.73 6.41 7 8 7Zm11 2a1 1 0 1 1 0 2h-5a1 1 0 1 1 0-2h5Z"
                fill="currentColor"
            />
        </svg>
    );
}
const IconComponent = convertIcon(SvgComponent, 'id_card_stroked');
export default IconComponent;
