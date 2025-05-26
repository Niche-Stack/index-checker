import { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, Timestamp } from 'firebase/firestore';
import { db } from '../../../config/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { Page } from '../../../types/site';
import LoadingScreen from '../../../components/ui/LoadingScreen';

// Placeholder for Badge component
const PlaceholderBadge: React.FC<{ children: React.ReactNode; variant?: string }> = ({ children }) => (
  <span style={{ padding: '0.25em 0.5em', margin: '0.25em', borderRadius: '0.25em', backgroundColor: '#e0e0e0', color: '#333' }}>
    {children}
  </span>
);

interface CheckedPagesTableProps {
  siteUrlFilter?: string;
}

export const CheckedPagesTable: React.FC<CheckedPagesTableProps> = ({ siteUrlFilter }) => {
  const { currentUser } = useAuth();
  const [checkedPages, setCheckedPages] = useState<Page[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!currentUser) {
      setLoading(false);
      setError("User not authenticated.");
      return;
    }

    setLoading(true);
    let pagesQuery = query(
      collection(db, "pages"),
      where("userId", "==", currentUser.uid),
      orderBy("lastCheckedAt", "desc")
    );

    if (siteUrlFilter) {
      pagesQuery = query(
        collection(db, "pages"),
        where("userId", "==", currentUser.uid),
        where("siteUrl", "==", siteUrlFilter),
        orderBy("lastCheckedAt", "desc")
      );
    }

    const unsubscribe = onSnapshot(pagesQuery, (snapshot) => {
      const pagesData = snapshot.docs.map(doc => {
        const data = doc.data();
        const lastCheckedTimestamp = data.lastCheckedAt as Timestamp | undefined;
        // const lastIndexedTimestamp = data.lastIndexed as Timestamp | undefined; // Example if this field was present
        // const indextimestampTimestamp = data.indextimestamp as Timestamp | undefined; // Example if this field was present

        return {
          id: doc.id,
          url: data.pageUrl || '', // Mapped from Firestore's pageUrl
          siteUrl: data.siteUrl || '', // Mapped from Firestore's siteUrl
          status: data.status || 'N/A', // Mapped from Firestore's status
          lastCheckedAt: lastCheckedTimestamp ? lastCheckedTimestamp.toDate() : null,

          // Fields from Page type not currently set by the get_site_indexing_status backend function
          // They will default to empty or null as per this mapping.
          siteId: data.siteId || '',
          title: data.title || '',
          indexed: data.indexed || false,
          lastIndexed: null, // data.lastIndexed is not in Firestore from main.py
          indexRequested: data.indexRequested || false,
          indextimestamp: null, // data.indextimestamp is not in Firestore from main.py
        } as Page;
      });
      setCheckedPages(pagesData);
      setLoading(false);
      setError(null);
    }, (err) => {
      console.error("Error fetching checked pages:", err);
      setError("Failed to load checked pages. Please try again later.");
      setLoading(false);
    });

    return () => unsubscribe();
  }, [currentUser, siteUrlFilter]);

  if (loading) {
    return <LoadingScreen />;
  }

  if (error) {
    return <div className="text-red-500 text-center p-4">{error}</div>;
  }

  if (checkedPages.length === 0) {
    return <div className="text-center p-4">No checked pages found.</div>;
  }

  return (
    <div className="container mx-auto py-4 sm:py-6 lg:py-8">
      <h2 className="text-xl sm:text-2xl font-semibold mb-4 sm:mb-6">Recently Checked Pages {siteUrlFilter && `for ${siteUrlFilter}`}</h2>
      <div className="overflow-x-auto">
        {/* Using basic HTML table as placeholder */}
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Page URL</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider hidden sm:table-cell">Parent Site</th>
              <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Checked</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {checkedPages.map((page) => (
              <tr key={page.id}>
                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 max-w-xs truncate">
                  <a href={page.url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                    {page.url}
                  </a>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  <PlaceholderBadge>
                    {page.status || "N/A"}
                  </PlaceholderBadge>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 hidden sm:table-cell">{page.siteUrl}</td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                  {page.lastCheckedAt instanceof Date ? page.lastCheckedAt.toLocaleString() : "Invalid Date"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
