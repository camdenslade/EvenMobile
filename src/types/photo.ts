export type PhotoStatus = 'pending' | 'approved' | 'rejected' | 'flagged';

export interface ProfilePhoto {
  id: string;
  userId: string;
  url: string;
  originalKey?: string | null;
  derivedKey?: string | null;
  crop?: Record<string, unknown> | null;
  status: PhotoStatus;
  reason: string | null;
  confidence: number | null;
  createdAt: string;
}

