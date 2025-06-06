import { useState, useEffect } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../config/firebase';
import { Page } from '../types/site';

export function usePages(siteId: string | null) {
  const [pages, setPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!siteId) {
      setPages([]);
      setLoading(false);
      return;
    }

    const fetchPages = async () => {
      setLoading(true);
      try {
        const pagesQuery = query(
          collection(db, 'pages'),
          where('siteId', '==', siteId)
        );
        
        const snapshot = await getDocs(pagesQuery);
        const pagesData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Page[];
        
        setPages(pagesData);
      } catch (err) {
        console.error('Error fetching site pages:', err);
        setError('Failed to load pages');
      } finally {
        setLoading(false);
      }
    };

    fetchPages();
  }, [siteId]);

  return { pages, loading, error };
}