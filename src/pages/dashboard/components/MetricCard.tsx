import React from 'react';

interface MetricCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  description: string;
  color: 'blue' | 'green' | 'amber' | 'red' | 'purple';
}

const MetricCard: React.FC<MetricCardProps> = ({ 
  title, 
  value, 
  icon, 
  description, 
  color 
}) => {
  const getColorClasses = () => {
    switch (color) {
      case 'blue':
        return 'bg-blue-50 text-blue-900';
      case 'green':
        return 'bg-green-50 text-green-900';
      case 'amber':
        return 'bg-amber-50 text-amber-900';
      case 'red':
        return 'bg-red-50 text-red-900';
      case 'purple':
        return 'bg-purple-50 text-purple-900';
      default:
        return 'bg-blue-50 text-blue-900';
    }
  };

  return (
    <div className="card p-6">
      <div className="flex items-center mb-3">
        <div className={`w-10 h-10 rounded-md flex items-center justify-center mr-3 ${getColorClasses()}`}>
          {icon}
        </div>
        <h3 className="text-sm font-medium text-slate-500">{title}</h3>
      </div>
      <div className="flex items-end">
        <span className="text-3xl font-bold text-slate-900">{value}</span>
      </div>
      <p className="text-sm text-slate-500 mt-2">{description}</p>
    </div>
  );
};

export default MetricCard;