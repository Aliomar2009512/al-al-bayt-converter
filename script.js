// ... (احتفظ بكل الكود السابق الخاص بالدمج والتقسيم والضغط في أعلى الملف) ...

/* ========================================================
   الكود الجديد الخاص بقارئ وترجمة PDF
   ======================================================== */

// إعداد مسار العامل الخاص بـ PDF.js (ضروري لعمل المكتبة)
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

const pdfFileInput = document.getElementById('pdfFileInput');
const pdfContainer = document.getElementById('pdfContainer');
const tooltip = document.getElementById('translationTooltip');
const translationText = document.getElementById('translationText');

// التبديل بين الصفحات
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

// أحداث قارئ PDF
pdfFileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (!file) return;

  pdfContainer.innerHTML = '<p class="placeholder-text" style="color:#fff;">جاري تحميل الملف...</p>';
  
  const fileReader = new FileReader();
  fileReader.onload = async function() {
    const typedarray = new Uint8Array(this.result);
    try {
      const pdf = await pdfjsLib.getDocument(typedarray).promise;
      pdfContainer.innerHTML = ''; // مسح النص الترحيبي
      
      // عرض كل صفحة
      for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: 1.5 }); // تكبير الصفحة قليلاً
        
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'pdf-page-wrapper';
        pageWrapper.style.width = viewport.width + 'px';
        pageWrapper.style.height = viewport.height + 'px';
        
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;
        pageWrapper.appendChild(canvas);
        
        // طبقة النصوص (لتحديد النص)
        const textLayerDiv = document.createElement('div');
        textLayerDiv.className = 'textLayer';
        pageWrapper.appendChild(textLayerDiv);
        
        pdfContainer.appendChild(pageWrapper);

        // رسم الصفحة
        await page.render({ canvasContext: context, viewport: viewport }).promise;

        // استخراج النصوص
        const textContent = await page.getTextContent();
        pdfjsLib.renderTextLayer({
          textContentSource: textContent,
          container: textLayerDiv,
          viewport: viewport,
          textDivs: []
        });
      }
    } catch (error) {
      console.error("خطأ في تحميل PDF:", error);
      pdfContainer.innerHTML = '<p class="placeholder-text" style="color:#ff6b6b;">حدث خطأ في قراءة الملف. تأكد أنه ملف PDF سليم.</p>';
    }
  };
  fileReader.readAsArrayBuffer(file);
});

// دالة ترجمة النص
async function translateText(text) {
  tooltip.classList.remove('hidden');
  translationText.textContent = 'جاري الترجمة...';
  
  try {
    // استخدام API مجاني للترجمة
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=en|ar`;
    const response = await fetch(url);
    const data = await response.json();
    
    if(data.responseData && data.responseData.translatedText) {
      translationText.textContent = data.responseData.translatedText;
    } else {
      translationText.textContent = 'لم يتم العثور على ترجمة.';
    }
  } catch (error) {
    translationText.textContent = 'حدث خطأ أثناء الاتصال بمترجم جوجل.';
  }
}

function closeTooltip() {
  tooltip.classList.add('hidden');
}

// حدث عند تحديد نص في صفحة الـ PDF
document.addEventListener('mouseup', (e) => {
  // إذا لم نكن في صفحة القارئ، لا تفعل شيئاً
  if (document.getElementById('viewerPage').classList.contains('hidden')) return;

  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  // إذا كان هناك نص محدد (أكثر من حرفين) بالإنجليزية
  if (selectedText.length > 2 && /^[A-Za-z\s\.,!'"-?]+$/.test(selectedText)) {
    // احسب مكان الماوس لإظهار الترجمة تحته
    const range = selection.getRangeAt(0).getBoundingClientRect();
    
    // ضبط مكان المربع (تحت النص المحدد بقليل)
    tooltip.style.left = `${range.left + window.scrollX}px`;
    tooltip.style.top = `${range.bottom + window.scrollY + 10}px`;
    
    translateText(selectedText);
  } else {
    // إذا تم النقر في مكان فارغ، نخفي الترجمة
    if (!e.target.closest('.translation-tooltip')) {
      closeTooltip();
    }
  }
});
