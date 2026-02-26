// =======================
// FIREBASE CONFIG
// =======================

const firebaseConfig = {
  apiKey: "AIzaSyDtpVwu8uXsduApLrzn1aLWYzNv46FtBus",
  authDomain: "scadenze-famiglia.firebaseapp.com",
  databaseURL: "https://scadenze-famiglia-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "scadenze-famiglia",
  storageBucket: "scadenze-famiglia.firebasestorage.app",
  messagingSenderId: "835311360238",
  appId: "1:835311360238:web:5e0a59a66ab1109e7a7bff"
};

firebase.initializeApp(firebaseConfig);

const db = firebase.database();
const docsRef = db.ref("documenti");


// =======================
// LOCAL STORAGE BACKUP
// =======================

const STORAGE_KEY = 'family-documents-v1';
const ALERT_KEY = 'family-documents-last-monthly-check';
const SIX_MONTHS_MS = 1000 * 60 * 60 * 24 * 30 * 6;


// =======================
// ELEMENTI UI
// =======================

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


// =======================
// STATO APP
// =======================

let documents = loadDocuments();


// =======================
// FIREBASE REALTIME SYNC
// =======================

docsRef.on("value", snapshot => {

  const data = snapshot.val();

  if (data) {
    documents = Object.values(data);

    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify(documents)
    );

    renderDocuments();
  }

});


// =======================
// STORAGE
// =======================

function saveDocuments() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(documents)
  );

  // sync cloud
  const obj = {};
  documents.forEach(doc => obj[doc.id] = doc);

  docsRef.set(obj);
}

function loadDocuments() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
}


// =======================
// LOGICA DOCUMENTI
// =======================

function upsertRecord(e) {

  e.preventDefault();

  const payload = {
    id: recordIdInput.value || crypto.randomUUID(),
    person: personInput.value.trim(),
    docType: docTypeInput.value.trim(),
    expiryDate: expiryDateInput.value,
    notes: notesInput.value.trim()
  };

  const index = documents.findIndex(d => d.id === payload.id);

  if (index >= 0)
    documents[index] = payload;
  else
    documents.push(payload);

  saveDocuments();
  resetForm();
}

function deleteRecord(id) {

  if (!confirm("Eliminare documento?")) return;

  documents = documents.filter(d => d.id !== id);

  saveDocuments();
}

function resetForm() {
  form.reset();
  recordIdInput.value = '';
}


// =======================
// RENDER
// =======================

function renderDocuments() {

  listEl.innerHTML = '';

  documents
    .sort((a,b)=>new Date(a.expiryDate)-new Date(b.expiryDate))
    .forEach(doc => {

      const node =
        template.content.firstElementChild.cloneNode(true);

      node.querySelector('.item-person').textContent =
        doc.person;

      node.querySelector('.item-document').textContent =
        doc.docType;

      node.querySelector('.item-date').textContent =
        new Date(doc.expiryDate)
          .toLocaleDateString("it-IT");

      node.querySelector('.edit-btn')
        .onclick = () => startEdit(doc.id);

      node.querySelector('.delete-btn')
        .onclick = () => deleteRecord(doc.id);

      listEl.appendChild(node);
    });

  countChip.textContent =
    `${documents.length} elementi`;
}


// =======================
// EDIT
// =======================

function startEdit(id){

  const doc =
    documents.find(d=>d.id===id);

  if(!doc) return;

  recordIdInput.value=doc.id;
  personInput.value=doc.person;
  docTypeInput.value=doc.docType;
  expiryDateInput.value=doc.expiryDate;
  notesInput.value=doc.notes;
}


// =======================
// WHATSAPP REPORT
// =======================

function sendWhatsappReport(){

  const text = documents.map(d =>
    `${d.person} - ${d.docType} - ${
      new Date(d.expiryDate)
      .toLocaleDateString("it-IT")
    }`
  ).join("\n");

  window.location.href =
    "https://wa.me/?text=" +
    encodeURIComponent(text);
}


// =======================
// EVENTI
// =======================

form.addEventListener('submit', upsertRecord);
whatsappReportBtn.addEventListener(
  'click',
  sendWhatsappReport
);


// =======================
// SERVICE WORKER
// =======================

if ('serviceWorker' in navigator) {
  navigator.serviceWorker
    .register('service-worker.js');
}

renderDocuments();