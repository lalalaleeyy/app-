import React, { useMemo, useState } from 'react';
import { Contract } from '../types';
import { buildAuditVault } from '../services/storage';
import { ShieldCheck, Search, FileText } from 'lucide-react';

interface AuditVaultProps {
  contracts: Contract[];
  onSelectContract: (contract: Contract) => void;
}

export const AuditVault: React.FC<AuditVaultProps> = ({ contracts, onSelectContract }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const events = useMemo(() => buildAuditVault(contracts), [contracts]);
  const isLoading = false;

  const filtered = events.filter(
    e =>
      e.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.contractTitle.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.actor.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.event.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Master Audit Trail &amp; Cryptographic Vault</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Tamper-evident record of all contract versions, document opens, signatures, and certificates
          </p>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search audit trail by actor, ref, hash..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
          />
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">
          Loading audit records...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 px-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <p className="font-semibold text-slate-700">No audit events recorded yet</p>
          <p className="text-slate-400 mt-0.5">
            Every document creation, signature capture, and cryptographic event will be logged here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Timestamp (UTC)</th>
                <th className="py-2.5 px-4">Contract Ref</th>
                <th className="py-2.5 px-4">Action / Event</th>
                <th className="py-2.5 px-4">Actor</th>
                <th className="py-2.5 px-4">Description</th>
                <th className="py-2.5 px-4">IP Address</th>
                <th className="py-2.5 px-4 text-right">View Contract</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((item, idx) => {
                const contract = contracts.find(c => c.id === item.contractId);

                return (
                  <tr key={`vault-item-${item.id || idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {item.timestamp.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-900 whitespace-nowrap">
                      {item.contractNumber}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="font-semibold text-slate-800 capitalize">
                        {item.event.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-slate-700 whitespace-nowrap">{item.actor}</td>
                    <td className="py-3 px-4 text-slate-700 max-w-[320px] truncate" title={item.description}>
                      {item.description}
                    </td>
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {item.ipAddress || '—'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      {contract && (
                        <button
                          type="button"
                          onClick={() => onSelectContract(contract)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 font-medium cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </button>
                      )}
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
