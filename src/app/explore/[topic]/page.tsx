import { ExploreHeader } from '@/widgets/explore-header';
import { GraphCanvas } from '@/widgets/graph-canvas';
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
        <GraphCanvas key={`${decodedTopic}-${id || ''}`} initialTopic={decodedTopic} savedExplorationId={id} />
      </main>
    </>
  );
}
