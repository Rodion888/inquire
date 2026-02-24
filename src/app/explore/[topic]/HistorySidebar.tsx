'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/shared/lib';
import { getUserExplorations, deleteExploration, type Exploration } from '@/shared/api';
import styles from './HistorySidebar.module.css';

interface HistorySidebarProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistorySidebar({ isOpen, onClose }: HistorySidebarProps) {
  const { user } = useAuth();
  const [explorations, setExplorations] = useState<Exploration[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;

    setLoading(true);
    getUserExplorations(user.uid)
      .then(setExplorations)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [isOpen, user]);

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.preventDefault();
    e.stopPropagation();
    await deleteExploration(id);
    setExplorations((prev) => prev.filter((ex) => ex.id !== id));
  };

  const filtered = explorations.filter((ex) =>
    ex.title.toLowerCase().includes(search.toLowerCase())
  );

  const formatDate = (timestamp: Exploration['updatedAt']) => {
    if (!timestamp) return '';
    const date = timestamp.toDate();
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();
    if (isToday) {
      return `Today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  return (
    <>
      {isOpen && <div className={styles.overlay} onClick={onClose} />}
      <aside className={`${styles.sidebar} ${isOpen ? styles.open : ''}`}>
        <div className={styles.sidebarHeader}>
          <h2>History</h2>
          <button className={styles.closeButton} onClick={onClose}>
            &times;
          </button>
        </div>

        {user ? (
          <>
            <input
              className={styles.search}
              type="text"
              placeholder="Search history..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <div className={styles.list}>
              {loading ? (
                <p className={styles.emptyText}>Loading...</p>
              ) : filtered.length === 0 ? (
                <p className={styles.emptyText}>
                  {search ? 'Nothing found' : 'No explorations yet'}
                </p>
              ) : (
                filtered.map((ex) => (
                  <Link
                    key={ex.id}
                    href={`/explore/${encodeURIComponent(ex.topic)}?id=${ex.id}`}
                    className={styles.item}
                    onClick={onClose}
                  >
                    <div className={styles.itemContent}>
                      <h3 className={styles.itemTitle}>{ex.title}</h3>
                      <span className={styles.itemMeta}>
                        {ex.nodeCount} topics &middot; {formatDate(ex.updatedAt)}
                      </span>
                    </div>
                    <button
                      className={styles.deleteButton}
                      onClick={(e) => handleDelete(e, ex.id)}
                      title="Delete"
                    >
                      &times;
                    </button>
                  </Link>
                ))
              )}
            </div>
          </>
        ) : (
          <p className={styles.emptyText}>Sign in to see your history</p>
        )}
      </aside>
    </>
  );
}
