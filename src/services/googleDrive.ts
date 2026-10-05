import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User
} from 'firebase/auth';
import { auth } from './firebase';

// A single scope is enough: `drive` already covers listing, uploading and deleting
// files. The previous list of 13 overlapping scopes (scripts, install, photos,
// meet, activity...) requested far more access than this app ever uses.
export const DRIVE_SCOPES = ['https://www.googleapis.com/auth/drive'];

const provider = new GoogleAuthProvider();
DRIVE_SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

// In-memory token storage (MANDATORY: Never in localStorage/sessionStorage)
let cachedAccessToken: string | null = null;

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  createdTime?: string;
  modifiedTime?: string;
  webViewLink?: string;
  webContentLink?: string;
  iconLink?: string;
  thumbnailLink?: string;
  owners?: { displayName?: string; emailAddress?: string }[];
}

/** Escape a value for use inside a single-quoted Drive `q` string literal. */
const escapeDriveQuery = (value: string): string =>
  value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export const initDriveAuth = (
  onSuccess: (user: User, token: string) => void,
  onSignedOut: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onSuccess(user, cachedAccessToken);
    } else if (!user) {
      cachedAccessToken = null;
      onSignedOut();
    }
  });
};

export const signInWithGoogleDrive = async (): Promise<{ user: User; accessToken: string }> => {
  const result = await signInWithPopup(auth, provider);
  const credential = GoogleAuthProvider.credentialFromResult(result);
  if (!credential?.accessToken) {
    throw new Error('Could not obtain Google Drive OAuth access token.');
  }
  cachedAccessToken = credential.accessToken;
  return { user: result.user, accessToken: cachedAccessToken };
};

/** Disconnects Drive only. The dashboard (admin) session stays signed in. */
export const signOutGoogleDrive = async (): Promise<void> => {
  cachedAccessToken = null;
};

export const getDriveAccessToken = (): string | null => {
  return cachedAccessToken;
};

export const getCurrentDriveUser = (): User | null => {
  return auth.currentUser;
};

/**
 * List files from user's Google Drive
 */
export async function listDriveFiles(options?: {
  searchQuery?: string;
  mimeType?: 'all' | 'pdf' | 'folder' | 'docs';
  folderId?: string;
  pageSize?: number;
}): Promise<DriveFileItem[]> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive. Please connect your Google account.');

  const conditions: string[] = ['trashed = false'];

  if (options?.folderId) {
    conditions.push(`'${escapeDriveQuery(options.folderId)}' in parents`);
  }

  if (options?.mimeType === 'pdf') {
    conditions.push("mimeType = 'application/pdf'");
  } else if (options?.mimeType === 'folder') {
    conditions.push("mimeType = 'application/vnd.google-apps.folder'");
  } else if (options?.mimeType === 'docs') {
    conditions.push("(mimeType = 'application/pdf' or mimeType = 'application/vnd.google-apps.document' or mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document')");
  }

  if (options?.searchQuery?.trim()) {
    conditions.push(`name contains '${escapeDriveQuery(options.searchQuery.trim())}'`);
  }

  const queryStr = encodeURIComponent(conditions.join(' and '));
  const fields = encodeURIComponent('files(id, name, mimeType, size, createdTime, modifiedTime, webViewLink, webContentLink, iconLink, thumbnailLink, owners)');
  const pageSize = options?.pageSize || 30;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?q=${queryStr}&fields=${fields}&pageSize=${pageSize}&orderBy=${encodeURIComponent('modifiedTime desc')}`,
    {
      headers: {
        Authorization: `Bearer ${token}`
      }
    }
  );

  if (!res.ok) {
    const errJson = await res.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Google Drive API error (${res.status})`);
  }

  const data = await res.json();
  return data.files || [];
}

/**
 * Create a folder in Google Drive
 */
export async function createDriveFolder(folderName: string, parentFolderId?: string): Promise<DriveFileItem> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const metadata: { name: string; mimeType: string; parents?: string[] } = {
    name: folderName,
    mimeType: 'application/vnd.google-apps.folder'
  };

  if (parentFolderId) {
    metadata.parents = [parentFolderId];
  }

  const res = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(metadata)
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to create folder in Google Drive');
  }

  return await res.json();
}

/**
 * Finds or creates the default "Ignite Vision Contracts" folder in Google Drive
 */
export async function getOrCreateContractsFolder(): Promise<string> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  // Check if exists
  const existing = await listDriveFiles({
    searchQuery: 'Ignite Vision Contracts',
    mimeType: 'folder'
  });

  const found = existing.find(f => f.name.toLowerCase() === 'ignite vision contracts');
  if (found) {
    return found.id;
  }

  // Create it
  const created = await createDriveFolder('Ignite Vision Contracts');
  return created.id;
}

/**
 * Upload a PDF blob to Google Drive using multipart upload
 */
export async function uploadPdfToDrive(
  fileName: string,
  pdfBlob: Blob,
  metadata?: {
    description?: string;
    folderId?: string;
  }
): Promise<DriveFileItem> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  const fileMetadata: { name: string; mimeType: string; description: string; parents?: string[] } = {
    name: fileName,
    mimeType: 'application/pdf',
    description: metadata?.description || 'Exported from Ignite Vision Documentation Dashboard'
  };

  if (metadata?.folderId) {
    fileMetadata.parents = [metadata.folderId];
  }

  // Read blob as binary string or array buffer
  const arrayBuffer = await pdfBlob.arrayBuffer();
  const bytes = new Uint8Array(arrayBuffer);

  const metaHeader = `${delimiter}Content-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(fileMetadata)}\r\n`;
  const fileHeader = `${delimiter}Content-Type: application/pdf\r\n\r\n`;

  const enc = new TextEncoder();
  const part1 = enc.encode(metaHeader);
  const part2 = enc.encode(fileHeader);
  const part3 = bytes;
  const part4 = enc.encode(closeDelimiter);

  const fullPayload = new Uint8Array(part1.length + part2.length + part3.length + part4.length);
  fullPayload.set(part1, 0);
  fullPayload.set(part2, part1.length);
  fullPayload.set(part3, part1.length + part2.length);
  fullPayload.set(part4, part1.length + part2.length + part3.length);

  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,size,webViewLink,webContentLink,createdTime,modifiedTime', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': `multipart/related; boundary=${boundary}`
    },
    body: fullPayload
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `Failed to upload PDF to Google Drive (${res.status})`);
  }

  return await res.json();
}

/**
 * Download a file content from Google Drive as a Blob / ArrayBuffer
 */
export async function downloadDriveFileBlob(fileId: string): Promise<Blob> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, {
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to download file from Google Drive (${res.status})`);
  }

  return await res.blob();
}

/**
 * Delete a file in Google Drive.
 * NOTE: The calling UI component MUST show a confirmation dialog before invoking this.
 */
export async function deleteDriveFile(fileId: string): Promise<void> {
  const token = getDriveAccessToken();
  if (!token) throw new Error('Not authenticated with Google Drive.');

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`
    }
  });

  if (!res.ok && res.status !== 204) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || 'Failed to delete file from Google Drive');
  }
}
