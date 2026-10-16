import { Await, Link, defer } from '@tanstack/react-router';
import { Carbon } from '~/components/Carbon';
import { twMerge } from 'tailwind-merge';
import { FaDiscord, FaGithub, FaTshirt } from 'react-icons/fa';
import { CgMusicSpeaker, CgSpinner } from 'react-icons/cg';
import { Footer } from '~/components/Footer';
import SponsorPack from '~/components/SponsorPack';
import { LogoColor } from '~/components/LogoColor';
import { getSponsorsForSponsorPack } from '~/server/sponsors';
import agGridImage from '~/images/ag-grid.png';
import nozzleImage from '~/images/nozzle.png';
import bytesImage from '~/images/bytes.svg';
import bytesUidotdevImage from '~/images/bytes-uidotdev.png';
const courses = [{
  name: 'The Official TanStack React Query Course',
  cardStyles: `border-t-4 border-red-500 hover:(border-green-500)`,
  href: 'https://query.gg/?s=tanstack',
  description: `Learn how to build enterprise quality apps with TanStack's React Query the easy way with our brand new course.`
}];
const SplitLoader = () => {
  return {
    randomNumber: Math.random(),
    sponsorsPromise: defer(getSponsorsForSponsorPack())
  };
};
export { SplitLoader as loader };