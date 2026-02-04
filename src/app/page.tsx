import Link from 'next/link';
import { SearchForm } from '@/features/create-exploration';
import styles from './page.module.css';

const EXAMPLE_TOPICS = [
  { title: 'Quantum Computing', description: 'Explore the future of computation' },
  { title: 'Machine Learning', description: 'How AI learns from data' },
  { title: 'Space Exploration', description: 'Journey through the cosmos' },
];

export default function HomePage() {
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
        <section className={styles.hero}>
          <h1>Explore any topic</h1>
          <p>Dive deep into knowledge through interactive visual graphs</p>
          <SearchForm />
        </section>

        <section className={styles.examples}>
          <h2>Popular topics</h2>
          <ul className={styles.topicList}>
            {EXAMPLE_TOPICS.map((topic) => (
              <li key={topic.title}>
                <Link
                  href={`/explore/${encodeURIComponent(topic.title)}`}
                  className={styles.topicCard}
                >
                  <h3>{topic.title}</h3>
                  <p>{topic.description}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
