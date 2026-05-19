import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, FileText } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useSessions } from '../hooks/useSession';
import { Sidebar } from '../components/layout/Sidebar';
import { TopBar } from '../components/layout/TopBar';
import { StatsOverview } from '../components/dashboard/StatsOverview';
import { SessionCard } from '../components/dashboard/SessionCard';
import { SessionCardSkeleton } from '../components/ui/Skeleton';
import { EmptyState } from '../components/ui/EmptyState';

export const DashboardPage: React.FC = () => {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const { data: sessions, isLoading } = useSessions();

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <div className="flex min-h-screen bg-[#0A0A0F]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          title={`${greeting()}, ${user?.full_name?.split(' ')[0] ?? 'there'}`}
          subtitle="Here's an overview of your log analysis sessions"
          actions={
            <button
              onClick={() => navigate('/upload')}
              className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#818CF8] text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors shadow-lg shadow-[#6366F1]/20"
            >
              <Plus className="w-4 h-4" />
              New Session
            </button>
          }
        />

        <main className="flex-1 p-6 space-y-6 overflow-auto">
          {/* Stats */}
          <StatsOverview sessions={sessions} isLoading={isLoading} />

          {/* Sessions */}
          <div>
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono font-semibold text-[#F1F5F9]">Recent Sessions</h2>
              {sessions && sessions.length > 0 && (
                <span className="text-xs text-[#475569]">{sessions.length} session{sessions.length !== 1 ? 's' : ''}</span>
              )}
            </div>

            {isLoading ? (
              <div className="grid grid-cols-3 gap-4">
                {[1, 2, 3, 4, 5, 6].map((i) => <SessionCardSkeleton key={i} />)}
              </div>
            ) : !sessions || sessions.length === 0 ? (
              <div className="border border-dashed border-[#2A2A3A] rounded-xl">
                <EmptyState
                  icon={<FileText className="w-16 h-16" />}
                  title="No sessions yet"
                  description="Upload your first log file or paste log text to get started with AI-powered analysis"
                  action={
                    <button
                      onClick={() => navigate('/upload')}
                      className="flex items-center gap-2 bg-[#6366F1] hover:bg-[#818CF8] text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Upload your first logs
                    </button>
                  }
                />
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-4">
                {sessions.map((session) => (
                  <SessionCard key={session.id} session={session} />
                ))}
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};
