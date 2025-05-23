import React from 'react';
import { 
  PieChart, 
  Pie, 
  Cell, 
  ResponsiveContainer, 
  Tooltip 
} from 'recharts';
import { Site } from '../../../types/site';

interface SiteStatusChartProps {
  sites: Site[];
}

interface ChartData {
  name: string;
  value: number;
}

const COLORS = ['#047857', '#B91C1C'];

const SiteStatusChart: React.FC<SiteStatusChartProps> = ({ sites }) => {
  const totalPages = sites.reduce((sum, site) => sum + (site.totalPages || 0), 0);
  const totalIndexed = sites.reduce((sum, site) => sum + (site.indexedPages || 0), 0);
  const totalNonIndexed = totalPages - totalIndexed;
  
  const data: ChartData[] = [
    { name: 'Indexed', value: totalIndexed },
    { name: 'Not Indexed', value: totalNonIndexed }
  ];
  
  const indexedPercentage = totalPages > 0 
    ? Math.round((totalIndexed / totalPages) * 100) 
    : 0;

  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 shadow-md rounded-md border border-slate-100">
          <p className="font-medium">{`${payload[0].name}: ${payload[0].value}`}</p>
          <p className="text-sm text-slate-500">
            {`${Math.round((payload[0].value / totalPages) * 100)}% of total`}
          </p>
        </div>
      );
    }
  
    return null;
  };

  return (
    <div className="flex flex-col sm:flex-row items-center">
      <div className="w-full sm:w-1/3 flex flex-col items-center sm:items-start mb-6 sm:mb-0">
        <p className="text-sm text-slate-500 mb-2">Overall Indexing</p>
        <div className="text-4xl font-bold text-slate-900 mb-1">{indexedPercentage}%</div>
        <p className="text-sm text-slate-500">
          {totalIndexed} of {totalPages} pages indexed
        </p>
      </div>
      <div className="w-full sm:w-2/3 h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              startAngle={90}
              endAngle={450}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default SiteStatusChart;