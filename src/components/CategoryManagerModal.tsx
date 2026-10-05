import React, { useState } from 'react';
import { ContractCategory } from '../types';
import { 
  getCategories, 
  addCategory, 
  updateCategory, 
  deleteCategory 
} from '../services/storage';
import { 
  FolderPlus, 
  Trash2, 
  Edit3, 
  Check, 
  X, 
  Plus, 
  AlertCircle 
} from 'lucide-react';
import { getErrorMessage } from '../services/security';

interface CategoryManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCategoriesChanged?: () => void;
}

export const CategoryManagerModal: React.FC<CategoryManagerModalProps> = ({
  isOpen,
  onClose,
  onCategoriesChanged
}) => {
  const [categories, setCategories] = useState<ContractCategory[]>(getCategories());
  const [newCatName, setNewCatName] = useState('');
  const [newCatDesc, setNewCatDesc] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const reload = () => {
    const fresh = getCategories();
    setCategories(fresh);
    if (onCategoriesChanged) onCategoriesChanged();
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    try {
      addCategory(newCatName, newCatDesc);
      setNewCatName('');
      setNewCatDesc('');
      reload();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to add category'));
    }
  };

  const handleStartEdit = (cat: ContractCategory) => {
    setEditingId(cat.id);
    setEditName(cat.name);
    setEditDesc(cat.description || '');
    setErrorMsg(null);
  };

  const handleSaveEdit = (id: string) => {
    setErrorMsg(null);
    try {
      updateCategory(id, editName, editDesc);
      setEditingId(null);
      reload();
    } catch (err) {
      setErrorMsg(getErrorMessage(err, 'Failed to update category'));
    }
  };

  const handleDelete = (id: string, name: string) => {
    if (categories.length <= 1) {
      setErrorMsg('You must maintain at least one category.');
      return;
    }
    if (window.confirm(`Are you sure you want to remove the category "${name}"?`)) {
      try {
        deleteCategory(id);
        reload();
      } catch (err) {
        setErrorMsg(getErrorMessage(err, 'Failed to delete category'));
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#060b1e]/75 backdrop-blur-xs p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col border border-[#162354] overflow-hidden">
        
        {/* Modal Header */}
        <div className="p-4 bg-[#060b1e] border-b border-[#14204c] text-white flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FolderPlus className="w-4 h-4 text-[#ff1e27]" />
            <div>
              <h3 className="text-sm font-extrabold uppercase tracking-wider text-white">
                Manage Contract Categories
              </h3>
              <p className="text-[10px] text-slate-400 font-mono">
                ADD, EDIT, OR REMOVE DOCUMENT CLASSIFICATIONS
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 flex-1">
          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-[#ff1e27] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Add Category Form */}
          <form onSubmit={handleAdd} className="p-3.5 bg-slate-50 rounded-lg border border-slate-200 space-y-2.5">
            <span className="text-[11px] font-bold text-slate-900 uppercase tracking-wider block">
              + Add New Category
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                placeholder="Category name (e.g. Master Services Agreement)"
                value={newCatName}
                onChange={e => setNewCatName(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
                required
              />
              <input
                type="text"
                placeholder="Brief description (optional)"
                value={newCatDesc}
                onChange={e => setNewCatDesc(e.target.value)}
                className="w-full text-xs px-3 py-1.5 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-slate-900 bg-white"
              />
            </div>
            <div className="flex justify-end">
              <button
                type="submit"
                className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#060b1e] hover:bg-[#ff1e27] text-white rounded text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Category</span>
              </button>
            </div>
          </form>

          {/* Existing Categories List */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
              <span>Existing Categories ({categories.length})</span>
              <span className="text-[10px] text-slate-400 font-normal">Click edit icon to modify</span>
            </div>

            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg bg-white overflow-hidden max-h-64 overflow-y-auto">
              {categories.map((cat, idx) => (
                <div key={`cat-item-${cat.id || idx}`} className="p-3 flex items-center justify-between gap-2 hover:bg-slate-50 transition-colors">
                  {editingId === cat.id ? (
                    <div className="flex-1 flex flex-col sm:flex-row items-center gap-2">
                      <input
                        type="text"
                        value={editName}
                        onChange={e => setEditName(e.target.value)}
                        className="flex-1 text-xs px-2.5 py-1 rounded border border-slate-300 bg-white"
                        autoFocus
                      />
                      <input
                        type="text"
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        placeholder="Description"
                        className="flex-1 text-xs px-2.5 py-1 rounded border border-slate-300 bg-white"
                      />
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(cat.id)}
                          className="p-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 cursor-pointer"
                          title="Save Changes"
                        >
                          <Check className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="p-1 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 cursor-pointer"
                          title="Cancel"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div className="min-w-0 flex-1">
                        <div className="font-bold text-xs text-[#060b1e] truncate">{cat.name}</div>
                        {cat.description && (
                          <div className="text-[11px] text-slate-500 truncate">{cat.description}</div>
                        )}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => handleStartEdit(cat)}
                          className="p-1.5 text-slate-400 hover:text-slate-900 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                          title="Edit Category Name"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(cat.id, cat.name)}
                          disabled={categories.length <= 1}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded hover:bg-rose-50 transition-colors cursor-pointer disabled:opacity-30 disabled:hover:text-slate-400"
                          title="Delete Category"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 bg-slate-100 rounded transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
