import { Link } from '@theme';
import styles from './Step.module.scss';
import { useI18nUrl } from './utils';

interface StepProps {
  href: string;
  title: string;
  description: string;
}
const Step = ({ href, title, description }: StepProps) => {
  const tUrl = useI18nUrl();
  const isExternal = href.startsWith('http');
  return (
    <Link className={styles.step} href={isExternal ? href : tUrl(href)}>
      <p className={styles.title}>{title}</p>
      <p className={styles.description}>{description}</p>
    </Link>
  );
};

export default Step;
