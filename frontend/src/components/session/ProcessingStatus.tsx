import React from 'react';
import { Loader2, CheckCircle, XCircle } from 'lucide-react';
import { useWebSocket } from '../../hooks/useWebSocket';
import type { LogSession } from '../../types';

const PHASES = [
  { key: 'parsing', label: 'Parsing logs' },
  { key: 'inserting', label: 'Storing entries' },
  { key: 'detecting_anomalies', label: 'Detecting anomalies' },
  { key: 'embedding', label: 'Generating embeddings' },
  { key: 'clustering', label: 'Clustering patterns' },
  { key: 'complete', label: 'Complete' },
];

const PHASE_ORDER = PHASES.map((p) => p.key);

interface ProcessingStatusProps {
  session: LogSession;
}

export const ProcessingStatus: React.FC<ProcessingStatusProps> = ({ session }) => {
  const { progress } = useWebSocket(session.id, session.status === 'PROCESSING' || session.status === 'PENDING');

  const currentPhaseIndex = progress ? PHASE_ORDER.indexOf(progress.phase) : 0;
  const progressPct =
    progress && session.total_lines && progress.lines_processed
      ? Math.min(100, Math.round((progress.lines_processed / session.total_lines) * 100))
      : currentPhaseIndex > 0
      ? Math.round((currentPhaseIndex / (PHASES.length - 1)) * 100)
      : 5;

  const isFailed = progress?.phase === 'failed' || session.status === 'FAILED';
  const isComplete = progress?.phase === 'complete';

  return (
    <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-8 max-w-2xl mx-auto mt-12">
      {/* Icon */}
      <div className="flex justify-center mb-6">
        {isFailed ? (
          <XCircle className="w-14 h-14 text-red-400" />
        ) : isComplete ? (
          <CheckCircle className="w-14 h-14 text-emerald-400" />
        ) : (
          <Loader2 className="w-14 h-14 text-[#6366F1] animate-spin" />
        )}
      </div>

      <h2 className="font-mono font-bold text-xl text-[#F1F5F9] text-center mb-1">
        {isFailed ? 'Processing Failed' : isComplete ? 'Processing Complete' : 'Processing Logs…'}
      </h2>
      <p className="text-sm text-[#475569] text-center mb-8">
        {isFailed
          ? progress?.error || 'An error occurred during processing'
          : isComplete
          ? `${progress?.lines_processed?.toLocaleString()} lines processed`
          : 'Hang tight — this usually takes under a minute'}
      </p>

      {/* Progress bar */}
      {!isFailed && (
        <div className="mb-8">
          <div className="flex justify-between text-xs text-[#475569] mb-1.5">
            <span>{PHASES.find((p) => p.key === progress?.phase)?.label ?? 'Initializing…'}</span>
            <span>{progressPct}%</span>
          </div>
          <div className="w-full h-2 bg-[#2A2A3A] rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-[#6366F1] to-[#22D3EE] rounded-full transition-all duration-500"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}

      {/* Phase steps */}
      <div className="flex flex-col gap-2">
        {PHASES.filter((p) => p.key !== 'complete').map((phase, i) => {
          const isDone = currentPhaseIndex > i;
          const isCurrent = PHASE_ORDER[currentPhaseIndex] === phase.key && !isComplete;
          return (
            <div key={phase.key} className="flex items-center gap-3">
              <div
                className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold border transition-colors ${
                  isDone
                    ? 'bg-emerald-950 border-emerald-600 text-emerald-400'
                    : isCurrent
                    ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]'
                    : 'bg-[#1A1A24] border-[#2A2A3A] text-[#475569]'
                }`}
              >
                {isDone ? '✓' : i + 1}
              </div>
              <span
                className={`text-sm font-medium transition-colors ${
                  isDone ? 'text-emerald-400' : isCurrent ? 'text-[#F1F5F9]' : 'text-[#475569]'
                }`}
              >
                {phase.label}
              </span>
              {isCurrent && (
                <Loader2 className="w-3.5 h-3.5 text-[#6366F1] animate-spin ml-auto" />
              )}
            </div>
          );
        })}
      </div>

      {/* Live stats */}
      {progress && !isFailed && !isComplete && (
        <div className="mt-6 pt-6 border-t border-[#2A2A3A] grid grid-cols-2 gap-4 text-center">
          <div>
            <p className="font-mono font-bold text-lg text-[#F1F5F9]">
              {progress.lines_processed?.toLocaleString() ?? '—'}
            </p>
            <p className="text-xs text-[#475569]">Lines processed</p>
          </div>
          <div>
            <p className="font-mono font-bold text-lg text-amber-400">
              {progress.anomalies_found?.toLocaleString() ?? '—'}
            </p>
            <p className="text-xs text-[#475569]">Anomalies found</p>
          </div>
        </div>
      )}
    </div>
  );
};
