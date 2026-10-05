import React, { useMemo, useState } from 'react';
import { EmailPreviewFrame } from './EmailPreviewFrame';
import { Contract, EmailLog } from '../types';
import { buildEmailOutbox } from '../services/storage';
import { 
  Mail, 
  Search, 
  Eye, 
  Check, 
  Link2, 
  ExternalLink, 
  X 
} from 'lucide-react';

interface EmailOutboxProps {
  contracts: Contract[];
  onOpenSignerPortal: (token: string) => void;
}

export const EmailOutbox: React.FC<EmailOutboxProps> = ({ contracts, onOpenSignerPortal }) => {
  const emails = useMemo(() => buildEmailOutbox(contracts), [contracts]);
  const isLoading = false;
  const [searchQuery, setSearchQuery] = useState('');
  const [previewEmail, setPreviewEmail] = useState<EmailLog | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopyLink = (id: string, link: string) => {
    navigator.clipboard.writeText(link);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2500);
  };

  const filtered = emails.filter(
    e =>
      e.contractNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.recipientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.recipientEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
      e.subject.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden shadow-xs">
      {/* Outbox Header */}
      <div className="p-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-600" />
            <span>Email Delivery Outbox &amp; Notification Logs</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Audit log of all automatic invitations, reminders, and completed execution notices dispatched
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative min-w-[200px]">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search outbox logs..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 text-xs rounded border border-slate-200 bg-slate-50 focus:outline-none focus:ring-1 focus:ring-slate-900 font-sans"
            />
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="py-12 text-center text-xs text-slate-500">
          Loading email outbox logs...
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-xs text-slate-500 px-4">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
            <Mail className="w-5 h-5" />
          </div>
          <p className="font-semibold text-slate-700">No email records found</p>
          <p className="text-slate-400 mt-0.5">
            When contracts are created and invitations or reminders are sent, they will appear here.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 uppercase text-[10px] tracking-wider font-semibold border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-4">Dispatched (UTC)</th>
                <th className="py-2.5 px-4">Notification Type</th>
                <th className="py-2.5 px-4">Recipient</th>
                <th className="py-2.5 px-4">Contract Ref</th>
                <th className="py-2.5 px-4">Email Subject</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((email, idx) => {
                const tokenMatch = email.signingLink.match(/token=([a-zA-Z0-9_]+)/);
                const token = tokenMatch ? tokenMatch[1] : null;

                return (
                  <tr key={`email-item-${email.id || idx}`} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-3 px-4 font-mono tabular-nums text-slate-600 whitespace-nowrap">
                      {email.sentAt.slice(0, 19).replace('T', ' ')}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <span className="capitalize font-medium text-slate-800">
                        {email.type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 px-4 max-w-[200px]">
                      <div className="font-semibold text-slate-900 truncate">
                        {email.recipientName}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {email.recipientEmail}
                      </div>
                    </td>
                    <td className="py-3 px-4 font-mono font-medium text-slate-800 whitespace-nowrap">
                      {email.contractNumber}
                    </td>
                    <td className="py-3 px-4 text-slate-700 truncate max-w-[280px]">
                      {email.subject}
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {email.status === 'failed' ? (
                        <span title={email.error} className="inline-flex px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 text-[10px] font-bold uppercase">
                          Failed
                        </span>
                      ) : (
                        <span className="inline-flex px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold uppercase">
                          Sent
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          type="button"
                          onClick={() => setPreviewEmail(email)}
                          className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Preview</span>
                        </button>

                        {token && (
                          <>
                            <button
                              type="button"
                              onClick={() => handleCopyLink(email.id, email.signingLink)}
                              className="inline-flex items-center gap-1 text-xs text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 px-2 py-1 rounded cursor-pointer"
                              title="Copy signing link"
                            >
                              {copiedId === email.id ? (
                                <Check className="w-3.5 h-3.5 text-emerald-600" />
                              ) : (
                                <Link2 className="w-3.5 h-3.5" />
                              )}
                              <span>Link</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => onOpenSignerPortal(token)}
                              className="inline-flex items-center gap-1 text-xs text-blue-700 hover:text-blue-900 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded font-medium cursor-pointer"
                              title="Test as Signer"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                              <span>Sign</span>
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rendered HTML Email Modal */}
      {previewEmail && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-lg shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600" />
                <h3 className="font-semibold text-sm text-slate-900">Rendered HTML Email Notification</h3>
              </div>
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                className="text-slate-400 hover:text-slate-600 p-1 font-bold text-sm cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 border-b border-slate-200 text-xs space-y-1 text-slate-700">
              <div>
                <strong>To:</strong> {previewEmail.recipientName} &lt;{previewEmail.recipientEmail}&gt; ({previewEmail.recipientRole})
              </div>
              <div>
                <strong>Subject:</strong> {previewEmail.subject}
              </div>
              <div>
                <strong>Dispatched:</strong> {previewEmail.sentAt} (Status: {previewEmail.status === 'sent' ? 'Accepted by mail server' : `Failed${previewEmail.error ? ' – ' + previewEmail.error : ''}`})
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1 bg-white">
              <EmailPreviewFrame html={previewEmail.previewContent} title={previewEmail.subject} />
            </div>
            <div className="p-3 border-t border-slate-200 flex justify-end gap-2 bg-slate-50">
              <button
                type="button"
                onClick={() => setPreviewEmail(null)}
                className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 bg-slate-100 rounded cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
