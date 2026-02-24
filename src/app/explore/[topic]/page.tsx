import { ExploreHeader } from './ExploreHeader';
import { GraphView } from './GraphView';
import styles from './page.module.css';

interface ExplorePageProps {
  params: Promise<{ topic: string }>;
  searchParams: Promise<{ id?: string }>;
}

export default async function ExplorePage({ params, searchParams }: ExplorePageProps) {
  const { topic } = await params;
  const { id } = await searchParams;
  const decodedTopic = decodeURIComponent(topic);

  return (
    <>
      <ExploreHeader />

      <main className={styles.main}>
        <GraphView initialTopic={decodedTopic} savedExplorationId={id} />
      </main>
    </>
  );
}
