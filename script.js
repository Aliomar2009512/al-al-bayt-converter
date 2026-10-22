let currentTool = null;
let selectedFiles = [];

function openTool(tool) {
  currentTool = tool;
  selectedFiles = [];

  const titles = {
    merge: '🔗 دمج ملفات PDF',
    split: '✂️ تقسيم PDF',
    compress: '🗜️ ضغط PDF',
    images: '🖼️ تحويل صور إلى PDF'
  };
  document.getElementById('modalTitle').textContent = titles[tool] || 'أداة';
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInput').accept =
    tool === 'images' ? 'image/*' : 'application/pdf';
  document.getElementById('fileInput').multiple = (tool !== 'split' && tool !== 'compress');
  document.getElementById('fileList').innerHTML = '';
  document.getElementById('status').textContent = '';
  document.getElementById('status').className = 'status';
  document.getElementById('processBtn').disabled = true;
  document.getElementById('toolModal').classList.remove('hidden');
}

function closeTool() {
  document.getElementById('toolModal').classList.add('hidden');
  currentTool = null;
  selectedFiles = [];
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const dropZone = document.getElementById('dropZone');
  const processBtn = document.getElementById('processBtn');

  fileInput.addEventListener('change', (e) => {
    addFiles(Array.from(e.target.files));
  });

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
  });
  dropZone.addEventListener('dragleave', () => dropZone.classList.remove('dragover'));
  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    addFiles(Array.from(e.dataTransfer.files));
  });

  processBtn.addEventListener('click', processFiles);
});

function addFiles(files) {
  const accept = document.getElementById('fileInput').accept;
  const valid = files.filter(f => {
    if (accept === 'image/*') return f.type.startsWith('image/');
    return f.type === 'application/pdf';
  });

  if (currentTool === 'split' || currentTool === 'compress') {
    selectedFiles = valid.slice(0, 1);
  } else {
    selectedFiles.push(...valid);
  }

  renderFileList();
}

function renderFileList() {
  const list = document.getElementById('fileList');
  list.innerHTML = '';
  selectedFiles.forEach((file, i) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${file.name} <small>(${(file.size/1024).toFixed(0)} KB)</small></span>`;
    const btn = document.createElement('button');
    btn.textContent = '✕';
    btn.onclick = () => {
      selectedFiles.splice(i, 1);
      renderFileList();
    };
    li.appendChild(btn);
    list.appendChild(li);
  });
  document.getElementById('processBtn').disabled = selectedFiles.length === 0;
}

async function processFiles() {
  const status = document.getElementById('status');
  status.className = 'status info';
  status.textContent = '⏳ جارٍ المعالجة...';

  try {
    let blob;
    if (currentTool === 'merge') blob = await mergePDFs(selectedFiles);
    else if (currentTool === 'images') blob = await imagesToPDF(selectedFiles);
    else if (currentTool === 'split') blob = await splitPDF(selectedFiles[0]);
    else if (currentTool === 'compress') blob = await compressPDF(selectedFiles[0]);

    if (blob) {
      downloadBlob(blob, outputName());
      status.className = 'status success';
      status.textContent = '✅ تم! جارٍ تنزيل الملف...';
    }
  } catch (err) {
    console.error(err);
    status.className = 'status error';
    status.textContent = '❌ حدث خطأ: ' + err.message;
  }
}

function outputName() {
  const names = {
    merge: 'merged.pdf',
    split: 'split.pdf',
    compress: 'compressed.pdf',
    images: 'images.pdf'
  };
  return names[currentTool] || 'output.pdf';
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function mergePDFs(files) {
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    const pdf = await PDFDocument.load(bytes);
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  const bytes = await merged.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function imagesToPDF(files) {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();

  for (const file of files) {
    const bytes = await file.arrayBuffer();
    let img;
    if (file.type === 'image/png') img = await doc.embedPng(bytes);
    else if (file.type === 'image/jpeg' || file.type === 'image/jpg') img = await doc.embedJpg(bytes);
    else throw new Error('الصيغة غير مدعومة: ' + file.type);

    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  const bytes = await doc.save();
  return new Blob([bytes], { type: 'application/pdf' });
}

async function splitPDF(file) {
  const { PDFDocument } = PDFLib;
  const bytes = await file.arrayBuffer();
  const src = await PDFDocument.load(bytes);
  const total = src.getPageCount();

  if (total < 2) throw new Error('الملف يحتوي على صفحة واحدة فقط.');

  const mid = Math.floor(total / 2);

  const part1 = await PDFDocument.create();
  const p1 = await part1.copyPages(src, src.getPageIndices().slice(0, mid));
  p1.forEach(p => part1.addPage(p));
  const b1 = await part1.save();
  downloadBlob(new Blob([b1], { type: 'application/pdf' }), 'part1.pdf');

  const part2 = await PDFDocument.create();
  const p2 = await part2.copyPages(src, src.getPageIndices().slice(mid));
  p2.forEach(p => part2.addPage(p));
  const b2 = await part2.save();

  return new Blob([b2], { type: 'application/pdf' });
}

async function compressPDF(file) {
  const { PDFDocument } = PDFLib;
  const bytes = await file.arrayBuffer();
  const pdf = await PDFDocument.load(bytes);

  const compressed = await pdf.save({
    useObjectStreams: true,
    addDefaultPage: false,
  });

  return new Blob([compressed], { type: 'application/pdf' });
}