import React, { useState } from 'react';
import { Contract, ContractStatus } from '../types';
import { downloadCertifiedPdf } from '../services/pdfGenerator';
import { 
  Search, 
  Download, 
  ArrowRight, 
  Check, 
  Link2, 
  FileText,
  Plus
} from 'lucide-react';

interface ContractsTableProps {
  contracts: Contract[];
  onSelectContract: (contract: Contract) => void;
  onOpenCreate: () => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
}

export const ContractsTable: React.FC<ContractsTableProps> = ({
  contracts,
  onSelectContract,
  onOpenCreate,
  selectedStatus,
  onSelectStatus,
  searchQuery,
  onSearchChange
}) => {
  const [copiedToken, setCopiedToken] = useState<string | null>(null);

  const handleCopyLink = (e: React.MouseEvent, token: string) => {
    e.stopPropagation();
    const url = `${window.location.origin}/#sign?token=${token}`;
    navigator.clipboard.writeText(url);
    setCopiedToken(token);
    setTimeout(() => setCopiedToken(null), 2500);
  };

  const handleDownloadPdf = (e: React.MouseEvent, contract: Contract) => {
    e.stopPropagation();
    downloadCertifiedPdf(contract);
  };

  const renderStatusBadge = (status: ContractStatus) => {
    switch (status) {
      case 'fully_signed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-[#060b1e] text-white border border-[#162354]">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            LOCKED & SIGNED
          </span>
        );
      case 'partially_signed':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-blue-50 text-blue-900 border border-blue-200">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            PARTIALLY SIGNED
          </span>
        );
      case 'pending_signature':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-50 text-[#ff1e27] border border-red-200">
            <span className="w-1.5 h-1.5 rounded-full bg-[#ff1e27] animate-ping" />
            ACTION REQUIRED
          </span>
        );
      case 'draft':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
            DRAFT
          </span>
        );
      case 'cancelled':
      case 'expired':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider bg-red-100 text-red-900 border border-red-300">
            <span className="w-1.5 h-1.5 rounded-full bg-red-600" />
            {status.toUpperCase()}
          </span>
        );
      default:
        return <span className="text-xs text-slate-500">{status}</span>;
    }
  };

  const statusFilters = [
    { id: 'all', label: 'ALL PIPELINE' },
    { id: 'pending_signature', label: 'PENDING' },
    { id: 'partially_signed', label: 'PARTIAL' },
    { id: 'fully_signed', label: 'CERTIFIED' },
    { id: 'draft', label: 'DRAFTS' },
  ];

  return (
    <div className="bg-white rounded-xl border border-[#e1e7f5] overflow-hidden shadow-sm">
      {/* Top Filter and Search Bar */}
      <div className="p-4 border-b border-[#e1e7f5] flex flex-col md:flex-row md:items-center justify-between gap-3 bg-white">
        <div className="flex items-center gap-1.5 p-1 bg-[#060b1e] rounded-lg overflow-x-auto border border-[#162354]">
          {statusFilters.map(filter => (
            <button
              key={filter.id}
              type="button"
              onClick={() => onSelectStatus(filter.id)}
              className={`px-3 py-1.5 text-[11px] font-bold rounded-md transition-all whitespace-nowrap uppercase tracking-wider cursor-pointer ${
                selectedStatus === filter.id
                  ? 'bg-[#ff1e27] text-white shadow-xs'
                  : 'text-slate-300 hover:text-white hover:bg-white/10'
              }`}
            >
              {filter.label}
            </button>
          ))}
        </div>

        <div className="relative min-w-[240px] md:w-80">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search ref #, candidate, role, title..."
            value={searchQuery}
            onChange={e => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-xs rounded-lg border border-[#e1e7f5] focus:outline-none focus:ring-2 focus:ring-[#ff1e27] focus:border-[#ff1e27] bg-[#f8faff] text-[#060b1e] placeholder-slate-400 transition-all font-sans"
          />
        </div>
      </div>

      {/* Contracts Table List or Clean Empty State */}
      {contracts.length === 0 ? (
        <div className="py-20 text-center px-4">
          <div className="w-12 h-12 rounded-xl bg-red-50 text-[#ff1e27] border border-red-200 flex items-center justify-center mx-auto mb-3 font-bold text-lg font-mono">
            //
          </div>
          <p className="text-base font-extrabold text-[#060b1e] uppercase tracking-tight">
            NO ACTIVE CONTRACTS FOUND
          </p>
          <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
            {searchQuery || selectedStatus !== 'all'
              ? 'No documents match the specified query or status filter. Try clearing your search.'
              : 'The dashboard pipeline is ready. Create your first legally binding contract workflow.'}
          </p>
          <div className="mt-5">
            <button
              type="button"
              onClick={onOpenCreate}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Create New Contract</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#060b1e] border-b border-[#14204c] text-slate-300 uppercase text-[10px] tracking-wider font-extrabold">
              <tr>
                <th className="py-3 px-4 text-white">CONTRACT IDENTIFIER // TITLE</th>
                <th className="py-3 px-4">DATE & TYPE</th>
                <th className="py-3 px-4">PARTY 1</th>
                <th className="py-3 px-4">COUNTER SIGNATORY (PARTY 2/3)</th>
                <th className="py-3 px-4">EXECUTION STATUS</th>
                <th className="py-3 px-4 text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#f1f5f9]">
              {contracts.map((contract, idx) => {
                const isFullySigned = contract.status === 'fully_signed';
                const p1 = contract.parties?.[0] || contract.party1;
                const p2 = contract.parties?.[1] || contract.party2;
                const p3 = contract.parties?.[2] || contract.party3;

                return (
                  <tr
                    key={`contract-row-${contract.id || idx}`}
                    onClick={() => onSelectContract(contract)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors group"
                  >
                    {/* Identifier & Title */}
                    <td className="py-3.5 px-4 max-w-[280px]">
                      <div className="font-mono text-xs font-bold text-[#ff1e27] group-hover:underline">
                        {contract.contractNumber}
                      </div>
                      <div className="font-bold text-sm text-[#060b1e] truncate mt-0.5" title={contract.title}>
                        {contract.title}
                      </div>
                      <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                        {contract.partyCount || 2} Parties · {contract.signingOrder}
                      </div>
                    </td>

                    {/* Date & Type */}
                    <td className="py-3.5 px-4 whitespace-nowrap text-slate-600">
                      <div className="font-mono text-xs font-semibold text-[#060b1e]">
                        {contract.contractDate}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate max-w-[150px]">
                        {contract.contractType}
                      </div>
                    </td>

                    {/* Party 1 */}
                    <td className="py-3.5 px-4 max-w-[190px]">
                      <div className="font-bold text-[#060b1e] truncate">
                        {p1.name}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {p1.email}
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 text-[11px]">
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            p1.status === 'signed' ? 'bg-emerald-500' : 'bg-red-500'
                          }`}
                        />
                        <span className="text-slate-600 capitalize text-[10px] font-semibold">
                          {p1.status}
                        </span>
                        {p1.status === 'pending' && (
                          <button
                            type="button"
                            title="Copy Party 1 Sign Link"
                            onClick={e => handleCopyLink(e, p1.signingToken)}
                            className="ml-1 p-0.5 text-slate-400 hover:text-[#ff1e27] rounded transition-colors cursor-pointer"
                          >
                            {copiedToken === p1.signingToken ? (
                              <Check className="w-3 h-3 text-[#ff1e27]" />
                            ) : (
                              <Link2 className="w-3 h-3" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>

                    {/* Counter Signatories (Party 2 & 3) */}
                    <td className="py-3.5 px-4 max-w-[210px]">
                      {contract.partyCount === 1 || (!p2 && !p3) ? (
                        <span className="text-slate-400 italic text-[11px]">Single Signatory Workflow</span>
                      ) : (
                        <div className="space-y-1.5">
                          {p2 && (
                            <div>
                              <div className="font-bold text-[#060b1e] truncate flex items-center justify-between">
                                <span className="truncate">{p2.name}</span>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${p2.status === 'signed' ? 'bg-emerald-500' : 'bg-amber-400'}`} />
                              </div>
                              <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
                                <span className="truncate">P2: {p2.role}</span>
                                {p2.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={e => handleCopyLink(e, p2.signingToken)}
                                    className="p-0.5 text-slate-400 hover:text-[#ff1e27] rounded"
                                    title="Copy P2 Link"
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {p3 && (
                            <div className="pt-1 border-t border-slate-100">
                              <div className="font-bold text-[#060b1e] truncate flex items-center justify-between">
                                <span className="truncate">{p3.name}</span>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ml-1 ${p3.status === 'signed' ? 'bg-emerald-500' : 'bg-purple-400'}`} />
                              </div>
                              <div className="text-[10px] text-slate-500 truncate flex items-center justify-between">
                                <span className="truncate">P3: {p3.role}</span>
                                {p3.status === 'pending' && (
                                  <button
                                    type="button"
                                    onClick={e => handleCopyLink(e, p3.signingToken)}
                                    className="p-0.5 text-slate-400 hover:text-[#ff1e27] rounded"
                                    title="Copy P3 Link"
                                  >
                                    <Link2 className="w-2.5 h-2.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      {renderStatusBadge(contract.status)}
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        {isFullySigned && (
                          <button
                            type="button"
                            onClick={e => handleDownloadPdf(e, contract)}
                            className="p-1.5 bg-[#060b1e] hover:bg-[#ff1e27] text-white rounded-md transition-colors shadow-2xs cursor-pointer"
                            title="Download Certified PDF"
                          >
                            <Download className="w-3.5 h-3.5" />
                          </button>
                        )}
                        <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-bold text-white bg-[#060b1e] group-hover:bg-[#ff1e27] transition-colors shadow-2xs">
                          <span>OPEN</span>
                          <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
