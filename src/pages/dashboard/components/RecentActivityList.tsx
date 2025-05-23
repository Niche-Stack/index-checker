import React from 'react';
import { format, formatDistanceToNow } from 'date-fns';
import { Search, RefreshCw, AlertTriangle, CheckCircle } from 'lucide-react';
import { IndexingHistory, Site } from '../../../types/site';

interface RecentActivityListProps {
  activities: IndexingHistory[];
  sites: Site[];
}

const RecentActivityList: React.FC<RecentActivityListProps> = ({ activities, sites }) => {
  const getSiteNameById = (siteId: string): string => {
    const site = sites.find(s => s.id === siteId);
    return site ? site.name : 'Unknown Site';
  };

  const getActivityIcon = (activity: IndexingHistory) => {
    if (activity.action === 'check') {
      return activity.result === 'indexed' 
        ? <CheckCircle className="w-5 h-5 text-green-600" />
        : <AlertTriangle className="w-5 h-5 text-amber-600" />;
    } else {
      return activity.result === 'successful' || activity.result === 'pending'
        ? <RefreshCw className="w-5 h-5 text-blue-600" />
        : <AlertTriangle className="w-5 h-5 text-red-600" />;
    }
  };

  const getActivityDescription = (activity: IndexingHistory): string => {
    const siteName = getSiteNameById(activity.siteId);
    
    if (activity.action === 'check') {
      return activity.result === 'indexed'
        ? `Page on ${siteName} is indexed`
        : `Page on ${siteName} is not indexed`;
    } else {
      if (activity.result === 'successful') {
        return `Successfully requested indexing for page on ${siteName}`;
      } else if (activity.result === 'pending') {
        return `Submitted indexing request for page on ${siteName}`;
      } else {
        return `Failed to request indexing for page on ${siteName}`;
      }
    }
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-8">
        <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-slate-100 mb-4">
          <Search className="w-6 h-6 text-slate-400" />
        </div>
        <h3 className="text-lg font-medium text-slate-800 mb-2">No activity yet</h3>
        <p className="text-slate-500">
          Activity will appear here once you start checking and indexing pages
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {activities.map(activity => (
        <div key={activity.id} className="flex items-start">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-3 mt-1">
            {getActivityIcon(activity)}
          </div>
          <div className="flex-1">
            <p className="text-sm text-slate-900 font-medium">
              {getActivityDescription(activity)}
            </p>
            <div className="flex items-center text-xs text-slate-500 mt-1">
              <span className="mr-2">
                {formatDistanceToNow(activity.timestamp.toDate(), { addSuffix: true })}
              </span>
              <span>
                {format(activity.timestamp.toDate(), 'MMM d, h:mm a')}
              </span>
            </div>
          </div>
          <div className="text-right">
            <div className="text-xs font-medium text-slate-700 bg-slate-100 py-1 px-2 rounded-full">
              {activity.creditsUsed} credits
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default RecentActivityList;