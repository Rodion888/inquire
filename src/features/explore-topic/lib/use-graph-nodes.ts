'use client';

import { useState, useCallback, useRef } from 'react';
import type { GraphNode, HeightMap, DefinitionItem } from '@/shared/types';
import { exploreTopic } from '@/shared/api';
import type { ExploreContext, BranchNode } from '@/shared/api';
import {
  generateId,
  resolveCollisions,
  calculateChildPositions,
} from '@/entities/graph';

interface UseGraphNodesOptions {
  currentHGap: number;
  currentCardWidth: number;
  nodeHeights: React.MutableRefObject<HeightMap>;
}

function collectExistingTopics(nodes: GraphNode[]): string[] {
  return [...new Set(nodes.map(n => n.topic))];
}

function getBranchChain(nodes: GraphNode[], nodeId: string): BranchNode[] {
  const chain: BranchNode[] = [];
  let current = nodes.find(n => n.id === nodeId);
  while (current) {
    if (current.isExpanded && current.content) {
      chain.unshift({
        topic: current.topic,
        title: current.title,
        category: current.category,
      });
    }
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return chain;
}

function getNodeContentSummary(node: GraphNode): string[] {
  if (!node.blocks?.length) {
    const text = node.content?.slice(0, 200) ?? '';
    return text ? [text] : [];
  }

  const parts: string[] = [];
  for (const block of node.blocks) {
    if (block.type === 'definition') {
      const items = (block.items ?? []) as DefinitionItem[];
      if (items.length) parts.push(items.map(i => i.term).join(', '));
    } else if (block.type === 'list') {
      const items = (block.items ?? []) as string[];
      if (items.length) parts.push(items.slice(0, 10).join(', '));
    } else if (block.type === 'table' && block.headers) {
      parts.push(block.headers.join(', '));
    }
  }
  return parts;
}

function getBranchContentSummary(nodes: GraphNode[], nodeId: string): string {
  const summaries: string[] = [];
  let current = nodes.find(n => n.id === nodeId);
  while (current) {
    if (current.isExpanded && current.content) {
      const parts = getNodeContentSummary(current);
      if (parts.length) summaries.unshift(parts.join(', '));
    }
    current = current.parentId ? nodes.find(n => n.id === current!.parentId) : undefined;
  }
  return summaries.join(' | ').slice(0, 1500);
}

function randomSuggestionCount(): number {
  return Math.floor(Math.random() * 3) + 1;
}

function buildContext(nodes: GraphNode[], parentNode: GraphNode): ExploreContext {
  return {
    branchChain: getBranchChain(nodes, parentNode.id),
    parentContent: getBranchContentSummary(nodes, parentNode.id),
    existingTopics: collectExistingTopics(nodes),
  };
}

export function useGraphNodes({ currentHGap, currentCardWidth, nodeHeights }: UseGraphNodesOptions) {
  const [nodes, setNodes] = useState<GraphNode[]>([]);
  const isDirty = useRef(false);
  const relayoutTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  }, [nodeHeights]);

  const createChildNode = useCallback(
    async (parentNodeId: string, topic: string) => {
      const parentNode = nodes.find((n) => n.id === parentNodeId);
      if (!parentNode) return;
      markDirty();

      const newId = generateId();
      const [position] = calculateChildPositions(
        parentNode, 1, nodes, nodeHeights.current, currentHGap, currentCardWidth
      );

      setNodes((prev) => [
        ...prev,
        {
          id: newId,
          topic,
          title: topic,
          content: '',
          relatedTopics: [],
          position,
          parentId: parentNodeId,
          isExpanded: false,
          isLoading: true,
        },
      ]);

      try {
        const context = buildContext(nodes, parentNode);
        const result = await exploreTopic(topic, context);

        setNodes((prev) => {
          const updatedNodes = prev.map((n) =>
            n.id === newId
              ? {
                  ...n,
                  title: result.title,
                  content: result.content,
                  blocks: result.blocks,
                  category: result.category,
                  relatedTopics: result.relatedTopics,
                  isLoading: false,
                  isExpanded: true,
                }
              : n
          );

          const expandedNode = updatedNodes.find((n) => n.id === newId)!;
          const count = randomSuggestionCount();
          const topics = result.relatedTopics.slice(0, count);
          const positions = calculateChildPositions(
            expandedNode, topics.length, updatedNodes, nodeHeights.current, currentHGap, currentCardWidth
          );
          const suggestionNodes: GraphNode[] = topics.map((t, index) => ({
            id: generateId(),
            topic: t,
            title: t,
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
    [nodes, currentHGap, currentCardWidth, nodeHeights, markDirty]
  );

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
        const parentNode = nodes.find(n => n.id === node.parentId);
        const context: ExploreContext = parentNode
          ? buildContext(nodes, parentNode)
          : { existingTopics: collectExistingTopics(nodes) };
        const result = await exploreTopic(node.topic, context);

        setNodes((prev) => {
          const updatedNodes = prev.map((n) =>
            n.id === nodeId
              ? {
                  ...n,
                  title: result.title,
                  content: result.content,
                  blocks: result.blocks,
                  category: result.category,
                  relatedTopics: result.relatedTopics,
                  isLoading: false,
                  isExpanded: true,
                }
              : n
          );

          const expandedNode = updatedNodes.find((n) => n.id === nodeId)!;
          const count = randomSuggestionCount();
          const topics = result.relatedTopics.slice(0, count);
          const positions = calculateChildPositions(
            expandedNode, topics.length, updatedNodes, nodeHeights.current, currentHGap, currentCardWidth
          );
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
    [nodes, currentHGap, currentCardWidth, nodeHeights, markDirty]
  );

  const deleteNode = useCallback((nodeId: string) => {
    setNodes((prev) => {
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

  const handleKeywordClick = useCallback(
    (parentNodeId: string, keyword: string) => createChildNode(parentNodeId, keyword),
    [createChildNode]
  );

  const handleFollowUpSubmit = useCallback(
    (parentNodeId: string, question: string) => createChildNode(parentNodeId, question),
    [createChildNode]
  );

  return {
    nodes,
    setNodes,
    isDirty,
    markDirty,
    expandNode,
    deleteNode,
    handleKeywordClick,
    handleFollowUpSubmit,
    handleNodeResize,
  };
}
