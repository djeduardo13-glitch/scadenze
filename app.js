// App in localStorage: nessun backend, pienamente offline.
const STORAGE_KEY = 'family-documents-v1';
const ALERT_KEY = 'family-documents-last-monthly-check';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;

const form = document.getElementById('document-form');
const recordIdInput = document.getElementById('record-id');
const personInput = document.getElementById('person');
const docTypeInput = document.getElementById('docType');
const expiryDateInput = document.getElementById('expiryDate');
const notesInput = document.getElementById('notes');
const cancelEditBtn = document.getElementById('cancel-edit-btn');
const formTitle = document.getElementById('form-title');
const listEl = document.getElementById('documents-list');
const template = document.getElementById('document-item-template');
const countChip = document.getElementById('count-chip');
const emptyState = document.getElementById('empty-state');
const whatsappReportBtn = document.getElementById('whatsapp-report-btn');
const exportBtn = document.getElementById('export-btn');
const importFileInput = document.getElementById('import-file');
const monthlyAlertDialog = document.getElementById('monthly-alert');
const monthlyAlertText = document.getElementById('monthly-alert-text');
const closeAlertBtn = document.getElementById('close-alert-btn');

let documents = loadDocuments();

function saveDocuments() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(documents));
}

function loadDocuments() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    const parsed = data ? JSON.parse(data) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getStatus(expiryDate) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const expiry = new Date(expiryDate);
  expiry.setHours(0, 0, 0, 0);

  if (expiry < today) {
    return { label: '❌ Scaduto', className: 'status-expired', priority: 0 };
  }

  const diff = expiry.getTime() - today.getTime();
  if (diff <= SIX_MONTHS_MS) {
    return { label: '⚠️ In scadenza (<6 mesi)', className: 'status-warning', priority: 1 };
  }

  return { label: '✅ Valido', className: 'status-valid', priority: 2 };
}

function sortDocuments(items) {
  return [...items].sort((a, b) => new Date(a.expiryDate) - new Date(b.expiryDate));
}

function renderDocuments() {
  const sorted = sortDocuments(documents);
  listEl.innerHTML = '';

  sorted.forEach((doc) => {
    const node = template.content.firstElementChild.cloneNode(true);
    const status = getStatus(doc.expiryDate);

    node.dataset.id = doc.id;
    node.querySelector('.item-person').textContent = doc.person;
    node.querySelector('.item-document').textContent = `Documento: ${doc.docType}`;
    node.querySelector('.item-date').textContent = `Scadenza: ${formatDate(doc.expiryDate)}`;

    const notesNode = node.querySelector('.item-notes');
    if (doc.notes?.trim()) {
      notesNode.textContent = `Note: ${doc.notes}`;
    } else {
      notesNode.remove();
    }

    const statusNode = node.querySelector('.status-pill');
    statusNode.textContent = status.label;
    statusNode.classList.add(status.className);

    node.querySelector('.edit-btn').addEventListener('click', () => startEdit(doc.id));
    node.querySelector('.delete-btn').addEventListener('click', () => deleteRecord(doc.id));

    listEl.appendChild(node);
  });

  countChip.textContent = `${documents.length} ${documents.length === 1 ? 'elemento' : 'elementi'}`;
  emptyState.classList.toggle('hidden', documents.length > 0);
}

function formatDate(dateString) {
  return new Intl.DateTimeFormat('it-IT').format(new Date(dateString));
}

function resetForm() {
  form.reset();
  recordIdInput.value = '';
  formTitle.textContent = 'Nuovo documento';
  cancelEditBtn.classList.add('hidden');
}

function startEdit(id) {
  const doc = documents.find((entry) => entry.id === id);
  if (!doc) return;

  recordIdInput.value = doc.id;
  personInput.value = doc.person;
  docTypeInput.value = doc.docType;
  expiryDateInput.value = doc.expiryDate;
  notesInput.value = doc.notes || '';
  formTitle.textContent = 'Modifica documento';
  cancelEditBtn.classList.remove('hidden');
  personInput.focus();
}

function deleteRecord(id) {
  const confirmed = window.confirm('Confermi l\'eliminazione del documento?');
  if (!confirmed) return;

  documents = documents.filter((entry) => entry.id !== id);
  saveDocuments();
  renderDocuments();
}

function upsertRecord(event) {
  event.preventDefault();

  if (!form.reportValidity()) return;

  const payload = {
    id: recordIdInput.value || crypto.randomUUID(),
    person: personInput.value.trim(),
    docType: docTypeInput.value.trim(),
    expiryDate: expiryDateInput.value,
    notes: notesInput.value.trim(),
  };

  const existingIndex = documents.findIndex((entry) => entry.id === payload.id);
  if (existingIndex >= 0) {
    documents[existingIndex] = payload;
  } else {
    documents.push(payload);
  }

  saveDocuments();
  renderDocuments();
  resetForm();
}

function generateReportText() {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const expiring = sortDocuments(documents).filter((doc) => {
    const expiry = new Date(doc.expiryDate);
    expiry.setHours(0, 0, 0, 0);
    const diff = expiry.getTime() - today.getTime();
    return diff <= SIX_MONTHS_MS;
  });

  if (expiring.length === 0) {
    return 'Report scadenze familiari:\nNessun documento in scadenza nei prossimi 6 mesi ✅';
  }

  const lines = expiring.map((doc, index) => {
    const status = getStatus(doc.expiryDate).label;
    return `${index + 1}. ${doc.person} - ${doc.docType} - ${formatDate(doc.expiryDate)} (${status})`;
  });

  return `Report scadenze familiari (prossimi 6 mesi):\n${lines.join('\n')}`;
}

function sendWhatsappReport() {
  const report = generateReportText();
  const encoded = encodeURIComponent(report);
  window.location.href = `https://wa.me/?text=${encoded}`;
}

function exportAsJson() {
  const blob = new Blob([JSON.stringify(documents, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `scadenze-famiglia-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importFromJson(event) {
  const [file] = event.target.files;
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!Array.isArray(parsed)) throw new Error('Formato non valido');

      // Validazione minima dei campi per evitare dati corrotti.
      const normalized = parsed
        .filter((item) => item.person && item.docType && item.expiryDate)
        .map((item) => ({
          id: item.id || crypto.randomUUID(),
          person: String(item.person),
          docType: String(item.docType),
          expiryDate: String(item.expiryDate),
          notes: item.notes ? String(item.notes) : '',
        }));

      documents = normalized;
      saveDocuments();
      renderDocuments();
      window.alert('Importazione completata con successo.');
    } catch {
      window.alert('File JSON non valido.');
    } finally {
      importFileInput.value = '';
    }
  };

  reader.readAsText(file);
}

function maybeShowMonthlyAlert() {
  const now = Date.now();
  const lastCheck = Number(localStorage.getItem(ALERT_KEY) || 0);
  const oneMonthMs = 1000 * 60 * 60 * 24 * 30;

  if (now - lastCheck < oneMonthMs) return;

  const upcoming = sortDocuments(documents).filter((doc) => {
    const status = getStatus(doc.expiryDate);
    return status.priority < 2;
  });

  localStorage.setItem(ALERT_KEY, String(now));

  if (upcoming.length === 0) return;

  const message = upcoming
    .slice(0, 5)
    .map((doc) => `• ${doc.person} - ${doc.docType} (${formatDate(doc.expiryDate)})`)
    .join('\n');

  monthlyAlertText.textContent = `Hai ${upcoming.length} documento/i da controllare:\n${message}`;

  if (typeof monthlyAlertDialog.showModal === 'function') {
    monthlyAlertDialog.showModal();
  } else {
    window.alert(monthlyAlertText.textContent);
  }
}

closeAlertBtn.addEventListener('click', () => monthlyAlertDialog.close());
form.addEventListener('submit', upsertRecord);
cancelEditBtn.addEventListener('click', resetForm);
whatsappReportBtn.addEventListener('click', sendWhatsappReport);
exportBtn.addEventListener('click', exportAsJson);
importFileInput.addEventListener('change', importFromJson);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('service-worker.js').catch(() => {
      // Ignore in local environments where SW can't be registered.
    });
  });
}

renderDocuments();
maybeShowMonthlyAlert();
