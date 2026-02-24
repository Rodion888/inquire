'use client';

import React, { useRef, useState, useEffect } from 'react';
import { GraphNode, ContentBlock } from './types';
import styles from './GraphCard.module.css';

/* ===== Inline formatting: **bold**, *italic*, `code` ===== */
function renderInline(text: string, onKeywordClick?: (keyword: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
  let lastIndex = 0;
  let match;
  let key = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    if (match[2]) {
      const keyword = match[2];
      parts.push(
        onKeywordClick ? (
          <strong
            key={key++}
            className={styles.keyword}
            onClick={(e) => { e.stopPropagation(); onKeywordClick(keyword); }}
          >
            {keyword}
          </strong>
        ) : (
          <strong key={key++}>{keyword}</strong>
        )
      );
    }
    else if (match[3]) parts.push(<em key={key++}>{match[3]}</em>);
    else if (match[4]) parts.push(<code key={key++}>{match[4]}</code>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ===== Block renderer ===== */
function renderBlock(block: ContentBlock, index: number, onKeywordClick?: (keyword: string) => void): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return <h3 key={index} className={styles.blockHeading}>{block.content}</h3>;

    case 'text':
      return <p key={index} className={styles.blockText}>{renderInline(block.content ?? '', onKeywordClick)}</p>;

    case 'list':
      return (
        <ul key={index} className={styles.blockList}>
          {(block.items ?? []).map((item, i) => (
            <li key={i}>{renderInline(item, onKeywordClick)}</li>
          ))}
        </ul>
      );

    case 'code':
      return (
        <pre key={index} className={styles.blockCode}>
          <code>{block.content}</code>
        </pre>
      );

    default:
      return null;
  }
}

/* ===== Fallback: plain text content (old saved explorations) ===== */
function renderPlainContent(text: string): React.ReactNode[] {
  return text.split(/\n\n+/).filter(Boolean).map((paragraph, i) => (
    <p key={i} className={styles.blockText}>{paragraph}</p>
  ));
}

interface GraphCardProps {
  node: GraphNode;
  isDragging: boolean;
  onExpand: () => void;
  onDragStart: (clientX: number, clientY: number) => void;
  onAskFollowUp?: () => void;
  onDelete?: () => void;
  onKeywordClick?: (keyword: string) => void;
  onHover: () => void;
  onHoverEnd: () => void;
  onResize?: (nodeId: string, height: number) => void;
}

export function GraphCard({ node, isDragging, onExpand, onDragStart, onAskFollowUp, onDelete, onKeywordClick, onHover, onHoverEnd, onResize }: GraphCardProps) {
  const { id, position, title, content, blocks, isLoading, isExpanded } = node;
  const cardRef = useRef<HTMLElement>(null);
  const wasDragged = useRef(false);
  const startPos = useRef({ x: 0, y: 0 });
  const [menuOpen, setMenuOpen] = useState(false);
  const onResizeRef = useRef(onResize);
  onResizeRef.current = onResize;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        onResizeRef.current?.(id, entry.borderBoxSize[0].blockSize);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [id]);

  const handleHeaderMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    wasDragged.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    onDragStart(e.clientX, e.clientY);
  };

  const handleHeaderMouseUp = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 5 || dy > 5) {
      wasDragged.current = true;
    }
  };

  const handleCollapsedMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    wasDragged.current = false;
    startPos.current = { x: e.clientX, y: e.clientY };
    onDragStart(e.clientX, e.clientY);
  };

  const handleCollapsedMouseUp = (e: React.MouseEvent) => {
    const dx = Math.abs(e.clientX - startPos.current.x);
    const dy = Math.abs(e.clientY - startPos.current.y);
    if (dx > 5 || dy > 5) {
      wasDragged.current = true;
    }
  };

  const handleCollapsedClick = () => {
    if (wasDragged.current) {
      wasDragged.current = false;
      return;
    }
    if (!isLoading) onExpand();
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    wasDragged.current = false;
    const t = e.touches[0];
    startPos.current = { x: t.clientX, y: t.clientY };
    onDragStart(t.clientX, t.clientY);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const t = e.changedTouches[0];
    const dx = Math.abs(t.clientX - startPos.current.x);
    const dy = Math.abs(t.clientY - startPos.current.y);
    if (dx > 5 || dy > 5) {
      wasDragged.current = true;
    }
    // Tap on collapsed card = expand
    if (!wasDragged.current && isCollapsed && !isLoading) {
      onExpand();
    }
  };

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${title}\n\n${content}`);
    setMenuOpen(false);
  };

  const isCollapsed = !isExpanded;

  if (isCollapsed) {
    return (
      <article
        ref={cardRef}
        className={`${styles.card} ${isDragging ? styles.dragging : ''} ${styles.collapsed}`}
        style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
        onMouseDown={handleCollapsedMouseDown}
        onMouseUp={handleCollapsedMouseUp}
        onClick={handleCollapsedClick}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        onMouseEnter={onHover}
        onMouseLeave={onHoverEnd}
      >
        <div className={styles.collapsedContent}>
          {isLoading ? (
            <div className={styles.spinnerSmall} />
          ) : (
            <>
              <h3 className={styles.collapsedTitle}>{title}</h3>
              <span className={styles.expandHint}>→</span>
            </>
          )}
        </div>
      </article>
    );
  }

  const hasBlocks = blocks && blocks.length > 0;

  return (
    <article
      ref={cardRef}
      className={`${styles.card} ${isDragging ? styles.dragging : ''}`}
      style={{ transform: `translate(${position.x}px, ${position.y}px)` }}
      onMouseEnter={onHover}
      onMouseLeave={onHoverEnd}
    >
      <header
        className={styles.header}
        onMouseDown={handleHeaderMouseDown}
        onMouseUp={handleHeaderMouseUp}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        <h2 className={styles.title}>{title}</h2>
        <button
          className={styles.menuButton}
          onClick={(e) => {
            e.stopPropagation();
            setMenuOpen(!menuOpen);
          }}
        >
          &#x22EE;
        </button>
        {menuOpen && (
          <div className={styles.menu}>
            <button className={styles.menuItem} onClick={handleCopy}>
              Copy
            </button>
            {onDelete && (
              <button
                className={`${styles.menuItem} ${styles.menuItemDanger}`}
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onDelete();
                }}
              >
                Delete
              </button>
            )}
          </div>
        )}
      </header>
      <div className={styles.content} data-card-content>
        {hasBlocks
          ? blocks.map((block, i) => renderBlock(block, i, onKeywordClick))
          : renderPlainContent(content)
        }
      </div>
      {onAskFollowUp && (
        <button
          className={styles.followUpButton}
          onClick={(e) => {
            e.stopPropagation();
            onAskFollowUp();
          }}
        >
          Ask Follow Up
        </button>
      )}
    </article>
  );
}
