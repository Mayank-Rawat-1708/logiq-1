import React from 'react';

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export const EmptyState: React.FC<EmptyStateProps> = ({ icon, title, description, action }) => (
  <div className="flex flex-col items-center justify-center py-20 px-6 text-center">
    {icon && <div className="mb-4 text-[#2A2A3A]">{icon}</div>}
    <h3 className="text-lg font-mono font-semibold text-[#94A3B8] mb-2">{title}</h3>
    {description && <p className="text-sm text-[#475569] max-w-sm mb-6">{description}</p>}
    {action}
  </div>
);
