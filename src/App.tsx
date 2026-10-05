import { useState, useEffect, useCallback, useMemo } from 'react';
import { Contract, ContractStats, AuthUser } from './types';
import { calculateStats, filterContracts, subscribeContracts } from './services/storage';
import { signOutAdmin, watchAdminSession } from './services/auth';
import { getErrorMessage } from './services/security';
import { Header } from './components/Header';
import { PipelineStats } from './components/PipelineStats';
import { ContractsTable } from './components/ContractsTable';
import { ContractDetails } from './components/ContractDetails';
import { CreateContractModal } from './components/CreateContractModal';
import { CategoryManagerModal } from './components/CategoryManagerModal';
import { SignerPortal } from './components/SignerPortal';
import { EmailOutbox } from './components/EmailOutbox';
import { AuditVault } from './components/AuditVault';
import { AuthScreen } from './components/AuthScreen';

export default function App() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [activeToken, setActiveToken] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'dashboard' | 'outbox' | 'audit'>('dashboard');

  const [allContracts, setAllContracts] = useState<Contract[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [justCreated, setJustCreated] = useState<Contract | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);

  // Check URL token (hash #sign?token=... or query parameter ?token=...)
  const checkTokenFromUrl = useCallback(() => {
    const hash = window.location.hash;
    if (hash.includes('token=')) {
      const match = hash.match(/token=([a-zA-Z0-9_]+)/); // matches tokens from newSigningToken()
      if (match && match[1]) {
        setActiveToken(match[1]);
        return;
      }
    }
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setActiveToken(token);
      return;
    }
    setActiveToken(null);
  }, []);

  useEffect(() => {
    checkTokenFromUrl();
    window.addEventListener('hashchange', checkTokenFromUrl);
    window.addEventListener('popstate', checkTokenFromUrl);
    return () => {
      window.removeEventListener('hashchange', checkTokenFromUrl);
      window.removeEventListener('popstate', checkTokenFromUrl);
    };
  }, [checkTokenFromUrl]);

  // Admin session (Firebase Auth, company Google accounts only)
  useEffect(() => watchAdminSession(u => {
    setUser(u);
    setIsInitializing(false);
  }), []);

  // Live contract list: updates automatically when a signer signs or an email is logged
  useEffect(() => {
    if (!user) {
      setAllContracts([]);
      return;
    }
    setLoadError(null);
    return subscribeContracts(setAllContracts, err =>
      setLoadError(getErrorMessage(err, 'Could not load contracts. Check your connection and permissions.'))
    );
  }, [user]);

  const contracts = useMemo(
    () => filterContracts(allContracts, selectedStatus, searchQuery),
    [allContracts, selectedStatus, searchQuery]
  );
  const stats: ContractStats = useMemo(() => calculateStats(allContracts), [allContracts]);
  const selectedContract = useMemo(
    () => allContracts.find(c => c.id === selectedId) ?? (justCreated?.id === selectedId ? justCreated : null),
    [allContracts, selectedId, justCreated]
  );
  const setSelectedContract = useCallback((c: Contract | null) => setSelectedId(c ? c.id : null), []);

  // When a recipient clicks a test signing link from dashboard
  const handleOpenSignerPortal = (token: string) => {
    window.location.hash = `sign?token=${token}`;
    setActiveToken(token);
  };

  const handleExitSignerPortal = () => {
    window.location.hash = '';
    setActiveToken(null);
  };

  const handleLogout = async () => {
    await signOutAdmin();
    setSelectedContract(null);
  };

  // If a signer token is active in the URL, render SignerPortal immediately
  if (activeToken) {
    return (
      <SignerPortal 
        token={activeToken} 
        onExit={handleExitSignerPortal} 
      />
    );
  }

  // Session initialization spinner
  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="text-center space-y-2">
          <div className="w-8 h-8 border-2 border-slate-900 border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs text-slate-500 font-medium">Checking dashboard session...</p>
        </div>
      </div>
    );
  }

  // If user is not authenticated, show AuthScreen (without examples)
  if (!user) {
    return <AuthScreen onLoginSuccess={u => setUser(u)} />;
  }

  // Authenticated Dashboard View
  return (
    <div className="min-h-screen bg-[#f4f6fb] flex flex-col font-sans text-[#060b1e]">
      <Header
        user={user}
        activeTab={activeTab}
        onSelectTab={tab => {
          setActiveTab(tab);
          setSelectedContract(null);
        }}
        onOpenCreate={() => setIsCreateOpen(true)}
        onOpenCategories={() => setIsCategoriesOpen(true)}
        onLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {loadError && (
          <div role="alert" className="p-3 text-xs text-red-700 bg-red-50 border border-red-200 rounded-lg">
            {loadError}
          </div>
        )}
        {/* CONTRACTS TAB */}
        {activeTab === 'dashboard' && (
          <>
            {selectedContract ? (
              <ContractDetails
                contract={selectedContract}
                onBack={() => setSelectedContract(null)}
                onOpenSignerPortal={handleOpenSignerPortal}
              />
            ) : (
              <div className="space-y-6">
                <PipelineStats
                  stats={stats}
                  selectedStatus={selectedStatus}
                  onSelectStatus={status => setSelectedStatus(status)}
                />

                <ContractsTable
                  contracts={contracts}
                  selectedStatus={selectedStatus}
                  onSelectStatus={status => setSelectedStatus(status)}
                  searchQuery={searchQuery}
                  onSearchChange={query => setSearchQuery(query)}
                  onSelectContract={c => setSelectedContract(c)}
                  onOpenCreate={() => setIsCreateOpen(true)}
                />
              </div>
            )}
          </>
        )}

        {/* EMAIL OUTBOX TAB */}
        {activeTab === 'outbox' && (
          <EmailOutbox contracts={allContracts} onOpenSignerPortal={handleOpenSignerPortal} />
        )}

        {/* AUDIT VAULT TAB */}
        {activeTab === 'audit' && (
          <AuditVault
            contracts={allContracts}
            onSelectContract={c => {
              setSelectedContract(c);
              setActiveTab('dashboard');
            }}
          />
        )}
      </main>

      {/* CREATE CONTRACT MODAL */}
      <CreateContractModal
        isOpen={isCreateOpen}
        onClose={() => setIsCreateOpen(false)}
        onSuccess={newContract => {
          setJustCreated(newContract);
          setSelectedContract(newContract);
          setActiveTab('dashboard');
        }}
      />

      {/* CATEGORY MANAGER MODAL */}
      <CategoryManagerModal
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        onCategoriesChanged={() => undefined}
      />
    </div>
  );
}
