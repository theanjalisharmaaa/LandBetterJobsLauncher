// Standard link configurations
const standardLinks = {
  website: { id: 'website', label: 'Website', icon: 'fa-globe', defaultOrder: 1 },
  linkedin: { id: 'linkedin', label: 'LinkedIn', icon: 'fa-linkedin', defaultOrder: 2 },
  medium: { id: 'medium', label: 'Medium', icon: 'fa-medium', defaultOrder: 3 },
  twitter: { id: 'twitter', label: 'Twitter', icon: 'fa-twitter', defaultOrder: 4 },
  github: { id: 'github', label: 'GitHub', icon: 'fa-github', defaultOrder: 5 }
};

let linksData = {};
let customLinks = [];
let nextCustomId = 1;

const nameInput = document.getElementById('name');
const linksList = document.getElementById('links-list');
const addCustomLinkBtn = document.getElementById('add-custom-link');

// Load data from storage
function loadData() {
  let keys = ["name", "website", "linkedin", "medium", "twitter", "github",
              "website_enabled", "linkedin_enabled", "medium_enabled", "twitter_enabled", "github_enabled",
              "website_order", "linkedin_order", "medium_order", "twitter_order", "github_order",
              "website_favicon", "linkedin_favicon", "medium_favicon", "twitter_favicon", "github_favicon",
              "customLinks"];
  
  chrome.storage.sync.get(keys, function(data) {
    if (!chrome.runtime.error) {
      linksData = data;
      if (data.name) {
        nameInput.value = data.name;
      }
      if (data.customLinks && Array.isArray(data.customLinks)) {
        customLinks = data.customLinks;
        // Find the highest ID
        customLinks.forEach(link => {
          const idNum = parseInt(link.id.replace('custom_', ''));
          if (idNum >= nextCustomId) {
            nextCustomId = idNum + 1;
          }
        });
      }
      renderLinks();
      // Fetch favicons for existing URLs that don't have favicons yet
      fetchMissingFavicons();
    }
  });
}

// Fetch favicons for existing URLs that don't have favicons stored
function fetchMissingFavicons() {
  // Check standard links
  for (let key in standardLinks) {
    const url = linksData[key];
    const faviconUrl = linksData[`${key}_favicon`];
    if (url && !faviconUrl) {
      fetchFavicon(url, function(faviconUrl) {
        if (faviconUrl) {
          linksData[`${key}_favicon`] = faviconUrl;
          // Re-render to show the favicon
          renderLinks();
        }
      });
    }
  }
  
  // Check custom links
  customLinks.forEach(link => {
    if (link.url && !link.faviconUrl) {
      fetchFavicon(link.url, function(faviconUrl) {
        if (faviconUrl) {
          link.faviconUrl = faviconUrl;
          // Re-render to show the favicon
          renderLinks();
        }
      });
    }
  });
}

// Render all links
function renderLinks() {
  linksList.innerHTML = '';
  
  // Get all links and sort by order
  let allLinks = [];
  
  // Add standard links
  for (let key in standardLinks) {
    const linkConfig = standardLinks[key];
    const enabled = linksData[`${key}_enabled`] !== false;
    const order = linksData[`${key}_order`] !== undefined ? linksData[`${key}_order`] : linkConfig.defaultOrder;
    const url = linksData[key] || '';
    const faviconUrl = linksData[`${key}_favicon`] || null;
    
    allLinks.push({
      id: linkConfig.id,
      label: linkConfig.label,
      icon: linkConfig.icon,
      faviconUrl: faviconUrl,
      url: url,
      enabled: enabled,
      order: order,
      isCustom: false
    });
  }
  
  // Add custom links
  customLinks.forEach(link => {
    allLinks.push({
      id: link.id,
      label: link.label || 'Custom Link',
      icon: link.icon || 'fa-link',
      faviconUrl: link.faviconUrl || null,
      url: link.url || '',
      enabled: link.enabled !== false,
      order: link.order || 999,
      isCustom: true
    });
  });
  
  // Sort: enabled links first (by order), then disabled links (by order)
  allLinks.sort((a, b) => {
    // If both enabled or both disabled, sort by order
    if (a.enabled === b.enabled) {
      return a.order - b.order;
    }
    // Enabled links come first
    return a.enabled ? -1 : 1;
  });
  
  // Render each link
  allLinks.forEach((link, index) => {
    const linkItem = createLinkItem(link, index, allLinks.length);
    linksList.appendChild(linkItem);
  });
}

// Create a link item element
function createLinkItem(link, index, total) {
  const item = document.createElement('div');
  item.className = 'link-item';
  item.dataset.linkId = link.id;
  item.dataset.isCustom = link.isCustom;
  
  const isFirst = index === 0;
  const isLast = index === total - 1;
  
  item.innerHTML = `
    <div class="link-item-header">
      <div class="link-item-title">
        ${link.faviconUrl ? 
          `<img src="${link.faviconUrl}" alt="" style="width: 18px; height: 18px; margin-right: 8px; object-fit: contain;" onerror="this.outerHTML='<i class=\\'fa ${link.icon}\\'></i>'">` : 
          `<i class="fa ${link.icon}"></i>`
        }
        <span>${link.label}</span>
      </div>
      <div class="link-controls">
        <label class="toggle-switch">
          <input type="checkbox" ${link.enabled ? 'checked' : ''} class="enable-toggle">
          <span class="toggle-slider"></span>
        </label>
        ${link.isCustom ? '<button class="delete-link" data-action="delete" title="Delete"><i class="fa fa-trash"></i></button>' : ''}
      </div>
    </div>
    <div class="link-item-fields ${!link.enabled ? 'hidden' : ''}">
      ${link.isCustom ? `
        <div class="form-group">
          <label class="form-label">Label</label>
          <input type="text" class="form-control link-label" placeholder="Link Label" value="${link.label || ''}">
        </div>
      ` : ''}
      <div class="form-group">
        <label class="form-label">URL</label>
        <input type="text" class="form-control link-url" placeholder="https://..." value="${link.url || ''}">
      </div>
    </div>
  `;
  
  // Add event listeners
  const enableToggle = item.querySelector('.enable-toggle');
  enableToggle.addEventListener('change', function() {
    const fields = item.querySelector('.link-item-fields');
    if (this.checked) {
      fields.classList.remove('hidden');
    } else {
      fields.classList.add('hidden');
    }
    // Update enabled status
    if (link.isCustom) {
      const customLink = customLinks.find(cl => cl.id === link.id);
      if (customLink) {
        customLink.enabled = this.checked;
      }
    } else {
      linksData[`${link.id}_enabled`] = this.checked;
    }
    // Autosave on toggle change
    autoSave();
    // Re-render to reorder (enabled first, disabled last)
    renderLinks();
  });
  
  // Fetch favicon when URL changes (for both standard and custom links)
  const urlInput = item.querySelector('.link-url');
  const titleIconContainer = item.querySelector('.link-item-title');
  
  urlInput.addEventListener('blur', function() {
    const url = this.value.trim();
    if (url) {
      fetchFavicon(url, function(faviconUrl) {
        // Update title icon
        if (titleIconContainer) {
          const existingIcon = titleIconContainer.querySelector('i, img');
          if (faviconUrl) {
            if (existingIcon && existingIcon.tagName === 'IMG') {
              existingIcon.src = faviconUrl;
            } else {
              const img = document.createElement('img');
              img.src = faviconUrl;
              img.alt = '';
              img.style.cssText = 'width: 18px; height: 18px; margin-right: 8px; object-fit: contain;';
              img.onerror = function() {
                const icon = document.createElement('i');
                icon.className = `fa ${link.icon}`;
                this.replaceWith(icon);
              };
              if (existingIcon) {
                existingIcon.replaceWith(img);
              } else {
                titleIconContainer.insertBefore(img, titleIconContainer.querySelector('span'));
              }
            }
          } else {
            if (existingIcon && existingIcon.tagName === 'IMG') {
              const icon = document.createElement('i');
              icon.className = `fa ${link.icon}`;
              existingIcon.replaceWith(icon);
            } else if (existingIcon) {
              existingIcon.className = `fa ${link.icon}`;
            }
          }
        }
        // Store favicon URL for saving
        if (link.isCustom) {
          const customLink = customLinks.find(cl => cl.id === link.id);
          if (customLink) {
            customLink.faviconUrl = faviconUrl;
          }
        } else {
          // Store favicon for standard links
          linksData[`${link.id}_favicon`] = faviconUrl;
        }
        // Autosave
        autoSave();
      });
    } else {
      // Clear favicon if URL is empty
      if (link.isCustom) {
        const customLink = customLinks.find(cl => cl.id === link.id);
        if (customLink) {
          customLink.faviconUrl = null;
        }
      } else {
        linksData[`${link.id}_favicon`] = null;
      }
      // Autosave
      autoSave();
    }
  });
  
  // Autosave on URL input change
  urlInput.addEventListener('input', debounce(function() {
    autoSave();
  }, 1000));
  
  if (link.isCustom) {
    const deleteBtn = item.querySelector('.delete-link');
    deleteBtn.addEventListener('click', function() {
      deleteCustomLink(link.id);
    });
    
    // Autosave on label change
    const labelInput = item.querySelector('.link-label');
    if (labelInput) {
      labelInput.addEventListener('input', debounce(function() {
        autoSave();
      }, 1000));
    }
  }
  
  return item;
}


// Fetch favicon from URL
function fetchFavicon(url, callback) {
  try {
    let domain = '';
    try {
      const urlObj = new URL(url);
      domain = urlObj.hostname.replace('www.', '');
    } catch (e) {
      // If URL parsing fails, try to extract domain manually
      const match = url.match(/https?:\/\/(?:www\.)?([^\/]+)/);
      if (match) {
        domain = match[1];
      } else {
        callback(null);
        return;
      }
    }
    
    // Use Google's favicon service
    const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=32`;
    
    // Test if favicon loads
    const img = new Image();
    img.onload = function() {
      callback(faviconUrl);
    };
    img.onerror = function() {
      callback(null);
    };
    img.src = faviconUrl;
  } catch (e) {
    callback(null);
  }
}

// Add custom link
addCustomLinkBtn.addEventListener('click', function() {
  const newLink = {
    id: 'custom_' + nextCustomId++,
    label: 'Custom Link',
    icon: 'fa-link',
    faviconUrl: null,
    url: '',
    enabled: true,
    order: 999 + customLinks.length
  };
  customLinks.push(newLink);
  renderLinks();
});

// Delete custom link
function deleteCustomLink(linkId) {
  customLinks = customLinks.filter(link => link.id !== linkId);
  renderLinks();
  autoSave();
}

// Debounce function for autosave
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Autosave function
function autoSave() {
  const dataToSave = {
    name: nameInput.value
  };
  
  // Save standard links
  for (let key in standardLinks) {
    const linkItem = document.querySelector(`[data-link-id="${key}"]`);
    if (linkItem) {
      const urlInput = linkItem.querySelector('.link-url');
      const enableToggle = linkItem.querySelector('.enable-toggle');
      
      dataToSave[key] = urlInput ? urlInput.value : '';
      dataToSave[`${key}_enabled`] = enableToggle ? enableToggle.checked : true;
      
      // Save favicon URL if it exists in linksData
      if (linksData[`${key}_favicon`]) {
        dataToSave[`${key}_favicon`] = linksData[`${key}_favicon`];
      }
      
      // Get order from rendered position
      const allItems = Array.from(linksList.querySelectorAll('.link-item'));
      const index = allItems.indexOf(linkItem);
      dataToSave[`${key}_order`] = index;
    }
  }
  
  // Save custom links
  const updatedCustomLinks = [];
  customLinks.forEach(link => {
    const linkItem = document.querySelector(`[data-link-id="${link.id}"]`);
    if (linkItem) {
      const labelInput = linkItem.querySelector('.link-label');
      const urlInput = linkItem.querySelector('.link-url');
      const enableToggle = linkItem.querySelector('.enable-toggle');
      
      const allItems = Array.from(linksList.querySelectorAll('.link-item'));
      const index = allItems.indexOf(linkItem);
      
      // Get favicon URL from link data
      let faviconUrl = link.faviconUrl || null;
      
      updatedCustomLinks.push({
        id: link.id,
        label: labelInput ? labelInput.value : link.label,
        icon: 'fa-link',
        faviconUrl: faviconUrl,
        url: urlInput ? urlInput.value : '',
        enabled: enableToggle ? enableToggle.checked : true,
        order: index
      });
    }
  });
  
  dataToSave.customLinks = updatedCustomLinks;
  
  chrome.storage.sync.set(dataToSave, function() {
    if (!chrome.runtime.error) {
      console.log("Links Autosaved");
    }
  });
}

// Add autosave on name change
nameInput.addEventListener('input', debounce(function() {
  autoSave();
}, 1000));
  const dataToSave = {
    name: nameInput.value
  };
  
  // Save standard links
  for (let key in standardLinks) {
    const linkItem = document.querySelector(`[data-link-id="${key}"]`);
    if (linkItem) {
      const urlInput = linkItem.querySelector('.link-url');
      const enableToggle = linkItem.querySelector('.enable-toggle');
      
      dataToSave[key] = urlInput ? urlInput.value : '';
      dataToSave[`${key}_enabled`] = enableToggle ? enableToggle.checked : true;
      
      // Save favicon URL if it exists in linksData
      if (linksData[`${key}_favicon`]) {
        dataToSave[`${key}_favicon`] = linksData[`${key}_favicon`];
      }
      
      // Get order from rendered position
      const allItems = Array.from(linksList.querySelectorAll('.link-item'));
      const index = allItems.indexOf(linkItem);
      dataToSave[`${key}_order`] = index;
    }
  }
  

// Initialize
loadData();
