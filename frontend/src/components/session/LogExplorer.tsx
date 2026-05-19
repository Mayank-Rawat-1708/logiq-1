import React, { useState, useCallback, useRef, useEffect } from 'react';
import { Search, Filter, AlertTriangle } from 'lucide-react';
import { format } from 'date-fns';
import { useLogEntries } from '../../hooks/useLogEntries';
import { searchApi } from '../../api/search';
import { useAuthStore } from '../../store/authStore';
import { LevelBadge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { LogRowSkeleton } from '../ui/Skeleton';
import type { LogEntry, LogLevel } from '../../types';

const LEVELS: LogLevel[] = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];

const LEVEL_ROW_STYLE: Record<LogLevel, string> = {
  DEBUG: '',
  INFO: '',
  WARN: 'bg-amber-950/10',
  ERROR: 'bg-red-950/10',
  CRITICAL: 'bg-red-950/20',
  UNKNOWN: '',
};

interface LogExplorerProps {
  sessionId: string;
  highlightLine?: number | null;
  onHighlightClear?: () => void;
  initialClusterId?: number | null;
}

export const LogExplorer: React.FC<LogExplorerProps> = ({
  sessionId,
  highlightLine,
  onHighlightClear,
  initialClusterId,
}) => {
  const [page, setPage] = useState(1);
  const [selectedLevels, setSelectedLevels] = useState<LogLevel[]>([]);
  const [anomalyOnly, setAnomalyOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [semanticResults, setSemanticResults] = useState<LogEntry[] | null>(null);
  const [semanticLoading, setSemanticLoading] = useState(false);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const searchTimeout = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => {
      setDebouncedSearch(searchQuery);
      setPage(1);
    }, 500);
    return () => clearTimeout(searchTimeout.current);
  }, [searchQuery]);

  const filters = {
    page,
    page_size: 100,
    level: selectedLevels.length > 0 ? selectedLevels.join(',') : undefined,
    anomaly_only: anomalyOnly || undefined,
    search: debouncedSearch || undefined,
  };

  const { data, isLoading } = useLogEntries(sessionId, filters, !semanticResults);

  const entries = semanticResults ?? data?.items ?? [];
  const totalPages = data?.pages ?? 1;
  const total = semanticResults ? semanticResults.length : data?.total ?? 0;

  const handleSemanticSearch = useCallback(async (q: string) => {
    if (!q.trim()) { setSemanticResults(null); return; }
    setSemanticLoading(true);
    try {
      const results = await searchApi.semanticSearch(sessionId, q, 50);
      setSemanticResults(results);
    } catch {
      setSemanticResults(null);
    } finally {
      setSemanticLoading(false);
    }
  }, [sessionId]);

  const toggleLevel = (level: LogLevel) => {
    setSelectedLevels(prev =>
      prev.includes(level) ? prev.filter(l => l !== level) : [...prev, level]
    );
    setPage(1);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-[#2A2A3A] bg-[#0A0A0F] flex-wrap shrink-0">
        <div className="flex items-center gap-2 bg-[#111118] border border-[#2A2A3A] rounded-lg px-3 py-1.5 flex-1 min-w-56">
          <Search className="w-3.5 h-3.5 text-[#475569] shrink-0" />
          <input
            type="text"
            placeholder="Search logs or ask a question…"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSemanticSearch(searchQuery)}
            className="bg-transparent text-sm text-[#F1F5F9] placeholder-[#475569] outline-none w-full"
          />
          {semanticLoading && <Spinner size="sm" />}
          {semanticResults && (
            <button onClick={() => { setSemanticResults(null); setSearchQuery(''); }}
              className="text-xs text-[#6366F1] hover:text-[#818CF8] shrink-0">
              Clear
            </button>
          )}
        </div>

        <div className="flex items-center gap-1">
          <Filter className="w-3.5 h-3.5 text-[#475569]" />
          {LEVELS.map(level => (
            <button key={level} onClick={() => toggleLevel(level)}
              className={`text-xs font-mono px-2 py-1 rounded border transition-colors ${
                selectedLevels.includes(level)
                  ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]'
                  : 'border-[#2A2A3A] text-[#475569] hover:border-[#475569]'
              }`}>
              {level}
            </button>
          ))}
        </div>

        <button
          onClick={() => { setAnomalyOnly(v => !v); setPage(1); }}
          className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg border transition-colors ${
            anomalyOnly
              ? 'bg-amber-950/30 border-amber-600 text-amber-400'
              : 'border-[#2A2A3A] text-[#475569] hover:border-[#475569]'
          }`}>
          <AlertTriangle className="w-3 h-3" />
          Anomalies only
        </button>

        <span className="text-xs text-[#475569] ml-auto shrink-0">
          {semanticResults ? `${total} results` : `${total.toLocaleString()} entries`}
        </span>
      </div>

      {/* Table header */}
      <div className="grid grid-cols-[60px_160px_90px_120px_1fr] gap-2 px-4 py-2 border-b border-[#2A2A3A] bg-[#111118] shrink-0">
        {['Line', 'Timestamp', 'Level', 'Service', 'Message'].map(h => (
          <span key={h} className="text-xs font-semibold text-[#475569] uppercase tracking-wider">{h}</span>
        ))}
      </div>

      {/* Scrollable log list — NO virtualizer, plain list for correctness */}
      {isLoading ? (
        <div className="flex-1 overflow-hidden">
          {Array.from({ length: 15 }).map((_, i) => <LogRowSkeleton key={i} />)}
        </div>
      ) : entries.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-[#475569] text-sm font-mono">No log entries match your filters</p>
        </div>
      ) : (
        <div className="flex-1 overflow-auto">
          {entries.map(entry => {
            const isExpanded = expandedRow === entry.id;
            const isHighlighted = highlightLine === entry.line_number;

            return (
              <div key={entry.id}>
                {/* Row */}
                <div
                  onClick={() => {
                    setExpandedRow(isExpanded ? null : entry.id);
                    if (isHighlighted && onHighlightClear) onHighlightClear();
                  }}
                  className={`grid grid-cols-[60px_160px_90px_120px_1fr] gap-2 px-4 py-2.5 border-b border-[#2A2A3A] cursor-pointer transition-colors items-center
                    ${isHighlighted ? 'bg-[#6366F1]/15 border-l-2 border-l-[#6366F1]' : ''}
                    ${entry.is_anomaly && !isHighlighted ? 'border-l-2 border-l-red-500 ' + LEVEL_ROW_STYLE[entry.level] : ''}
                    ${!isHighlighted && !entry.is_anomaly ? LEVEL_ROW_STYLE[entry.level] : ''}
                    hover:bg-[#1A1A24]`}
                >
                  <span className="font-mono text-xs text-[#475569]">{entry.line_number}</span>
                  <span className="font-mono text-xs text-[#475569] truncate">
                    {entry.timestamp ? format(new Date(entry.timestamp), 'MM-dd HH:mm:ss') : '—'}
                  </span>
                  <LevelBadge level={entry.level} />
                  <span className="text-xs text-[#22D3EE] font-mono truncate">{entry.service ?? '—'}</span>
                  <div className="flex items-center gap-2 min-w-0">
                    {entry.is_anomaly && <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />}
                    <span className="font-mono text-xs text-[#F1F5F9] truncate">{entry.message}</span>
                  </div>
                </div>

                {/* Expanded detail — renders inline in normal flow, no overlap */}
                {isExpanded && (
                  <div className="px-6 py-4 bg-[#0D0D14] border-b border-[#2A2A3A] space-y-3">
                    <div>
                      <p className="text-xs text-[#475569] mb-1.5 font-semibold uppercase tracking-wider">Raw log</p>
                      <pre className="font-mono text-xs text-[#94A3B8] bg-[#0A0A0F] border border-[#2A2A3A] rounded-lg p-3 overflow-x-auto whitespace-pre-wrap break-all">
                        {entry.raw_text}
                      </pre>
                    </div>
                    {entry.is_anomaly && (
                      <div className="flex items-center gap-4 text-xs">
                        <span className="text-amber-400 font-semibold">⚠ Anomaly detected</span>
                        {entry.anomaly_score != null && (
                          <span className="text-[#475569]">
                            Score: <span className="text-[#F1F5F9] font-mono">{entry.anomaly_score.toFixed(3)}</span>
                          </span>
                        )}
                        {entry.cluster_id != null && (
                          <span className="text-[#475569]">
                            Cluster: <span className="text-[#22D3EE] font-mono">#{entry.cluster_id}</span>
                          </span>
                        )}
                      </div>
                    )}
                    <div className="flex items-center gap-6 text-xs text-[#475569]">
                      {entry.timestamp && (
                        <span>Time: <span className="text-[#94A3B8] font-mono">{format(new Date(entry.timestamp), 'yyyy-MM-dd HH:mm:ss')}</span></span>
                      )}
                      {entry.service && (
                        <span>Service: <span className="text-[#22D3EE] font-mono">{entry.service}</span></span>
                      )}
                      <span>Level: <span className="text-[#94A3B8] font-mono">{entry.level}</span></span>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {!semanticResults && totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 px-4 py-3 border-t border-[#2A2A3A] shrink-0">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="text-xs px-3 py-1.5 rounded border border-[#2A2A3A] text-[#94A3B8] hover:border-[#6366F1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Previous
          </button>
          <span className="text-xs text-[#475569] font-mono">{page} / {totalPages}</span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="text-xs px-3 py-1.5 rounded border border-[#2A2A3A] text-[#94A3B8] hover:border-[#6366F1] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};