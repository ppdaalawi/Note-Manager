// =====================
// State & Config
// =====================
let data = { folders: {}, files: {} };
let currentPath = 'root';
let currentEditingId = null;
let currentEditingType = null;
let deleteTarget = null;
let tempHeaders = [];
let actionTarget = null;
let moveCopyTarget = null;
let moveCopyMode = null;
let tableZoom = 100;
let resizingColumn = null;
let resizeStartX = 0;
let resizeStartWidth = 0;
let isResizing = false;
let currentTable = null;
let simpleDeleteCallback = null;
let selectedDestFolder = null;
let isMobileSearchOpen = false;

const defaultConfig = { app_title: 'Note Manager' };

// =====================
// Initialize
// =====================
function init() {
  loadData();
  setupHistoryAPI();
  renderBreadcrumb();
  renderFileList();
  setupEventListeners();
  updateViewModeButtons();
  updateDarkModeUI();
  
  const savedDarkMode = localStorage.getItem('darkMode');
  if (savedDarkMode === 'true') {
    document.documentElement.classList.add('dark');
  }
  
  registerServiceWorker();
}

function registerServiceWorker() {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('SW registered'))
      .catch(err => console.log('SW registration failed:', err));
  }
}

// =====================
// History API
// =====================
function setupHistoryAPI() {
  history.replaceState({ path: currentPath }, '', '#' + currentPath);
  
  window.addEventListener('popstate', (e) => {
    if (e.state && e.state.path) {
      currentPath = e.state.path;
      renderBreadcrumb();
      renderFileList();
      showFAB();
    }
  });
}

function navigateTo(path, addToHistory = true) {
  currentPath = path;
  
  if (addToHistory) {
    history.pushState({ path: path }, '', '#' + path);
  }
  
  renderBreadcrumb();
  renderFileList();
  showFAB();
}

function showFAB() {
  document.getElementById('fabButton').classList.remove('hidden');
}

function hideFAB() {
  document.getElementById('fabButton').classList.add('hidden');
}

// =====================
// Event Listeners
// =====================
function setupEventListeners() {
  // Settings Button
  document.getElementById('settingsBtn').addEventListener('click', (e) => {
    e.stopPropagation();
    const dropdown = document.getElementById('settingsDropdown');
    dropdown.classList.toggle('hidden');
  });

  // Search - Desktop
  document.getElementById('searchInputDesktop').addEventListener('input', debounce(handleSearch, 300));
  
  // Search - Mobile
  document.getElementById('searchInputMobile').addEventListener('input', debounce(handleMobileSearch, 300));

  // Close dropdowns on outside click
  document.addEventListener('click', (e) => {
    document.getElementById('settingsDropdown').classList.add('hidden');
  });

  // Resize handlers
  document.addEventListener('mouseup', stopResizing);
  document.addEventListener('mousemove', handleResize);
  document.addEventListener('touchend', stopResizing);
  document.addEventListener('touchmove', handleTouchResize, { passive: false });
}

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

// =====================
// Mobile Search
// =====================
function toggleMobileSearch() {
  isMobileSearchOpen = !isMobileSearchOpen;
  const header = document.getElementById('mainHeader');
  const iconOpen = document.getElementById('searchIconOpen');
  const iconClose = document.getElementById('searchIconClose');
  const input = document.getElementById('searchInputMobile');
  
  if (isMobileSearchOpen) {
    header.classList.add('search-expanded');
    iconOpen.classList.add('hidden');
    iconClose.classList.remove('hidden');
    setTimeout(() => input.focus(), 300);
  } else {
    header.classList.remove('search-expanded');
    iconOpen.classList.remove('hidden');
    iconClose.classList.add('hidden');
    input.value = '';
    renderFileList();
  }
}

function handleMobileSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    renderFileList();
    return;
  }
  performSearch(query);
}

// =====================
// Dark Mode
// =====================
function toggleDarkMode() {
  document.documentElement.classList.toggle('dark');
  const isDark = document.documentElement.classList.contains('dark');
  localStorage.setItem('darkMode', isDark);
  updateDarkModeUI();
}

function updateDarkModeUI() {
  const isDark = document.documentElement.classList.contains('dark');
  const icon = document.getElementById('darkModeIcon');
  const text = document.getElementById('darkModeText');
  
  if (isDark) {
    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"/>';
    text.textContent = 'Mode Terang';
  } else {
    icon.innerHTML = '<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"/>';
    text.textContent = 'Mode Gelap';
  }
}

// =====================
// Data Management
// =====================
function loadData() {
  const saved = localStorage.getItem('noteManagerData');
  if (saved) {
    data = JSON.parse(saved);
    Object.values(data.folders).forEach(f => {
      if (f.deletedAt === undefined) f.deletedAt = null;
      if (f.pinned === undefined) f.pinned = false;
      if (f.sortOrder === undefined) f.sortOrder = 'name-asc';
    });
    Object.values(data.files).forEach(f => {
      if (f.deletedAt === undefined) f.deletedAt = null;
      if (f.pinned === undefined) f.pinned = false;
    });
  } else {
    data = {
      folders: { root: { name: 'Root', parent: null, createdAt: Date.now(), deletedAt: null, pinned: false, sortOrder: 'name-asc' } },
      files: {}
    };
    saveData();
  }
}

function saveData() {
  localStorage.setItem('noteManagerData', JSON.stringify(data));
}

// =====================
// Sort & View
// =====================
function setSort(value) {
  const folder = data.folders[currentPath];
  if (folder) {
    folder.sortOrder = value;
    saveData();
  }
  document.getElementById('settingsDropdown').classList.add('hidden');
  renderFileList();
}

function setViewMode(mode) {
  localStorage.setItem('viewMode', mode);
  updateViewModeButtons();
  renderFileList();
  document.getElementById('settingsDropdown').classList.add('hidden');
}

function updateViewModeButtons() {
  const mode = localStorage.getItem('viewMode') || 'icon';
}

// =====================
// Toast
// =====================
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  const toast = document.createElement('div');
  const bgColor = type === 'success' ? 'bg-green-500' : type === 'error' ? 'bg-red-500' : 'bg-blue-500';
  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : 'ℹ';
  
  toast.className = `${bgColor} text-white px-4 py-3 rounded-xl shadow-lg flex items-center gap-2 toast-enter min-w-[200px] pointer-events-auto`;
  toast.innerHTML = `<span class="font-bold">${icon}</span><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.remove('toast-enter');
    toast.classList.add('toast-exit');
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// =====================
// Navigation & Breadcrumb
// =====================
function renderBreadcrumb() {
  const breadcrumb = document.getElementById('breadcrumb');
  const pathParts = getPathParts(currentPath);
  
  breadcrumb.innerHTML = pathParts.map((part, index) => {
    const isLast = index === pathParts.length - 1;
    return `
      <button onclick="navigateTo('${part.id}', true)" class="${isLast ? 'text-gray-600 dark:text-gray-400' : 'text-green-600 dark:text-green-400 hover:underline'} font-medium whitespace-nowrap">${part.name}</button>
      ${!isLast ? '<span class="text-gray-400">/</span>' : ''}
    `;
  }).join('');
}

function getPathParts(path) {
  const parts = [];
  let current = path;
  while (current) {
    const folder = data.folders[current];
    if (folder && !folder.deletedAt) {
      parts.unshift({ id: current, name: folder.name });
      current = folder.parent;
    } else {
      break;
    }
  }
  return parts;
}

// =====================
// Render File List
// =====================
function renderFileList() {
  const fileList = document.getElementById('fileList');
  const emptyState = document.getElementById('emptyState');
  
  document.getElementById('searchResults').classList.add('hidden');
  document.getElementById('searchResults').classList.remove('flex');
  
  const folder = data.folders[currentPath];
  const sortOrder = folder?.sortOrder || 'name-asc';
  
  const items = [];
  
  Object.entries(data.folders).forEach(([id, f]) => {
    if (f.parent === currentPath && !f.deletedAt) {
      items.push({ id, type: 'folder', ...f });
    }
  });
  
  Object.entries(data.files).forEach(([id, f]) => {
    if (f.parent === currentPath && !f.deletedAt) {
      items.push({ id, type: f.type, ...f });
    }
  });

  items.sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    const aIsFolder = a.type === 'folder';
    const bIsFolder = b.type === 'folder';
    if (aIsFolder !== bIsFolder) return aIsFolder ? -1 : 1;
    
    switch (sortOrder) {
      case 'name-asc': return a.name.localeCompare(b.name);
      case 'name-desc': return b.name.localeCompare(a.name);
      case 'date-asc': return (a.createdAt || 0) - (b.createdAt || 0);
      case 'date-desc': return (b.createdAt || 0) - (a.createdAt || 0);
      default: return 0;
    }
  });

  if (items.length === 0) {
    fileList.innerHTML = '';
    fileList.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3';
    emptyState.classList.remove('hidden');
    emptyState.classList.add('flex');
  } else {
    emptyState.classList.add('hidden');
    emptyState.classList.remove('flex');
    
    const viewMode = localStorage.getItem('viewMode') || 'icon';
    if (viewMode === 'detail') {
      fileList.className = 'grid detail-item gap-3';
      fileList.innerHTML = items.map(item => renderDetailItem(item)).join('');
    } else {
      fileList.className = 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3';
      fileList.innerHTML = items.map(item => renderIconItem(item)).join('');
    }
  }
}

function renderIconItem(item) {
  const { icon, bgColor } = getItemIconAndColor(item.type);
  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '';
  const pinHtml = item.pinned ? '<div class="pinned-indicator"></div>' : '';

  return `
    <div class="group relative ${bgColor} rounded-xl p-2 sm:p-3 cursor-pointer hover:shadow-md transition-all border border-transparent hover:border-gray-200 dark:hover:border-gray-600" onclick="handleItemClick('${item.id}', '${item.type}')">
      ${pinHtml}
      <div class="flex flex-col items-center text-center">
        ${icon}
        <span class="mt-1 sm:mt-2 text-xs sm:text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-2">${item.name}</span>
        <span class="text-[10px] sm:text-xs text-gray-400 dark:text-gray-500 mt-0.5 sm:mt-1">${dateStr}</span>
      </div>
      <button onclick="event.stopPropagation(); showActionMenu('${item.id}', '${item.type}')" class="absolute top-1 left-1 p-1 sm:p-1.5 rounded-full bg-white dark:bg-gray-700 shadow opacity-70 hover:opacity-100 transition-opacity hover:bg-gray-100 dark:hover:bg-gray-600">
        <svg class="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-500 dark:text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
        </svg>
      </button>
    </div>
  `;
}

function renderDetailItem(item) {
  const { icon, bgColor, typeLabel } = getItemIconAndColor(item.type, true);
  const dateStr = item.createdAt ? new Date(item.createdAt).toLocaleDateString('id-ID') : '';
  const pinHtml = item.pinned ? '<span class="text-yellow-500">⭐</span>' : '';

  return `
    <div class="group relative ${bgColor} border rounded-xl p-3 sm:p-4 cursor-pointer hover:shadow-md transition-all" onclick="handleItemClick('${item.id}', '${item.type}')">
      <div class="flex items-start gap-3 sm:gap-4">
        <div class="shrink-0">${icon}</div>
        <div class="flex-1 min-w-0">
          <p class="font-semibold text-gray-800 dark:text-white line-clamp-2 text-sm sm:text-base">${pinHtml} ${item.name}</p>
          <p class="text-xs sm:text-sm text-gray-600 dark:text-gray-400">${typeLabel}</p>
          <p class="text-[10px] sm:text-xs text-gray-500 dark:text-gray-500 mt-0.5 sm:mt-1">${dateStr}</p>
        </div>
        <button onclick="event.stopPropagation(); showActionMenu('${item.id}', '${item.type}')" class="shrink-0 p-2 rounded-lg text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700">
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

function getItemIconAndColor(type, detailed = false) {
  let icon, bgColor, typeLabel;
  
  if (type === 'folder') {
    icon = `<svg class="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>`;
    bgColor = 'bg-yellow-50 dark:bg-yellow-900/20';
    typeLabel = 'Folder';
  } else if (type === 'note') {
    icon = `<svg class="w-7 h-7 sm:w-8 sm:h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/></svg>`;
    bgColor = 'bg-blue-50 dark:bg-blue-900/20';
    typeLabel = 'Catatan';
  } else {
    icon = `<svg class="w-7 h-7 sm:w-8 sm:h-8 text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>`;
    bgColor = 'bg-green-50 dark:bg-green-900/20';
    typeLabel = 'Tabel';
  }
  
  return detailed ? { icon, bgColor, typeLabel } : { icon, bgColor };
}

function handleItemClick(id, type) {
  if (type === 'folder') {
    navigateTo(id, true);
  } else if (type === 'note') {
    openNote(id);
  } else {
    openTable(id);
  }
}

// =====================
// Action Menu
// =====================
function showActionMenu(id, type) {
  actionTarget = { id, type };
  const item = type === 'folder' ? data.folders[id] : data.files[id];
  const { icon, bgColor, typeLabel } = getItemIconAndColor(type, true);
  
  document.getElementById('actionMenuIcon').innerHTML = icon;
  document.getElementById('actionMenuIcon').className = `w-10 h-10 rounded-lg flex items-center justify-center ${bgColor}`;
  document.getElementById('actionMenuTitle').textContent = item.name;
  document.getElementById('actionMenuSubtitle').textContent = typeLabel;
  
  const pinLabel = item.pinned ? 'Lepas Sematkan' : 'Sematkan';
  
  const menuItems = [
    { label: 'Ganti Nama', icon: 'edit', action: 'rename' },
    { label: 'Pindah', icon: 'move', action: 'move' },
    { label: 'Salin', icon: 'copy', action: 'copy', hide: type === 'folder' },
    { label: pinLabel, icon: 'pin', action: 'pin' },
    { label: 'Hapus', icon: 'delete', action: 'delete', danger: true }
  ];
  
  document.getElementById('actionMenuItems').innerHTML = menuItems.filter(item => !item.hide).map(item => {
    let iconSvg = getActionIcon(item.icon);
    return `
      <button onclick="handleAction('${item.action}')" class="w-full flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors ${item.danger ? 'text-red-600 dark:text-red-400' : 'text-gray-700 dark:text-gray-200'}">
        ${iconSvg}
        <span class="font-medium">${item.label}</span>
      </button>
    `;
  }).join('');
  
  document.getElementById('actionMenuModal').classList.remove('hidden');
  document.getElementById('actionMenuModal').classList.add('flex');
}

function hideActionMenu() {
  document.getElementById('actionMenuModal').classList.add('hidden');
  document.getElementById('actionMenuModal').classList.remove('flex');
  actionTarget = null;
}

function getActionIcon(type) {
  const icons = {
    edit: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/></svg>',
    move: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z"/></svg>',
    copy: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/></svg>',
    pin: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"/></svg>',
    delete: '<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>'
  };
  return icons[type] || '';
}

function handleAction(action) {
  if (!actionTarget) return;
  
  const { id, type } = actionTarget;
  const item = type === 'folder' ? data.folders[id] : data.files[id];
  
  switch (action) {
    case 'rename':
      hideActionMenu();
      showRenameModal(id, type, item.name);
      break;
    case 'move':
      hideActionMenu();
      showFolderPicker('move', id, type);
      break;
    case 'copy':
      hideActionMenu();
      showFolderPicker('copy', id, type);
      break;
    case 'pin':
      item.pinned = !item.pinned;
      saveData();
      hideActionMenu();
      renderFileList();
      showToast(item.pinned ? 'Item disematkan' : 'Sematkan dilepas');
      break;
    case 'delete':
      hideActionMenu();
      showSoftDeleteConfirm(id, type, item.name);
      break;
  }
}

// =====================
// Soft Delete Confirmation
// =====================
function showSoftDeleteConfirm(id, type, name) {
  deleteTarget = { id, type, action: 'soft-delete' };
  const itemType = type === 'folder' ? 'folder' : (type === 'note' ? 'catatan' : 'tabel');
  document.getElementById('deleteMessage').textContent = `Pindahkan ${itemType} "${name}" ke Tempat Sampah?`;
  document.getElementById('deleteConfirmInput').classList.add('hidden');
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

// =====================
// Rename
// =====================
function showRenameModal(id, type, currentName) {
  actionTarget = { id, type };
  document.getElementById('renameInput').value = currentName;
  document.getElementById('renameModal').classList.remove('hidden');
  document.getElementById('renameModal').classList.add('flex');
  document.getElementById('renameInput').focus();
}

function hideRenameModal() {
  document.getElementById('renameModal').classList.add('hidden');
  document.getElementById('renameModal').classList.remove('flex');
}

function confirmRename() {
  if (!actionTarget) return;
  const { id, type } = actionTarget;
  const newName = document.getElementById('renameInput').value.trim();
  
  if (!newName) {
    showToast('Nama tidak boleh kosong', 'error');
    return;
  }
  
  if (type === 'folder') {
    data.folders[id].name = newName;
  } else {
    data.files[id].name = newName;
  }
  
  saveData();
  hideRenameModal();
  renderFileList();
  showToast('Nama berhasil diubah');
}

// =====================
// Move & Copy
// =====================
function showFolderPicker(mode, id, type) {
  moveCopyTarget = { id, type };
  moveCopyMode = mode;
  selectedDestFolder = null;
  
  document.getElementById('folderPickerTitle').textContent = mode === 'move' ? 'Pindah ke Folder' : 'Salin ke Folder';
  
  const treeHtml = buildFolderTree('root', 0, id, type);
  document.getElementById('folderPickerTree').innerHTML = treeHtml || '<p class="text-gray-500 text-center py-4">Tidak ada folder tersedia</p>';
  
  document.getElementById('folderPickerModal').classList.remove('hidden');
  document.getElementById('folderPickerModal').classList.add('flex');
}

function buildFolderTree(folderId, level, excludeId, excludeType) {
  let html = '';
  
  if (excludeType === 'folder' && folderId === excludeId) return '';
  
  const folder = data.folders[folderId];
  if (!folder || folder.deletedAt) return '';
  
  const indent = level * 16;
  const isCurrentFolder = folderId === currentPath;
  
  html += `
    <button onclick="selectFolder('${folderId}')" class="folder-tree-item w-full text-left p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center gap-2 ${isCurrentFolder ? 'bg-green-50 dark:bg-green-900/20' : ''}" style="padding-left: ${indent + 8}px;">
      <svg class="w-5 h-5 text-yellow-500 shrink-0" fill="currentColor" viewBox="0 0 24 24"><path d="M10 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2h-8l-2-2z"/></svg>
      <span class="text-gray-700 dark:text-gray-200 truncate">${folder.name}</span>
      ${isCurrentFolder ? '<span class="text-xs text-green-600 dark:text-green-400">(saat ini)</span>' : ''}
    </button>
  `;
  
  Object.keys(data.folders).forEach(childId => {
    const child = data.folders[childId];
    if (child.parent === folderId && !child.deletedAt) {
      html += buildFolderTree(childId, level + 1, excludeId, excludeType);
    }
  });
  
  return html;
}

function selectFolder(folderId) {
  selectedDestFolder = folderId;
  document.querySelectorAll('.folder-tree-item').forEach(btn => {
    btn.classList.remove('bg-green-100', 'dark:bg-green-900/30', 'ring-2', 'ring-green-500');
  });
  event.currentTarget.classList.add('bg-green-100', 'dark:bg-green-900/30', 'ring-2', 'ring-green-500');
}

function hideFolderPicker() {
  document.getElementById('folderPickerModal').classList.add('hidden');
  document.getElementById('folderPickerModal').classList.remove('flex');
  moveCopyTarget = null;
  selectedDestFolder = null;
}

function confirmMoveCopy() {
  if (!moveCopyTarget || !selectedDestFolder) {
    showToast('Pilih folder tujuan', 'error');
    return;
  }
  
  const { id, type } = moveCopyTarget;
  const currentItem = type === 'folder' ? data.folders[id] : data.files[id];
  
  if (currentItem.parent === selectedDestFolder) {
    showToast('Item sudah berada di folder ini', 'error');
    return;
  }
  
  if (type === 'folder' && isDescendant(selectedDestFolder, id)) {
    showToast('Tidak dapat memindahkan ke subfolder-nya sendiri', 'error');
    return;
  }
  
  if (moveCopyMode === 'move') {
    if (type === 'folder') {
      data.folders[id].parent = selectedDestFolder;
    } else {
      data.files[id].parent = selectedDestFolder;
    }
    showToast('Item berhasil dipindahkan');
  } else {
    const newId = type + '_' + Date.now();
    const original = data.files[id];
    data.files[newId] = {
      ...JSON.parse(JSON.stringify(original)),
      id: newId,
      parent: selectedDestFolder,
      name: original.name + ' (salinan)',
      createdAt: Date.now(),
      pinned: false
    };
    showToast('Item berhasil disalin');
  }
  
  saveData();
  hideFolderPicker();
  renderFileList();
}

function isDescendant(potentialDescendant, ancestor) {
  let current = potentialDescendant;
  while (current) {
    if (current === ancestor) return true;
    const folder = data.folders[current];
    current = folder ? folder.parent : null;
  }
  return false;
}

// =====================
// Soft Delete & Trash
// =====================
function softDelete(id, type) {
  if (type === 'folder') {
    markFolderDeleted(id, true);
  } else {
    data.files[id].deletedAt = Date.now();
  }
  saveData();
  renderFileList();
  showToast('Dipindahkan ke Tempat Sampah');
}

function markFolderDeleted(folderId, deleted) {
  const folder = data.folders[folderId];
  if (folder) {
    folder.deletedAt = deleted ? Date.now() : null;
    
    Object.keys(data.files).forEach(fileId => {
      if (data.files[fileId].parent === folderId) {
        data.files[fileId].deletedAt = deleted ? Date.now() : null;
      }
    });
    
    Object.keys(data.folders).forEach(subFolderId => {
      if (data.folders[subFolderId].parent === folderId) {
        markFolderDeleted(subFolderId, deleted);
      }
    });
  }
}

function showTrashModal() {
  document.getElementById('settingsDropdown').classList.add('hidden');
  renderTrashList();
  document.getElementById('trashModal').classList.remove('hidden');
  document.getElementById('trashModal').classList.add('flex');
}

function hideTrashModal() {
  document.getElementById('trashModal').classList.add('hidden');
  document.getElementById('trashModal').classList.remove('flex');
}

function renderTrashList() {
  const trashList = document.getElementById('trashList');
  const items = [];
  
  Object.entries(data.folders).forEach(([id, f]) => {
    if (f.deletedAt && !data.folders[f.parent]?.deletedAt) {
      items.push({ id, type: 'folder', ...f });
    }
  });
  
  Object.entries(data.files).forEach(([id, f]) => {
    if (f.deletedAt && !data.folders[f.parent]?.deletedAt) {
      items.push({ id, type: f.type, ...f });
    }
  });
  
  if (items.length === 0) {
    trashList.innerHTML = `
      <div class="flex flex-col items-center justify-center py-12 text-gray-400 dark:text-gray-500">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
        </svg>
        <p class="text-lg">Tempat sampah kosong</p>
      </div>
    `;
  } else {
    trashList.innerHTML = `
      <div class="grid grid-cols-2 sm:grid-cols-3 gap-3">
        ${items.map(item => renderTrashItem(item)).join('')}
      </div>
    `;
  }
}

function renderTrashItem(item) {
  const { icon, bgColor } = getItemIconAndColor(item.type);
  const dateStr = item.deletedAt ? new Date(item.deletedAt).toLocaleDateString('id-ID') : '';
  
  return `
    <div class="relative ${bgColor} rounded-xl p-3 border border-gray-200 dark:border-gray-600">
      <div class="flex flex-col items-center text-center">
        ${icon}
        <span class="mt-2 text-sm font-medium text-gray-700 dark:text-gray-200 line-clamp-2">${item.name}</span>
        <span class="text-xs text-gray-400 dark:text-gray-500 mt-1">Dihapus: ${dateStr}</span>
      </div>
      <div class="flex gap-1 mt-2">
        <button onclick="restoreItem('${item.id}', '${item.type}')" class="flex-1 py-1.5 text-xs bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-lg hover:bg-green-200 dark:hover:bg-green-900/50">Pulihkan</button>
        <button onclick="permanentDelete('${item.id}', '${item.type}')" class="flex-1 py-1.5 text-xs bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400 rounded-lg hover:bg-red-200 dark:hover:bg-red-900/50">Hapus</button>
      </div>
    </div>
  `;
}

function restoreItem(id, type) {
  if (type === 'folder') {
    markFolderDeleted(id, false);
  } else {
    data.files[id].deletedAt = null;
  }
  saveData();
  renderTrashList();
  showToast('Item berhasil dipulihkan');
}

function permanentDelete(id, type) {
  deleteTarget = { id, type, permanent: true };
  document.getElementById('deleteMessage').textContent = 'Hapus permanen? Item tidak dapat dikembalikan.';
  document.getElementById('deleteConfirmInput').classList.add('hidden');
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

function emptyTrash() {
  const hasItems = Object.values(data.folders).some(f => f.deletedAt) || Object.values(data.files).some(f => f.deletedAt);
  
  if (!hasItems) {
    showToast('Tempat sampah sudah kosong', 'info');
    return;
  }
  
  deleteTarget = { type: 'empty-trash' };
  document.getElementById('deleteMessage').textContent = 'Kosongkan seluruh tempat sampah? Semua item akan dihapus permanen.';
  document.getElementById('deleteConfirmInput').classList.remove('hidden');
  document.getElementById('deleteConfirmText').value = '';
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

// =====================
// Delete Modal
// =====================
function hideDeleteModal() {
  document.getElementById('deleteModal').classList.add('hidden');
  document.getElementById('deleteModal').classList.remove('flex');
  deleteTarget = null;
}

function confirmDelete() {
  if (!deleteTarget) return;
  
  if (deleteTarget.type === 'simple') {
    if (simpleDeleteCallback) simpleDeleteCallback();
    hideDeleteModal();
    return;
  }
  
  if (deleteTarget.type === 'empty-trash') {
    const confirmText = document.getElementById('deleteConfirmText').value.trim().toLowerCase();
    if (confirmText !== 'yes') {
      showToast('Ketik "yes" untuk konfirmasi', 'error');
      return;
    }
    
    Object.keys(data.folders).forEach(id => {
      if (data.folders[id].deletedAt) delete data.folders[id];
    });
    Object.keys(data.files).forEach(id => {
      if (data.files[id].deletedAt) delete data.files[id];
    });
    
    saveData();
    hideDeleteModal();
    renderTrashList();
    showToast('Tempat sampah dikosongkan');
    return;
  }
  
  const { id, type, permanent, action } = deleteTarget;
  
  if (action === 'soft-delete') {
    softDelete(id, type);
    hideDeleteModal();
    return;
  }
  
  if (type === 'folder') {
    deleteFolderRecursive(id, true);
    delete data.folders[id];
  } else {
    delete data.files[id];
  }
  
  saveData();
  hideDeleteModal();
  
  if (document.getElementById('trashModal').classList.contains('flex')) {
    renderTrashList();
  }
  showToast('Item dihapus permanen');
}

function deleteFolderRecursive(folderId, permanent = false) {
  Object.keys(data.files).forEach(fileId => {
    if (data.files[fileId].parent === folderId) {
      if (permanent) delete data.files[fileId];
    }
  });
  
  Object.keys(data.folders).forEach(subFolderId => {
    if (data.folders[subFolderId].parent === folderId) {
      deleteFolderRecursive(subFolderId, permanent);
      if (permanent) delete data.folders[subFolderId];
    }
  });
}

// =====================
// Search
// =====================
function handleSearch(e) {
  const query = e.target.value.trim().toLowerCase();
  if (!query) {
    renderFileList();
    return;
  }
  performSearch(query);
}

function performSearch(query) {
  const results = [];
  
  Object.entries(data.folders).forEach(([id, f]) => {
    if (!f.deletedAt && f.name.toLowerCase().includes(query)) {
      results.push({ id, type: 'folder', ...f, path: getFullPath(id, 'folder') });
    }
  });
  
  Object.entries(data.files).forEach(([id, f]) => {
    if (!f.deletedAt && f.name.toLowerCase().includes(query)) {
      results.push({ id, type: f.type, ...f, path: getFullPath(id, 'file') });
    }
  });
  
  const container = document.getElementById('searchList');
  
  if (results.length === 0) {
    container.innerHTML = '<p class="text-gray-500 text-center py-8">Tidak ada hasil ditemukan</p>';
  } else {
    container.innerHTML = results.map(item => {
      const { icon, bgColor } = getItemIconAndColor(item.type);
      return `
        <div class="flex items-center gap-3 p-3 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 cursor-pointer mb-2" onclick="goToSearchResult('${item.id}', '${item.type}', '${item.parent || ''}')">
          ${icon}
          <div class="flex-1 min-w-0">
            <p class="font-medium text-gray-800 dark:text-white truncate">${item.name}</p>
            <p class="text-xs text-gray-500 dark:text-gray-400 truncate">${item.path}</p>
          </div>
        </div>
      `;
    }).join('');
  }
  
  document.getElementById('fileList').classList.add('hidden');
  document.getElementById('emptyState').classList.add('hidden');
  document.getElementById('searchResults').classList.remove('hidden');
  document.getElementById('searchResults').classList.add('flex');
}

function getFullPath(id, type) {
  const parts = [];
  let parentId = type === 'folder' ? data.folders[id]?.parent : data.files[id]?.parent;
  
  while (parentId) {
    const folder = data.folders[parentId];
    if (folder) {
      parts.unshift(folder.name);
      parentId = folder.parent;
    } else {
      break;
    }
  }
  
  return parts.join(' / ') || 'Root';
}

function goToSearchResult(id, type, parentId) {
  document.getElementById('searchInputDesktop').value = '';
  document.getElementById('searchInputMobile').value = '';
  
  // Close mobile search if open
  if (isMobileSearchOpen) {
    toggleMobileSearch();
  }
  
  if (type === 'folder') {
    navigateTo(id, true);
  } else {
    navigateTo(parentId || 'root', true);
    setTimeout(() => {
      if (type === 'note') openNote(id);
      else openTable(id);
    }, 100);
  }
}

// =====================
// Backup & Restore
// =====================
function backupData() {
  document.getElementById('settingsDropdown').classList.add('hidden');
  
  const backup = {
    version: 1,
    timestamp: Date.now(),
    data: data
  };
  
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `note-manager-backup-${new Date().toISOString().split('T')[0]}.json`;
  link.click();
  URL.revokeObjectURL(url);
  
  showToast('Backup berhasil dibuat');
}

function restoreData(e) {
  document.getElementById('settingsDropdown').classList.add('hidden');
  
  const file = e.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const backup = JSON.parse(event.target.result);
      
      if (!backup.data || !backup.data.folders || !backup.data.files) {
        throw new Error('Format file tidak valid');
      }
      
      data = backup.data;
      
      Object.values(data.folders).forEach(f => {
        if (f.deletedAt === undefined) f.deletedAt = null;
        if (f.pinned === undefined) f.pinned = false;
        if (f.sortOrder === undefined) f.sortOrder = 'name-asc';
      });
      Object.values(data.files).forEach(f => {
        if (f.deletedAt === undefined) f.deletedAt = null;
        if (f.pinned === undefined) f.pinned = false;
      });
      
      saveData();
      currentPath = 'root';
      navigateTo('root', true);
      showToast('Data berhasil dipulihkan');
    } catch (err) {
      showToast('Gagal memulihkan: ' + err.message, 'error');
    }
  };
  reader.readAsText(file);
  e.target.value = '';
}

// =====================
// Modal Functions
// =====================
function showAddModal() {
  document.getElementById('addModal').classList.remove('hidden');
  document.getElementById('addModal').classList.add('flex');
}

function hideAddModal() {
  document.getElementById('addModal').classList.add('hidden');
  document.getElementById('addModal').classList.remove('flex');
}

function showCreateFolder() {
  hideAddModal();
  document.getElementById('folderNameInput').value = '';
  document.getElementById('createFolderModal').classList.remove('hidden');
  document.getElementById('createFolderModal').classList.add('flex');
  document.getElementById('folderNameInput').focus();
}

function hideCreateFolder() {
  document.getElementById('createFolderModal').classList.add('hidden');
  document.getElementById('createFolderModal').classList.remove('flex');
}

function showCreateNote() {
  hideAddModal();
  document.getElementById('noteNameInput').value = '';
  document.getElementById('createNoteModal').classList.remove('hidden');
  document.getElementById('createNoteModal').classList.add('flex');
  document.getElementById('noteNameInput').focus();
}

function hideCreateNote() {
  document.getElementById('createNoteModal').classList.add('hidden');
  document.getElementById('createNoteModal').classList.remove('flex');
}

function showCreateTable() {
  hideAddModal();
  document.getElementById('tableNameInput').value = '';
  tempHeaders = [
    { name: 'No', type: 'number' },
    { name: 'Tanggal', type: 'date' },
    { name: 'Keterangan', type: 'text' },
    { name: 'Jumlah', type: 'number' }
  ];
  renderHeaderColumns();
  document.getElementById('createTableModal').classList.remove('hidden');
  document.getElementById('createTableModal').classList.add('flex');
  document.getElementById('tableNameInput').focus();
}

function hideCreateTable() {
  document.getElementById('createTableModal').classList.add('hidden');
  document.getElementById('createTableModal').classList.remove('flex');
}

function addHeaderColumn() {
  tempHeaders.push({ name: '', type: 'text' });
  renderHeaderColumns();
}

function renderHeaderColumns() {
  const container = document.getElementById('headerColumns');
  container.innerHTML = tempHeaders.map((h, i) => {
    const isFinancial = ['income', 'expense', 'balance'].includes(h.type);
    const nameValue = isFinancial ? getAutoName(h.type) : h.name;
    const nameDisabled = isFinancial ? 'disabled' : '';
    
    return `
    <div class="flex gap-2 items-center">
      <input type="text" value="${nameValue}" ${nameDisabled} onchange="tempHeaders[${i}].name = this.value" placeholder="Nama kolom" class="flex-1 px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent ${isFinancial ? 'opacity-60' : ''}">
      <select onchange="tempHeaders[${i}].type = this.value; renderHeaderColumns()" class="px-2 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-800 dark:text-white text-sm focus:ring-2 focus:ring-green-500 focus:border-transparent">
        <option value="text" ${h.type === 'text' ? 'selected' : ''}>Teks</option>
        <option value="number" ${h.type === 'number' ? 'selected' : ''}>Angka</option>
        <option value="date" ${h.type === 'date' ? 'selected' : ''}>Tanggal</option>
        <option value="checkbox" ${h.type === 'checkbox' ? 'selected' : ''}>Cekbox</option>
        <option value="income" ${h.type === 'income' ? 'selected' : ''}>Pemasukan</option>
        <option value="expense" ${h.type === 'expense' ? 'selected' : ''}>Pengeluaran</option>
        <option value="balance" ${h.type === 'balance' ? 'selected' : ''}>Saldo</option>
      </select>
      <button onclick="tempHeaders.splice(${i}, 1); renderHeaderColumns()" class="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded-lg">
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
        </svg>
      </button>
    </div>
  `}).join('');
}

function getAutoName(type) {
  const names = {
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    balance: 'Saldo'
  };
  return names[type] || '';
}

function handleColumnTypeChange(selectId, inputId) {
  const select = document.getElementById(selectId);
  const input = document.getElementById(inputId);
  const type = select.value;
  
  if (['income', 'expense', 'balance'].includes(type)) {
    input.value = getAutoName(type);
    input.disabled = true;
    input.classList.add('opacity-60');
  } else {
    input.value = '';
    input.disabled = false;
    input.classList.remove('opacity-60');
  }
}

// =====================
// Create Functions
// =====================
function createFolder() {
  const name = document.getElementById('folderNameInput').value.trim();
  if (!name) {
    showToast('Nama folder tidak boleh kosong', 'error');
    return;
  }
  
  const id = 'folder_' + Date.now();
  data.folders[id] = { 
    name, 
    parent: currentPath, 
    createdAt: Date.now(),
    deletedAt: null,
    pinned: false,
    sortOrder: 'name-asc'
  };
  saveData();
  hideCreateFolder();
  renderFileList();
  showToast('Folder berhasil dibuat');
}

function createNote() {
  const name = document.getElementById('noteNameInput').value.trim();
  if (!name) {
    showToast('Nama catatan tidak boleh kosong', 'error');
    return;
  }
  
  const id = 'note_' + Date.now();
  data.files[id] = { 
    name, 
    type: 'note', 
    content: '', 
    parent: currentPath, 
    createdAt: Date.now(),
    deletedAt: null,
    pinned: false
  };
  saveData();
  hideCreateNote();
  renderFileList();
  showToast('Catatan berhasil dibuat');
}

function createTable() {
  const name = document.getElementById('tableNameInput').value.trim();
  if (!name) {
    showToast('Nama tabel tidak boleh kosong', 'error');
    return;
  }
  
  tempHeaders.forEach(h => {
    if (['income', 'expense', 'balance'].includes(h.type)) {
      h.name = getAutoName(h.type);
    }
  });
  
  const validHeaders = tempHeaders.filter(h => h.name.trim());
  if (validHeaders.length === 0) {
    showToast('Minimal satu kolom harus diisi', 'error');
    return;
  }
  
  const id = 'table_' + Date.now();
  data.files[id] = { 
    name, 
    type: 'table', 
    headers: validHeaders,
    rows: [],
    columnWidths: {},
    zoom: 100,
    parent: currentPath, 
    createdAt: Date.now(),
    deletedAt: null,
    pinned: false
  };
  saveData();
  hideCreateTable();
  renderFileList();
  showToast('Tabel berhasil dibuat');
}

// =====================
// Note Editor
// =====================
function openNote(id) {
  currentEditingId = id;
  currentEditingType = 'note';
  const note = data.files[id];
  document.getElementById('noteEditorTitle').value = note.name;
  document.getElementById('noteEditorContent').value = note.content || '';
  document.getElementById('noteEditorModal').classList.remove('hidden');
  document.getElementById('noteEditorModal').classList.add('flex');
}

function closeNoteEditor() {
  document.getElementById('noteEditorModal').classList.add('hidden');
  document.getElementById('noteEditorModal').classList.remove('flex');
  currentEditingId = null;
}

function saveNote() {
  if (!currentEditingId) return;
  data.files[currentEditingId].name = document.getElementById('noteEditorTitle').value.trim() || 'Untitled';
  data.files[currentEditingId].content = document.getElementById('noteEditorContent').value;
  saveData();
  renderFileList();
  showToast('Catatan berhasil disimpan');
  closeNoteEditor();
}

function downloadNote() {
  if (!currentEditingId) return;
  const note = data.files[currentEditingId];
  const content = note.content || '';
  const filename = `${note.name || 'Untitled'}.txt`;
  
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    showToast('File berhasil diunduh');
  } catch (e) {
    showToast('Gagal mengunduh file', 'error');
  }
}

// =====================
// Table Editor
// =====================
function openTable(id) {
  currentEditingId = id;
  currentEditingType = 'table';
  currentTable = JSON.parse(JSON.stringify(data.files[id]));
  tableZoom = currentTable.zoom || 100;
  document.getElementById('tableEditorTitle').value = currentTable.name;
  document.getElementById('zoomLevel').textContent = tableZoom + '%';
  renderTable();
  document.getElementById('tableEditorModal').classList.remove('hidden');
  document.getElementById('tableEditorModal').classList.add('flex');
}

function closeTableEditor() {
  document.getElementById('tableEditorModal').classList.add('hidden');
  document.getElementById('tableEditorModal').classList.remove('flex');
  currentEditingId = null;
  currentTable = null;
}

function formatNumber(num) {
  if (num === null || num === undefined || num === '') return '';
  const number = parseFloat(num);
  if (isNaN(number)) return '';
  return number.toLocaleString('id-ID');
}

function calculateAutoWidth(headerName, columnIndex) {
  let maxWidth = headerName.length * 10 + 32;
  currentTable.rows.forEach(row => {
    const val = row[columnIndex];
    if (val !== undefined && val !== null && val !== '') {
      const displayVal = currentTable.headers[columnIndex].type === 'number' 
        ? formatNumber(val) 
        : String(val);
      maxWidth = Math.max(maxWidth, displayVal.length * 9 + 32);
    }
  });
  if (headerName.toLowerCase() === 'no') return Math.max(50, Math.min(maxWidth, 70));
  return Math.max(100, Math.min(maxWidth, 350));
}

function renderTable() {
  if (!currentTable) return;
  
  const container = document.getElementById('tableContainer');
  
  if (!currentTable.columnWidths || Object.keys(currentTable.columnWidths).length === 0) {
    currentTable.columnWidths = {};
    currentTable.headers.forEach((h, i) => {
      currentTable.columnWidths[i] = calculateAutoWidth(h.name, i);
    });
  }
  
  let html = `<table class="border-collapse bg-white dark:bg-gray-800 rounded-xl overflow-hidden shadow" style="transform: scale(${tableZoom / 100}); transform-origin: top left;">`;
  
  html += `<thead class="bg-green-500 text-white"><tr>`;
  currentTable.headers.forEach((h, i) => {
    const width = currentTable.columnWidths[i] || 150;
    const typeLabel = getTypeLabel(h.type);
    html += `
      <th class="border border-green-600 dark:border-green-700 p-2 text-center font-semibold excel-cell relative group" style="width: ${width}px; min-width: ${width}px;">
        <div class="flex flex-col items-center">
          <span class="truncate">${h.name}</span>
          ${typeLabel ? `<span class="text-xs opacity-75">${typeLabel}</span>` : ''}
        </div>
        ${h.type !== 'balance' ? `
        <button onclick="deleteColumn(${i})" class="absolute top-1 right-1 p-1 hover:bg-green-600 rounded opacity-0 group-hover:opacity-100 transition-opacity" title="Hapus kolom">
          <svg class="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12"/>
          </svg>
        </button>
        ` : ''}
        <div class="resize-handle" 
             onmousedown="startResizing(event, ${i})" 
             ontouchstart="startTouchResizing(event, ${i})"></div>
      </th>
    `;
  });
  html += `<th class="border border-green-600 dark:border-green-700 p-2 w-12"></th></tr></thead>`;
  
  html += `<tbody>`;
  
  currentTable.rows.forEach((row, rowIndex) => {
    html += `<tr class="hover:bg-gray-50 dark:hover:bg-gray-700/50">`;
    
    let runningBalance = 0;
    for (let r = 0; r <= rowIndex; r++) {
      for (let i = 0; i < currentTable.headers.length; i++) {
        const h = currentTable.headers[i];
        if (h.type === 'income') {
          runningBalance += parseFloat(currentTable.rows[r][i]) || 0;
        } else if (h.type === 'expense') {
          runningBalance -= parseFloat(currentTable.rows[r][i]) || 0;
        }
      }
    }
    
    currentTable.headers.forEach((h, colIndex) => {
      const width = currentTable.columnWidths[colIndex] || 150;
      let value = row[colIndex] !== undefined ? row[colIndex] : '';
      let cellClass = '';
      let alignClass = 'cell-text-center';
      
      if (h.type === 'text') {
        alignClass = 'cell-text-left';
      }
      
      if (h.type === 'balance') {
        value = formatNumber(runningBalance);
        cellClass = 'balance-cell font-semibold';
      } else if (h.type === 'income') {
        cellClass = 'income-cell';
      } else if (h.type === 'expense') {
        cellClass = 'expense-cell';
      }
      
      html += `<td class="border border-gray-200 dark:border-gray-600 p-1 excel-cell ${alignClass} ${cellClass}" style="width: ${width}px; min-width: ${width}px;">`;
      
      if (h.type === 'balance') {
        html += `<span class="px-2 py-1 block">${value}</span>`;
      } else if (h.type === 'checkbox') {
        html += `<div class="flex justify-center"><input type="checkbox" ${value ? 'checked' : ''} onchange="updateCell(${rowIndex}, ${colIndex}, this.checked)" class="w-5 h-5 rounded"></div>`;
      } else if (h.type === 'date') {
        html += `<input type="date" value="${value}" onchange="updateCell(${rowIndex}, ${colIndex}, this.value)" class="w-full px-2 py-1 bg-transparent text-gray-800 dark:text-white border-0 focus:ring-2 focus:ring-green-500 rounded text-center">`;
      } else if (h.type === 'number' || h.type === 'income' || h.type === 'expense') {
        const displayValue = value !== '' ? formatNumber(value) : '';
        html += `<input type="text" 
                       value="${displayValue}" 
                       data-raw="${value}"
                       onfocus="this.value='${value}'" 
                       onblur="formatNumberInput(this, ${rowIndex}, ${colIndex})" 
                       onchange="updateCellFromInput(this, ${rowIndex}, ${colIndex})"
                       class="number-input w-full px-2 py-1 bg-transparent text-gray-800 dark:text-white border-0 focus:ring-2 focus:ring-green-500 rounded">`;
      } else {
        html += `<input type="text" value="${value}" onchange="updateCell(${rowIndex}, ${colIndex}, this.value)" class="w-full px-2 py-1 bg-transparent text-gray-800 dark:text-white border-0 focus:ring-2 focus:ring-green-500 rounded">`;
      }
      
      html += `</td>`;
    });
    
    html += `
      <td class="border border-gray-200 dark:border-gray-600 p-1 w-12 text-center">
        <button onclick="deleteRow(${rowIndex})" class="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/>
          </svg>
        </button>
      </td>
    </tr>`;
  });
  html += `</tbody></table>`;
  
  container.innerHTML = html;
  updateTableSummary();
}

function getTypeLabel(type) {
  const labels = {
    income: 'Pemasukan',
    expense: 'Pengeluaran',
    balance: 'Saldo'
  };
  return labels[type] || '';
}

function updateTableSummary() {
  const summary = document.getElementById('tableSummary');
  let totalIncome = 0;
  let totalExpense = 0;
  let totalNumber = 0;
  
  const hasFinancial = currentTable.headers.some(h => h.type === 'income' || h.type === 'expense');
  
  currentTable.rows.forEach(row => {
    currentTable.headers.forEach((h, i) => {
      const val = parseFloat(row[i]) || 0;
      if (h.type === 'income') totalIncome += val;
      else if (h.type === 'expense') totalExpense += val;
      else if (h.type === 'number' && h.name.toLowerCase() !== 'no') totalNumber += val;
    });
  });
  
  if (hasFinancial) {
    const balance = totalIncome - totalExpense;
    summary.innerHTML = `
      <div><span class="text-gray-600 dark:text-gray-400">Pemasukan:</span> <span class="font-bold text-green-600 dark:text-green-400">${formatNumber(totalIncome)}</span></div>
      <div><span class="text-gray-600 dark:text-gray-400">Pengeluaran:</span> <span class="font-bold text-red-600 dark:text-red-400">${formatNumber(totalExpense)}</span></div>
      <div><span class="text-gray-600 dark:text-gray-400">Saldo:</span> <span class="font-bold text-blue-600 dark:text-blue-400">${formatNumber(balance)}</span></div>
    `;
  } else {
    summary.innerHTML = `
      <div><span class="text-gray-600 dark:text-gray-400">Total Angka:</span> <span class="font-bold text-green-600 dark:text-green-400">${formatNumber(totalNumber)}</span></div>
    `;
  }
}

function formatNumberInput(input, rowIndex, colIndex) {
  const rawValue = input.value.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(rawValue);
  
  if (!isNaN(num)) {
    input.value = formatNumber(num);
    input.dataset.raw = num;
    updateCell(rowIndex, colIndex, num);
  } else {
    input.value = '';
    input.dataset.raw = '';
    updateCell(rowIndex, colIndex, '');
  }
  renderTable();
}

function updateCellFromInput(input, rowIndex, colIndex) {
  const rawValue = input.value.replace(/\./g, '').replace(/,/g, '.');
  const num = parseFloat(rawValue);
  updateCell(rowIndex, colIndex, isNaN(num) ? '' : num);
  renderTable();
}

function updateCell(rowIndex, colIndex, value) {
  if (!currentTable.rows[rowIndex]) {
    currentTable.rows[rowIndex] = [];
  }
  currentTable.rows[rowIndex][colIndex] = value;
}

// =====================
// Column Resizing
// =====================
function startResizing(e, columnIndex) {
  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  resizingColumn = columnIndex;
  resizeStartX = e.clientX;
  resizeStartWidth = currentTable.columnWidths[columnIndex] || 150;
  document.body.style.cursor = 'col-resize';
  document.body.style.userSelect = 'none';
}

function startTouchResizing(e, columnIndex) {
  e.preventDefault();
  e.stopPropagation();
  isResizing = true;
  resizingColumn = columnIndex;
  const touch = e.touches[0];
  resizeStartX = touch.clientX;
  resizeStartWidth = currentTable.columnWidths[columnIndex] || 150;
  document.body.style.userSelect = 'none';
}

function handleResize(e) {
  if (!isResizing || resizingColumn === null || !currentTable) return;
  const delta = e.clientX - resizeStartX;
  const newWidth = Math.max(50, resizeStartWidth + delta);
  currentTable.columnWidths[resizingColumn] = newWidth;
  updateColumnWidth(resizingColumn, newWidth);
}

function handleTouchResize(e) {
  if (!isResizing || resizingColumn === null || !currentTable) return;
  e.preventDefault();
  const touch = e.touches[0];
  const delta = touch.clientX - resizeStartX;
  const newWidth = Math.max(50, resizeStartWidth + delta);
  currentTable.columnWidths[resizingColumn] = newWidth;
  updateColumnWidth(resizingColumn, newWidth);
}

function updateColumnWidth(columnIndex, newWidth) {
  const table = document.querySelector('#tableContainer table');
  if (table) {
    const headers = table.querySelectorAll('thead th');
    if (headers[columnIndex]) {
      headers[columnIndex].style.width = newWidth + 'px';
      headers[columnIndex].style.minWidth = newWidth + 'px';
      const rows = table.querySelectorAll('tbody tr');
      rows.forEach(row => {
        const cells = row.querySelectorAll('td');
        if (cells[columnIndex]) {
          cells[columnIndex].style.width = newWidth + 'px';
          cells[columnIndex].style.minWidth = newWidth + 'px';
        }
      });
    }
  }
}

function stopResizing() {
  if (isResizing) {
    isResizing = false;
    document.body.style.cursor = 'auto';
    document.body.style.userSelect = 'auto';
    resizingColumn = null;
  }
}

// =====================
// Zoom & Table Operations
// =====================
function zoomTable(direction) {
  tableZoom += direction * 10;
  tableZoom = Math.max(50, Math.min(200, tableZoom));
  document.getElementById('zoomLevel').textContent = tableZoom + '%';
  renderTable();
}

function addTableRow() {
  const newRow = currentTable.headers.map(h => {
    if (h.type === 'checkbox') return false;
    if (h.type === 'date') return new Date().toISOString().split('T')[0];
    if (h.type === 'number' || h.type === 'income' || h.type === 'expense') {
      if (h.name.toLowerCase() === 'no') return currentTable.rows.length + 1;
      return '';
    }
    if (h.type === 'balance') return '';
    return '';
  });
  currentTable.rows.push(newRow);
  renderTable();
}

function deleteRow(index) {
  simpleDeleteCallback = () => {
    currentTable.rows.splice(index, 1);
    currentTable.rows.forEach((row, i) => {
      const noIndex = currentTable.headers.findIndex(h => h.name.toLowerCase() === 'no');
      if (noIndex !== -1) {
        row[noIndex] = i + 1;
      }
    });
    renderTable();
    showToast('Baris berhasil dihapus');
  };
  
  document.getElementById('deleteMessage').textContent = `Hapus baris ${index + 1}?`;
  document.getElementById('deleteConfirmInput').classList.add('hidden');
  deleteTarget = { type: 'simple' };
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

function deleteColumn(index) {
  simpleDeleteCallback = () => {
    currentTable.headers.splice(index, 1);
    const newWidths = {};
    Object.entries(currentTable.columnWidths).forEach(([key, val]) => {
      const keyNum = parseInt(key);
      if (keyNum < index) newWidths[keyNum] = val;
      else if (keyNum > index) newWidths[keyNum - 1] = val;
    });
    currentTable.columnWidths = newWidths;
    currentTable.rows.forEach(row => row.splice(index, 1));
    renderTable();
    showToast('Kolom berhasil dihapus');
  };
  
  document.getElementById('deleteMessage').textContent = `Hapus kolom "${currentTable.headers[index].name}"?`;
  document.getElementById('deleteConfirmInput').classList.add('hidden');
  deleteTarget = { type: 'simple' };
  document.getElementById('deleteModal').classList.remove('hidden');
  document.getElementById('deleteModal').classList.add('flex');
}

function addTableColumn() {
  document.getElementById('newColumnName').value = '';
  document.getElementById('newColumnType').value = 'text';
  document.getElementById('newColumnName').disabled = false;
  document.getElementById('newColumnName').classList.remove('opacity-60');
  document.getElementById('addColumnModal').classList.remove('hidden');
  document.getElementById('addColumnModal').classList.add('flex');
  document.getElementById('newColumnName').focus();
}

function hideAddColumnModal() {
  document.getElementById('addColumnModal').classList.add('hidden');
  document.getElementById('addColumnModal').classList.remove('flex');
}

function confirmAddColumn() {
  let name = document.getElementById('newColumnName').value.trim();
  const type = document.getElementById('newColumnType').value;
  
  if (['income', 'expense', 'balance'].includes(type)) {
    name = getAutoName(type);
  }
  
  if (!name) {
    showToast('Nama kolom tidak boleh kosong', 'error');
    return;
  }
  
  const newIndex = currentTable.headers.length;
  currentTable.headers.push({ name, type });
  currentTable.columnWidths[newIndex] = calculateAutoWidth(name, newIndex);
  currentTable.rows.forEach(row => {
    if (type === 'checkbox') row.push(false);
    else if (type === 'date') row.push(new Date().toISOString().split('T')[0]);
    else row.push('');
  });
  
  hideAddColumnModal();
  renderTable();
  showToast('Kolom berhasil ditambahkan');
}

function saveTable() {
  if (!currentEditingId || !currentTable) return;
  currentTable.name = document.getElementById('tableEditorTitle').value.trim() || 'Untitled';
  currentTable.zoom = tableZoom;
  data.files[currentEditingId] = currentTable;
  saveData();
  renderFileList();
  showToast('Tabel berhasil disimpan');
  closeTableEditor();
}

function downloadTableTxt() {
  if (!currentTable) return;
  
  let content = currentTable.name + '\n';
  content += '='.repeat(50) + '\n\n';
  
  content += currentTable.headers.map(h => h.name).join('\t') + '\n';
  content += '-'.repeat(50) + '\n';
  
  currentTable.rows.forEach(row => {
    content += currentTable.headers.map((h, i) => {
      const val = row[i];
      if (h.type === 'checkbox') return val ? 'Ya' : 'Tidak';
      if (h.type === 'number' || h.type === 'income' || h.type === 'expense' || h.type === 'balance') return formatNumber(val) || '0';
      return val || '';
    }).join('\t') + '\n';
  });
  
  let totalIncome = 0, totalExpense = 0;
  currentTable.headers.forEach((h, colIndex) => {
    if (h.type === 'income' || h.type === 'expense') {
      currentTable.rows.forEach(row => {
        const val = parseFloat(row[colIndex]) || 0;
        if (h.type === 'income') totalIncome += val;
        else totalExpense += val;
      });
    }
  });
  
  if (totalIncome || totalExpense) {
    content += '\n' + '-'.repeat(50) + '\n';
    content += `Total Pemasukan: ${formatNumber(totalIncome)}\n`;
    content += `Total Pengeluaran: ${formatNumber(totalExpense)}\n`;
    content += `Saldo: ${formatNumber(totalIncome - totalExpense)}\n`;
  }
  
  try {
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${currentTable.name}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('File TXT berhasil diunduh');
  } catch (e) {
    showToast('Gagal mengunduh file TXT', 'error');
  }
}

function downloadTableExcel() {
  if (!currentTable) return;
  
  let csv = '\uFEFF';
  csv += currentTable.headers.map(h => `"${h.name}"`).join(',') + '\n';
  
  currentTable.rows.forEach(row => {
    csv += currentTable.headers.map((h, i) => {
      const val = row[i];
      if (h.type === 'checkbox') return val ? '"Ya"' : '"Tidak"';
      if (h.type === 'number' || h.type === 'income' || h.type === 'expense' || h.type === 'balance') return val || '0';
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`;
      return val || '';
    }).join(',') + '\n';
  });
  
  let totalIncome = 0, totalExpense = 0;
  currentTable.headers.forEach((h, colIndex) => {
    if (h.type === 'income' || h.type === 'expense') {
      currentTable.rows.forEach(row => {
        const val = parseFloat(row[colIndex]) || 0;
        if (h.type === 'income') totalIncome += val;
        else totalExpense += val;
      });
    }
  });
  
  if (totalIncome || totalExpense) {
    csv += '\n"Total Pemasukan","",' + totalIncome + '\n';
    csv += '"Total Pengeluaran","",' + totalExpense + '\n';
    csv += '"Saldo","",' + (totalIncome - totalExpense) + '\n';
  }
  
  try {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.href = url;
    link.download = `${currentTable.name}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    showToast('File Excel (CSV) berhasil diunduh');
  } catch (e) {
    showToast('Gagal mengunduh file Excel', 'error');
  }
}

// Initialize
init();