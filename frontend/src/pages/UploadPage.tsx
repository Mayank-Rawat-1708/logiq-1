import React, { useState, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, X, Loader2, AlertCircle } from 'lucide-react';
import { logsApi } from '../api/logs';
import { useAuthStore } from '../store/authStore';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';

type Tab = 'upload' | 'paste';

export const UploadPage: React.FC = () => {
  const navigate = useNavigate();
  const addToast = useAuthStore((s) => s.addToast);

  const [tab, setTab] = useState<Tab>('upload');
  const [sessionName, setSessionName] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [pasteText, setPasteText] = useState('');
  const [loading, setLoading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const fileInputRef = useRef<HTMLInputElement>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!sessionName.trim()) e.name = 'Session name is required';
    if (tab === 'upload' && !file) e.file = 'Please select a file';
    if (tab === 'paste' && !pasteText.trim()) e.paste = 'Please paste some log content';
    return e;
  };

  const handleFile = useCallback((f: File) => {
    const allowed = ['text/plain', 'application/json', 'application/octet-stream', ''];
    const ext = f.name.split('.').pop()?.toLowerCase();
    if (!['log', 'txt', 'json'].includes(ext ?? '')) {
      setErrors({ file: 'Only .log, .txt, and .json files are supported' });
      return;
    }
    if (f.size > 50 * 1024 * 1024) {
      setErrors({ file: 'File must be under 50MB' });
      return;
    }
    setFile(f);
    setErrors((prev) => ({ ...prev, file: '' }));
    if (!sessionName) {
      setSessionName(f.name.replace(/\.[^.]+$/, ''));
    }
  }, [sessionName]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  }, [handleFile]);

  const handleSubmit = async () => {
    const validationErrors = validate();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    setErrors({});
    setLoading(true);

    try {
      const source = tab === 'upload' ? 'UPLOAD' : 'PASTE';
      const session = await logsApi.createSession(sessionName.trim(), source);

      if (tab === 'upload' && file) {
        await logsApi.uploadFile(session.id, file);
      } else if (tab === 'paste') {
        await logsApi.pasteLogs(session.id, pasteText);
      }

      addToast('success', 'Session created — processing started!');
      navigate(`/sessions/${session.id}`);
    } catch (err: any) {
      const msg = err?.response?.data?.detail || 'Failed to create session';
      addToast('error', msg);
      setErrors({ form: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen bg-[#0A0A0F]">
      <Sidebar />
      <div className="flex-1 flex flex-col">
        <TopBar title="New Session" subtitle="Upload a log file or paste log content to begin analysis" />

        <main className="flex-1 p-6 flex justify-center">
          <div className="w-full max-w-2xl space-y-6">
            {/* Session name */}
            <div>
              <label className="block text-sm font-medium text-[#94A3B8] mb-2">
                Session name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={sessionName}
                onChange={(e) => setSessionName(e.target.value)}
                placeholder="e.g. prod-api-2024-01-15"
                className="w-full bg-[#111118] border border-[#2A2A3A] rounded-lg px-4 py-2.5 text-sm text-[#F1F5F9] placeholder-[#475569] outline-none focus:border-[#6366F1] transition-colors font-mono"
              />
              {errors.name && <p className="text-xs text-red-400 mt-1">{errors.name}</p>}
            </div>

            {/* Tabs */}
            <div className="flex bg-[#111118] border border-[#2A2A3A] rounded-xl p-1">
              {([['upload', 'Upload File'], ['paste', 'Paste Logs']] as [Tab, string][]).map(([t, label]) => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setErrors({}); }}
                  className={`flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium rounded-lg transition-all ${
                    tab === t
                      ? 'bg-[#6366F1] text-white shadow-sm'
                      : 'text-[#94A3B8] hover:text-[#F1F5F9]'
                  }`}
                >
                  {t === 'upload' ? <Upload className="w-4 h-4" /> : <FileText className="w-4 h-4" />}
                  {label}
                </button>
              ))}
            </div>

            {/* Upload tab */}
            {tab === 'upload' && (
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".log,.txt,.json"
                  className="hidden"
                  onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
                />
                <div
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  onClick={() => !file && fileInputRef.current?.click()}
                  className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${
                    dragOver
                      ? 'border-[#6366F1] bg-[#6366F1]/5'
                      : file
                      ? 'border-emerald-600 bg-emerald-950/10 cursor-default'
                      : 'border-[#2A2A3A] hover:border-[#6366F1]/50 bg-[#111118]'
                  }`}
                >
                  {file ? (
                    <div className="space-y-3">
                      <FileText className="w-10 h-10 text-emerald-400 mx-auto" />
                      <div>
                        <p className="font-mono font-semibold text-[#F1F5F9]">{file.name}</p>
                        <p className="text-sm text-[#475569]">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFile(null); }}
                        className="flex items-center gap-1.5 text-xs text-[#475569] hover:text-red-400 mx-auto transition-colors"
                      >
                        <X className="w-3 h-3" /> Remove
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <Upload className="w-10 h-10 text-[#2A2A3A] mx-auto" />
                      <div>
                        <p className="font-semibold text-[#94A3B8]">Drop your log file here</p>
                        <p className="text-sm text-[#475569] mt-1">or click to browse · .log · .txt · .json · max 50MB</p>
                      </div>
                    </div>
                  )}
                </div>
                {errors.file && <p className="text-xs text-red-400 mt-2">{errors.file}</p>}
              </div>
            )}

            {/* Paste tab */}
            {tab === 'paste' && (
              <div>
                <textarea
                  value={pasteText}
                  onChange={(e) => setPasteText(e.target.value)}
                  placeholder={"Paste your log content here…\n\nExample:\n2024-01-15 10:23:45 ERROR api.service Database connection failed\n2024-01-15 10:23:46 INFO api.service Retrying connection..."}
                  className="w-full bg-[#111118] border border-[#2A2A3A] rounded-xl px-4 py-3 text-sm font-mono text-[#F1F5F9] placeholder-[#475569] outline-none focus:border-[#6366F1] transition-colors resize-none"
                  style={{ minHeight: '300px' }}
                />
                <div className="flex justify-between items-center mt-1.5">
                  {errors.paste
                    ? <p className="text-xs text-red-400">{errors.paste}</p>
                    : <span />
                  }
                  <p className="text-xs text-[#475569]">
                    {pasteText.length.toLocaleString()} chars · {pasteText.split('\n').filter(Boolean).length.toLocaleString()} lines
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {errors.form && (
              <div className="flex items-center gap-2 bg-red-950/30 border border-red-800 rounded-lg px-4 py-3">
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                <p className="text-sm text-red-400">{errors.form}</p>
              </div>
            )}

            {/* Submit */}
            <button
              onClick={handleSubmit}
              disabled={loading}
              className="w-full flex items-center justify-center gap-2 bg-[#6366F1] hover:bg-[#818CF8] disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold py-3 rounded-xl transition-colors shadow-lg shadow-[#6366F1]/20"
            >
              {loading ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Creating session…</>
              ) : (
                <><Upload className="w-4 h-4" /> Start Analysis</>
              )}
            </button>

            <p className="text-center text-xs text-[#475569]">
              LogIQ will parse, embed, and analyze your logs automatically. Processing usually takes 30–120 seconds.
            </p>
          </div>
        </main>
      </div>
    </div>
  );
};
