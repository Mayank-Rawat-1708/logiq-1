import React from 'react';
import { Database, FileText, AlertTriangle } from 'lucide-react';
import type { LogSession } from '../../types';
import { Skeleton } from '../ui/Skeleton';

interface StatsOverviewProps {
  sessions: LogSession[] | undefined;
  isLoading: boolean;
}

export const StatsOverview: React.FC<StatsOverviewProps> = ({ sessions, isLoading }) => {
  const totalSessions = sessions?.length ?? 0;
  const totalLines = sessions?.reduce((acc, s) => acc + (s.total_lines ?? 0), 0) ?? 0;
  const totalAnomalies = sessions?.reduce((acc, s) => acc + (s.anomaly_count ?? 0), 0) ?? 0;

  const stats = [
    {
      label: 'Total Sessions',
      value: totalSessions,
      icon: <Database className="w-5 h-5 text-[#6366F1]" />,
      color: 'border-[#6366F1]/20 bg-[#6366F1]/5',
    },
    {
      label: 'Logs Ingested',
      value: totalLines.toLocaleString(),
      icon: <FileText className="w-5 h-5 text-[#22D3EE]" />,
      color: 'border-[#22D3EE]/20 bg-[#22D3EE]/5',
    },
    {
      label: 'Anomalies Detected',
      value: totalAnomalies.toLocaleString(),
      icon: <AlertTriangle className="w-5 h-5 text-amber-400" />,
      color: 'border-amber-400/20 bg-amber-400/5',
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 gap-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="bg-[#111118] border border-[#2A2A3A] rounded-lg p-5">
            <Skeleton className="h-5 w-5 mb-3" />
            <Skeleton className="h-8 w-24 mb-1" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-3 gap-4">
      {stats.map((stat) => (
        <div key={stat.label} className={`bg-[#111118] border ${stat.color} rounded-lg p-5`}>
          <div className="mb-3">{stat.icon}</div>
          <p className="font-mono font-bold text-2xl text-[#F1F5F9]">{stat.value}</p>
          <p className="text-sm text-[#94A3B8] mt-1">{stat.label}</p>
        </div>
      ))}
    </div>
  );
};
