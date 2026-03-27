/* =============================================================
   WealthTrack — app.js
   IndexedDB storage, Chart.js, CRUD, validation, formatting
   ============================================================= */

'use strict';

// ── Category Config ──────────────────────────────────────────
const CATEGORIES = {
  income: [
    { name: 'Salary',      emoji: '💼' },
    { name: 'Business',    emoji: '🏢' },
    { name: 'Investment',  emoji: '📈' },
    { name: 'Freelance',   emoji: '💻' },
    { name: 'Gift',        emoji: '🎁' },
    { name: 'Other Income',emoji: '💰' },
  ],
  expense: [
    { name: 'Food',        emoji: '🍔' },
    { name: 'Rent',        emoji: '🏠' },
    { name: 'Transport',   emoji: '🚗' },
    { name: 'Shopping',    emoji: '🛍️' },
    { name: 'Healthcare',  emoji: '💊' },
    { name: 'Education',   emoji: '📚' },
    { name: 'Utilities',   emoji: '⚡' },
    { name: 'Entertainment',emoji: '🎬' },
    { name: 'Travel',      emoji: '✈️' },
    { name: 'Other',       emoji: '📦' },
  ],
};

// Pastel palette for pie/bar chart
const CHART_COLORS = [
  '#7c6fff','#22d3a0','#f06292','#fbbf24','#38bdf8',
  '#a78bfa','#34d399','#fb923c','#f472b6','#60a5fa',
];

// ── Currency Formatter ─────────────────────────────────────────
function formatCurrency(amount) {
  const n = parseFloat(amount);
  if (!isFinite(n)) return '₹0.00';
  // Handle extremely large numbers gracefully (abbreviate)
  const abs = Math.abs(n);
  let formatted;
  if (abs >= 1e12)       formatted = (n / 1e12).toFixed(2) + 'T';
  else if (abs >= 1e9)   formatted = (n / 1e9).toFixed(2) + 'B';
  else if (abs >= 1e7)   formatted = (n / 1e7).toFixed(2) + 'Cr';
  else if (abs >= 1e5)   formatted = (n / 1e5).toFixed(2) + 'L';
  else                   formatted = abs.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return (n < 0 ? '-₹' : '₹') + formatted;
}

function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T00:00:00');
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

// ── IndexedDB ─────────────────────────────────────────────────
const DB_NAME    = 'wealthtrack_db';
const DB_VERSION = 1;
const STORE_NAME = 'transactions';
let db;

function openDB() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = (e) => {
      const database = e.target.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        const store = database.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('type',     'type',     { unique: false });
        store.createIndex('category', 'category', { unique: false });
        store.createIndex('date',     'date',     { unique: false });
      }
    };
    req.onsuccess = (e) => { db = e.target.result; resolve(db); };
    req.onerror   = (e) => reject(e.target.error);
  });
}

function dbGetAll() {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbAdd(item) {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.add(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbUpdate(item) {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.put(item);
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => reject(req.error);
  });
}

function dbDelete(id) {
  return new Promise((resolve, reject) => {
    const tx   = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req  = store.delete(id);
    req.onsuccess = () => resolve();
    req.onerror   = () => reject(req.error);
  });
}

// ── App State ─────────────────────────────────────────────────
let transactions = [];    // all from DB
let chartInstance = null;
let currentChartType = 'pie';
let deleteTargetId    = null;

// ── DOM References ────────────────────────────────────────────
const $ = id => document.getElementById(id);

const els = {
  modalOverlay:    $('modalOverlay'),
  deleteOverlay:   $('deleteOverlay'),
  txForm:          $('txForm'),
  txId:            $('txId'),
  txTitle:         $('txTitle'),
  txAmount:        $('txAmount'),
  txCategory:      $('txCategory'),
  txDate:          $('txDate'),
  txNote:          $('txNote'),
  errorTitle:      $('errorTitle'),
  errorAmount:     $('errorAmount'),
  errorCategory:   $('errorCategory'),
  totalIncome:     $('totalIncome'),
  totalExpenses:   $('totalExpenses'),
  netBalance:      $('netBalance'),
  txList:          $('txList'),
  txCount:         $('txCount'),
  emptyState:      $('emptyState'),
  chartEmpty:      $('chartEmpty'),
  expenseChart:    $('expenseChart'),
  modalTitle:      $('modalTitle'),
  btnSubmit:       $('btnSubmit'),
  filterType:      $('filterType'),
  filterCategory:  $('filterCategory'),
  toast:           $('toast'),
};

// ── Init ──────────────────────────────────────────────────────
async function init() {
  await openDB();
  transactions = (await dbGetAll()).sort((a, b) => b.id - a.id);
  setupEventListeners();
  setTodayDate();
  populateCategoryDropdown('income');
  populateCategoryFilter();
  render();
}

function setTodayDate() {
  const today = new Date().toISOString().split('T')[0];
  els.txDate.value = today;
}

// ── Category Dropdowns ────────────────────────────────────────
function populateCategoryDropdown(type) {
  const sel = els.txCategory;
  sel.innerHTML = '<option value="">Select category...</option>';
  CATEGORIES[type].forEach(({ name }) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

function populateCategoryFilter() {
  const sel = els.filterCategory;
  sel.innerHTML = '<option value="all">All Categories</option>';
  [...CATEGORIES.income, ...CATEGORIES.expense].forEach(({ name }) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    sel.appendChild(opt);
  });
}

// ── Event Listeners ───────────────────────────────────────────
function setupEventListeners() {
  // Header add button & empty state CTA
  $('btnOpenModal') .addEventListener('click', () => openModal());
  $('btnEmptyCta')  .addEventListener('click', () => openModal());

  // Modal controls
  $('btnCloseModal').addEventListener('click', closeModal);
  $('btnCancel')    .addEventListener('click', closeModal);
  els.modalOverlay  .addEventListener('click', e => { if (e.target === els.modalOverlay) closeModal(); });

  // Form submit
  els.txForm.addEventListener('submit', handleSubmit);

  // Type radio change → repopulate categories
  document.querySelectorAll('input[name="type"]').forEach(radio => {
    radio.addEventListener('change', () => {
      populateCategoryDropdown(radio.value);
      clearErrors();
    });
  });

  // Filter change → re-render list only
  els.filterType    .addEventListener('change', renderTransactionList);
  els.filterCategory.addEventListener('change', renderTransactionList);

  // Chart toggle
  $('btnPie').addEventListener('click', () => switchChart('pie'));
  $('btnBar').addEventListener('click', () => switchChart('bar'));

  // Delete modal
  $('btnDeleteCancel') .addEventListener('click', () => closeDeleteModal());
  $('btnDeleteConfirm').addEventListener('click', confirmDelete);
  els.deleteOverlay    .addEventListener('click', e => { if (e.target === els.deleteOverlay) closeDeleteModal(); });
}

// ── Modal Open/Close ──────────────────────────────────────────
function openModal(tx = null) {
  clearErrors();
  els.txId.value = '';

  if (tx) {
    // Edit mode
    els.modalTitle.textContent = 'Edit Transaction';
    els.btnSubmit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Update Transaction`;
    els.txId.value    = tx.id;
    els.txTitle.value = tx.title;
    els.txAmount.value= tx.amount;
    els.txDate.value  = tx.date || '';
    els.txNote.value  = tx.note || '';

    const radio = document.querySelector(`input[name="type"][value="${tx.type}"]`);
    if (radio) { radio.checked = true; }
    populateCategoryDropdown(tx.type);
    // set category after options are built
    els.txCategory.value = tx.category;
  } else {
    // Add mode
    els.modalTitle.textContent = 'Add Transaction';
    els.btnSubmit.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>
      Save Transaction`;
    els.txForm.reset();
    document.querySelector('input[name="type"][value="income"]').checked = true;
    populateCategoryDropdown('income');
    setTodayDate();
  }

  els.modalOverlay.classList.add('open');
  setTimeout(() => els.txTitle.focus(), 100);
}

function closeModal() {
  els.modalOverlay.classList.remove('open');
}

// ── Form Validation ───────────────────────────────────────────
function validateForm() {
  let valid = true;
  clearErrors();

  const title    = els.txTitle.value.trim();
  const amountRaw= els.txAmount.value.trim();
  const category = els.txCategory.value;

  if (!title) {
    setError('errorTitle', 'txTitle', 'Title is required.');
    valid = false;
  }

  const amount = parseFloat(amountRaw);
  if (!amountRaw) {
    setError('errorAmount', 'txAmount', 'Amount is required.');
    valid = false;
  } else if (isNaN(amount) || amount <= 0) {
    setError('errorAmount', 'txAmount', 'Enter a valid positive number.');
    valid = false;
  } else if (!isFinite(amount)) {
    setError('errorAmount', 'txAmount', 'Amount is out of range.');
    valid = false;
  }

  if (!category) {
    setError('errorCategory', 'txCategory', 'Please select a category.');
    valid = false;
  }

  return valid;
}

function setError(errorId, inputId, msg) {
  const err = $(errorId);
  const inp = $(inputId);
  if (err) err.textContent = msg;
  if (inp) inp.classList.add('error');
}

function clearErrors() {
  ['errorTitle','errorAmount','errorCategory'].forEach(id => {
    const el = $(id);
    if (el) el.textContent = '';
  });
  document.querySelectorAll('.form-input.error').forEach(el => el.classList.remove('error'));
}

// ── Submit ────────────────────────────────────────────────────
async function handleSubmit(e) {
  e.preventDefault();
  if (!validateForm()) return;

  const type    = document.querySelector('input[name="type"]:checked').value;
  const title   = els.txTitle.value.trim();
  const amount  = parseFloat(parseFloat(els.txAmount.value).toFixed(2));
  const category= els.txCategory.value;
  const date    = els.txDate.value;
  const note    = els.txNote.value.trim();
  const editId  = els.txId.value ? parseInt(els.txId.value, 10) : null;

  try {
    if (editId) {
      const tx = { id: editId, type, title, amount, category, date, note, updatedAt: new Date().toISOString() };
      await dbUpdate(tx);
      const idx = transactions.findIndex(t => t.id === editId);
      if (idx !== -1) transactions[idx] = tx;
      showToast('Transaction updated ✓', 'success');
    } else {
      const tx = { type, title, amount, category, date, note, createdAt: new Date().toISOString() };
      const id = await dbAdd(tx);
      tx.id = id;
      transactions.unshift(tx);
      showToast('Transaction added ✓', 'success');
    }

    closeModal();
    render();
  } catch (err) {
    showToast('Something went wrong. Please try again.', 'error');
    console.error(err);
  }
}

// ── Delete ────────────────────────────────────────────────────
function openDeleteModal(id) {
  deleteTargetId = id;
  els.deleteOverlay.classList.add('open');
}

function closeDeleteModal() {
  deleteTargetId = null;
  els.deleteOverlay.classList.remove('open');
}

async function confirmDelete() {
  if (deleteTargetId == null) return;
  try {
    await dbDelete(deleteTargetId);
    transactions = transactions.filter(t => t.id !== deleteTargetId);
    closeDeleteModal();
    render();
    showToast('Transaction deleted.', 'info');
  } catch (err) {
    showToast('Failed to delete. Try again.', 'error');
    console.error(err);
  }
}

// ── Chart ─────────────────────────────────────────────────────
function switchChart(type) {
  currentChartType = type;
  $('btnPie').classList.toggle('active', type === 'pie');
  $('btnBar').classList.toggle('active', type === 'bar');
  $('btnPie').setAttribute('aria-pressed', type === 'pie');
  $('btnBar').setAttribute('aria-pressed', type === 'bar');
  renderChart();
}

function buildChartData() {
  const expenseMap = {};
  transactions
    .filter(t => t.type === 'expense')
    .forEach(t => {
      expenseMap[t.category] = (expenseMap[t.category] || 0) + t.amount;
    });

  const labels = Object.keys(expenseMap);
  const data   = labels.map(l => parseFloat(expenseMap[l].toFixed(2)));
  const colors = labels.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]);

  return { labels, data, colors };
}

function renderChart() {
  const { labels, data, colors } = buildChartData();
  const hasData = data.length > 0;

  els.chartEmpty.style.display = hasData ? 'none' : 'flex';
  els.expenseChart.style.display = hasData ? 'block' : 'none';

  if (!hasData) {
    if (chartInstance) { chartInstance.destroy(); chartInstance = null; }
    return;
  }

  const ctx = els.expenseChart.getContext('2d');

  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const isPie = currentChartType === 'pie';

  Chart.defaults.color = '#8891b4';
  Chart.defaults.font.family = "'Inter', sans-serif";

  chartInstance = new Chart(ctx, {
    type: isPie ? 'doughnut' : 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: isPie ? colors.map(c => c + 'cc') : colors.map(c => c + '99'),
        borderColor:      colors,
        borderWidth:      2,
        borderRadius:     isPie ? 0 : 8,
        hoverOffset:      isPie ? 10 : 0,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      animation: { duration: 600, easing: 'easeInOutQuart' },
      plugins: {
        legend: {
          display: isPie,
          position: 'bottom',
          labels: {
            padding: 14,
            boxWidth: 12,
            boxHeight: 12,
            borderRadius: 4,
            color: '#8891b4',
            font: { size: 12, weight: '500' },
          },
        },
        tooltip: {
          backgroundColor: '#1a1e35',
          borderColor: '#252a45',
          borderWidth: 1,
          padding: 12,
          titleFont: { size: 13, weight: '700' },
          bodyFont: { size: 13 },
          callbacks: {
            label: (ctx) => {
              const val = ctx.parsed;
              const total = ctx.dataset.data.reduce((a, b) => a + b, 0);
              const pct   = total > 0 ? ((isPie ? val : val.y) / total * 100).toFixed(1) : '0.0';
              const amt   = formatCurrency(isPie ? val : val.y);
              return `  ${amt}  (${pct}%)`;
            },
          },
        },
      },
      scales: isPie ? {} : {
        x: {
          grid: { color: '#252a45' },
          ticks: { color: '#8891b4', font: { size: 12 } },
        },
        y: {
          grid: { color: '#252a45' },
          ticks: {
            color: '#8891b4',
            font: { size: 12 },
            callback: (v) => formatCurrency(v),
          },
          beginAtZero: true,
        },
      },
    },
  });
}

// ── Summary Cards ─────────────────────────────────────────────
function renderSummary() {
  let income = 0, expense = 0;
  transactions.forEach(t => {
    if (t.type === 'income')  income  += t.amount;
    if (t.type === 'expense') expense += t.amount;
  });
  const balance = income - expense;

  // Animate numbers
  animateValue(els.totalIncome,    income);
  animateValue(els.totalExpenses,  expense);
  animateValue(els.netBalance,     balance);

  els.netBalance.className = 'card-amount ' +
    (balance > 0 ? 'balance-positive' : balance < 0 ? 'balance-negative' : '');
}

function animateValue(el, target) {
  const start   = parseFloat(el.dataset.current || '0');
  const duration = 700;
  const startTime = performance.now();

  function step(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3); // ease-out cubic
    const current = start + (target - start) * ease;
    el.textContent = formatCurrency(current);
    if (progress < 1) requestAnimationFrame(step);
    else {
      el.textContent = formatCurrency(target);
      el.dataset.current = String(target);
    }
  }
  requestAnimationFrame(step);
}

// ── Transaction List ──────────────────────────────────────────
function getCatInfo(type, category) {
  const list = CATEGORIES[type] || [];
  return list.find(c => c.name === category) || { name: category, emoji: '💳' };
}

function getFilteredTransactions() {
  const typeFilter = els.filterType.value;
  const catFilter  = els.filterCategory.value;
  return transactions.filter(t => {
    if (typeFilter !== 'all' && t.type !== typeFilter) return false;
    if (catFilter  !== 'all' && t.category !== catFilter) return false;
    return true;
  });
}

function renderTransactionList() {
  const filtered = getFilteredTransactions();
  const list     = els.txList;
  list.innerHTML = '';

  const total = transactions.length;
  els.txCount.textContent = `${total} ${total === 1 ? 'entry' : 'entries'}`;
  els.emptyState.style.display = total === 0 ? 'block' : 'none';

  filtered.forEach(tx => {
    const cat     = getCatInfo(tx.type, tx.category);
    const isInc   = tx.type === 'income';
    const bgColor = isInc ? 'rgba(34,211,160,0.12)' : 'rgba(240,98,146,0.12)';

    const li = document.createElement('li');
    li.className = 'tx-item';
    li.dataset.id = tx.id;
    li.innerHTML = `
      <div class="tx-cat-icon" style="background:${bgColor}">${cat.emoji}</div>
      <div class="tx-info">
        <div class="tx-title" title="${escHtml(tx.title)}">${escHtml(tx.title)}</div>
        <div class="tx-meta">${escHtml(tx.category)}${tx.date ? ' · ' + formatDate(tx.date) : ''}${tx.note ? ' · ' + escHtml(tx.note) : ''}</div>
      </div>
      <div class="tx-right">
        <span class="tx-amount ${tx.type}">${isInc ? '+' : '−'}${formatCurrency(tx.amount)}</span>
        <div class="tx-actions">
          <button class="tx-action-btn edit" title="Edit transaction" aria-label="Edit ${escHtml(tx.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
          </button>
          <button class="tx-action-btn delete" title="Delete transaction" aria-label="Delete ${escHtml(tx.title)}">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/><path d="M9 6V4h6v2"/></svg>
          </button>
        </div>
      </div>
    `;

    // Bind edit / delete buttons
    li.querySelector('.edit') .addEventListener('click', () => openModal(tx));
    li.querySelector('.delete').addEventListener('click', () => openDeleteModal(tx.id));

    list.appendChild(li);
  });
}

function escHtml(str) {
  return String(str)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Master Render ─────────────────────────────────────────────
function render() {
  renderSummary();
  renderTransactionList();
  renderChart();
}

// ── Toast ─────────────────────────────────────────────────────
let toastTimer;
function showToast(msg, type = 'info') {
  const t = els.toast;
  t.textContent = msg;
  t.className = `toast ${type} show`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 3000);
}

// ── Boot ──────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', init);
