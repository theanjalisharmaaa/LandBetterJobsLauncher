const DOC_STORAGE_KEY = 'documents';
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024; // 4MB practical cap to avoid quota issues
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];

function isSupportedDocType(docType) {
  return docType === 'resume' || (typeof docType === 'string' && docType.startsWith('resume-'));
}

async function getDocuments() {
  const { [DOC_STORAGE_KEY]: documents = {} } = await chrome.storage.local.get(DOC_STORAGE_KEY);
  return documents || {};
}

function bufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

async function saveDocument(payload) {
  const { docType, fileName, mimeType, size, data } = payload;
  if (!isSupportedDocType(docType)) {
    throw new Error('Unsupported document type');
  }
  if (!fileName || !data) {
    throw new Error('Missing file data');
  }
  const normalizedSize = typeof size === 'number' ? size : (data.byteLength ?? data.length ?? 0);
  if (normalizedSize > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too large');
  }
  if (mimeType && !ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error('Invalid file type');
  }

  let encoded = '';
  if (typeof data === 'string') {
    encoded = data;
  } else {
    const buffer = data instanceof ArrayBuffer ? data : new Uint8Array(data).buffer;
    encoded = bufferToBase64(buffer);
  }
  const now = new Date().toISOString();
  const stored = await getDocuments();
  stored[docType] = {
    docType,
    fileName,
    mimeType,
    size: normalizedSize,
    updatedAt: now,
    data: encoded
  };

  await chrome.storage.local.set({ [DOC_STORAGE_KEY]: stored });
  return stored[docType];
}

async function deleteDocument(docType) {
  const stored = await getDocuments();
  if (stored[docType]) {
    delete stored[docType];
    await chrome.storage.local.set({ [DOC_STORAGE_KEY]: stored });
  }
  return stored;
}

async function attachDocumentToActiveTab(docType) {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.id) {
    throw new Error('No active tab');
  }

  const documents = await getDocuments();
  const doc = documents[docType];
  if (!doc) {
    throw new Error('Document not found');
  }

  // Ensure content script is injected before sending message
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ['contentScript.js']
  });

  const response = await chrome.tabs.sendMessage(tab.id, { type: 'docs:attach', docType, doc });
  return response;
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  (async () => {
    try {
      switch (message?.type) {
        case 'docs:list': {
          const documents = await getDocuments();
          sendResponse({ ok: true, documents });
          return;
        }
        case 'docs:save': {
          const saved = await saveDocument(message.payload);
          sendResponse({ ok: true, doc: saved });
          return;
        }
        case 'docs:delete': {
          const documents = await deleteDocument(message.docType);
          sendResponse({ ok: true, documents });
          return;
        }
        case 'docs:attach': {
          const result = await attachDocumentToActiveTab(message.docType);
          sendResponse({ ok: true, result });
          return;
        }
        default:
          sendResponse({ ok: false, error: 'Unknown message type' });
      }
    } catch (error) {
      console.error('Background error:', error);
      sendResponse({ ok: false, error: error?.message || 'Unknown error' });
    }
  })();
  return true;
});

