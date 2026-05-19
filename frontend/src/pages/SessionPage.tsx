import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { format } from 'date-fns';
import {
  Terminal, AlertTriangle, Layers, MessageSquare,
  FileText, Clock, ArrowLeft, BarChart3,
} from 'lucide-react';
import { useSession, useSessionStats } from '../hooks/useSession';
import { Sidebar } from '../components/layout/Sidebar';
import { StatusBadge } from '../components/ui/Badge';
import { Spinner } from '../components/ui/Spinner';
import { ProcessingStatus } from '../components/session/ProcessingStatus';
import { LogExplorer } from '../components/session/LogExplorer';
import { AnomalyTimeline } from '../components/session/AnomalyTimeline';
import { ErrorClusters } from '../components/session/ErrorClusters';
import { ChatPanel } from '../components/session/ChatPanel';
import type { LogLevel } from '../types';

const LEVEL_COLORS: Record<LogLevel, string> = {
  DEBUG: 'text-slate-400',
  INFO: 'text-cyan-400',
  WARN: 'text-amber-400',
  ERROR: 'text-red-400',
  CRITICAL: 'text-red-600',
  UNKNOWN: 'text-slate-400',
};

type TabId = 'explorer' | 'anomalies' | 'clusters' | 'chat';

const TABS: { id: TabId; label: string; icon: React.ReactNode }[] = [
  { id: 'explorer', label: 'Explorer', icon: <Terminal className="w-4 h-4" /> },
  { id: 'anomalies', label: 'Anomalies', icon: <AlertTriangle className="w-4 h-4" /> },
  { id: 'clusters', label: 'Clusters', icon: <Layers className="w-4 h-4" /> },
  { id: 'chat', label: 'Chat', icon: <MessageSquare className="w-4 h-4" /> },
];

export const SessionPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [highlightLine, setHighlightLine] = useState<number | null>(null);
  const [selectedClusterId, setSelectedClusterId] = useState<number | null>(null);

  const activeTab = (searchParams.get('tab') as TabId) || 'explorer';
  const setTab = (tab: TabId) => {
    setSearchParams({ tab });
  };

  const { data: session, isLoading: sessionLoading } = useSession(id!);
  const isReady = session?.status === 'READY';
  const { data: stats } = useSessionStats(id!, isReady);

  // Handle line click from chat — switch to explorer and highlight
  const handleLineClick = (lineNumber: number) => {
    setHighlightLine(lineNumber);
    setTab('explorer');
  };

  // Handle cluster selection — switch to explorer
  const handleSelectCluster = (clusterId: number) => {
    setSelectedClusterId(clusterId);
    setTab('explorer');
  };

  const levelCounts = stats?.level_counts ?? [];
  const getCount = (level: string) => levelCounts.find((l) => l.level === level)?.count ?? 0;

  if (sessionLoading) {
    return (
      <div className="flex min-h-screen bg-[#0A0A0F]">
        <Sidebar />
        <div className="flex-1 flex items-center justify-center">
          <Spinner size="lg" />
        </div>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="flex min-h-screen bg-[#0A0A0F]">
        <Sidebar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <p className="text-[#94A3B8]">Session not found</p>
          <button onClick={() => navigate('/dashboard')} className="text-sm text-[#6366F1] hover:underline">
            Back to dashboard
          </button>
        </div>
      </div>
    );
  }

  const isProcessing = session.status === 'PROCESSING' || session.status === 'PENDING';
  const anomalyRate =
    session.total_lines && session.anomaly_count != null
      ? ((session.anomaly_count / session.total_lines) * 100).toFixed(1)
      : null;

  return (
    <div className="flex min-h-screen bg-[#0A0A0F]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="border-b border-[#2A2A3A] bg-[#0A0A0F] px-6 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <button
              onClick={() => navigate('/dashboard')}
              className="text-[#475569] hover:text-[#94A3B8] transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <FileText className="w-4 h-4 text-[#6366F1]" />
            <h1 className="font-mono font-bold text-lg text-[#F1F5F9] truncate">{session.name}</h1>
            <StatusBadge status={session.status} />
          </div>

          {/* Stats row */}
          {isReady && (
            <div className="flex items-center gap-6 text-xs flex-wrap">
              <span className="flex items-center gap-1.5 text-[#94A3B8]">
                <FileText className="w-3.5 h-3.5" />
                {session.total_lines?.toLocaleString()} lines
              </span>
              {(['ERROR', 'WARN', 'CRITICAL'] as LogLevel[]).map((level) => {
                const count = getCount(level);
                if (!count) return null;
                return (
                  <span key={level} className={`flex items-center gap-1 font-mono ${LEVEL_COLORS[level]}`}>
                    {count.toLocaleString()} {level}
                  </span>
                );
              })}
              {anomalyRate && (
                <span className="flex items-center gap-1.5 text-amber-400">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  {anomalyRate}% anomaly rate
                </span>
              )}
              {session.processed_at && (
                <span className="flex items-center gap-1.5 text-[#475569] ml-auto">
                  <Clock className="w-3.5 h-3.5" />
                  Analyzed {format(new Date(session.processed_at), 'MMM d, HH:mm')}
                </span>
              )}
            </div>
          )}
        </header>

        {/* Processing state */}
        {isProcessing && (
          <div className="flex-1 overflow-auto px-6">
            <ProcessingStatus session={session} />
          </div>
        )}

        {/* Ready state — tabs */}
        {isReady && (
          <>
            {/* Tab bar */}
            <div className="flex items-center gap-1 px-6 pt-3 border-b border-[#2A2A3A] bg-[#0A0A0F] shrink-0">
              {TABS.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setTab(tab.id)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
                    activeTab === tab.id
                      ? 'border-[#6366F1] text-[#6366F1]'
                      : 'border-transparent text-[#475569] hover:text-[#94A3B8]'
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === 'anomalies' && session.anomaly_count ? (
                    <span className="text-xs bg-amber-950/40 text-amber-400 border border-amber-800 px-1.5 py-0.5 rounded-full font-mono">
                      {session.anomaly_count}
                    </span>
                  ) : null}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={`flex-1 overflow-hidden ${activeTab === 'chat' ? 'p-4' : activeTab === 'explorer' ? '' : 'p-6 overflow-auto'}`}>
              {activeTab === 'explorer' && (
                <LogExplorer
                  sessionId={id!}
                  highlightLine={highlightLine}
                  onHighlightClear={() => setHighlightLine(null)}
                  initialClusterId={selectedClusterId}
                />
              )}
              {activeTab === 'anomalies' && (
                <AnomalyTimeline sessionId={id!} />
              )}
              {activeTab === 'clusters' && (
                <ErrorClusters sessionId={id!} onSelectCluster={handleSelectCluster} />
              )}
              {activeTab === 'chat' && (
                <div className="h-full">
                  <ChatPanel sessionId={id!} onLineClick={handleLineClick} />
                </div>
              )}
            </div>
          </>
        )}

        {/* Failed state */}
        {session.status === 'FAILED' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-4">
            <div className="bg-red-950/30 border border-red-800 rounded-xl p-8 max-w-md text-center">
              <AlertTriangle className="w-12 h-12 text-red-400 mx-auto mb-4" />
              <h2 className="font-mono font-bold text-lg text-[#F1F5F9] mb-2">Processing Failed</h2>
              <p className="text-sm text-[#94A3B8] mb-4">
                Something went wrong while processing your logs. Please try uploading again.
              </p>
              <button
                onClick={() => navigate('/upload')}
                className="bg-[#6366F1] hover:bg-[#818CF8] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
              >
                Try again
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
