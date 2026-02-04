import Link from 'next/link';
import { ExplorationView } from './ExplorationView';
import styles from './page.module.css';

interface ExplorePageProps {
  params: Promise<{ topic: string }>;
}

export default async function ExplorePage({ params }: ExplorePageProps) {
  const { topic } = await params;
  const decodedTopic = decodeURIComponent(topic);

  return (
    <>
      <header className={styles.header}>
        <nav>
          <Link href="/" className={styles.logo}>
            Inquire
          </Link>
        </nav>
      </header>

      <main className={styles.main}>
        <ExplorationView initialTopic={decodedTopic} />
      </main>
    </>
  );
}
