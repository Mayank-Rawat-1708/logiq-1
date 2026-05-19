import React from 'react';
import { useNavigate } from 'react-router-dom';
import { formatDistanceToNow } from 'date-fns';
import { FileText, AlertTriangle, ArrowRight, Trash2 } from 'lucide-react';
import { StatusBadge } from '../ui/Badge';
import { useDeleteSession } from '../../hooks/useSession';
import type { LogSession } from '../../types';

interface SessionCardProps {
  session: LogSession;
}

export const SessionCard: React.FC<SessionCardProps> = ({ session }) => {
  const navigate = useNavigate();
  const deleteSession = useDeleteSession();

  const anomalyRate =
    session.total_lines && session.anomaly_count != null
      ? ((session.anomaly_count / session.total_lines) * 100).toFixed(1)
      : null;

  const isProcessing = session.status === 'PROCESSING' || session.status === 'PENDING';

  return (
    <div className="bg-[#111118] border border-[#2A2A3A] rounded-lg p-5 flex flex-col gap-4 hover:border-[#6366F1]/40 transition-colors group">
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <FileText className="w-4 h-4 text-[#6366F1] shrink-0" />
          <h3 className="font-mono font-semibold text-[#F1F5F9] text-sm truncate">{session.name}</h3>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <StatusBadge status={session.status} />
          <button
            onClick={(e) => { e.stopPropagation(); deleteSession.mutate(session.id); }}
            className="opacity-0 group-hover:opacity-100 text-[#475569] hover:text-red-400 transition-all"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex items-center gap-4 text-xs text-[#94A3B8]">
        <span className="flex items-center gap-1">
          <FileText className="w-3 h-3" />
          {session.total_lines != null ? session.total_lines.toLocaleString() : '—'} lines
        </span>
        {session.anomaly_count != null && (
          <span className="flex items-center gap-1 text-amber-400">
            <AlertTriangle className="w-3 h-3" />
            {session.anomaly_count} anomalies
          </span>
        )}
        {anomalyRate && (
          <span className="text-[#475569]">{anomalyRate}% rate</span>
        )}
      </div>

      {/* Progress bar for processing */}
      {isProcessing && (
        <div className="w-full h-1 bg-[#2A2A3A] rounded-full overflow-hidden">
          <div className="h-full bg-[#6366F1] rounded-full animate-pulse w-1/2" />
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-[#475569]">
          {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
        </span>
        <button
          onClick={() => navigate(`/sessions/${session.id}`)}
          disabled={isProcessing}
          className="flex items-center gap-1.5 text-xs font-medium text-[#6366F1] hover:text-[#818CF8] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          Open <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};
