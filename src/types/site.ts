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
}

export interface IndexingHistory {
  id: string;
  pageId: string;
  siteId: string;
  timestamp: any; // Firestore timestamp
  action: 'check' | 'index_request';
  result: string;
  status: 'indexed' | 'not_indexed' | 'pending' | 'processing' | 'successful' | 'failed';
  creditsUsed: number;
  estimatedCredits: number;
}