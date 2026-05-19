import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-[#0A0A0F] flex flex-col items-center justify-center gap-6">
      <div className="w-10 h-10 bg-[#6366F1] rounded-lg flex items-center justify-center">
        <Zap className="w-6 h-6 text-white" />
      </div>
      <div className="text-center">
        <h1 className="font-mono font-bold text-6xl text-[#2A2A3A] mb-2">404</h1>
        <p className="text-[#94A3B8]">This page doesn't exist</p>
      </div>
      <button
        onClick={() => navigate('/dashboard')}
        className="text-sm text-[#6366F1] hover:text-[#818CF8] transition-colors"
      >
        Back to dashboard
      </button>
    </div>
  );
};
