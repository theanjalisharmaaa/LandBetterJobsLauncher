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

async function attachDocumentToActiveTab(docType, sender) {
  const documents = await getDocuments();
  const doc = documents[docType];
  if (!doc) {
    throw new Error('Document not found');
  }

  // With activeTab permission and content script loaded via manifest,
  // we can use messaging to communicate with the content script
  // The content script will handle the attachment in the active tab
  
  // Store the attachment request temporarily so content script can access it
  const attachmentId = `attach_${Date.now()}_${Math.random()}`;
  await chrome.storage.local.set({
    [`pending_attachment_${attachmentId}`]: { docType, doc, attachmentId, timestamp: Date.now() }
  });

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      chrome.storage.local.remove(`pending_attachment_${attachmentId}`);
      chrome.runtime.onMessage.removeListener(listener);
      reject(new Error('Attachment timeout'));
    }, 10000);
    
    const listener = (message, msgSender, sendResponse) => {
      if (message.type === 'docs:attach:response' && message.attachmentId === attachmentId) {
        chrome.runtime.onMessage.removeListener(listener);
        clearTimeout(timeout);
        chrome.storage.local.remove(`pending_attachment_${attachmentId}`);
        
        if (message.ok) {
          resolve(message.result);
        } else {
          reject(new Error(message.error || 'Attach failed'));
        }
        return true;
      }
    };
    
    chrome.runtime.onMessage.addListener(listener);
    
    // Since we can't send messages from background to content script without tabs permission,
    // we'll use storage events. The content script listens for storage changes and processes
    // pending attachments. We've already stored the attachment data above.
    // Content script will detect the storage change and process it.
  });
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
          const result = await attachDocumentToActiveTab(message.docType, _sender);
          sendResponse({ ok: true, result });
          return;
        }
        case 'docs:attach:get': {
          // Content script requests the pending attachment data
          const { [`pending_attachment_${message.attachmentId}`]: attachment } = await chrome.storage.local.get(`pending_attachment_${message.attachmentId}`);
          if (attachment) {
            sendResponse({ ok: true, attachment });
          } else {
            sendResponse({ ok: false, error: 'Attachment not found' });
          }
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

