import './index.css';

// ============================================
// State
// ============================================
let files = []; // Array of { path, name, size, status }
let isProcessing = false;

// ============================================
// DOM Elements
// ============================================
const dropZone = document.getElementById('dropZone');
const browseBtn = document.getElementById('browseBtn');
const fileListContainer = document.getElementById('fileListContainer');
const fileList = document.getElementById('fileList');
const fileCount = document.getElementById('fileCount');
const clearAllBtn = document.getElementById('clearAllBtn');
const actionSection = document.getElementById('actionSection');
const passwordInput = document.getElementById('passwordInput');
const togglePassword = document.getElementById('togglePassword');
const unlockBtn = document.getElementById('unlockBtn');
const statusBar = document.getElementById('statusBar');
const statusIcon = document.getElementById('statusIcon');
const statusText = document.getElementById('statusText');
const progressBar = document.getElementById('progressBar');
const progressFill = document.getElementById('progressFill');

// ============================================
// Drag & Drop
// ============================================
let dragCounter = 0;

document.addEventListener('dragover', (e) => e.preventDefault());
document.addEventListener('drop', (e) => e.preventDefault());

dropZone.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragCounter++;
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) {
    dropZone.classList.remove('drag-over');
  }
});

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
});

dropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropZone.classList.remove('drag-over');

  const droppedFiles = Array.from(e.dataTransfer.files);
  const pdfFiles = droppedFiles.filter((f) => f.name.toLowerCase().endsWith('.pdf'));

  if (pdfFiles.length === 0) return;

  pdfFiles.forEach((f) => {
    const filePath = window.electronAPI.getPathForFile(f);
    // Avoid duplicates
    if (!files.some((existing) => existing.path === filePath)) {
      files.push({
        path: filePath,
        name: f.name,
        size: formatFileSize(f.size),
        status: 'pending',
      });
    }
  });

  renderFileList();
  updateUI();
});

// ============================================
// Browse Files
// ============================================
browseBtn.addEventListener('click', async (e) => {
  e.stopPropagation();
  const filePaths = await window.electronAPI.openFileDialog();
  if (filePaths && filePaths.length > 0) {
    filePaths.forEach((fp) => {
      const name = fp.split(/[\\/]/).pop();
      if (!files.some((existing) => existing.path === fp)) {
        files.push({
          path: fp,
          name: name,
          size: '',
          status: 'pending',
        });
      }
    });
    renderFileList();
    updateUI();
  }
});

dropZone.addEventListener('click', () => {
  browseBtn.click();
});

// ============================================
// File List Rendering
// ============================================
function renderFileList() {
  fileList.innerHTML = '';

  files.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'file-item';
    li.innerHTML = `
      <div class="file-item-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M14 2H6C4.9 2 4 2.9 4 4V20C4 21.1 4.9 22 6 22H18C19.1 22 20 21.1 20 20V8L14 2Z" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <polyline points="14,2 14,8 20,8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
        </svg>
      </div>
      <div class="file-item-info">
        <div class="file-item-name" title="${file.name}">${file.name}</div>
        ${file.size ? `<div class="file-item-size">${file.size}</div>` : ''}
      </div>
      <div class="file-item-status ${file.status}" id="status-${index}">
        ${getStatusHTML(file)}
      </div>
      ${
        file.status === 'pending'
          ? `<button class="file-item-remove" data-index="${index}" title="Hapus file">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <line x1="18" y1="6" x2="6" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="6" y1="6" x2="18" y2="18" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg>
            </button>`
          : ''
      }
    `;
    fileList.appendChild(li);
  });

  // Attach remove handlers
  fileList.querySelectorAll('.file-item-remove').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const idx = parseInt(btn.dataset.index, 10);
      files.splice(idx, 1);
      renderFileList();
      updateUI();
    });
  });

  // Update file count
  fileCount.textContent = `${files.length} file`;
}

function getStatusHTML(file) {
  switch (file.status) {
    case 'processing':
      return '<div class="spinner"></div><span>Memproses...</span>';
    case 'success':
      return `<svg class="check-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M20 6L9 17L4 12" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
              </svg><span>Berhasil</span>`;
    case 'error': {
      const errMsg = file.error || 'Gagal';
      const shortMsg = errMsg.length > 40 ? errMsg.substring(0, 40) + '...' : errMsg;
      return `<svg class="error-icon" width="16" height="16" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="2"/>
                <line x1="15" y1="9" x2="9" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                <line x1="9" y1="9" x2="15" y2="15" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
              </svg><span title="${errMsg}">${shortMsg}</span>`;
    }
    default:
      return '';
  }
}

// ============================================
// UI State Management
// ============================================
function updateUI() {
  const hasPendingFiles = files.some((f) => f.status === 'pending');
  const hasFiles = files.length > 0;

  // Show/hide file list
  fileListContainer.classList.toggle('hidden', !hasFiles);

  // Show/hide action section
  actionSection.classList.toggle('hidden', !hasFiles);

  // Enable/disable unlock button
  updateUnlockButtonState();
}

function updateUnlockButtonState() {
  const hasPendingFiles = files.some((f) => f.status === 'pending');
  const hasPassword = passwordInput.value.trim().length > 0;
  unlockBtn.disabled = !hasPendingFiles || !hasPassword || isProcessing;
}

// ============================================
// Password Toggle
// ============================================
togglePassword.addEventListener('click', () => {
  const isPassword = passwordInput.type === 'password';
  passwordInput.type = isPassword ? 'text' : 'password';
  togglePassword.querySelector('.eye-icon').classList.toggle('hidden', !isPassword);
  togglePassword.querySelector('.eye-off-icon').classList.toggle('hidden', isPassword);
});

passwordInput.addEventListener('input', updateUnlockButtonState);

// ============================================
// Unlock Process
// ============================================
unlockBtn.addEventListener('click', async () => {
  const password = passwordInput.value.trim();
  if (!password || isProcessing) return;

  isProcessing = true;
  unlockBtn.disabled = true;
  unlockBtn.classList.add('loading');
  unlockBtn.querySelector('span').textContent = 'Memproses...';

  // Show status bar
  statusBar.classList.remove('hidden');
  progressFill.style.width = '0%';
  progressFill.classList.remove('complete', 'has-errors');
  statusText.textContent = 'Memulai proses unlock...';
  statusIcon.innerHTML = '<div class="spinner"></div>';

  // Get only pending files
  const pendingFiles = files.filter((f) => f.status === 'pending');
  const pendingPaths = pendingFiles.map((f) => f.path);

  // Listen for progress updates
  window.electronAPI.onUnlockProgress((data) => {
    const fileIndex = files.findIndex(
      (f) => f.name === data.fileName && f.status !== 'success' && f.status !== 'error'
    );
    if (fileIndex !== -1) {
      files[fileIndex].status = data.status;
      if (data.error) files[fileIndex].error = data.error;
    }

    // Update progress bar
    const done = files.filter((f) => f.status === 'success' || f.status === 'error').length;
    const total = files.length;
    const percent = Math.round((done / total) * 100);
    progressFill.style.width = `${percent}%`;

    // Update status text
    if (data.status === 'processing') {
      statusText.textContent = `Membuka ${data.fileName}...`;
    }

    // Re-render to show status
    renderFileList();
  });

  try {
    const results = await window.electronAPI.unlockPdfs(pendingPaths, password);

    // Process results
    results.forEach((result) => {
      const fileIndex = files.findIndex(
        (f) => f.name === result.fileName
      );
      if (fileIndex !== -1) {
        files[fileIndex].status = result.success ? 'success' : 'error';
        if (result.error) files[fileIndex].error = result.error;
      }
    });

    renderFileList();

    // Final status
    const successCount = results.filter((r) => r.success).length;
    const errorCount = results.filter((r) => !r.success).length;

    progressFill.style.width = '100%';

    if (errorCount === 0) {
      progressFill.classList.add('complete');
      statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M20 6L9 17L4 12" stroke="#22c55e" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      </svg>`;
      statusText.textContent = `Selesai! ${successCount} file berhasil di-unlock.`;
      statusText.style.color = 'var(--success)';
    } else if (successCount === 0) {
      progressFill.classList.add('has-errors');
      statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
        <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
        <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
      const firstError = results.find((r) => !r.success);
      const errorDetail = firstError?.error || 'Unknown error';
      statusText.textContent = `Gagal: ${errorDetail}`;
      statusText.style.color = 'var(--error)';
    } else {
      progressFill.classList.add('has-errors');
      statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
        <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        <line x1="12" y1="9" x2="12" y2="13" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
        <line x1="12" y1="17" x2="12.01" y2="17" stroke="#f59e0b" stroke-width="2" stroke-linecap="round"/>
      </svg>`;
      statusText.textContent = `${successCount} berhasil, ${errorCount} gagal.`;
      statusText.style.color = 'var(--warning)';
    }
  } catch (error) {
    statusIcon.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <circle cx="12" cy="12" r="10" stroke="#ef4444" stroke-width="2"/>
      <line x1="15" y1="9" x2="9" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
      <line x1="9" y1="9" x2="15" y2="15" stroke="#ef4444" stroke-width="2" stroke-linecap="round"/>
    </svg>`;
    statusText.textContent = `Error: ${error.message}`;
    statusText.style.color = 'var(--error)';
    progressFill.classList.add('has-errors');
    progressFill.style.width = '100%';
  } finally {
    isProcessing = false;
    unlockBtn.classList.remove('loading');
    unlockBtn.querySelector('span').textContent = 'Unlock PDF';
    updateUnlockButtonState();
    window.electronAPI.removeUnlockProgressListener();
  }
});

// ============================================
// Clear All
// ============================================
clearAllBtn.addEventListener('click', () => {
  if (isProcessing) return;
  files = [];
  renderFileList();
  updateUI();
  statusBar.classList.add('hidden');
  statusText.style.color = '';
});

// ============================================
// Helpers
// ============================================
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}
