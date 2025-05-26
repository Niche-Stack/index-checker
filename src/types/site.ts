export interface Site {
  id: string;
  userId: string;
  name: string;
  url: string;
  gscProperty: string;
  createdAt: any; // Firestore timestamp
  sitemapUrl: string;
  lastScan: any | null; // Firestore timestamp
  totalPages: number;
  indexedPages: number;
  // Added for re-indexing status
  lastReindexRequestAt?: any | null; // Firestore timestamp
  lastReindexStatus?: string; // e.g., 'completed', 'completed_with_errors', 'pending', 'failed'
  lastReindexMessage?: string;
}

export interface Page {
  id: string;
  siteId: string;
  url: string; // Represents pageUrl from Firestore
  title: string;
  lastCheckedAt: any | null; // Firestore timestamp, was lastChecked in component, but type & backend use lastCheckedAt
  indexed: boolean;
  lastIndexed: any | null; // Firestore timestamp
  indexRequested: boolean;
  indextimestamp: any | null; // Firestore timestamp
  siteUrl: string; // Added: Parent site URL, used in table
  status: string; // Added: Indexing status from GSC, used in table
  lastReindexRequestedAt?: any | null; // Firestore timestamp
}

export interface IndexingHistory {
  id: string;
  userId?: string; // Added
  siteId: string;
  siteUrl?: string; // Added
  pageId?: string; // Can be empty for site-wide actions
  timestamp: any; // Firestore timestamp (creation)
  updatedAt?: any; // Firestore timestamp (last update)
  completedAt?: any; // Firestore timestamp (completion)
  action: 'check' | 'index_request' | 'reindex'; // Added 'reindex'
  status: 'pending' | 'processing' | 'successful' | 'failed' | 'completed_with_errors' | 'indexed' | 'not_indexed' | 'no_urls_to_reindex' | 'no_urls_found'; // Added new statuses
  message?: string; // For user-facing messages
  estimatedCredits?: number;
  creditsUsed?: number;
  initialItemCount?: number; // For urlsToInspectCount or urlsToProcessCount
  processedItemCount?: number; // For urlsInspectedCount or urlsProcessedCount by execute function
  indexedItemCount?: number; // For 'check' action, actual indexed pages from execute function
}