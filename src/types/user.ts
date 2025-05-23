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
  makeConnected: boolean;
  searchConsoleConnected: boolean;
  searchConsoleAccessToken?: string; // Added field for Search Console access token
}