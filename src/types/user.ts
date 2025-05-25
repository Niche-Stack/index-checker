import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  email: string;
  displayName: string;
  photoURL: string;
  createdAt: Timestamp;
  updatedAt?: Timestamp;
  onboardingCompleted: boolean;
  credits: number;
  seoFocus: string;
  seoImportance?: string; // New optional field for SEO importance
  newPagesPerMonth?: string; // New optional field for number of new pages per month
  searchConsoleConnected: boolean;
  searchConsoleAccessToken?: string; // Added field for Search Console access token,
  searchConsoleRefreshToken?: string; // Added field for Search Console refresh token
  searchConsoleAccessTokenExpiryTime?: Timestamp; // Added field for Search Console access token expiry time
}