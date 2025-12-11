var name_text = document.getElementById('name');
var links_container = document.getElementById('links-container');
var profile_title = document.getElementById('profile-title');

// Standard link configurations
const standardLinks = {
  website: { id: 'website', label: 'Website', icon: 'fa-globe', defaultOrder: 1 },
  linkedin: { id: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin', defaultOrder: 2 },
  medium: { id: 'medium', label: 'Medium', icon: 'fa-medium', defaultOrder: 3 },
  twitter: { id: 'twitter', label: 'Twitter', icon: 'fa-twitter', defaultOrder: 4 },
  github: { id: 'github', label: 'GitHub', icon: 'fa-github', defaultOrder: 5 }
};

let documentTypes = [
  { id: 'resume', label: 'Resume', accept: '.pdf,.doc,.docx' }
];

const ALLOWED_EXTENSIONS = ['pdf', 'doc', 'docx'];
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
];
const MAX_FILE_SIZE_BYTES = 4 * 1024 * 1024;

function getIconClass(iconName) {
  // If it's a FontAwesome class, return it; otherwise assume it's a class name
  if (iconName.startsWith('fa-')) {
    return iconName;
  }
  return iconName;
}

function renderLinks(linksData) {
  links_container.innerHTML = '';
  
  // Get all links (standard + custom)
  let allLinks = [];
  
  // Add standard links
  for (let key in standardLinks) {
    const linkConfig = standardLinks[key];
    const enabled = linksData[`${key}_enabled`] !== false; // Default to enabled
    const order = linksData[`${key}_order`] !== undefined ? linksData[`${key}_order`] : linkConfig.defaultOrder;
    const url = linksData[key];
    const faviconUrl = linksData[`${key}_favicon`] || null;
    
    if (enabled && url) {
      allLinks.push({
        id: linkConfig.id,
        label: linkConfig.label,
        icon: linkConfig.icon,
        faviconUrl: faviconUrl,
        url: url,
        order: order,
        isCustom: false
      });
    }
  }
  
  // Add custom links
  if (linksData.customLinks && Array.isArray(linksData.customLinks)) {
    linksData.customLinks.forEach(link => {
      if (link.enabled !== false && link.url) {
        allLinks.push({
          id: link.id,
          label: link.label,
          icon: link.icon || 'fa-link',
          faviconUrl: link.faviconUrl || null,
          url: link.url,
          order: link.order || 999,
          isCustom: true
        });
      }
    });
  }
  
  // Sort by order (only enabled links are shown in popup)
  allLinks.sort((a, b) => a.order - b.order);
  
  // Render links
  allLinks.forEach((link, index) => {
    const linkDiv = document.createElement('div');
    linkDiv.className = 'flex';
    linkDiv.draggable = true;
    linkDiv.dataset.linkId = link.id;
    linkDiv.dataset.isCustom = link.isCustom;
    linkDiv.dataset.order = index;
    
    // Use favicon if available (for both standard and custom links), otherwise use FontAwesome icon
    const iconHtml = link.faviconUrl ? 
      `<img src="${link.faviconUrl}" alt="" style="width: 32px; height: 32px; object-fit: contain; display: block; margin: 0 auto 6px;" onerror="this.outerHTML='<i class=\\'fa ${link.icon}\\' style=\\'font-size: 32px; color: #FF4400; display: block; margin-bottom: 6px;\\'></i>'">` :
      `<i class="fa ${link.icon}" style="font-size: 32px; color: #FF4400; display: block; margin-bottom: 6px;"></i>`;
    
    const linkElement = document.createElement('a');
    linkElement.id = `${link.id}_link`;
    linkElement.href = link.url;
    linkElement.target = '_blank';
    linkElement.draggable = false;
    linkElement.innerHTML = `
      ${iconHtml}
      <div>${link.label}</div>
    `;
    
    // Click to copy, Ctrl/Cmd+Click to open
    linkElement.addEventListener('click', function(e) {
      // Don't copy if dragging
      if (linkDiv.classList.contains('dragging')) {
        return true;
      }
      if (e.ctrlKey || e.metaKey) {
        // Allow Ctrl/Cmd+Click to open in new tab
        return true;
      }
      e.preventDefault();
      e.stopPropagation();
      copyToClipboard(link.url);
      // Visual feedback
      const originalBg = linkDiv.style.backgroundColor;
      linkDiv.style.backgroundColor = '#fff8f5';
      setTimeout(() => {
        linkDiv.style.backgroundColor = originalBg;
      }, 200);
      return false;
    });
    
    linkDiv.appendChild(linkElement);
    
    // Add drag event listeners
    linkDiv.addEventListener('dragstart', handleDragStart);
    linkDiv.addEventListener('dragover', handleDragOver);
    linkDiv.addEventListener('drop', handleDrop);
    linkDiv.addEventListener('dragend', handleDragEnd);
    linkDiv.addEventListener('dragenter', handleDragEnter);
    linkDiv.addEventListener('dragleave', handleDragLeave);
    
    links_container.appendChild(linkDiv);
  });
  
  // If no links, show message
  if (allLinks.length === 0) {
    links_container.innerHTML = '<p style="text-align: center; color: #999; padding: 20px; width: 100%;">No links configured. Click "Edit Links" to add some!</p>';
  }
}

// Copy to clipboard function
function copyToClipboard(text) {
  navigator.clipboard.writeText(text).then(function() {
    showCopyToast();
    console.log('Link copied to clipboard:', text);
  }, function(err) {
    console.error('Failed to copy:', err);
    // Fallback for older browsers
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.opacity = '0';
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand('copy');
      showCopyToast();
      console.log('Link copied to clipboard (fallback):', text);
    } catch (err) {
      console.error('Fallback copy failed:', err);
    }
    document.body.removeChild(textArea);
  });
}

// Show copy confirmation toast
function showCopyToast() {
  // Remove existing toast if any
  const existingToast = document.querySelector('.copy-toast');
  if (existingToast) {
    existingToast.remove();
  }
  
  // Create new toast
  const toast = document.createElement('div');
  toast.className = 'copy-toast';
  toast.textContent = 'Link copied';
  document.body.appendChild(toast);
  
  // Show toast
  setTimeout(() => {
    toast.classList.add('show');
  }, 10);
  
  // Hide and remove toast after 2 seconds
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 2000);
}

// Load and display links
let array = ["name", "website", "linkedin", "medium", "twitter", "github", 
             "website_enabled", "linkedin_enabled", "medium_enabled", "twitter_enabled", "github_enabled",
             "website_order", "linkedin_order", "medium_order", "twitter_order", "github_order",
             "website_favicon", "linkedin_favicon", "medium_favicon", "twitter_favicon", "github_favicon",
             "customLinks"];

// Drag and drop functionality
let draggedElement = null;

function handleDragStart(e) {
  draggedElement = this;
  this.classList.add('dragging');
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/html', this.innerHTML);
}

function handleDragOver(e) {
  if (e.preventDefault) {
    e.preventDefault();
  }
  e.dataTransfer.dropEffect = 'move';
  return false;
}

function handleDragEnter(e) {
  if (this !== draggedElement) {
    this.classList.add('drag-over');
  }
}

function handleDragLeave(e) {
  this.classList.remove('drag-over');
}

function handleDrop(e) {
  if (e.stopPropagation) {
    e.stopPropagation();
  }
  
  if (draggedElement !== this) {
    // Get all link elements
    const allElements = Array.from(links_container.querySelectorAll('.flex'));
    const draggedIndex = allElements.indexOf(draggedElement);
    const targetIndex = allElements.indexOf(this);
    
    if (draggedIndex < targetIndex) {
      links_container.insertBefore(draggedElement, this.nextSibling);
    } else {
      links_container.insertBefore(draggedElement, this);
    }
    
    // Save new order
    saveLinkOrder();
  }
  
  this.classList.remove('drag-over');
  return false;
}

function handleDragEnd(e) {
  this.classList.remove('dragging');
  const allElements = links_container.querySelectorAll('.flex');
  allElements.forEach(el => el.classList.remove('drag-over'));
  draggedElement = null;
}

function saveLinkOrder() {
  const allElements = Array.from(links_container.querySelectorAll('.flex'));
  const dataToSave = {};
  
  allElements.forEach((element, index) => {
    const linkId = element.dataset.linkId;
    const isCustom = element.dataset.isCustom === 'true';
    
    if (isCustom) {
      // For custom links, we need to update the customLinks array
      // This will be handled when we get all data
    } else {
      dataToSave[`${linkId}_order`] = index;
    }
  });
  
  // Get all current data and update orders
  chrome.storage.sync.get(array, function(links) {
    if (!chrome.runtime.error) {
      // Update standard link orders
      allElements.forEach((element, index) => {
        const linkId = element.dataset.linkId;
        const isCustom = element.dataset.isCustom === 'true';
        if (!isCustom) {
          links[`${linkId}_order`] = index;
        }
      });
      
      // Update custom link orders
      if (links.customLinks && Array.isArray(links.customLinks)) {
        allElements.forEach((element, index) => {
          const linkId = element.dataset.linkId;
          const isCustom = element.dataset.isCustom === 'true';
          if (isCustom) {
            const customLink = links.customLinks.find(cl => cl.id === linkId);
            if (customLink) {
              customLink.order = index;
            }
          }
        });
      }
      
      // Save updated data
      chrome.storage.sync.set(links, function() {
        if (!chrome.runtime.error) {
          console.log("Link order saved");
        }
            });
    }
});
}

chrome.storage.sync.get(array, function(links) {
  if (!chrome.runtime.error) {
    console.log(links);
    
    if (links.name) {
      if (name_text) {
        name_text.textContent = links.name + "'s ";
      }
      if (profile_title) {
        profile_title.innerHTML = `<span class="brand-name">${links.name}'s</span> Profiles`;
      }
    } else {
      if (profile_title) {
        profile_title.textContent = 'Social Media Profiles';
      }
    }
    
    renderLinks(links);
  }
});

// -------------------------------
// Documents Section
// -------------------------------

const documentsContainer = document.getElementById('documents-container');
let documentsState = {};

function formatBytes(bytes) {
  if (!bytes && bytes !== 0) return '';
  const sizes = ['Bytes', 'KB', 'MB'];
  if (bytes === 0) return '0 Byte';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = (bytes / Math.pow(1024, i)).toFixed(1);
  return `${value} ${sizes[i]}`;
}

function formatDate(isoString) {
  if (!isoString) return '';
  try {
    const date = new Date(isoString);
    return date.toLocaleString();
  } catch (e) {
    return '';
  }
}

function setDocStatus(card, message, type) {
  const statusEl = card.querySelector('.doc-status');
  if (!statusEl) return;
  statusEl.textContent = message || '';
  statusEl.classList.remove('error', 'success');
  if (type) {
    statusEl.classList.add(type);
  }
}

function renderDocCard(docType) {
  const card = document.createElement('div');
  card.className = 'doc-card';
  card.dataset.docType = docType.id;
  card.innerHTML = `
    <input type="file" class="hidden" accept="${docType.accept}" />
    <div class="doc-meta">
      <span class="doc-line" data-meta-name></span>
      <span class="doc-line muted" data-meta-updated></span>
      <a class="doc-line muted doc-delete hidden" data-delete-link href="#">Delete this resume</a>
    </div>
    <div class="doc-actions">
      <button class="doc-btn upload-btn">Upload</button>
      <button class="doc-btn primary attach-btn">Attach</button>
    </div>
    <div class="doc-status" data-status></div>
  `;

  const fileInput = card.querySelector('input[type="file"]');
  const uploadBtn = card.querySelector('.upload-btn');
  const attachBtn = card.querySelector('.attach-btn');
  const deleteLink = card.querySelector('[data-delete-link]');

  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', event => {
    const file = event.target.files && event.target.files[0];
    if (file) {
      handleFileUpload(docType, file, card);
      fileInput.value = '';
    }
  });

  attachBtn.addEventListener('click', () => handleAttach(docType, card));
  deleteLink.addEventListener('click', (e) => {
    e.preventDefault();
    handleDelete(docType, card);
  });

  documentsContainer.appendChild(card);
  updateDocCardState(card, documentsState[docType.id]);
}

function renderAllDocCards() {
  documentsContainer.innerHTML = '';
  documentTypes.forEach(renderDocCard);
}

function updateDocCardState(card, doc) {
  const nameEl = card.querySelector('[data-meta-name]');
  const updatedEl = card.querySelector('[data-meta-updated]');
  const attachBtn = card.querySelector('.attach-btn');
  const uploadBtn = card.querySelector('.upload-btn');
  const deleteLink = card.querySelector('[data-delete-link]');

  if (doc) {
    nameEl.textContent = doc.fileName || 'File';
    updatedEl.textContent = `Updated ${formatDate(doc.updatedAt)}`;
    nameEl.classList.remove('muted');
    updatedEl.classList.remove('muted');
    attachBtn.disabled = false;
    uploadBtn.textContent = 'Replace';
    deleteLink.classList.remove('hidden');
    setDocStatus(card, '', null);
  } else {
    nameEl.textContent = 'No file saved. Click "Upload" to add resume!';
    nameEl.classList.add('muted');
    updatedEl.textContent = '';
    updatedEl.classList.add('muted');
    attachBtn.disabled = true;
    uploadBtn.textContent = 'Upload';
    deleteLink.classList.add('hidden');
    setDocStatus(card, '', null);
  }
}

function validateFile(file) {
  const extension = file.name.split('.').pop().toLowerCase();
  if (!ALLOWED_EXTENSIONS.includes(extension) && !ALLOWED_MIME_TYPES.includes(file.type)) {
    throw new Error('Unsupported file type. Use PDF or DOCX.');
  }
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('File too large. Max 4MB.');
  }
}

function handleFileUpload(docType, file, card) {
  try {
    validateFile(file);
  } catch (error) {
    setDocStatus(card, error.message, 'error');
    return;
  }

  setDocStatus(card, 'Saving...', null);
  const reader = new FileReader();
  function arrayBufferToBase64(buffer) {
    let binary = '';
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }
  reader.onload = function() {
    const base64Data = arrayBufferToBase64(reader.result);
    chrome.runtime.sendMessage({
      type: 'docs:save',
      payload: {
        docType: docType.id,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
        data: base64Data
      }
    }, response => {
      const runtimeError = chrome.runtime.lastError?.message;
      if (runtimeError) {
        setDocStatus(card, runtimeError, 'error');
        return;
      }
      if (response?.ok && response.doc) {
        documentsState[docType.id] = response.doc;
        updateDocCardState(card, response.doc);
        setDocStatus(card, `${docType.label} saved`, 'success');
      } else {
        setDocStatus(card, response?.error || 'Failed to save file', 'error');
      }
    });
  };
  reader.onerror = function() {
    setDocStatus(card, 'Failed to read file', 'error');
  };
  reader.readAsArrayBuffer(file);
}

function handleAttach(docType, card) {
  setDocStatus(card, 'Attaching...', null);
  chrome.runtime.sendMessage({ type: 'docs:attach', docType: docType.id }, response => {
    if (response?.ok && response.result?.ok) {
      setDocStatus(card, 'Attached to page', 'success');
    } else {
      const message = response?.error || response?.result?.error || 'Unable to attach';
      setDocStatus(card, message, 'error');
    }
  });
}

function loadDocuments() {
  chrome.runtime.sendMessage({ type: 'docs:list' }, response => {
    if (response?.ok) {
      documentsState = response.documents || {};
      const storedKeys = Object.keys(documentsState || {}).filter(key => key === 'resume' || key.startsWith('resume-'));
      storedKeys.forEach(key => {
        if (!documentTypes.find(dt => dt.id === key)) {
          documentTypes.push({ id: key, label: 'Resume', accept: '.pdf,.doc,.docx' });
        }
      });
      renderAllDocCards();
      documentTypes.forEach(docType => {
        const card = documentsContainer.querySelector(`[data-doc-type="${docType.id}"]`);
        if (card) {
          updateDocCardState(card, documentsState[docType.id]);
        }
      });
    }
  });
}

function initDocumentsUI() {
  renderAllDocCards();
  loadDocuments();
}

initDocumentsUI();

function handleDelete(docType, card) {
  chrome.runtime.sendMessage({ type: 'docs:delete', docType: docType.id }, response => {
    if (response?.ok) {
      documentsState[docType.id] = null;
      updateDocCardState(card, null);
      setDocStatus(card, '', null);
    } else {
      setDocStatus(card, response?.error || 'Delete failed', 'error');
    }
  });
}
