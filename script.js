pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

let currentTool = null;
let selectedFiles = [];
const pdfFileInput = document.getElementById('pdfFileInput');
const pdfContainer = document.getElementById('pdfContainer');
const tooltip = document.getElementById('translationTooltip');
const translationText = document.getElementById('translationText');

function showHome() {
  document.getElementById('homePage').classList.remove('hidden');
  document.getElementById('viewerPage').classList.add('hidden');
  document.getElementById('toolModal').classList.add('hidden');
  tooltip.classList.add('hidden');
}

function openViewer() {
  document.getElementById('homePage').classList.add('hidden');
  document.getElementById('viewerPage').classList.remove('hidden');
}

pdfFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  pdfContainer.innerHTML = '<p class="placeholder-text" style="color:#fff;">جاري تحميل الملف...</p>';
  
  const fileReader = new FileReader();
  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    try {
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      pdfContainer.innerHTML = ''; 
      
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); 
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.style.width = viewport.width + 'px';
        pageWrapper.style.height = viewport.height + 'px';
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        pageWrapper.appendChild(canvas);
        
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        pageWrapper.appendChild(textLayerDiv);
        pdfContainer.appendChild(pageWrapper);

        await page.render({ canvasContext: context, viewport: viewport }).promise;

        const textContent = await page.getTextContent();
        pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
          textDivs: []
        });
      }
    } catch (error) {
      pdfContainer.innerHTML = '<p class="placeholder-text" style="color:#ff6b6b;">حدث خطأ في قراءة الملف.</p>';
    }
  };
  fileReader.readAsArrayBuffer(file);
});

async function translateText(text) {
  tooltip.classList.remove('hidden');
  translationText.textContent = 'جاري الترجمة...';
  
  try {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
    const response = await fetch(url);
    const data = await response.json();
    
    if(data.responseData && data.responseData.translatedText) {
      translationText.textContent = data.responseData.translatedText;
    } else {
      translationText.textContent = 'لم يتم العثور على ترجمة.';
    }
  } catch (error) {
    translationText.textContent = 'حدث خطأ أثناء الترجمة.';
  }
}

function closeTooltip() {
  tooltip.classList.add('hidden');
}

document.addEventListener('mouseup', (e) => {
  if (document.getElementById('viewerPage').classList.contains('hidden')) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 2 && /^[A-Za-z\s\.,!'"-?]+$/.test(selectedText)) {
    const range = selection.getRangeAt(0).getBoundingClientRect();
    tooltip.style.left = `${range.left + window.scrollX}px`;
    tooltip.style.top = `${range.bottom + window.scrollY + 10}px`;
    translateText(selectedText);
  } else {
    if (!e.target.closest('.translation-tooltip')) closeTooltip();
  }
});

function openTool(tool) {
  currentTool = tool;
  selectedFiles = [];
  const titles = { merge: '🔗 دمج ملفات PDF', split: '✂️ تقسيم PDF', compress: '🗜️ ضغط PDF', images: '🖼️ تحويل صور إلى PDF' };
  document.getElementById('modalTitle').textContent = titles[tool];
  document.getElementById('fileInput').value = '';
  document.getElementById('fileInput').accept = tool === 'images' ? 'image/*' : 'application/pdf';
  document.getElementById('fileInput').multiple = (tool !== 'split' && tool !== 'compress');
  document.getElementById('fileList').innerHTML = '';
  document.getElementById('status').className = 'status';
  document.getElementById('processBtn').disabled = true;
  document.getElementById('toolModal').classList.remove('hidden');
}

function closeTool() {
  document.getElementById('toolModal').classList.add('hidden');
}

document.addEventListener('DOMContentLoaded', () => {
  const fileInput = document.getElementById('fileInput');
  const processBtn = document.getElementById('processBtn');

  fileInput.addEventListener('change', (e) => {
    const files = Array.from(e.target.files);
    const accept = fileInput.accept;
    const valid = files.filter(f => accept === 'image/*' ? f.type.startsWith('image/') : f.type === 'application/pdf');
    
    if (currentTool === 'split' || currentTool === 'compress') {
      selectedFiles = valid.slice(0, 1);
    } else {
      selectedFiles.push(...valid);
    }
    
    const list = document.getElementById('fileList');
    list.innerHTML = '';
    selectedFiles.forEach((file, i) => {
      const li = document.createElement('li');
      li.innerHTML = `<span>${file.name} <small>(${(file.size/1024).toFixed(0)} KB)</small></span>`;
      const btn = document.createElement('button');
      btn.innerHTML = '<i class="fa-solid fa-xmark" style="color:red; background:none; border:none; font-size:1.2rem; cursor:pointer;"></i>';
      btn.onclick = () => { selectedFiles.splice(i, 1); fileInput.dispatchEvent(new Event('change')); };
      li.appendChild(btn);
      list.appendChild(li);
    });
    processBtn.disabled = selectedFiles.length === 0;
  });

  processBtn.addEventListener('click', async () => {
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
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = 'output.pdf'; a.click();
        status.className = 'status success';
        status.textContent = '✅ تم! جارٍ تنزيل الملف...';
      }
    } catch (err) {
      status.className = 'status error';
      status.textContent = '❌ حدث خطأ: ' + err.message;
    }
  });
});

async function mergePDFs(files) {
  const { PDFDocument } = PDFLib;
  const merged = await PDFDocument.create();
  for (const file of files) {
    const pdf = await PDFDocument.load(await file.arrayBuffer());
    const pages = await merged.copyPages(pdf, pdf.getPageIndices());
    pages.forEach(p => merged.addPage(p));
  }
  return new Blob([await merged.save()], { type: 'application/pdf' });
}

async function imagesToPDF(files) {
  const { PDFDocument } = PDFLib;
  const doc = await PDFDocument.create();
  for (const file of files) {
    const bytes = await file.arrayBuffer();
    let img = file.type === 'image/png' ? await doc.embedPng(bytes) : await doc.embedJpg(bytes);
    const page = doc.addPage([img.width, img.height]);
    page.drawImage(img, { x: 0, y: 0, width: img.width, height: img.height });
  }
  return new Blob([await doc.save()], { type: 'application/pdf' });
}

async function splitPDF(file) {
  const { PDFDocument } = PDFLib;
  const src = await PDFDocument.load(await file.arrayBuffer());
  const mid = Math.floor(src.getPageCount() / 2);
  const part1 = await PDFDocument.create();
  (await part1.copyPages(src, src.getPageIndices().slice(0, mid))).forEach(p => part1.addPage(p));
  const url = URL.createObjectURL(new Blob([await part1.save()], { type: 'application/pdf' }));
  const a = document.createElement('a'); a.href = url; a.download = 'part1.pdf'; a.click();
  
  const part2 = await PDFDocument.create();
  (await part2.copyPages(src, src.getPageIndices().slice(mid))).forEach(p => part2.addPage(p));
  return new Blob([await part2.save()], { type: 'application/pdf' });
}

async function compressPDF(file) {
  const { PDFDocument } = PDFLib;
  const pdf = await PDFDocument.load(await file.arrayBuffer());
  return new Blob([await pdf.save({ useObjectStreams: true })], { type: 'application/pdf' });
}
