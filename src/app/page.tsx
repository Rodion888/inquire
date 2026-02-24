'use client';

import { useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/shared/lib';
import { Button, Input } from '@/shared/ui';
import { HistorySidebar } from './explore/[topic]/HistorySidebar';
import styles from './page.module.css';

const EXAMPLE_TOPICS = [
  { title: 'Quantum Computing', description: 'Explore the future of computation' },
  { title: 'Machine Learning', description: 'How AI learns from data' },
  { title: 'Space Exploration', description: 'Journey through the cosmos' },
];

function SearchForm() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;
    router.push(`/explore/${encodeURIComponent(trimmed)}`);
  };

  return (
    <form className={styles.searchForm} onSubmit={handleSubmit}>
      <Input
        value={topic}
        onChange={(e) => setTopic(e.target.value)}
        placeholder="What do you want to explore?"
        aria-label="Enter a topic to explore"
      />
      <Button type="submit" disabled={!topic.trim()}>
        Explore
      </Button>
    </form>
  );
}

export default function HomePage() {
  const { user, loading, signIn, logOut } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <header className={styles.header}>
        <nav className={styles.nav}>
          <div className={styles.navLeft}>
            {user && (
              <button
                className={styles.burgerButton}
                onClick={() => setSidebarOpen(true)}
                title="History"
              >
                <span />
                <span />
                <span />
              </button>
            )}
            <Link href="/" className={styles.logo}>
              Inquire
            </Link>
          </div>
          {!loading && (
            <div className={styles.authSection}>
              {user ? (
                <button className={styles.signOutButton} onClick={logOut}>
                  Sign Out
                </button>
              ) : (
                <button className={styles.signInButton} onClick={signIn}>
                  Sign In
                </button>
              )}
            </div>
          )}
        </nav>
      </header>

      <main className={styles.main}>
        {user && (
          <p className={styles.greeting}>
            Hello, {user.displayName}
          </p>
        )}

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

      <HistorySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
