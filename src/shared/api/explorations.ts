import {
  collection,
  doc,
  getDocs,
  getDoc,
  setDoc,
  deleteDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/config';
import { GraphNode } from '@/shared/types';

export interface Exploration {
  id: string;
  userId: string;
  title: string;
  topic: string;
  nodes: GraphNode[];
  nodeCount: number;
  isPublic: boolean;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}

const explorationsRef = collection(db, 'explorations');

export async function saveExploration(
  explorationId: string,
  userId: string,
  topic: string,
  nodes: GraphNode[]
): Promise<void> {
  const rootNode = nodes.find((n) => n.parentId === null);
  const title = rootNode?.title || topic;

  const docRef = doc(explorationsRef, explorationId);
  const existing = await getDoc(docRef);

  await setDoc(docRef, {
    userId,
    title,
    topic,
    nodes,
    nodeCount: nodes.length,
    ...(!existing.exists() ? { isPublic: false, createdAt: serverTimestamp() } : {}),
    updatedAt: serverTimestamp(),
  }, { merge: true });
}

export async function getExploration(explorationId: string): Promise<Exploration | null> {
  const snap = await getDoc(doc(explorationsRef, explorationId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Exploration;
}

export async function getUserExplorations(userId: string): Promise<Exploration[]> {
  const q = query(
    explorationsRef,
    where('userId', '==', userId)
  );
  const snap = await getDocs(q);
  const explorations = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Exploration);
  return explorations.sort((a, b) => {
    const aTime = a.updatedAt?.toMillis() ?? 0;
    const bTime = b.updatedAt?.toMillis() ?? 0;
    return bTime - aTime;
  });
}

export async function setExplorationPublic(explorationId: string, isPublic: boolean): Promise<void> {
  await setDoc(doc(explorationsRef, explorationId), { isPublic }, { merge: true });
}

export async function deleteExploration(explorationId: string): Promise<void> {
  await deleteDoc(doc(explorationsRef, explorationId));
}
