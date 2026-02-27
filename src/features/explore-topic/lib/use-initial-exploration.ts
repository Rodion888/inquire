'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { GraphNode } from '@/shared/types';
import { exploreTopic } from '@/shared/api';
import {
  generateId,
  CARD_HEIGHT,
  COLLAPSED_HEIGHT,
  VERTICAL_GAP,
  HORIZONTAL_GAP,
  HORIZONTAL_GAP_MOBILE,
  MOBILE_BREAKPOINT,
} from '@/entities/graph';

interface UseInitialExplorationOptions {
  initialTopic: string;
  initialized: boolean;
  savedExplorationId?: string;
  viewportSize: { width: number; height: number };
  setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
  setInitialized: (val: boolean) => void;
}

export function useInitialExploration({
  initialTopic,
  initialized,
  savedExplorationId,
  viewportSize,
  setNodes,
  setInitialized,
}: UseInitialExplorationOptions) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['exploration', initialTopic],
    queryFn: () => exploreTopic(initialTopic),
    enabled: !initialized && !savedExplorationId,
  });

  useEffect(() => {
    if (data && !initialized) {
      const isMob = viewportSize.width > 0 && viewportSize.width < MOBILE_BREAKPOINT;
      const hGap = isMob ? HORIZONTAL_GAP_MOBILE : HORIZONTAL_GAP;

      const rootId = generateId();
      const rootNode: GraphNode = {
        id: rootId,
        topic: initialTopic,
        title: data.title,
        content: data.content,
        blocks: data.blocks,
        category: data.category,
        relatedTopics: data.relatedTopics,
        position: { x: 0, y: 0 },
        parentId: null,
        isExpanded: true,
      };

      const count = Math.floor(Math.random() * 3) + 1;
      const topics = data.relatedTopics.slice(0, count);
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
  }, [data, initialized, initialTopic, viewportSize, setNodes, setInitialized]);

  return { isLoading, error };
}
