'use client';

import styles from './ZoomControls.module.css';

interface ZoomControlsProps {
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onReset: () => void;
  isPublic?: boolean;
  onTogglePublic?: () => void;
}

export function ZoomControls({ zoom, onZoomIn, onZoomOut, onReset, isPublic, onTogglePublic }: ZoomControlsProps) {
  return (
    <div className={styles.controls}>
      <button className={styles.button} onClick={onZoomIn} title="Zoom in">
        +
      </button>
      <button className={styles.button} onClick={onZoomOut} title="Zoom out">
        −
      </button>
      <button className={styles.button} onClick={onReset} title="Fit view">
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <rect x="2" y="2" width="5" height="5" rx="1" />
          <rect x="9" y="2" width="5" height="5" rx="1" />
          <rect x="2" y="9" width="5" height="5" rx="1" />
          <rect x="9" y="9" width="5" height="5" rx="1" />
        </svg>
      </button>
      {onTogglePublic ? (
        <button
          className={`${styles.button} ${styles.lockButton}`}
          onClick={onTogglePublic}
          title={isPublic ? 'Public — click to make private' : 'Private — click to make public'}
        >
          {isPublic ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 9.9-1" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
          )}
        </button>
      ) : (
        <span className={styles.zoomLevel}>{Math.round(zoom * 100)}%</span>
      )}
    </div>
  );
}
