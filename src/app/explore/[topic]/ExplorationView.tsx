'use client';

import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { exploreTopic } from '@/shared/api';
import styles from './ExplorationView.module.css';

interface ExplorationViewProps {
  initialTopic: string;
}

export function ExplorationView({ initialTopic }: ExplorationViewProps) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exploration', initialTopic],
    queryFn: () => exploreTopic(initialTopic),
  });

  if (isLoading) {
    return (
      <div className={styles.loading}>
        <div className={styles.spinner} />
        <p>Exploring {initialTopic}...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.error}>
        <h2>Something went wrong</h2>
        <p>{error instanceof Error ? error.message : 'Failed to explore topic'}</p>
        <Link href="/" className={styles.backLink}>
          Go back home
        </Link>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={styles.container}>
      <article className={styles.card}>
        <h1 className={styles.title}>{data.title}</h1>
        <div className={styles.content}>
          {data.content.split('\n\n').map((paragraph, i) => (
            <p key={i}>{paragraph}</p>
          ))}
        </div>
      </article>

      <section className={styles.related}>
        <h2>Related Topics</h2>
        <ul className={styles.topicList}>
          {data.relatedTopics.map((topic) => (
            <li key={topic}>
              <Link
                href={`/explore/${encodeURIComponent(topic)}`}
                className={styles.topicLink}
              >
                {topic}
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
