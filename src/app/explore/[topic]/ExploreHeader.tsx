'use client';

import { useState } from 'react';
import Link from 'next/link';
import { HistorySidebar } from './HistorySidebar';
import styles from './page.module.css';

export function ExploreHeader() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <>
      <div className={styles.actions}>
        <button
          className={styles.actionButton}
          onClick={() => setSidebarOpen(true)}
          title="History"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 4.5h12M3 9h12M3 13.5h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
        <Link href="/" className={styles.actionButton} title="Home">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 9.5l6-6 6 6M5 7.5v7h3v-4h2v4h3v-7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      </div>
      <HistorySidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
    </>
  );
}
