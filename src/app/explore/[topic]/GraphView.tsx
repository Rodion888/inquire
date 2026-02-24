'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { exploreTopic, saveExploration, getExploration, setExplorationPublic } from '@/shared/api';
import { useAuth } from '@/shared/lib';
import { GraphNode } from './types';
import { GraphCard } from './GraphCard';
import { GraphEdges } from './GraphEdges';
import { ZoomControls } from './ZoomControls';
import { Minimap } from './Minimap';
import { FollowUpModal } from './FollowUpModal';
import styles from './GraphView.module.css';

interface GraphViewProps {
  initialTopic: string;
  savedExplorationId?: string;
}

const CARD_WIDTH = 400;
const CARD_WIDTH_MOBILE = 320;
const CARD_HEIGHT = 350;
const COLLAPSED_HEIGHT = 46;
const HORIZONTAL_GAP = 540;
const HORIZONTAL_GAP_MOBILE = 460;
const VERTICAL_GAP = 40;
const MOBILE_BREAKPOINT = 640;

function generateId() {
  return Math.random().toString(36).substring(2, 9);
}

type HeightMap = Map<string, number>;

function getNodeHeight(node: GraphNode, heights?: HeightMap): number {
  if (!node.isExpanded) return COLLAPSED_HEIGHT;
  return heights?.get(node.id) ?? CARD_HEIGHT;
}

function hasCollision(
  pos: { x: number; y: number },
  height: number,
  existingNodes: GraphNode[],
  heights?: HeightMap,
  cardWidth: number = CARD_WIDTH
): boolean {
  for (const node of existingNodes) {
    const nodeH = getNodeHeight(node, heights);
    const overlapX = Math.abs(pos.x - node.position.x) < cardWidth + 20;
    const overlapY =
      pos.y < node.position.y + nodeH + VERTICAL_GAP &&
      pos.y + height + VERTICAL_GAP > node.position.y;
    if (overlapX && overlapY) return true;
  }
  return false;
}

function resolveCollisions(nodes: GraphNode[], heights?: HeightMap): GraphNode[] {
  const result = nodes.map((n) => ({ ...n, position: { ...n.position } }));

  // Step 1: Center each sibling group on their parent
  const childrenByParent = new Map<string, number[]>();
  result.forEach((node, idx) => {
    if (node.parentId) {
      if (!childrenByParent.has(node.parentId)) childrenByParent.set(node.parentId, []);
      childrenByParent.get(node.parentId)!.push(idx);
    }
  });

  childrenByParent.forEach((childIndices, parentId) => {
    const parent = result.find((n) => n.id === parentId);
    if (!parent) return;

    const parentCenterY = parent.position.y + getNodeHeight(parent, heights) / 2;

    // Sort children by current Y
    childIndices.sort((a, b) => result[a].position.y - result[b].position.y);

    // Calculate total height of children group
    let totalHeight = 0;
    for (const idx of childIndices) {
      totalHeight += getNodeHeight(result[idx], heights);
    }
    totalHeight += (childIndices.length - 1) * VERTICAL_GAP;

    // Position centered on parent
    let currentY = parentCenterY - totalHeight / 2;
    for (const idx of childIndices) {
      result[idx].position.y = currentY;
      currentY += getNodeHeight(result[idx], heights) + VERTICAL_GAP;
    }
  });

  // Step 2: Resolve cross-group overlaps by column
  const columns = new Map<number, number[]>();
  result.forEach((node, idx) => {
    const col = Math.round(node.position.x / 100) * 100;
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col)!.push(idx);
  });

  let changed = true;
  let passes = 0;
  while (changed && passes < 10) {
    changed = false;
    passes++;

    columns.forEach((indices) => {
      indices.sort((a, b) => result[a].position.y - result[b].position.y);

      for (let i = 1; i < indices.length; i++) {
        const prev = result[indices[i - 1]];
        const curr = result[indices[i]];
        const prevHeight = getNodeHeight(prev, heights);
        const minY = prev.position.y + prevHeight + VERTICAL_GAP;

        if (curr.position.y < minY) {
          curr.position.y = minY;
          changed = true;
        }
      }
    });
  }

  return result;
}

function fitAllNodes(
  allNodes: GraphNode[],
  viewportW: number,
  viewportH: number,
  cardWidth: number,
  heights?: HeightMap
): { zoom: number; pan: { x: number; y: number } } {
  if (allNodes.length === 0) return { zoom: 1, pan: { x: 0, y: 0 } };

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const node of allNodes) {
    const w = node.isExpanded ? cardWidth : cardWidth * 0.55;
    const h = getNodeHeight(node, heights);
    minX = Math.min(minX, node.position.x);
    minY = Math.min(minY, node.position.y);
    maxX = Math.max(maxX, node.position.x + w);
    maxY = Math.max(maxY, node.position.y + h);
  }

  const contentW = maxX - minX;
  const contentH = maxY - minY;
  const centerX = (minX + maxX) / 2;
  const centerY = (minY + maxY) / 2;

  const pad = 60;
  const zoomX = (viewportW - pad * 2) / contentW;
  const zoomY = (viewportH - pad * 2) / contentH;
  const zoom = Math.min(Math.max(Math.min(zoomX, zoomY), 0.15), 1);

  const pan = {
    x: viewportW / 2 / zoom - centerX,
    y: viewportH / 2 / zoom - centerY,
  };

  return { zoom, pan };
}

function calculateChildPositions(
  parentNode: GraphNode,
  count: number,
  existingNodes: GraphNode[],
  heights?: HeightMap,
  hGap: number = HORIZONTAL_GAP,
  cardWidth: number = CARD_WIDTH
): { x: number; y: number }[] {
  const x = parentNode.position.x + hGap;
  const parentCenterY = parentNode.position.y + getNodeHeight(parentNode, heights) / 2;

  const totalHeight = count * COLLAPSED_HEIGHT + (count - 1) * VERTICAL_GAP;
  let startY = parentCenterY - totalHeight / 2;

  const positions: { x: number; y: number }[] = [];

  for (let i = 0; i < count; i++) {
    let y = startY + i * (COLLAPSED_HEIGHT + VERTICAL_GAP);
    const pos = { x, y };

    const allToCheck = [
      ...existingNodes,
      ...positions.map((p) => ({
        position: p,
        isExpanded: false,
      } as GraphNode)),
    ];

    let attempts = 0;
    while (hasCollision(pos, COLLAPSED_HEIGHT, allToCheck, heights, cardWidth) && attempts < 50) {
      pos.y += COLLAPSED_HEIGHT + VERTICAL_GAP;
      attempts++;
    }

    positions.push({ x: pos.x, y: pos.y });
  }

  return positions;
}

export function GraphView({ initialTopic, savedExplorationId }: GraphViewProps) {
  const canvasRef = useRef<HTMLDivElement>(null);
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const [initialized, setInitialized] = useState(false);
  const initialFitDone = useRef(false);
  const [draggedNodeId, setDraggedNodeId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [viewportSize, setViewportSize] = useState({ width: 0, height: 0 });
  const [followUpNodeId, setFollowUpNodeId] = useState<string | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [isPublic, setIsPublic] = useState(false);
  const [ownerId, setOwnerId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const panStart = useRef({ x: 0, y: 0 });
  const explorationId = useRef(savedExplorationId || generateId());
  const isDirty = useRef(false);
  const nodeHeights = useRef<HeightMap>(new Map());
  const relayoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { user } = useAuth();
  const isOwner = !ownerId || (user?.uid === ownerId);
  const isMobile = viewportSize.width > 0 && viewportSize.width < MOBILE_BREAKPOINT;
  const currentHGap = isMobile ? HORIZONTAL_GAP_MOBILE : HORIZONTAL_GAP;
  const currentCardWidth = isMobile ? CARD_WIDTH_MOBILE : CARD_WIDTH;

  const markDirty = useCallback(() => {
    isDirty.current = true;
  }, []);

  const handleNodeResize = useCallback((nodeId: string, height: number) => {
    const current = nodeHeights.current.get(nodeId);
    if (current !== undefined && Math.abs(current - height) < 2) return;
    nodeHeights.current.set(nodeId, height);

    if (relayoutTimer.current) clearTimeout(relayoutTimer.current);
    relayoutTimer.current = setTimeout(() => {
      setNodes(prev => resolveCollisions(prev, nodeHeights.current));
    }, 50);
  }, []);

  // Load saved exploration from Firestore
  useEffect(() => {
    if (!savedExplorationId || initialized) return;

    getExploration(savedExplorationId).then((exploration) => {
      if (exploration && exploration.nodes.length > 0) {
        setNodes(exploration.nodes);
        setOwnerId(exploration.userId);
        setIsPublic(exploration.isPublic);
        setInitialized(true);
      }
    }).catch(() => {});
  }, [savedExplorationId, initialized]);

  // Initial fit: run once after nodes are loaded and viewport is measured
  useEffect(() => {
    if (!initialized || initialFitDone.current || viewportSize.width === 0 || nodes.length === 0) return;
    initialFitDone.current = true;

    const fit = fitAllNodes(nodes, viewportSize.width, viewportSize.height, currentCardWidth, nodeHeights.current);
    setZoom(fit.zoom);
    setPan(fit.pan);
  }, [initialized, viewportSize, nodes, currentCardWidth]);

  // Auto-save to Firestore (debounced 2s, only when dirty, only for owner)
  useEffect(() => {
    if (!user || !initialized || !isDirty.current || !isOwner) return;

    const timer = setTimeout(() => {
      saveExploration(explorationId.current, user.uid, initialTopic, nodes).catch(() => {});
      isDirty.current = false;
    }, 2000);

    return () => clearTimeout(timer);
  }, [nodes, user, initialized, initialTopic]);

  // Track viewport size via ResizeObserver for accurate dimensions
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

  const handleFollowUpSubmit = useCallback(
    async (question: string) => {
      if (!followUpNodeId) return;

      const parentNode = nodes.find((n) => n.id === followUpNodeId);
      if (!parentNode) return;

      setFollowUpNodeId(null);
      markDirty();

      const newId = generateId();
      const [position] = calculateChildPositions(parentNode, 1, nodes, nodeHeights.current, currentHGap, currentCardWidth);

      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          topic: question,
          title: question,
          content: '',
          relatedTopics: [],
          position,
          parentId: followUpNodeId,
          isExpanded: false,
          isLoading: true,
        },
      ]);

      try {
        const result = await exploreTopic(question);

        setNodes((prev) => {
          const updatedNodes = prev.map((n) =>
            n.id === newId
              ? {
                  ...n,
                  title: result.title,
                  content: result.content,
                  blocks: result.blocks,
                  relatedTopics: result.relatedTopics,
                  isLoading: false,
                  isExpanded: true,
                }
              : n
          );

          const expandedNode = updatedNodes.find((n) => n.id === newId)!;
          const topics = result.relatedTopics.slice(0, 3);
          const positions = calculateChildPositions(expandedNode, topics.length, updatedNodes, nodeHeights.current, currentHGap, currentCardWidth);
          const suggestionNodes: GraphNode[] = topics.map((topic, index) => ({
            id: generateId(),
            topic,
            title: topic,
            content: '',
            relatedTopics: [],
            position: positions[index],
            parentId: newId,
            isExpanded: false,
          }));

          return resolveCollisions([...updatedNodes, ...suggestionNodes], nodeHeights.current);
        });
      } catch {
        setNodes((prev) => prev.filter((n) => n.id !== newId));
      }
    },
    [followUpNodeId, nodes, currentHGap, currentCardWidth]
  );

  const { data, isLoading, error } = useQuery({
    queryKey: ['exploration', initialTopic],
    queryFn: () => exploreTopic(initialTopic),
    enabled: !initialized && !savedExplorationId,
  });

  useEffect(() => {
    if (data && !initialized && viewportSize.width > 0) {
      const isMob = viewportSize.width < MOBILE_BREAKPOINT;
      const hGap = isMob ? HORIZONTAL_GAP_MOBILE : HORIZONTAL_GAP;

      const rootId = generateId();
      const rootNode: GraphNode = {
        id: rootId,
        topic: initialTopic,
        title: data.title,
        content: data.content,
        blocks: data.blocks,
        relatedTopics: data.relatedTopics,
        position: { x: 0, y: 0 },
        parentId: null,
        isExpanded: true,
      };

      const topics = data.relatedTopics.slice(0, 3);
      const x = rootNode.position.x + hGap;
      const parentCenterY = rootNode.position.y + CARD_HEIGHT / 2;
      const totalHeight = topics.length * COLLAPSED_HEIGHT + (topics.length - 1) * VERTICAL_GAP;
      const startY = parentCenterY - totalHeight / 2;
      const suggestionNodes: GraphNode[] = topics.map((topic, index) => ({
        id: generateId(),
        topic,
        title: topic,
        content: '',
        relatedTopics: [],
        position: { x, y: startY + index * (COLLAPSED_HEIGHT + VERTICAL_GAP) },
        parentId: rootId,
        isExpanded: false,
      }));

      const allNodes = [rootNode, ...suggestionNodes];
      setNodes(allNodes);
      setInitialized(true);
    }
  }, [data, initialized, initialTopic, viewportSize]);

  const expandNode = useCallback(
    async (nodeId: string) => {
      const node = nodes.find((n) => n.id === nodeId);
      if (!node || node.isExpanded || node.isLoading) return;
      markDirty();

      setNodes((prev) =>
        prev.map((n) =>
          n.id === nodeId ? { ...n, isLoading: true } : n
        )
      );

      try {
        const result = await exploreTopic(node.topic);

        setNodes((prev) => {
          const updatedNodes = prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  title: result.title,
                  content: result.content,
                  blocks: result.blocks,
                  relatedTopics: result.relatedTopics,
                  isLoading: false,
                  isExpanded: true,
                }
              : n
          );

          const expandedNode = updatedNodes.find((n) => n.id === nodeId)!;
          const topics = result.relatedTopics.slice(0, 3);
          const positions = calculateChildPositions(expandedNode, topics.length, updatedNodes, nodeHeights.current, currentHGap, currentCardWidth);
          const suggestionNodes: GraphNode[] = topics.map((topic, index) => ({
            id: generateId(),
            topic,
            title: topic,
            content: '',
            relatedTopics: [],
            position: positions[index],
            parentId: nodeId,
            isExpanded: false,
          }));

          return resolveCollisions([...updatedNodes, ...suggestionNodes], nodeHeights.current);
        });
      } catch {
        setNodes((prev) =>
          prev.map((n) =>
            n.id === nodeId ? { ...n, isLoading: false } : n
          )
        );
      }
    },
    [nodes, currentHGap, currentCardWidth]
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => {
      // Collect all descendant IDs
      const toRemove = new Set<string>();
      toRemove.add(nodeId);
      let added = true;
      while (added) {
        added = false;
        for (const n of prev) {
          if (n.parentId && toRemove.has(n.parentId) && !toRemove.has(n.id)) {
            toRemove.add(n.id);
            added = true;
          }
        }
      }
      return prev.filter((n) => !toRemove.has(n.id));
    });
    markDirty();
  }, [markDirty]);

  const handleTogglePublic = useCallback(async () => {
    const id = explorationId.current;
    const newValue = !isPublic;
    await setExplorationPublic(id, newValue);
    setIsPublic(newValue);
    if (newValue) {
      const url = `${window.location.origin}/explore/${encodeURIComponent(initialTopic)}?id=${id}`;
      await navigator.clipboard.writeText(url);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    }
  }, [isPublic, initialTopic]);

  const handleKeywordClick = useCallback(
    async (parentNodeId: string, keyword: string) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;
      markDirty();

      const newId = generateId();
      const [position] = calculateChildPositions(parentNode, 1, nodes, nodeHeights.current, currentHGap, currentCardWidth);

      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          topic: keyword,
          title: keyword,
          content: '',
          relatedTopics: [],
          position,
          parentId: parentNodeId,
          isExpanded: false,
          isLoading: true,
        },
      ]);

      try {
        const result = await exploreTopic(keyword);

        setNodes((prev) => {
          const updatedNodes = prev.map((n) =>
            n.id === newId
              ? {
                  ...n,
                  title: result.title,
                  content: result.content,
                  blocks: result.blocks,
                  relatedTopics: result.relatedTopics,
                  isLoading: false,
                  isExpanded: true,
                }
              : n
          );

          const expandedNode = updatedNodes.find((n) => n.id === newId)!;
          const topics = result.relatedTopics.slice(0, 3);
          const positions = calculateChildPositions(expandedNode, topics.length, updatedNodes, nodeHeights.current, currentHGap, currentCardWidth);
          const suggestionNodes: GraphNode[] = topics.map((topic, index) => ({
            id: generateId(),
            topic,
            title: topic,
            content: '',
            relatedTopics: [],
            position: positions[index],
            parentId: newId,
            isExpanded: false,
          }));

          return resolveCollisions([...updatedNodes, ...suggestionNodes], nodeHeights.current);
        });
      } catch {
        setNodes((prev) => prev.filter((n) => n.id !== newId));
      }
    },
    [nodes, markDirty, currentHGap, currentCardWidth]
  );

  // Card drag handlers
  const handleDragStart = useCallback((nodeId: string, clientX: number, clientY: number) => {
    const node = nodes.find((n) => n.id === nodeId);
    if (!node) return;

    setDraggedNodeId(nodeId);
    dragOffset.current = {
      x: clientX / zoom - node.position.x - pan.x,
      y: clientY / zoom - node.position.y - pan.y,
    };
  }, [nodes, zoom, pan]);

  const handleDragMove = useCallback((clientX: number, clientY: number) => {
    if (!draggedNodeId) return;

    setNodes((prev) =>
      prev.map((node) =>
        node.id === draggedNodeId
          ? {
              ...node,
              position: {
                x: clientX / zoom - dragOffset.current.x - pan.x,
                y: clientY / zoom - dragOffset.current.y - pan.y,
              },
            }
          : node
      )
    );
  }, [draggedNodeId, zoom, pan]);

  const handleDragEnd = useCallback(() => {
    setDraggedNodeId(null);
  }, []);

  // Canvas pan handlers
  const handleCanvasMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest(`.${styles.zoomContainer}`) === e.target) {
      setIsPanning(true);
      panStart.current = {
        x: e.clientX - pan.x * zoom,
        y: e.clientY - pan.y * zoom,
      };
    }
  }, [pan, zoom]);

  // Wheel/touchpad handler - pan & pinch zoom
  const zoomRef = useRef(zoom);
  const panRef = useRef(pan);
  zoomRef.current = zoom;
  panRef.current = pan;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const handleWheel = (e: WheelEvent) => {
      // If cursor is over scrollable card content — capture all scroll
      const target = e.target as HTMLElement;
      const cardContent = target.closest('[data-card-content]') as HTMLElement | null;
      if (cardContent && !e.ctrlKey && !e.metaKey) {
        const hasVerticalScroll = cardContent.scrollHeight > cardContent.clientHeight;
        // Check for horizontally scrollable element (e.g. code block)
        const hScrollEl = target.closest('pre') as HTMLElement | null;
        const hasHorizontalScroll = hScrollEl && hScrollEl.scrollWidth > hScrollEl.clientWidth;

        if (hasVerticalScroll || hasHorizontalScroll) {
          e.preventDefault();
          if (hasVerticalScroll) cardContent.scrollTop += e.deltaY;
          if (hasHorizontalScroll) hScrollEl.scrollLeft += e.deltaX;
          return;
        }
      }

      e.preventDefault();

      if (e.ctrlKey || e.metaKey) {
        // Pinch-to-zoom toward cursor position
        const rect = canvas.getBoundingClientRect();
        const cursorX = e.clientX - rect.left;
        const cursorY = e.clientY - rect.top;

        const oldZoom = zoomRef.current;
        const delta = -e.deltaY * 0.005;
        const newZoom = Math.min(Math.max(oldZoom + delta, 0.1), 2);

        // World position under cursor before zoom
        const worldX = cursorX / oldZoom - panRef.current.x;
        const worldY = cursorY / oldZoom - panRef.current.y;

        // Adjust pan so same world point stays under cursor
        const newPanX = cursorX / newZoom - worldX;
        const newPanY = cursorY / newZoom - worldY;

        setZoom(newZoom);
        setPan({ x: newPanX, y: newPanY });
      } else {
        // Regular scroll/swipe = pan
        setPan((p) => ({
          x: p.x - e.deltaX / zoomRef.current,
          y: p.y - e.deltaY / zoomRef.current,
        }));
      }
    };

    canvas.addEventListener('wheel', handleWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', handleWheel);
  }, [initialized]);

  // Global mouse handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggedNodeId) {
        handleDragMove(e.clientX, e.clientY);
      } else if (isPanning) {
        setPan({
          x: (e.clientX - panStart.current.x) / zoom,
          y: (e.clientY - panStart.current.y) / zoom,
        });
      }
    };

    const handleMouseUp = () => {
      handleDragEnd();
      setIsPanning(false);
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (draggedNodeId && e.touches.length === 1) {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
      }
    };

    const handleTouchEnd = () => {
      if (draggedNodeId) handleDragEnd();
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('touchmove', handleTouchMove, { passive: false });
    window.addEventListener('touchend', handleTouchEnd);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleTouchEnd);
    };
  }, [draggedNodeId, isPanning, handleDragMove, handleDragEnd, zoom]);

  // Touch handlers for mobile
  const touchRef = useRef<{ startX: number; startY: number; startPanX: number; startPanY: number; pinchDist: number; pinchZoom: number } | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const getDistance = (t1: Touch, t2: Touch) =>
      Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY);

    const handleTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        // Pinch zoom start
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        touchRef.current = {
          startX: 0, startY: 0,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          pinchDist: dist, pinchZoom: zoomRef.current,
        };
      } else if (e.touches.length === 1) {
        const target = e.target as HTMLElement;
        // Don't intercept touches on card content (allow native scroll)
        if (target.closest('[data-card-content]')) return;
        // Don't intercept touches on cards (they handle their own)
        if (target.closest('article')) return;

        e.preventDefault();
        touchRef.current = {
          startX: e.touches[0].clientX,
          startY: e.touches[0].clientY,
          startPanX: panRef.current.x, startPanY: panRef.current.y,
          pinchDist: 0, pinchZoom: 0,
        };
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchRef.current) return;

      if (e.touches.length === 2 && touchRef.current.pinchDist > 0) {
        e.preventDefault();
        const dist = getDistance(e.touches[0], e.touches[1]);
        const scale = dist / touchRef.current.pinchDist;
        const newZoom = Math.min(Math.max(touchRef.current.pinchZoom * scale, 0.1), 2);

        // Zoom toward midpoint
        const rect = canvas.getBoundingClientRect();
        const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
        const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;

        const oldZoom = zoomRef.current;
        const worldX = midX / oldZoom - panRef.current.x;
        const worldY = midY / oldZoom - panRef.current.y;

        setZoom(newZoom);
        setPan({ x: midX / newZoom - worldX, y: midY / newZoom - worldY });
      } else if (e.touches.length === 1 && touchRef.current.pinchDist === 0) {
        e.preventDefault();
        const dx = e.touches[0].clientX - touchRef.current.startX;
        const dy = e.touches[0].clientY - touchRef.current.startY;
        setPan({
          x: touchRef.current.startPanX + dx / zoomRef.current,
          y: touchRef.current.startPanY + dy / zoomRef.current,
        });
      }
    };

    const handleTouchEnd = () => {
      touchRef.current = null;
    };

    canvas.addEventListener('touchstart', handleTouchStart, { passive: false });
    canvas.addEventListener('touchmove', handleTouchMove, { passive: false });
    canvas.addEventListener('touchend', handleTouchEnd);

    return () => {
      canvas.removeEventListener('touchstart', handleTouchStart);
      canvas.removeEventListener('touchmove', handleTouchMove);
      canvas.removeEventListener('touchend', handleTouchEnd);
    };
  }, [initialized]);

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
            onDelete={isOwner && node.parentId !== null ? () => deleteNode(node.id) : undefined}
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
        onNavigate={handleMinimapNavigate}
      />
      <FollowUpModal
        isOpen={followUpNodeId !== null}
        onClose={() => setFollowUpNodeId(null)}
        onSubmit={handleFollowUpSubmit}
      />
    </div>
  );
}
