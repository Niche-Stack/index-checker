export interface Site {
  id: string;
  userId: string;
  name: string;
  url: string;
  createdAt: any; // Firestore timestamp
  sitemapUrl: string;
  lastScan: any | null; // Firestore timestamp
  totalPages: number;
  indexedPages: number;
}

export interface SitePage {
  id: string;
  siteId: string;
  url: string;
  title: string;
  lastChecked: any | null; // Firestore timestamp
  indexed: boolean;
  lastIndexed: any | null; // Firestore timestamp
  indexRequested: boolean;
  indexRequestedAt: any | null; // Firestore timestamp
}

export interface IndexingHistory {
  id: string;
  pageId: string;
  siteId: string;
  timestamp: any; // Firestore timestamp
  action: 'check' | 'index_request';
  result: 'indexed' | 'not_indexed' | 'pending' | 'successful' | 'failed';
  creditsUsed: number;
}