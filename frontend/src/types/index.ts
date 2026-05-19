export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR' | 'CRITICAL' | 'UNKNOWN';
export type SessionSource = 'UPLOAD' | 'PASTE' | 'STREAM';
export type SessionStatus = 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED';
export type AnomalySeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export interface User {
  id: string;
  email: string;
  full_name: string;
  is_active: boolean;
  created_at: string;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface LogSession {
  id: string;
  user_id: string;
  name: string;
  source: SessionSource;
  status: SessionStatus;
  total_lines: number | null;
  anomaly_count: number | null;
  created_at: string;
  processed_at: string | null;
}

export interface LogEntry {
  id: string;
  session_id: string;
  line_number: number;
  raw_text: string;
  timestamp: string | null;
  level: LogLevel;
  service: string | null;
  message: string;
  is_anomaly: boolean;
  anomaly_score: number | null;
  cluster_id: number | null;
  created_at: string;
}

export interface PaginatedEntries {
  items: LogEntry[];
  total: number;
  page: number;
  page_size: number;
  pages: number;
}

export interface LevelCount {
  level: string;
  count: number;
}

export interface TimelineBucket {
  bucket: string;
  count: number;
  error_count: number;
}

export interface SessionStats {
  session_id: string;
  total_lines: number;
  level_counts: LevelCount[];
  anomaly_count: number;
  anomaly_rate: number;
  timeline: TimelineBucket[];
  top_services: { service: string; count: number }[];
  top_errors: { message: string; count: number }[];
}

export interface AnomalyRecord {
  id: string;
  session_id: string;
  entry_id: string;
  severity: AnomalySeverity;
  detection_method: string;
  context_lines: {
    before: { line_number: number; level: string; message: string }[];
    after: { line_number: number; level: string; message: string }[];
  };
  created_at: string;
  entry_line_number: number | null;
  entry_message: string | null;
  entry_level: LogLevel | null;
  entry_timestamp: string | null;
  anomaly_score: number | null;
}

export interface ClusterEntry {
  line_number: number;
  message: string;
  level: LogLevel;
  anomaly_score: number | null;
}

export interface ClusterResponse {
  cluster_id: number;
  size: number;
  representative_entries: ClusterEntry[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ProcessingProgress {
  phase: 'parsing' | 'inserting' | 'detecting_anomalies' | 'embedding' | 'clustering' | 'complete' | 'failed';
  lines_processed: number;
  anomalies_found: number;
  status?: string;
  error?: string;
}

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'info';
  message: string;
}
