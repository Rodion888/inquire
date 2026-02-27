'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useAuth } from '@/shared/lib';
import type { HeightMap } from '@/shared/types';
import { ConfirmDialog } from '@/shared/ui';
import {
  getUserSettings,
  shouldAskCascadeDelete,
  markCascadeDeleteAsked,
  type UserSettings,
} from '@/shared/api';
import {
  generateId,
  fitAllNodes,
  CARD_WIDTH,
  CARD_WIDTH_MOBILE,
  CARD_HEIGHT,
  COLLAPSED_HEIGHT,
  MOBILE_BREAKPOINT,
} from '@/entities/graph';
import {
  useGraphNodes,
  usePersistence,
  useInitialExploration,
  FollowUpModal,
} from '@/features/explore-topic';
import { useShare } from '@/features/share-exploration';
import { useCanvasInteractions } from '../lib/use-canvas-interactions';
import { useTouch } from '../lib/use-touch';
import { GraphCard } from './GraphCard';
import { GraphEdges } from './GraphEdges';
import { ZoomControls } from './ZoomControls';
import { Minimap } from './Minimap';
import styles from './GraphCanvas.module.css';

interface GraphCanvasProps {
  initialTopic: string;
  savedExplorationId?: string;
}

export function GraphCanvas({ initialTopic, savedExplorationId }: GraphCanvasProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [initialized, setInitialized] = useState(false);
  const initialFitDone = useRef(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [followUpNodeId, setFollowUpNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [confirmDeleteNodeId, setConfirmDeleteNodeId] = useState<string | null>(null);
  const nodeHeights = useRef<HeightMap>(new Map());
  const explorationId = useRef(savedExplorationId || generateId());
  const cachedSettings = useRef<UserSettings | null>(null);
  const { user } = useAuth();

  const isMobile = viewportSize.width > 0 && viewportSize.width < MOBILE_BREAKPOINT;
  const currentHGap = isMobile ? 460 : 540;
  const currentCardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;

  // --- Feature hooks ---
  const {
    nodes, setNodes, isDirty, expandNode, deleteNode,
    handleKeywordClick, handleFollowUpSubmit, handleNodeResize,
  } = useGraphNodes({ currentHGap, currentCardWidth, nodeHeights });

  const {
    isPublic, setIsPublic, setOwnerId, linkCopied,
    isOwner, handleTogglePublic,
  } = useShare(explorationId.current, initialTopic);

  usePersistence({
    explorationId: explorationId.current,
    savedExplorationId,
    initialTopic,
    nodes,
    initialized,
    isDirty,
    isOwner,
    user,
    setNodes,
    setOwnerId,
    setIsPublic,
    setInitialized,
  });

  const { isLoading, error } = useInitialExploration({
    initialTopic,
    initialized,
    savedExplorationId,
    viewportSize,
    setNodes,
    setInitialized,
  });

  // --- Widget hooks ---
  const { draggedNodeId, isPanning, handleDragStart, handleCanvasMouseDown } =
    useCanvasInteractions({
      canvasRef,
      nodes,
      zoom,
      pan,
      setZoom,
      setPan,
      setNodes,
      initialized,
      zoomContainerClass: styles.zoomContainer,
    });

  useTouch({ canvasRef, zoom, pan, setZoom, setPan, initialized });

  // --- Viewport tracking ---
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setViewportSize({ width, height });
      }
    });

    ro.observe(canvas);
    return () => ro.disconnect();
  }, []);

  // --- Initial fit ---
  useEffect(() => {
    if (!initialized || initialFitDone.current || viewportSize.width === 0 || nodes.length === 0) return;
    initialFitDone.current = true;

    const fit = fitAllNodes(nodes, viewportSize.width, viewportSize.height, currentCardWidth, nodeHeights.current);
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [initialized, viewportSize, nodes, currentCardWidth]);

  // --- Zoom controls ---
  const zoomToCenter = useCallback((delta: number) => {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;

    setZoom((oldZoom) => {
      const newZoom = Math.min(Math.max(oldZoom + delta, 0.1), 2);
      const worldX = cx / oldZoom - pan.x;
      const worldY = cy / oldZoom - pan.y;
      setPan({
        x: cx / newZoom - worldX,
        y: cy / newZoom - worldY,
      });
      return newZoom;
    });
  }, [pan]);

  const handleZoomIn = useCallback(() => zoomToCenter(0.1), [zoomToCenter]);
  const handleZoomOut = useCallback(() => zoomToCenter(-0.1), [zoomToCenter]);

  const handleFitView = useCallback(() => {
    if (nodes.length === 0 || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const fit = fitAllNodes(nodes, rect.width, rect.height, currentCardWidth, nodeHeights.current);
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [nodes, currentCardWidth]);

  const handleMinimapNavigate = useCallback((x: number, y: number) => {
    setPan({ x, y });
  }, []);

  const handleCenterNode = useCallback((nodeId: string) => {
    const node = nodes.find(n => n.id === nodeId);
    if (!node || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const h = node.isExpanded ? (nodeHeights.current.get(nodeId) ?? CARD_HEIGHT) : COLLAPSED_HEIGHT;
    const w = node.isExpanded ? currentCardWidth : currentCardWidth * 0.55;
    setPan({
      x: rect.width / 2 / zoom - node.position.x - w / 2,
      y: rect.height / 2 / zoom - node.position.y - h / 2,
    });
  }, [nodes, zoom, currentCardWidth]);

  const onFollowUpSubmit = useCallback(
    async (question: string) => {
      if (!followUpNodeId) return;
      setFollowUpNodeId(null);
      await handleFollowUpSubmit(followUpNodeId, question);
    },
    [followUpNodeId, handleFollowUpSubmit]
  );

  // --- Cascade delete ---
  const handleDeleteRequest = useCallback(
    async (nodeId: string) => {
      const hasChildren = nodes.some(n => n.parentId === nodeId);
      if (!hasChildren) {
        deleteNode(nodeId);
        return;
      }

      if (!user?.uid) {
        setConfirmDeleteNodeId(nodeId);
        return;
      }

      try {
        if (!cachedSettings.current) {
          cachedSettings.current = await getUserSettings(user.uid);
        }
        if (shouldAskCascadeDelete(cachedSettings.current)) {
          setConfirmDeleteNodeId(nodeId);
        } else {
          deleteNode(nodeId);
        }
      } catch {
        deleteNode(nodeId);
      }
    },
    [nodes, user, deleteNode]
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteNodeId) return;
    if (user?.uid) {
      try {
        await markCascadeDeleteAsked(user.uid);
        cachedSettings.current = await getUserSettings(user.uid);
      } catch { /* best effort */ }
    }
    deleteNode(confirmDeleteNodeId);
    setConfirmDeleteNodeId(null);
  }, [confirmDeleteNodeId, user, deleteNode]);

  const handleCancelDelete = useCallback(async () => {
    if (user?.uid) {
      try {
        await markCascadeDeleteAsked(user.uid);
        cachedSettings.current = await getUserSettings(user.uid);
      } catch { /* best effort */ }
    }
    setConfirmDeleteNodeId(null);
  }, [user]);

  // --- Render ---
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
      </div>
    );
  }

  return (
    <div
      ref={canvasRef}
      className={`${styles.canvas} ${isPanning ? styles.panning : ''}`}
      onMouseDown={handleCanvasMouseDown}
    >
      <div
        className={styles.zoomContainer}
        style={{
          transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
          transformOrigin: '0 0',
        }}
      >
        <GraphEdges nodes={nodes} hoveredNodeId={hoveredNodeId} nodeHeights={nodeHeights.current} cardWidth={currentCardWidth} />
        {nodes.map((node) => (
          <GraphCard
            key={node.id}
            node={node}
            isDragging={draggedNodeId === node.id}
            onExpand={() => expandNode(node.id)}
            onDragStart={(x, y) => handleDragStart(node.id, x, y)}
            onAskFollowUp={isOwner && node.isExpanded ? () => setFollowUpNodeId(node.id) : undefined}
            onDelete={isOwner && node.parentId !== null ? () => handleDeleteRequest(node.id) : undefined}
            onKeywordClick={node.isExpanded ? (kw) => handleKeywordClick(node.id, kw) : undefined}
            onHover={() => setHoveredNodeId(node.id)}
            onHoverEnd={() => setHoveredNodeId(null)}
            onResize={handleNodeResize}
          />
        ))}
      </div>
      <ZoomControls
        zoom={zoom}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onReset={handleFitView}
        isPublic={isPublic}
        onTogglePublic={isOwner && initialized ? handleTogglePublic : undefined}
      />
      {linkCopied && (
        <div className={styles.toast}>Link copied!</div>
      )}
      <Minimap
        nodes={nodes}
        zoom={zoom}
        pan={pan}
        viewportWidth={viewportSize.width}
        viewportHeight={viewportSize.height}
        cardWidth={currentCardWidth}
        initialTopic={initialTopic}
        onNavigate={handleMinimapNavigate}
        onFitView={handleFitView}
        onCenterNode={handleCenterNode}
      />
      <FollowUpModal
        isOpen={followUpNodeId !== null}
        onClose={() => setFollowUpNodeId(null)}
        onSubmit={onFollowUpSubmit}
      />
      <ConfirmDialog
        isOpen={confirmDeleteNodeId !== null}
        title="Delete with branches?"
        message="This card has branches that will also be deleted."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        danger
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
      />
    </div>
  );
}
