'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Input } from '@/shared/ui';
import styles from './SearchForm.module.css';

export function SearchForm() {
  const [topic, setTopic] = useState('');
  const router = useRouter();

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    const trimmed = topic.trim();
    if (!trimmed) return;

    const encoded = encodeURIComponent(trimmed);
    router.push(`/explore/${encoded}`);
  };

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
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
