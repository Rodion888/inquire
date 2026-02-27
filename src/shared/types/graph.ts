// === Topic category ===
export type TopicCategory =
  | 'vocabulary'
  | 'programming'
  | 'comparison'
  | 'how-to'
  | 'history'
  | 'science'
  | 'general';

// === Content blocks ===
export interface DefinitionItem {
  term: string;
  definition: string;
}

export interface ContentBlock {
  type: 'text' | 'heading' | 'subheading' | 'list' | 'code' | 'definition' | 'table' | 'callout';
  content?: string;
  items?: string[] | DefinitionItem[];
  language?: string;
  headers?: string[];
  rows?: string[][];
  variant?: 'tip' | 'note' | 'warning';
}

// === Graph ===
export interface GraphNode {
  id: string;
  topic: string;
  title: string;
  content: string;
  blocks?: ContentBlock[];
  category?: TopicCategory;
  relatedTopics: string[];
  position: { x: number; y: number };
  parentId: string | null;
  isLoading?: boolean;
  isExpanded?: boolean;
}

export interface GraphState {
  nodes: GraphNode[];
  selectedNodeId: string | null;
}

export type HeightMap = Map<string, number>;
