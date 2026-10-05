import React from 'react';
import { ContractStats } from '../types';
import { 
  FileStack, 
  FilePen, 
  Clock, 
  FileCheck2, 
  CircleCheck, 
  CircleX 
} from 'lucide-react';

interface PipelineStatsProps {
  stats: ContractStats;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

export const PipelineStats: React.FC<PipelineStatsProps> = ({
  stats,
  selectedStatus,
  onSelectStatus
}) => {
  const items = [
    { id: 'all', label: 'TOTAL PIPELINE', count: stats.total, icon: FileStack, tag: 'ALL' },
    { id: 'draft', label: 'DRAFTS', count: stats.draft, icon: FilePen, tag: 'INTERNAL' },
    { id: 'pending_signature', label: 'PENDING SIGNATURE', count: stats.pending, icon: Clock, tag: 'ACTIVE' },
    { id: 'partially_signed', label: 'PARTIALLY SIGNED', count: stats.partiallySigned, icon: FileCheck2, tag: 'P1 SIGNED' },
    { id: 'fully_signed', label: 'CERTIFIED & SIGNED', count: stats.fullySigned, icon: CircleCheck, tag: 'LOCKED' },
    { id: 'expired_cancelled', label: 'EXPIRED / CANCELLED', count: stats.expiredCancelled, icon: CircleX, tag: 'VOID' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {items.map(item => {
        const Icon = item.icon;
        const isSelected = selectedStatus === item.id;

        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelectStatus(item.id)}
            className={`text-left p-3.5 rounded-xl transition-all relative overflow-hidden group cursor-pointer ${
              isSelected
                ? 'bg-white border-2 border-[#ff1e27] shadow-lg shadow-red-500/10 -translate-y-0.5'
                : 'bg-white border border-[#e1e7f5] hover:border-[#060b1e] hover:shadow-md'
            }`}
          >
            {isSelected && <div className="absolute top-0 left-0 right-0 h-1 bg-[#ff1e27]" />}
            <div className="flex items-center justify-between mb-2">
              <span
                className={`p-1.5 rounded-lg transition-colors ${
                  isSelected
                    ? 'bg-[#ff1e27] text-white'
                    : 'bg-[#060b1e] text-white group-hover:bg-[#ff1e27]'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </span>
              <span
                className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                  isSelected ? 'bg-red-50 text-[#ff1e27]' : 'bg-slate-100 text-slate-500'
                }`}
              >
                {item.tag}
              </span>
            </div>
            <div className="text-2xl font-extrabold text-[#060b1e] tracking-tight font-mono">
              {item.count}
            </div>
            <div className="text-[10px] font-bold text-slate-600 mt-1 uppercase tracking-wider truncate">
              {item.label}
            </div>
          </button>
        );
      })}
    </div>
  );
};
