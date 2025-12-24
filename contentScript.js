const DOC_KEYWORDS = {
  resume: ['resume', 'cv', 'curriculum vitae']
};

function isElementVisible(el) {
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  const style = window.getComputedStyle(el);
  const hasSize = rect.width > 0 && rect.height > 0;
  const visible = style.visibility !== 'hidden' && style.display !== 'none' && style.opacity !== '0';
  return hasSize && visible && !el.disabled;
}

function getLabelText(input) {
  const labels = [];
  if (input.labels) {
    input.labels.forEach(label => labels.push(label.textContent || ''));
  }
  if (input.id) {
    const byFor = document.querySelector(`label[for="${input.id}"]`);
    if (byFor) labels.push(byFor.textContent || '');
  }
  let parent = input.parentElement;
  if (parent && parent.tagName.toLowerCase() === 'label') {
    labels.push(parent.textContent || '');
  }
  return labels.join(' ').toLowerCase();
}

function collectFileInputs(root) {
  const inputs = Array.from(root.querySelectorAll('input[type="file"]'));
  const shadowInputs = [];
  root.querySelectorAll('*').forEach(el => {
    if (el.shadowRoot) {
      shadowInputs.push(...collectFileInputs(el.shadowRoot));
    }
  });
  return inputs.concat(shadowInputs);
}

function scoreInput(input, docType) {
  let score = 0;
  const keywords = DOC_KEYWORDS['resume'];
  const textFields = [
    input.name || '',
    input.id || '',
    input.getAttribute('aria-label') || '',
    input.getAttribute('placeholder') || '',
    getLabelText(input)
  ].join(' ').toLowerCase();

  keywords.forEach(keyword => {
    if (textFields.includes(keyword)) {
      score += 5;
    }
  });

  if (textFields.includes('upload') || textFields.includes('attachment')) {
    score += 2;
  }

  // Prefer visible inputs
  if (isElementVisible(input)) {
    score += 3;
  }

  return score;
}

function findBestInput(docType) {
  const inputs = collectFileInputs(document);
  const candidates = inputs
    .filter(input => !input.disabled)
    .map(input => ({ input, score: scoreInput(input, docType) }))
    .sort((a, b) => b.score - a.score);

  return candidates[0]?.input || null;
}

function dispatchInputEvents(input) {
  ['input', 'change'].forEach(eventType => {
    input.dispatchEvent(new Event(eventType, { bubbles: true }));
  });
  input.dispatchEvent(new Event('blur', { bubbles: true }));
}

function base64ToArrayBuffer(base64) {
  try {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i += 1) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes.buffer;
  } catch (e) {
    return null;
  }
}

async function handleAttach(docType, doc) {
  if (!doc?.data) {
    return { ok: false, error: 'Missing document data' };
  }

  const targetInput = findBestInput(docType);
  if (!targetInput) {
    return { ok: false, error: 'No upload field detected' };
  }

  const buffer = typeof doc.data === 'string'
    ? base64ToArrayBuffer(doc.data)
    : (doc.data instanceof ArrayBuffer ? doc.data : new Uint8Array(doc.data).buffer);

  if (!buffer) {
    return { ok: false, error: 'Invalid document payload' };
  }
  const file = new File([buffer], doc.fileName || 'document', {
    type: doc.mimeType || '',
    lastModified: doc.updatedAt ? Date.parse(doc.updatedAt) || Date.now() : Date.now()
  });

  const dataTransfer = new DataTransfer();
  dataTransfer.items.add(file);
  targetInput.files = dataTransfer.files;
  dispatchInputEvents(targetInput);

  return { ok: true, message: `Attached ${docType}` };
}

// Check for pending attachments on load
(async () => {
  if (document.visibilityState === 'visible') {
    const allStorage = await chrome.storage.local.get(null);
    Object.keys(allStorage).forEach(key => {
      if (key.startsWith('pending_attachment_')) {
        const attachmentId = key.replace('pending_attachment_', '');
        const attachmentData = allStorage[key];
        // Only process if it's recent (within last 30 seconds)
        if (attachmentData.timestamp && Date.now() - attachmentData.timestamp < 30000) {
          processAttachment(attachmentId, attachmentData);
        }
      }
    });
  }
})();

// Listen for storage changes to detect new attachment requests
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local') return;
  
  // Check for pending attachment requests
  Object.keys(changes).forEach(key => {
    if (key.startsWith('pending_attachment_')) {
      const attachmentId = key.replace('pending_attachment_', '');
      const newValue = changes[key].newValue;
      
      if (newValue && document.visibilityState === 'visible') {
        // We're in the active tab, process the attachment
        processAttachment(attachmentId, newValue);
      }
    }
  });
});

async function processAttachment(attachmentId, attachmentData) {
  try {
    const { docType, doc } = attachmentData;
    
    // Process the attachment
    const result = await handleAttach(docType, doc);
    
    // Send response back to background
    chrome.runtime.sendMessage({
      type: 'docs:attach:response',
      attachmentId,
      ok: result.ok,
      result: result.ok ? result : undefined,
      error: result.ok ? undefined : (result.error || 'Attach failed')
    });
  } catch (error) {
    chrome.runtime.sendMessage({
      type: 'docs:attach:response',
      attachmentId,
      ok: false,
      error: error?.message || 'Attach failed'
    });
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'docs:attach') {
    // Legacy support - direct attachment with document data
    handleAttach(message.docType, message.doc)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ ok: false, error: error?.message || 'Attach failed' }));
    return true;
  }
  
  return undefined;
});

