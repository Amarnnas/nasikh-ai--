import { GoogleGenAI } from "@google/genai";
import { OcrMode } from "../types";

const ai = new GoogleGenAI({
  apiKey: process.env.API_KEY || process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      const base64Data = base64String.split(',')[1];
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const extractTextFromImage = async (
  file: File, 
  mode: OcrMode
): Promise<string> => {
  try {
    const base64Data = await fileToGenerativePart(file);

    let prompt = "Extract all text from this file exactly as it appears. Return only the text. Do not use any HTML tags.";
    
    if (mode === OcrMode.Formatting) {
      prompt = `
        You are an advanced OCR engine. 
        Task: Extract all text from this document while strictly preserving the visual structure and formatting.
        Instructions:
        1. Use Markdown for headings (# ## ###), lists, bold, and italics.
        2. VERY IMPORTANT: If you see a TABLE, you MUST represent it as a standard Markdown table (e.g., | col1 | col2 |). Ensure columns align.
        3. Do not summarize or explain. Output ONLY the extracted content.
        4. Do NOT use any HTML tags (e.g., <div>, <center>, <span dir="rtl">).
        5. For Arabic text, maintain a logical reading order.
        6. Return raw Markdown text without wrapping it in markdown code blocks unless it's actual code.
      `;
    } else if (mode === OcrMode.Educational) {
      prompt = `
أنت خبير محترف ومتميز في تحليل واستخراج النصوص من المستندات العربية التعليمية والمدرسية.

المطلوب بدقة:
1. اقرأ الصورة أو الملف كاملاً بدقة عالية جداً دون إغفال أي تفاصيل.
2. استخرج جميع النصوص العربية والإنجليزية المكتوبة بخط اليد والمطبوعة.
3. حافظ على الترتيب الأصلي للصفحة بدقة تامة.
4. حلل تخطيط الصفحة (Layout) بذكاء وعناية قبل استخراج النص.
5. إذا كانت الصفحة مقسومة إلى أعمدة أو جداول أو أقسام، فحافظ على نفس التقسيم والتخطيط تماماً ولا تدمجهما.
6. عند وجود عمودين أو جانبين منفصلين، أخرج النتيجة بصيغة جدول Markdown (ليتم تحويله مباشرة وعرضه كجدول Word):
   - العمود الأيمن = محتوى الجانب الأيمن من الصفحة كاملاً.
   - العمود الأيسر = محتوى الجانب الأيسر من الصفحة كاملاً.
7. لا تقم أبداً بدمج نصوص الأعمدة المنفصلة مع بعضها البعض.
8. صحح أخطاء القراءة الآلية (OCR) الإملائية الواضحة فقط إذا كنت متأكداً بنسبة عالية جداً ودون أي تغيير في المعنى الأصلي للمحتوى.
9. احتفظ بترقيم وحروف جميع الأسئلة، الفقرات، الدرجات، والعلامات والرموز المذكورة.
10. استخدم تنسيق Markdown قياسي ونظيف ومباشر يمكن تحويله مباشرة لملف Word.

صيغة الإخراج المطلوبة والملزمة:

# بيانات المستند
العنوان: [العنوان المستخرج، في حال عدم وجوده اكتب غير محدد]
الجهة: [الجهة المستخرجة مثل المدرسة أو الوزارة، في حال عدم وجودها اكتب غير محدد]
الصف: [الصف المستخرج، في حال عدم وجوده اكتب غير محدد]

# محتوى الصفحة

| العمود الأيمن | العمود الأيسر |
|--------------|---------------|
| النص المستخرج من العمود الأيمن كاملاً | النص المستخرج من العمود الأيسر كاملاً |

إذا لم يكن هناك عمودين أو جداول ثنائية، يمكنك سرد النص مباشرة بتنسيق Markdown قياسي منظم بنفس هيكلية المستند الأصلي دون جدول العمودين.

ملاحظات هامة جداً:
- حافظ على الأسطر والفقرات كما هي في المستند الأصلي.
- حافظ على الفراغات المخصصة لإجابات الطلاب، مثل النقط المتتالية (........) أو الأقواس الفارغة (  ).
- لا تلخص أو تعدل المحتوى التعليمي بأي شكل.
- لا تقدم أي شروحات أو تلميحات أو توضيحات إضافية.
- لا تضف أي جمل ترحيبية أو تمهيدية أو خاتمة؛ أخرج النص المستخرج فقط طبقاً للصيغة المحددة.
- لا تستخدم أي وسوم HTML كـ <div> أو <span> أو <p> أو غيرها.
      `;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.5-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: file.type,
              data: base64Data
            }
          },
          { text: prompt }
        ]
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("لم يتم توليد نص من الذكاء الاصطناعي.");
    }

    let cleanedText = text;
    const tagsToRemove = ['div', 'center', 'span', 'p', 'html', 'body', 'head', 'table', 'tr', 'td', 'th', 'thead', 'tbody'];
    tagsToRemove.forEach(tag => {
        const regex = new RegExp(`<${tag}[^>]*>|<\/${tag}>`, 'gi');
        cleanedText = cleanedText.replace(regex, '');
    });

    cleanedText = cleanedText
        .replace(/^```markdown\s*/i, '')
        .replace(/^```\s*/i, '')
        .replace(/```$/i, '');

    return cleanedText;

  } catch (error: any) {
    console.error("Gemini OCR Error:", error);
    throw new Error(error.message || "فشلت عملية معالجة الملف");
  }
};