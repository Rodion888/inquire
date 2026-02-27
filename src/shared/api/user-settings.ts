import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db } from '@/shared/config';

export interface UserSettings {
  cascadeDeleteAskedCount: number;
  lastCascadeDeleteAskedAt: Timestamp | null;
}

const DEFAULTS: UserSettings = {
  cascadeDeleteAskedCount: 0,
  lastCascadeDeleteAskedAt: null,
};

function userSettingsRef(userId: string) {
  return doc(db, 'userSettings', userId);
}

export async function getUserSettings(userId: string): Promise<UserSettings> {
  const snap = await getDoc(userSettingsRef(userId));
  if (!snap.exists()) return DEFAULTS;
  return { ...DEFAULTS, ...snap.data() } as UserSettings;
}

export async function markCascadeDeleteAsked(userId: string): Promise<void> {
  const current = await getUserSettings(userId);
  await setDoc(userSettingsRef(userId), {
    cascadeDeleteAskedCount: current.cascadeDeleteAskedCount + 1,
    lastCascadeDeleteAskedAt: serverTimestamp(),
  }, { merge: true });
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function shouldAskCascadeDelete(settings: UserSettings): boolean {
  if (settings.cascadeDeleteAskedCount >= 2) return false;
  if (settings.cascadeDeleteAskedCount === 1 && settings.lastCascadeDeleteAskedAt) {
    const elapsed = Date.now() - settings.lastCascadeDeleteAskedAt.toMillis();
    if (elapsed < WEEK_MS) return false;
  }
  return true;
}
