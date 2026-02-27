'use client';

import { useEffect } from 'react';
import type { GraphNode } from '@/shared/types';
import { saveExploration, getExploration } from '@/shared/api';
import type { User } from 'firebase/auth';

interface UsePersistenceOptions {
  explorationId: string;
  savedExplorationId?: string;
  initialTopic: string;
  nodes: GraphNode[];
  initialized: boolean;
  isDirty: React.MutableRefObject<boolean>;
  isOwner: boolean;
  user: User | null;
  setNodes: React.Dispatch<React.SetStateAction<GraphNode[]>>;
  setOwnerId: (id: string | null) => void;
  setIsPublic: (val: boolean) => void;
  setInitialized: (val: boolean) => void;
}

export function usePersistence({
  explorationId,
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
}: UsePersistenceOptions) {
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
  }, [savedExplorationId, initialized, setNodes, setOwnerId, setIsPublic, setInitialized]);

  // Auto-save to Firestore (debounced 2s, only when dirty, only for owner)
  useEffect(() => {
    if (!user || !initialized || !isDirty.current || !isOwner) return;

    const timer = setTimeout(() => {
      saveExploration(explorationId, user.uid, initialTopic, nodes).catch(() => {});
      isDirty.current = false;
    }, 2000);

    return () => clearTimeout(timer);
  }, [nodes, user, initialized, initialTopic, explorationId, isDirty, isOwner]);
}
