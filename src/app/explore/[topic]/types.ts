export interface ContentBlock {
  type: 'text' | 'heading' | 'list' | 'code';
  content?: string;
  items?: string[];
  language?: string;
}

export interface GraphNode {
  id: string;
  topic: string;
  title: string;
  content: string;
  blocks?: ContentBlock[];
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
