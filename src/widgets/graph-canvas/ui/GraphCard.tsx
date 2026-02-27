'use client';

import React, { useRef, useState, useEffect } from 'react';
import type { GraphNode, ContentBlock, DefinitionItem } from '@/shared/types';
import styles from './GraphCard.module.css';

/* ===== Inline formatting: **bold**, *italic*, `code`, [[badge]] ===== */
function renderInline(text: string, onKeywordClick?: (keyword: string) => void): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`|\[\[(.+?)\]\])/g;
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
    else if (match[5]) parts.push(<span key={key++} className={styles.badge}>{match[5]}</span>);
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
}

/* ===== Block renderer ===== */
function renderBlock(block: ContentBlock, index: number, isLead: boolean, onKeywordClick?: (keyword: string) => void): React.ReactNode {
  switch (block.type) {
    case 'heading':
      return <h3 key={index} className={styles.blockHeading}>{block.content}</h3>;

    case 'subheading':
      return <h4 key={index} className={styles.blockSubheading}>{block.content}</h4>;

    case 'text':
      return (
        <p key={index} className={`${styles.blockText} ${isLead ? styles.lead : ''}`}>
          {renderInline(block.content ?? '', onKeywordClick)}
        </p>
      );

    case 'list':
      return (
        <ul key={index} className={styles.blockList}>
          {((block.items ?? []) as string[]).map((item, i) => (
            <li key={i}>{renderInline(item, onKeywordClick)}</li>
          ))}
        </ul>
      );

    case 'code':
      return (
        <pre key={index} className={styles.blockCode}>
          {block.language && (
            <span className={styles.codeHeader}>{block.language}</span>
          )}
          <code>{block.content}</code>
        </pre>
      );

    case 'definition': {
      const items = (block.items ?? []) as DefinitionItem[];
      if (!items.length) return null;
      return (
        <dl key={index} className={styles.blockDefinition}>
          {items.map((item, i) => (
            <div key={i} className={styles.definitionPair}>
              <dt className={styles.definitionTerm}>
                {renderInline(item.term, onKeywordClick)}
              </dt>
              <dd className={styles.definitionDesc}>
                {renderInline(item.definition, onKeywordClick)}
              </dd>
            </div>
          ))}
        </dl>
      );
    }

    case 'table': {
      if (!block.headers || !block.rows) return null;
      const headerCount = block.headers.length;
      return (
        <div key={index} className={styles.blockTableWrapper}>
          <table className={styles.blockTable}>
            <thead>
              <tr>
                {block.headers.map((header, i) => (
                  <th key={i}>{renderInline(header, onKeywordClick)}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {block.rows.map((row, rowIdx) => (
                <tr key={rowIdx}>
                  {Array.from({ length: headerCount }, (_, cellIdx) => (
                    <td key={cellIdx}>
                      {row[cellIdx] ? renderInline(row[cellIdx], onKeywordClick) : null}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    case 'callout': {
      if (!block.content) return null;
      const variantClass =
        block.variant === 'tip' ? styles.calloutTip :
        block.variant === 'warning' ? styles.calloutWarning :
        styles.calloutNote;
      const variantLabel =
        block.variant === 'tip' ? 'Tip' :
        block.variant === 'warning' ? 'Warning' :
        'Note';
      return (
        <aside key={index} className={`${styles.blockCallout} ${variantClass}`}>
          <span className={styles.calloutLabel}>{variantLabel}</span>
          <p className={styles.calloutContent}>
            {renderInline(block.content, onKeywordClick)}
          </p>
        </aside>
      );
    }

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
  const { id, position, title, content, blocks, category, isLoading, isExpanded } = node;
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
              <span className={styles.expandHint}>&rarr;</span>
            </>
          )}
        </div>
        {!isLoading && onDelete && (
          <button
            className={styles.collapsedDelete}
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            &times;
          </button>
        )}
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
        <h2 className={styles.title}>
          {title}
          {category && category !== 'general' && (
            <span className={styles.categoryBadge}>{category}</span>
          )}
        </h2>
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
          ? (() => {
              let firstTextSeen = false;
              return blocks.map((block, i) => {
                const isLead = block.type === 'text' && !firstTextSeen;
                if (block.type === 'text') firstTextSeen = true;
                return renderBlock(block, i, isLead, onKeywordClick);
              });
            })()
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
