import React, { useState, useEffect } from 'react';
import { 
  signInWithGoogleDrive, 
  signOutGoogleDrive, 
  getDriveAccessToken, 
  getCurrentDriveUser,
  listDriveFiles, 
  deleteDriveFile,
  uploadPdfToDrive,
  createDriveFolder,
  getOrCreateContractsFolder,
  DriveFileItem
} from '../services/googleDrive';
import { Contract } from '../types';
import { getCertifiedPdfBlob, getOriginalPdfBlob } from '../services/pdfGenerator';
import { 
  Search, 
  RefreshCw, 
  ExternalLink, 
  Trash2, 
  FolderPlus, 
  UploadCloud, 
  FileText, 
  Folder, 
  Check, 
  AlertTriangle,
  HardDrive,
  Download,
  Plus
} from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface GoogleDriveVaultProps {
  contracts: Contract[];
  onSelectPdfForContract?: (pdfDataUrl: string, fileName: string) => void;
  onOpenCreate?: () => void;
}

export const GoogleDriveVault: React.FC<GoogleDriveVaultProps> = ({
  contracts,
  onSelectPdfForContract,
  onOpenCreate
}) => {
  const [user, setUser] = useState(getCurrentDriveUser());
  const [token, setToken] = useState<string | null>(getDriveAccessToken());
  const [files, setFiles] = useState<DriveFileItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'folder' | 'docs'>('all');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Destructive delete confirmation modal state (MANDATORY REQUIREMENT)
  const [fileToDelete, setFileToDelete] = useState<DriveFileItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Create folder modal state
  const [isNewFolderOpen, setIsNewFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');

  // Backup all contracts modal
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupProgress, setBackupProgress] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadFiles();
    }
  }, [token, filterType]);

  const loadFiles = async () => {
    try {
      setIsLoading(true);
      setErrorMsg(null);
      const items = await listDriveFiles({
        searchQuery,
        mimeType: filterType
      });
      setFiles(items);
    } catch (err) {
      console.error('Error listing Drive files:', err);
      setErrorMsg(getErrorMessage(err, 'Failed to list Google Drive files'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignIn = async () => {
    try {
      setIsSigningIn(true);
      setErrorMsg(null);
      const res = await signInWithGoogleDrive();
      setUser(res.user);
      setToken(res.accessToken);
      setSuccessMsg(`Connected as ${res.user.displayName || res.user.email}`);
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error('Drive sign-in error:', err);
      setErrorMsg(getErrorMessage(err, 'Failed to authenticate with Google Drive'));
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOutGoogleDrive();
      setUser(null);
      setToken(null);
      setFiles([]);
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to sign out of Google Drive'));
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      loadFiles();
    }
  };

  // User Confirmation for Destructive Delete (Mandatory Workspace Skill Rule)
  const handleConfirmDelete = async () => {
    if (!fileToDelete) return;
    try {
      setIsDeleting(true);
      setErrorMsg(null);
      await deleteDriveFile(fileToDelete.id);
      setSuccessMsg(`"${fileToDelete.name}" was permanently removed from Google Drive.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      setFileToDelete(null);
      loadFiles();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to delete file from Google Drive'));
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      setIsLoading(true);
      await createDriveFolder(newFolderName.trim());
      setNewFolderName('');
      setIsNewFolderOpen(false);
      setSuccessMsg(`Folder "${newFolderName.trim()}" created successfully in Google Drive.`);
      setTimeout(() => setSuccessMsg(null), 3000);
      loadFiles();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to create folder'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleBackupAllContracts = async () => {
    try {
      setIsBackingUp(true);
      setErrorMsg(null);
      const allContracts = contracts;
      if (allContracts.length === 0) {
        setErrorMsg('No contracts in pipeline to backup.');
        return;
      }

      setBackupProgress('Locating or creating "Ignite Vision Contracts" folder...');
      const folderId = await getOrCreateContractsFolder();

      let count = 0;
      for (const contract of allContracts) {
        count++;
        setBackupProgress(`Exporting ${count}/${allContracts.length}: ${contract.contractNumber}...`);
        
        // Export certified PDF if signed, or original
        const blob = contract.status === 'fully_signed'
          ? getCertifiedPdfBlob(contract)
          : getOriginalPdfBlob(contract);

        const suffix = contract.status === 'fully_signed' ? 'Certified_Signed' : 'Original';
        const fileName = `${contract.contractNumber}_${contract.title.replace(/[^a-zA-Z0-9_-]/g, '_')}_${suffix}.pdf`;

        await uploadPdfToDrive(fileName, blob, {
          folderId,
          description: `Contract ${contract.contractNumber} (${contract.title}) - Status: ${contract.status}`
        });
      }

      setSuccessMsg(`Successfully backed up ${count} contract(s) to "Ignite Vision Contracts" in Google Drive!`);
      setTimeout(() => setSuccessMsg(null), 4000);
      loadFiles();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to backup contracts to Google Drive'));
    } finally {
      setIsBackingUp(false);
      setBackupProgress(null);
    }
  };

  const handleImportToApp = async (file: DriveFileItem) => {
    if (!onSelectPdfForContract) return;
    try {
      setIsLoading(true);
      const token = getDriveAccessToken();
      const res = await fetch(`https://www.googleapis.com/drive/v3/files/${file.id}?alt=media`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const blob = await res.blob();
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          onSelectPdfForContract(reader.result, file.name);
        }
      };
      reader.readAsDataURL(blob);
    } catch (err) {
      setErrorMsg('Failed to load PDF data from Google Drive');
    } finally {
      setIsLoading(false);
    }
  };

  const formatBytes = (bytes?: string | number) => {
    if (!bytes) return '—';
    const n = typeof bytes === 'string' ? parseInt(bytes, 10) : bytes;
    if (isNaN(n) || n === 0) return '—';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(n) / Math.log(k));
    return parseFloat((n / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-6">
      {/* Top Banner / Google Drive Integration Status */}
      <div className="bg-white rounded-xl border border-[#e1e7f5] p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 flex items-center justify-center shrink-0 shadow-md">
              <svg className="w-7 h-7" viewBox="0 0 87.3 78" xmlns="http://www.w3.org/2000/svg">
                <path d="m6.6 66.85 3.85 6.65c.8 1.4 1.95 2.5 3.3 3.3l13.75-23.8h-27.5c0 1.55.4 3.1 1.2 4.5z" fill="#0066da"/>
                <path d="m43.65 25-13.75-23.8c-1.35.8-2.5 1.9-3.3 3.3l-25.4 44c-.8 1.4-1.2 2.95-1.2 4.5h27.5z" fill="#00ac47"/>
                <path d="m73.55 76.8c1.35-.8 2.5-1.9 3.3-3.3l1.6-2.75 7.65-13.25c.8-1.4 1.2-2.95 1.2-4.5h-27.502l5.852 11.5z" fill="#ea4335"/>
                <path d="m43.65 25 13.75-23.8c-1.35-.8-2.9-1.2-4.5-1.2h-18.5c-1.6 0-3.15.45-4.5 1.2z" fill="#00832d"/>
                <path d="m59.8 53h-32.3l-13.75 23.8c1.35.8 2.9 1.2 4.5 1.2h50.8c1.6 0 3.15-.45 4.5-1.2z" fill="#2684fc"/>
                <path d="m73.4 26.5-12.7-22c-.8-1.4-1.95-2.5-3.3-3.3l-13.75 23.8 16.15 28h27.45c0-1.55-.4-3.1-1.2-4.5z" fill="#ffba00"/>
              </svg>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-extrabold text-[#060b1e] tracking-tight">
                  Google Drive Cloud Vault &amp; Archival
                </h2>
                {token ? (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    CONNECTED
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                    DISCONNECTED
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Direct integration with your Google Drive to backup contracts, upload PDFs, and import documents with explicit permissions.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {token ? (
              <div className="flex items-center gap-3">
                {user && (
                  <div className="flex items-center gap-2 text-xs bg-[#f8faff] py-1.5 px-3 rounded-lg border border-[#e1e7f5]">
                    {user.photoURL ? (
                      <img src={user.photoURL} alt="Avatar" className="w-6 h-6 rounded-full" />
                    ) : (
                      <div className="w-6 h-6 rounded-full bg-[#060b1e] text-white flex items-center justify-center font-bold text-[10px]">
                        {(user.displayName || user.email || 'G')[0].toUpperCase()}
                      </div>
                    )}
                    <div className="text-left">
                      <div className="font-bold text-[#060b1e] truncate max-w-[140px] leading-tight">
                        {user.displayName || 'Google User'}
                      </div>
                      <div className="text-[10px] text-slate-500 truncate max-w-[140px] leading-tight font-mono">
                        {user.email}
                      </div>
                    </div>
                  </div>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-red-600 hover:bg-red-50 border border-slate-200 rounded-lg transition-colors cursor-pointer"
                >
                  Disconnect
                </button>
              </div>
            ) : (
              /* Official "Sign in with Google" button style specified by workspace-integration skill */
              <button
                type="button"
                onClick={handleSignIn}
                disabled={isSigningIn}
                className="inline-flex items-center gap-3 px-4 py-2 bg-white text-slate-700 hover:text-slate-900 border border-slate-300 hover:border-slate-400 rounded-lg shadow-sm hover:shadow transition-all font-medium text-xs cursor-pointer disabled:opacity-50"
              >
                <svg className="w-4 h-4" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
                <span>{isSigningIn ? 'Connecting to Google...' : 'Sign in with Google to Connect Drive'}</span>
              </button>
            )}
          </div>
        </div>

        {/* Feedback Alerts */}
        {errorMsg && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#ff1e27] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button type="button" onClick={() => setErrorMsg(null)} className="text-red-400 hover:text-red-700">✕</button>
          </div>
        )}

        {successMsg && (
          <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs font-semibold text-emerald-800 flex items-center gap-2">
            <Check className="w-4 h-4 shrink-0 text-emerald-600" />
            <span>{successMsg}</span>
          </div>
        )}
      </div>

      {/* Main Files Area */}
      {!token ? (
        <div className="bg-white rounded-xl border border-[#e1e7f5] p-12 text-center shadow-xs">
          <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-200 text-[#ff1e27] flex items-center justify-center mx-auto mb-4">
            <HardDrive className="w-8 h-8" />
          </div>
          <h3 className="text-base font-extrabold text-[#060b1e] uppercase tracking-wide">
            Google Drive Connection Required
          </h3>
          <p className="text-xs text-slate-500 mt-1.5 max-w-md mx-auto leading-relaxed">
            Connect your Google account with permission to store contracts, backup verified PDF audit trails, and access legal files stored in Google Drive.
          </p>
          <div className="mt-6">
            <button
              type="button"
              onClick={handleSignIn}
              disabled={isSigningIn}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#060b1e] hover:bg-[#ff1e27] text-white rounded-lg text-xs font-extrabold uppercase tracking-wider transition-all shadow-md cursor-pointer disabled:opacity-50"
            >
              <UploadCloud className="w-4 h-4" />
              <span>Connect Google Drive</span>
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#e1e7f5] overflow-hidden shadow-xs">
          {/* Action and Filter Bar */}
          <div className="p-4 border-b border-[#e1e7f5] flex flex-col lg:flex-row lg:items-center justify-between gap-3 bg-white">
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 bg-[#060b1e] rounded-lg border border-[#162354]">
                {(['all', 'pdf', 'docs', 'folder'] as const).map(type => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFilterType(type)}
                    className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all uppercase tracking-wider cursor-pointer ${
                      filterType === type
                        ? 'bg-[#ff1e27] text-white shadow-xs'
                        : 'text-slate-300 hover:text-white hover:bg-white/10'
                    }`}
                  >
                    {type === 'all' ? 'All Files' : type === 'pdf' ? 'PDFs' : type === 'docs' ? 'Docs & PDFs' : 'Folders'}
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setIsNewFolderOpen(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-slate-700 hover:text-[#060b1e] bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 cursor-pointer"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[#ff1e27]" />
                <span>New Folder</span>
              </button>

              <button
                type="button"
                onClick={handleBackupAllContracts}
                disabled={isBackingUp}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-extrabold uppercase tracking-wider text-white bg-[#060b1e] hover:bg-[#ff1e27] rounded-lg transition-all shadow-xs cursor-pointer disabled:opacity-50"
                title="Backup all active pipeline contracts to Google Drive"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{isBackingUp ? (backupProgress || 'Backing up...') : 'Backup Contracts to Drive'}</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              <form onSubmit={handleSearchSubmit} className="relative w-full sm:w-64">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search files in Google Drive..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-lg border border-[#e1e7f5] bg-[#f8faff] text-[#060b1e] focus:outline-none focus:ring-2 focus:ring-[#ff1e27]"
                />
              </form>

              <button
                type="button"
                onClick={loadFiles}
                disabled={isLoading}
                title="Refresh Google Drive files"
                className="p-2 text-slate-500 hover:text-[#060b1e] hover:bg-slate-100 rounded-lg transition-colors border border-[#e1e7f5] cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#ff1e27]' : ''}`} />
              </button>
            </div>
          </div>

          {/* Files List */}
          {isLoading && files.length === 0 ? (
            <div className="py-20 text-center text-xs text-slate-500">
              <div className="w-8 h-8 border-2 border-[#ff1e27] border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p>Fetching files from your Google Drive...</p>
            </div>
          ) : files.length === 0 ? (
            <div className="py-20 text-center px-4">
              <div className="w-12 h-12 rounded-xl bg-slate-100 text-slate-400 flex items-center justify-center mx-auto mb-3">
                <Folder className="w-6 h-6" />
              </div>
              <p className="text-sm font-bold text-[#060b1e] uppercase">No files found</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                No matching files or documents were found in Google Drive. Click "Backup Contracts to Drive" to export your pipeline.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-[#060b1e] text-slate-300 uppercase text-[10px] tracking-wider font-extrabold border-b border-[#14204c]">
                  <tr>
                    <th className="py-3 px-4 text-white">FILE / DOCUMENT NAME</th>
                    <th className="py-3 px-4">TYPE</th>
                    <th className="py-3 px-4">SIZE</th>
                    <th className="py-3 px-4">LAST MODIFIED</th>
                    <th className="py-3 px-4 text-right">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#f1f5f9]">
                  {files.map(file => {
                    const isPdf = file.mimeType === 'application/pdf';
                    const isFolder = file.mimeType === 'application/vnd.google-apps.folder';

                    return (
                      <tr key={`drive-file-${file.id}`} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-3 px-4 max-w-[320px]">
                          <div className="flex items-center gap-2.5">
                            {isFolder ? (
                              <Folder className="w-4 h-4 text-amber-500 shrink-0" />
                            ) : (
                              <FileText className="w-4 h-4 text-[#ff1e27] shrink-0" />
                            )}
                            <div className="truncate font-semibold text-[#060b1e]" title={file.name}>
                              {file.name}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap text-slate-500">
                          {isFolder ? 'Folder' : isPdf ? 'PDF Document' : file.mimeType.split('.').pop() || 'File'}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          {formatBytes(file.size)}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap font-mono text-slate-600">
                          {file.modifiedTime ? file.modifiedTime.slice(0, 16).replace('T', ' ') : '—'}
                        </td>
                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <div className="flex items-center justify-end gap-1.5">
                            {/* Open in Google Drive */}
                            {file.webViewLink && (
                              <a
                                href={file.webViewLink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md transition-colors"
                                title="Open in Google Drive"
                              >
                                <ExternalLink className="w-3 h-3" />
                                <span className="hidden sm:inline">Drive</span>
                              </a>
                            )}

                            {/* Import PDF to App */}
                            {isPdf && onSelectPdfForContract && (
                              <button
                                type="button"
                                onClick={() => handleImportToApp(file)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-md transition-colors cursor-pointer"
                                title="Use this PDF to create a contract"
                              >
                                <Plus className="w-3 h-3 text-emerald-600" />
                                <span className="hidden sm:inline">Create Contract</span>
                              </button>
                            )}

                            {/* Delete File - triggers mandatory confirmation modal */}
                            <button
                              type="button"
                              onClick={() => setFileToDelete(file)}
                              className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors cursor-pointer"
                              title="Delete file from Google Drive"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
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
      )}

      {/* MANDATORY USER CONFIRMATION MODAL FOR DESTRUCTIVE DRIVE OPERATIONS */}
      {fileToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-red-200">
            <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-[#ff1e27] text-white rounded-lg">
                  <Trash2 className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Confirm Google Drive Deletion
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <div className="p-5 space-y-3 text-xs">
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-900 leading-relaxed">
                Are you sure you want to permanently delete <strong>"{fileToDelete.name}"</strong> from your Google Drive?
                <p className="mt-1 text-[11px] text-red-700">
                  This action mutates your Google Drive account data and cannot be undone.
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setFileToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={isDeleting}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold uppercase tracking-wider text-white bg-[#ff1e27] hover:bg-[#e0121b] rounded-lg transition-all shadow-md shadow-red-500/25 cursor-pointer disabled:opacity-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>{isDeleting ? 'Deleting...' : 'Confirm Delete'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CREATE NEW FOLDER MODAL */}
      {isNewFolderOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/75 backdrop-blur-xs p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden border border-[#162354]">
            <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
              <div className="flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-[#ff1e27]" />
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                  Create Folder in Google Drive
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsNewFolderOpen(false)}
                className="text-slate-400 hover:text-white p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateFolder}>
              <div className="p-4 space-y-2">
                <label className="block text-xs font-bold text-[#060b1e] uppercase tracking-wider">
                  Folder Name
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Legal Contracts 2026"
                  value={newFolderName}
                  onChange={e => setNewFolderName(e.target.value)}
                  className="w-full text-xs p-2.5 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-[#ff1e27] font-sans"
                  autoFocus
                />
              </div>

              <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setIsNewFolderOpen(false)}
                  className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded-lg cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-white bg-[#060b1e] hover:bg-[#ff1e27] rounded-lg transition-colors cursor-pointer shadow-xs disabled:opacity-50"
                >
                  {isLoading ? 'Creating...' : 'Create Folder'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
