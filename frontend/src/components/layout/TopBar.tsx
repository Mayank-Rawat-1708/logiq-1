import React from 'react';

interface TopBarProps {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
}

export const TopBar: React.FC<TopBarProps> = ({ title, subtitle, actions }) => (
  <header className="flex items-center justify-between px-6 py-4 border-b border-[#2A2A3A] bg-[#0A0A0F] sticky top-0 z-10">
    <div>
      <h1 className="font-mono font-bold text-lg text-[#F1F5F9]">{title}</h1>
      {subtitle && <p className="text-xs text-[#475569] mt-0.5">{subtitle}</p>}
    </div>
    {actions && <div className="flex items-center gap-3">{actions}</div>}
  </header>
);
