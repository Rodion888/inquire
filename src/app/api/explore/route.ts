import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { ContentBlock, TopicCategory, DefinitionItem } from '@/shared/types';

interface TopicExploration {
  title: string;
  content: string;
  blocks: ContentBlock[];
  category?: TopicCategory;
  relatedTopics: string[];
}

interface RawExploration {
  title: string;
  blocks?: ContentBlock[];
  content?: string;
  category?: TopicCategory;
  relatedTopics: string[];
}

interface BranchNode {
  topic: string;
  title: string;
  category?: TopicCategory;
}

interface ExploreContext {
  branchChain?: BranchNode[];
  parentContent?: string;
  existingTopics?: string[];
}

const EXPLORATION_PROMPT = `You are a knowledge assistant. Do exactly what the user asks — nothing more, nothing less.

## STRICT RULES

1. NO commentary. No "This is a great topic!", no "Let's explore...", no "Here's what you need to know". Just deliver the content.
2. NO filler. Every sentence must carry information. If a sentence can be removed without losing meaning — remove it.
3. NO introductions unless the topic genuinely needs context. "React hooks" → start explaining hooks. "English words" → start listing words.
4. Answer PRECISELY what was asked. "list of words" = give words, not an essay about language learning. "how useState works" = explain useState, not all of React.
5. Be SPECIFIC. Use real examples, real names, real numbers. Never say "there are many ways to..." — name them.

## Response format

JSON:
{
  "title": "Topic Title",
  "blocks": [ ... ],
  "relatedTopics": ["Topic 1", "Topic 2", "Topic 3", "Topic 4"]
}

## Block types

Use whichever blocks fit. No required order, no mandatory blocks.

{ "type": "text", "content": "Paragraph. **bold** for key terms, *italic* for emphasis, \`code\` for technical, [[BADGE]] for labels." }
{ "type": "heading", "content": "Section Title" }
{ "type": "subheading", "content": "Subsection" }
{ "type": "list", "items": ["**Term** — description", "Item"] }
{ "type": "code", "content": "const x = 1;", "language": "javascript" }
{ "type": "definition", "items": [{ "term": "Hello", "definition": "Привет" }] }
{ "type": "table", "headers": ["Name", "Type"], "rows": [["**count**", "\`number\`"]] }
{ "type": "callout", "variant": "tip", "content": "Short note." }

## Guidelines

- Respond in the same language as the input
- **bold** key concepts the user might want to explore deeper
- Table rows must match header count
- If the user wants a list/table/definitions — give ONLY that, no surrounding prose
- Callouts: 1 sentence max, only when genuinely useful (gotcha, warning, pro tip)
- 4-6 related topics as logical next steps, never repeat what's already in the graph

## Continuation

- "more"/"next"/"continue" = full card of NEW content, same density
- With branch context: stay consistent, don't repeat what was shown
- Follow-up question: answer in context of the parent card`;

function buildUserMessage(topic: string, context?: ExploreContext): string {
  let message = `Topic: ${topic}`;

  if (context?.branchChain?.length) {
    const chain = context.branchChain;
    const root = chain[0];
    const parent = chain[chain.length - 1];

    message += `\n\nBRANCH CONTEXT (the user's exploration path — this is crucial for understanding what they want):`;
    message += `\nRoot: "${root.topic}"`;
    if (chain.length > 1) {
      message += `\nPath: ${chain.map(n => `"${n.title}"`).join(' → ')} → current`;
    }
    message += `\nParent card: "${parent.title}"`;

    if (context.parentContent) {
      message += `\nAll content shown in this branch so far: ${context.parentContent}`;
    }

    message += `\n\nStay consistent with the branch context above. Avoid repeating content already shown.`;
  }

  if (context?.existingTopics?.length) {
    message += `\n\nALREADY IN THE GRAPH (do NOT repeat content from these, do NOT suggest them as related topics):\n- ${context.existingTopics.join('\n- ')}`;
  }

  return message;
}

function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks.map(b => {
    switch (b.type) {
      case 'list':
        return ((b.items ?? []) as string[]).join('\n');
      case 'definition':
        return ((b.items ?? []) as DefinitionItem[]).map(d => `${d.term}: ${d.definition}`).join('\n');
      case 'table':
        return [(b.headers ?? []).join(' | '), ...(b.rows ?? []).map(r => r.join(' | '))].join('\n');
      case 'callout':
        return `[${b.variant ?? 'note'}] ${b.content ?? ''}`;
      default:
        return b.content ?? '';
    }
  }).join('\n\n');
}

function normalizeResponse(raw: RawExploration): TopicExploration {
  const blocks = raw.blocks ?? [];
  const content = blocks.length > 0
    ? blocksToPlainText(blocks)
    : (raw.content ?? '');

  return {
    title: raw.title,
    content,
    blocks,
    category: raw.category,
    relatedTopics: raw.relatedTopics,
  };
}

function parseResponse(text: string): TopicExploration {
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('Invalid response format');
  }
  const sanitized = jsonMatch[0].replace(/[\x00-\x1F\x7F]/g, (ch) => {
    if (ch === '\n') return '\\n';
    if (ch === '\r') return '\\r';
    if (ch === '\t') return '\\t';
    return '';
  });
  return normalizeResponse(JSON.parse(sanitized) as RawExploration);
}

async function exploreWithGroq(topic: string, context?: ExploreContext): Promise<TopicExploration> {
  const apiKey = process.env.GROQ_API_KEY ?? process.env.NEXT_PUBLIC_GROQ_API_KEY;
  if (!apiKey) throw new Error('GROQ_API_KEY not configured');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: EXPLORATION_PROMPT },
        { role: 'user', content: buildUserMessage(topic, context) },
      ],
      temperature: 0.7,
      response_format: { type: 'json_object' },
    }),
  });

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`);
  }

  const data = await response.json();
  return normalizeResponse(JSON.parse(data.choices[0].message.content) as RawExploration);
}

async function exploreWithGemini(topic: string, context?: ExploreContext): Promise<TopicExploration> {
  const apiKey = process.env.GEMINI_API_KEY ?? process.env.NEXT_PUBLIC_GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY not configured');

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await model.generateContent([
    EXPLORATION_PROMPT,
    buildUserMessage(topic, context),
  ]);
  return parseResponse(result.response.text());
}

export async function POST(request: NextRequest) {
  try {
    const { topic, context } = await request.json();

    if (!topic || typeof topic !== 'string') {
      return NextResponse.json({ error: 'Topic is required' }, { status: 400 });
    }

    if (topic.length > 500) {
      return NextResponse.json({ error: 'Topic too long' }, { status: 400 });
    }

    let result: TopicExploration;
    try {
      result = await exploreWithGroq(topic, context);
    } catch {
      result = await exploreWithGemini(topic, context);
    }

    return NextResponse.json(result);
  } catch (error) {
    console.error('Explore API error:', error);
    return NextResponse.json(
      { error: 'Failed to explore topic' },
      { status: 500 }
    );
  }
}
