import React from 'react';

interface SkeletonProps {
  className?: string;
}

export const Skeleton: React.FC<SkeletonProps> = ({ className = '' }) => (
  <div className={`animate-pulse bg-[#1A1A24] rounded ${className}`} />
);

export const SessionCardSkeleton: React.FC = () => (
  <div className="bg-[#111118] border border-[#2A2A3A] rounded-lg p-5 space-y-3">
    <div className="flex items-center justify-between">
      <Skeleton className="h-5 w-40" />
      <Skeleton className="h-5 w-16" />
    </div>
    <Skeleton className="h-4 w-full" />
    <div className="flex gap-4">
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-20" />
      <Skeleton className="h-4 w-20" />
    </div>
    <Skeleton className="h-8 w-full" />
  </div>
);

export const LogRowSkeleton: React.FC = () => (
  <div className="flex items-center gap-4 px-4 py-2 border-b border-[#2A2A3A]">
    <Skeleton className="h-4 w-10" />
    <Skeleton className="h-4 w-32" />
    <Skeleton className="h-5 w-16" />
    <Skeleton className="h-4 w-20" />
    <Skeleton className="h-4 flex-1" />
  </div>
);
