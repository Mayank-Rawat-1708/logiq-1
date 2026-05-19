import React from 'react';
import type { LogLevel, AnomalySeverity } from '../../types';

const LEVEL_STYLES: Record<LogLevel, string> = {
  DEBUG: 'text-slate-400 bg-slate-900/50 border-slate-700',
  INFO: 'text-cyan-400 bg-cyan-950/40 border-cyan-800',
  WARN: 'text-amber-400 bg-amber-950/40 border-amber-800',
  ERROR: 'text-red-400 bg-red-950/40 border-red-800',
  CRITICAL: 'text-red-300 bg-red-950/60 border-red-600',
  UNKNOWN: 'text-slate-400 bg-slate-900/50 border-slate-700',
};

const SEVERITY_STYLES: Record<AnomalySeverity, string> = {
  LOW: 'text-cyan-400 bg-cyan-950/40 border-cyan-800',
  MEDIUM: 'text-amber-400 bg-amber-950/40 border-amber-800',
  HIGH: 'text-orange-400 bg-orange-950/40 border-orange-800',
  CRITICAL: 'text-red-300 bg-red-950/60 border-red-600',
};

interface LevelBadgeProps {
  level: LogLevel;
  size?: 'sm' | 'md';
}

export const LevelBadge: React.FC<LevelBadgeProps> = ({ level, size = 'sm' }) => {
  const sizeClass = size === 'sm' ? 'text-xs px-1.5 py-0.5' : 'text-sm px-2 py-1';
  return (
    <span className={`inline-flex items-center font-mono font-semibold border rounded ${sizeClass} ${LEVEL_STYLES[level]}`}>
      {level}
    </span>
  );
};

interface SeverityBadgeProps {
  severity: AnomalySeverity;
}

export const SeverityBadge: React.FC<SeverityBadgeProps> = ({ severity }) => {
  return (
    <span className={`inline-flex items-center text-xs font-mono font-semibold border rounded px-1.5 py-0.5 ${SEVERITY_STYLES[severity]}`}>
      {severity}
    </span>
  );
};

interface StatusBadgeProps {
  status: string;
}

const STATUS_STYLES: Record<string, string> = {
  PENDING: 'text-slate-400 bg-slate-900/50 border-slate-700',
  PROCESSING: 'text-amber-400 bg-amber-950/40 border-amber-800 animate-pulse',
  READY: 'text-emerald-400 bg-emerald-950/40 border-emerald-800',
  FAILED: 'text-red-400 bg-red-950/40 border-red-800',
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({ status }) => {
  return (
    <span className={`inline-flex items-center text-xs font-mono font-semibold border rounded px-1.5 py-0.5 ${STATUS_STYLES[status] || STATUS_STYLES.PENDING}`}>
      {status}
    </span>
  );
};
