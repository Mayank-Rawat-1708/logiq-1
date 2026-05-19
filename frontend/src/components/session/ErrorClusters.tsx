import React from 'react';
import { Layers, ArrowRight } from 'lucide-react';
import { useClusters } from '../../hooks/useAnomalies';
import { LevelBadge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import type { LogLevel } from '../../types';

interface ErrorClustersProps {
  sessionId: string;
  onSelectCluster?: (clusterId: number) => void;
}

const CLUSTER_COLORS = [
  'border-[#6366F1]/40 bg-[#6366F1]/5',
  'border-[#22D3EE]/40 bg-[#22D3EE]/5',
  'border-amber-500/40 bg-amber-500/5',
  'border-emerald-500/40 bg-emerald-500/5',
  'border-pink-500/40 bg-pink-500/5',
  'border-purple-500/40 bg-purple-500/5',
  'border-orange-500/40 bg-orange-500/5',
  'border-teal-500/40 bg-teal-500/5',
  'border-rose-500/40 bg-rose-500/5',
  'border-indigo-500/40 bg-indigo-500/5',
];

export const ErrorClusters: React.FC<ErrorClustersProps> = ({ sessionId, onSelectCluster }) => {
  const { data: clusters, isLoading } = useClusters(sessionId);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!clusters || clusters.length === 0) {
    return (
      <EmptyState
        icon={<Layers className="w-16 h-16" />}
        title="No clusters available"
        description="Clusters are generated from ERROR and CRITICAL log entries using K-means. Not enough error entries to cluster."
      />
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-5">
        <div>
          <h3 className="font-mono font-semibold text-[#F1F5F9]">Error Pattern Clusters</h3>
          <p className="text-xs text-[#475569] mt-0.5">
            {clusters.length} distinct error pattern{clusters.length !== 1 ? 's' : ''} identified via K-means clustering
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {clusters.map((cluster, i) => (
          <div
            key={cluster.cluster_id}
            className={`border rounded-xl p-5 ${CLUSTER_COLORS[i % CLUSTER_COLORS.length]}`}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-mono font-bold text-sm text-[#F1F5F9]">
                Cluster #{cluster.cluster_id}
              </span>
              <span className="text-xs text-[#475569] font-mono bg-[#111118] px-2 py-0.5 rounded-full border border-[#2A2A3A]">
                {cluster.size} entries
              </span>
            </div>

            {/* Representative log lines */}
            <div className="space-y-2 mb-4">
              {cluster.representative_entries.map((entry, j) => (
                <div key={j} className="flex items-start gap-2">
                  <LevelBadge level={entry.level as LogLevel} />
                  <p className="font-mono text-xs text-[#94A3B8] leading-relaxed line-clamp-2 flex-1">
                    {entry.message}
                  </p>
                </div>
              ))}
            </div>

            {/* View in explorer */}
            {onSelectCluster && (
              <button
                onClick={() => onSelectCluster(cluster.cluster_id)}
                className="flex items-center gap-1.5 text-xs text-[#6366F1] hover:text-[#818CF8] transition-colors font-medium"
              >
                View in Explorer <ArrowRight className="w-3 h-3" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
