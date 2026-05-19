import React, { useState } from 'react';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Scatter, ScatterChart, ZAxis, Cell,
} from 'recharts';
import { useAnomalies } from '../../hooks/useAnomalies';
import { SeverityBadge, LevelBadge } from '../ui/Badge';
import { Spinner } from '../ui/Spinner';
import { EmptyState } from '../ui/EmptyState';
import { AlertTriangle, ChevronDown, ChevronRight } from 'lucide-react';
import type { AnomalySeverity } from '../../types';

const SEVERITY_COLORS: Record<AnomalySeverity, string> = {
  LOW: '#22D3EE',
  MEDIUM: '#F59E0B',
  HIGH: '#F97316',
  CRITICAL: '#EF4444',
};

const SEVERITIES: AnomalySeverity[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

interface AnomalyTimelineProps {
  sessionId: string;
}

export const AnomalyTimeline: React.FC<AnomalyTimelineProps> = ({ sessionId }) => {
  const [severityFilter, setSeverityFilter] = useState<AnomalySeverity | ''>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: anomalies, isLoading } = useAnomalies(sessionId, severityFilter || undefined);

  const chartData = (anomalies ?? []).map((a) => ({
    x: a.entry_line_number ?? 0,
    y: a.anomaly_score ?? 0,
    severity: a.severity,
    id: a.id,
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!anomalies || anomalies.length === 0) {
    return (
      <EmptyState
        icon={<AlertTriangle className="w-16 h-16" />}
        title="No anomalies detected"
        description="The Isolation Forest algorithm found no significant anomalies in this session"
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Chart */}
      <div className="bg-[#111118] border border-[#2A2A3A] rounded-xl p-5">
        <h3 className="font-mono font-semibold text-sm text-[#94A3B8] mb-4">Anomaly Score by Line Number</h3>
        <ResponsiveContainer width="100%" height={220}>
          <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#2A2A3A" />
            <XAxis
              dataKey="x"
              type="number"
              name="Line"
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              label={{ value: 'Line number', position: 'insideBottom', offset: -5, fill: '#475569', fontSize: 11 }}
            />
            <YAxis
              dataKey="y"
              type="number"
              domain={[0, 1]}
              tick={{ fill: '#475569', fontSize: 11, fontFamily: 'JetBrains Mono' }}
              label={{ value: 'Score', angle: -90, position: 'insideLeft', fill: '#475569', fontSize: 11 }}
            />
            <ZAxis range={[40, 40]} />
            <Tooltip
              cursor={{ strokeDasharray: '3 3', stroke: '#2A2A3A' }}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-[#1A1A24] border border-[#2A2A3A] rounded-lg p-3 text-xs font-mono shadow-xl">
                    <p className="text-[#94A3B8]">Line {d.x}</p>
                    <p className="text-[#F1F5F9]">Score: {d.y.toFixed(3)}</p>
                    <p style={{ color: SEVERITY_COLORS[d.severity as AnomalySeverity] }}>{d.severity}</p>
                  </div>
                );
              }}
            />
            <Scatter data={chartData} name="Anomalies">
              {chartData.map((entry, i) => (
                <Cell key={i} fill={SEVERITY_COLORS[entry.severity as AnomalySeverity]} fillOpacity={0.85} />
              ))}
            </Scatter>
          </ScatterChart>
        </ResponsiveContainer>
      </div>

      {/* Severity filter */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[#475569]">Filter:</span>
        <button
          onClick={() => setSeverityFilter('')}
          className={`text-xs px-2.5 py-1 rounded border transition-colors ${
            severityFilter === '' ? 'bg-[#6366F1]/20 border-[#6366F1] text-[#6366F1]' : 'border-[#2A2A3A] text-[#475569]'
          }`}
        >
          All ({anomalies.length})
        </button>
        {SEVERITIES.map((s) => {
          const count = anomalies.filter((a) => a.severity === s).length;
          if (!count) return null;
          return (
            <button
              key={s}
              onClick={() => setSeverityFilter(s === severityFilter ? '' : s)}
              className={`text-xs px-2.5 py-1 rounded border transition-colors ${
                severityFilter === s ? 'border-current' : 'border-[#2A2A3A] text-[#475569]'
              }`}
              style={severityFilter === s ? { color: SEVERITY_COLORS[s], borderColor: SEVERITY_COLORS[s] } : {}}
            >
              {s} ({count})
            </button>
          );
        })}
      </div>

      {/* Anomaly list */}
      <div className="flex flex-col gap-3">
        {anomalies.map((anomaly) => {
          const isExpanded = expandedId === anomaly.id;
          return (
            <div key={anomaly.id} className="bg-[#111118] border border-[#2A2A3A] rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(isExpanded ? null : anomaly.id)}
                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-[#1A1A24] transition-colors text-left"
              >
                <SeverityBadge severity={anomaly.severity} />
                {anomaly.entry_level && <LevelBadge level={anomaly.entry_level} />}
                <span className="font-mono text-xs text-[#475569]">Line {anomaly.entry_line_number ?? '?'}</span>
                <span className="font-mono text-sm text-[#F1F5F9] flex-1 truncate">{anomaly.entry_message}</span>
                {anomaly.anomaly_score != null && (
                  <span className="text-xs font-mono text-[#475569] shrink-0">
                    score: <span className="text-amber-400">{anomaly.anomaly_score.toFixed(3)}</span>
                  </span>
                )}
                {isExpanded ? (
                  <ChevronDown className="w-4 h-4 text-[#475569] shrink-0" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-[#475569] shrink-0" />
                )}
              </button>

              {isExpanded && (
                <div className="px-5 pb-5 border-t border-[#2A2A3A] pt-4 space-y-3">
                  <p className="text-xs font-semibold text-[#475569] uppercase tracking-wider mb-2">Context</p>
                  {/* Before */}
                  {anomaly.context_lines?.before?.map((line) => (
                    <div key={line.line_number} className="flex gap-3 items-start">
                      <span className="font-mono text-xs text-[#2A2A3A] w-10 shrink-0 text-right">{line.line_number}</span>
                      <span className="font-mono text-xs text-[#475569]">{line.message}</span>
                    </div>
                  ))}
                  {/* Current */}
                  <div className="flex gap-3 items-start bg-red-950/20 border-l-2 border-red-500 pl-2 rounded-r py-1">
                    <span className="font-mono text-xs text-red-400 w-10 shrink-0 text-right">{anomaly.entry_line_number}</span>
                    <span className="font-mono text-xs text-red-300">{anomaly.entry_message}</span>
                  </div>
                  {/* After */}
                  {anomaly.context_lines?.after?.map((line) => (
                    <div key={line.line_number} className="flex gap-3 items-start">
                      <span className="font-mono text-xs text-[#2A2A3A] w-10 shrink-0 text-right">{line.line_number}</span>
                      <span className="font-mono text-xs text-[#475569]">{line.message}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
