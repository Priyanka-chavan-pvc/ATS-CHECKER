// ATS Checker — Client-side logic

// Utility: simple debounce
function debounce(fn, delay = 300) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), delay);
  };
}

// Tabs
const tabs = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".tab-panel");
tabs.forEach((tab) => {
  tab.addEventListener("click", () => {
    tabs.forEach(t => t.classList.remove("active"));
    tab.classList.add("active");
    const id = tab.dataset.tab;
    panels.forEach(p => {
      const match = p.id === `tab-${id}`;
      p.hidden = !match;
      if (match) p.classList.add("active"); else p.classList.remove("active");
    });
  });
});

// Elements
const resumeFileInput = document.getElementById("resume-file");
const resumeTextDetected = document.getElementById("resume-text");
const resumeTextManual = document.getElementById("resume-text-manual");
const btnExtract = document.getElementById("btn-extract");
const btnClearResume = document.getElementById("btn-clear-resume");
const btnSaveText = document.getElementById("btn-save-text");
const btnUsePasted = document.getElementById("btn-use-pasted");
const btnClearPasted = document.getElementById("btn-clear-pasted");
const jobDesc = document.getElementById("job-desc");
const btnSampleJD = document.getElementById("btn-sample-jd");
const btnAnalyze = document.getElementById("btn-analyze");

const resultsCard = document.getElementById("results");
const scoreRing = document.getElementById("score-ring");
const scoreNumber = document.getElementById("score-number");
const keywordsHit = document.getElementById("keywords-hit");
const keywordsMiss = document.getElementById("keywords-miss");
const checksList = document.getElementById("checks-list");
const suggestionsList = document.getElementById("suggestions");
const btnCopySummary = document.getElementById("btn-copy-summary");
const btnDownloadJSON = document.getElementById("btn-download-json");
const btnExportPDF = document.getElementById("btn-export-pdf");

// Configure pdf.js worker
document.addEventListener("DOMContentLoaded", () => {
  if (window["pdfjsLib"]) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.2.67/pdf.worker.min.js";
  }
});

// ---- Sample JD ----
const SAMPLE_JD = `We are seeking a Front-End Developer with 2+ years experience.
Responsibilities:
- Build responsive UIs with HTML, CSS, JavaScript and React
- Collaborate with designers and backend engineers
- Optimize performance and accessibility
Requirements:
- Proficiency with React, TypeScript, and modern CSS (Flexbox, Grid)
- Experience with REST APIs, Git, and testing (Jest)
- Bonus: Next.js, Tailwind, CI/CD (GitHub Actions)
`;

btnSampleJD.addEventListener("click", () => {
  jobDesc.value = SAMPLE_JD;
});

// ---- File extraction ----
async function extractTextFromPDF(file) {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  let text = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const strings = content.items.map(item => item.str);
    text += strings.join(" ") + "\n";
  }
  return text;
}

async function extractTextFromDocx(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.extractRawText({ arrayBuffer });
  return result.value || "";
}

btnExtract.addEventListener("click", async () => {
  const file = resumeFileInput.files?.[0];
  if (!file) {
    alert("Please choose a resume file first.");
    return;
  }
  try {
    let text = "";
    if (file.name.toLowerCase().endsWith(".pdf")) {
      text = await extractTextFromPDF(file);
    } else if (file.name.toLowerCase().endsWith(".docx")) {
      text = await extractTextFromDocx(file);
    } else {
      alert("Unsupported file type. Please use PDF or DOCX.");
      return;
    }
    resumeTextDetected.value = cleanWhitespace(text);
  } catch (err) {
    console.error(err);
    alert("Couldn't extract text from the file. If it's a scanned PDF, try pasting the text manually.");
  }
});

btnClearResume.addEventListener("click", () => {
  resumeTextDetected.value = "";
  resumeFileInput.value = "";
});

btnSaveText.addEventListener("click", () => {
  const blob = new Blob([resumeTextDetected.value || ""], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "resume_extracted.txt";
  a.click();
  URL.revokeObjectURL(url);
});

btnUsePasted.addEventListener("click", () => {
  resumeTextDetected.value = resumeTextManual.value;
  tabs.forEach(t => {
    if (t.dataset.tab === "upload") t.click();
  });
});
btnClearPasted.addEventListener("click", () => {
  resumeTextManual.value = "";
});

// ---- Analysis ----
btnAnalyze.addEventListener("click", () => analyze());

function analyze() {
  const resume = (resumeTextDetected.value || "").trim();
  const jd = (jobDesc.value || "").trim();
  if (!resume) { alert("Please provide resume text (upload or paste)."); return; }
  if (!jd) { alert("Please paste the job description."); return; }

  const res = runATS(resume, jd);

  // Populate UI
  animateScore(res.score);
  renderKeywords(res.keywordsHit, res.keywordsMiss);
  renderChecks(res.checks);
  renderSuggestions(res.suggestions);

  resultsCard.hidden = false;
}

function animateScore(score) {
  const pct = Math.round(score);
  scoreNumber.textContent = pct;
  scoreRing.style.setProperty("--p", pct);
  scoreRing.setAttribute("data-score", pct);
  scoreRing.style.background = `conic-gradient(var(--primary) ${pct}%, var(--ring-track) 0)`;
}

// Keyword rendering
function renderKeywords(hit, miss) {
  keywordsHit.innerHTML = "";
  keywordsMiss.innerHTML = "";
  hit.forEach(k => {
    const el = document.createElement("span");
    el.className = "chip";
    el.textContent = k;
    keywordsHit.appendChild(el);
  });
  miss.forEach(k => {
    const el = document.createElement("span");
    el.className = "chip";
    el.textContent = k;
    keywordsMiss.appendChild(el);
  });
}

// Checks
function renderChecks(checks) {
  checksList.innerHTML = "";
  checks.forEach(ch => {
    const li = document.createElement("li");
    const badge = document.createElement("span");
    badge.className = "badge " + (ch.status === "ok" ? "ok" : ch.status === "warn" ? "warn" : "danger");
    badge.textContent = ch.status.toUpperCase();
    const txt = document.createElement("span");
    txt.textContent = ch.message;
    li.appendChild(badge);
    li.appendChild(txt);
    checksList.appendChild(li);
  });
}

// Suggestions
function renderSuggestions(sugs) {
  suggestionsList.innerHTML = "";
  sugs.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    suggestionsList.appendChild(li);
  });
}

// Copy summary
btnCopySummary.addEventListener("click", async () => {
  const summary = buildSummary();
  await navigator.clipboard.writeText(summary);
  alert("Summary copied!");
});

// Download JSON
btnDownloadJSON.addEventListener("click", () => {
  const data = buildData();
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "ats_report.json";
  a.click();
  URL.revokeObjectURL(url);
});

// Export PDF
btnExportPDF.addEventListener("click", () => {
  const opt = {
    margin: 10,
    filename: "ATS_Report.pdf",
    image: { type: "jpeg", quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true },
    jsPDF: { unit: "mm", format: "a4", orientation: "portrait" }
  };
  const clone = document.querySelector("#results").cloneNode(true);
  // ensure results visible
  clone.hidden = false;
  html2pdf().from(clone).set(opt).save();
});

function buildSummary() {
  const score = scoreNumber.textContent;
  const hit = [...keywordsHit.querySelectorAll(".chip")].map(x => x.textContent);
  const miss = [...keywordsMiss.querySelectorAll(".chip")].map(x => x.textContent);
  return `ATS Score: ${score}/100
Matched keywords (${hit.length}): ${hit.join(", ")}
Missing keywords (${miss.length}): ${miss.join(", ")}\n
See detailed checks and suggestions in the app.`;
}

function buildData() {
  return {
    score: Number(scoreNumber.textContent),
    keywordsHit: [...keywordsHit.querySelectorAll(".chip")].map(x => x.textContent),
    keywordsMiss: [...keywordsMiss.querySelectorAll(".chip")].map(x => x.textContent),
    checks: [...checksList.querySelectorAll("li")].map(li => ({
      status: li.querySelector(".badge").textContent,
      message: li.querySelector("span:last-child").textContent
    })),
    suggestions: [...suggestionsList.querySelectorAll("li")].map(li => li.textContent),
  };
}

// ---- Core ATS Logic ----

const STOPWORDS = new Set("a an and the of in on for to with from by as is are be this that it you your".split(" "));

const ACTION_VERBS = new Set([
  "led","managed","built","designed","developed","implemented","created","launched","owned","architected","optimized","delivered","improved","increased","reduced","automated","migrated","integrated","tested","deployed","mentored","collaborated","analyzed","designed","defined","prototyped","debugged","refactored","shipped"
]);

// Common resume sections to look for
const SECTIONS = [
  /summary|objective/i,
  /experience|employment|work history/i,
  /education/i,
  /skills/i,
  /projects/i,
  /certifications?|awards?/i
];

// Extract keywords from JD with a very light heuristic
function extractKeywordsFromJD(jd) {
  const tokens = tokenize(jd);
  const freq = new Map();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    if (!/^[a-z0-9\+\#\.\-]+$/.test(t)) continue; // simple filter
    freq.set(t, (freq.get(t) || 0) + 1);
  }
  // Keep top 30 words
  const sorted = [...freq.entries()].sort((a,b)=>b[1]-a[1]).map(([w])=>w);
  // Merge known tech words (React, TypeScript, etc.) by scanning original JD (case-sensitive)
  const techRegex = /\b([A-Z][a-zA-Z0-9\+\#\.]{1,}|[A-Z]{2,})\b/g;
  const proper = new Set();
  let m; while ((m = techRegex.exec(jd)) !== null) {
    const w = m[1];
    if (w.length <= 2) continue;
    proper.add(w);
  }
  // combine lowercase tokens and proper-case tech words
  const base = new Set(sorted.slice(0, 30));
  proper.forEach(w => base.add(w));
  // normalize: keep unique
  return [...base].slice(0, 40);
}

function tokenize(s) {
  return s.toLowerCase()
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/[^a-z0-9\+\#\.\- ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

function cleanWhitespace(s) {
  return s.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

function countRegex(re, text) {
  const matches = text.match(re);
  return matches ? matches.length : 0;
}

function runATS(resumeRaw, jdRaw) {
  const resume = cleanWhitespace(resumeRaw);
  const jd = cleanWhitespace(jdRaw);

  const jdKeywords = extractKeywordsFromJD(jd);
  const resumeTokens = new Set(tokenize(resume));
  // For proper-case keywords, also check raw resume
  const hits = [];
  const misses = [];
  for (const k of jdKeywords) {
    const lower = k.toLowerCase();
    const present = resumeTokens.has(lower) || resume.includes(k);
    if (present) hits.push(k); else misses.push(k);
  }

  // Section checks
  const checks = [];
  let sectionHits = 0;
  for (const re of SECTIONS) {
    const ok = re.test(resume);
    if (ok) sectionHits++;
    checks.push({
      status: ok ? "ok" : "warn",
      message: (ok ? "Has " : "Missing ") + re.source.replace(/\|/g, " / ").replace(/[\\]/g, "")
    });
  }

  // Contact info
  const emailOK = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(resume);
  const phoneOK = /\b(\+?\d[\d\-\s\(\)]{7,}\d)\b/.test(resume);
  const linkedInOK = /linkedin\.com\/in\//i.test(resume);
  checks.push({ status: emailOK ? "ok" : "danger", message: emailOK ? "Email present" : "Email missing" });
  checks.push({ status: phoneOK ? "ok" : "warn", message: phoneOK ? "Phone present" : "Phone missing" });
  checks.push({ status: linkedInOK ? "ok" : "warn", message: linkedInOK ? "LinkedIn present" : "LinkedIn not found" });

  // Action verbs & numbers (impact)
  const actionVerbCount = [...ACTION_VERBS].reduce((acc, v) => acc + countRegex(new RegExp(`\\b${v}\\b`, "gi"), resume), 0);
  const numberCount = countRegex(/\b\d{1,}\b/g, resume);

  // Length (basic heuristic: 350-1200 words)
  const wordCount = tokenize(resume).length;
  const lengthOK = wordCount >= 350 && wordCount <= 1200;
  checks.push({ status: lengthOK ? "ok" : "warn", message: `Length ~${wordCount} words ${lengthOK ? "(good)" : "(consider 1–2 pages)"}` });

  // File name keywording (if a file uploaded)
  const fileEl = document.getElementById("resume-file");
  let fileScore = 0;
  if (fileEl && fileEl.files && fileEl.files[0]) {
    const name = fileEl.files[0].name;
    const hasNameLike = /[a-z]+_[a-z]+/i.test(name) || /[A-Z][a-z]+\s?-[A-Z][a-z]+/.test(name);
    const hasRole = /(developer|engineer|manager|designer|analyst|data|qa|marketing|sales|product)/i.test(name);
    checks.push({ status: hasNameLike ? "ok" : "warn", message: `File name looks ${hasNameLike ? "descriptive" : "generic"} (${name})` });
    if (hasNameLike) fileScore += 0.5;
    if (hasRole) fileScore += 0.5;
  }

  // Formatting warnings (very rough)
  const hasTables = /│|┤|└|┐|┌|┘|┼|─|—|═|║/.test(resume); // box drawing chars often from tables
  const hasImagesHint = /image:|figure|diagram/i.test(resume); // rare in extracted text
  if (hasTables) checks.push({ status: "warn", message: "Table-like characters found; avoid complex tables/columns" });
  if (hasImagesHint) checks.push({ status: "warn", message: "Images detected; many ATS can't read images" });

  // Score calculation (weights total ~100)
  const keywordCoverage = (hits.length / Math.max(1, jdKeywords.length)) * 100; // 0..100
  const sectionCoverage = (sectionHits / SECTIONS.length) * 100;
  const contactCoverage = (emailOK ? 34 : 0) + (phoneOK ? 33 : 0) + (linkedInOK ? 33 : 0);
  const actionVerbScore = Math.min(100, (actionVerbCount / 10) * 100); // 10+ verbs => 100
  const impactScore = Math.min(100, (numberCount / 12) * 100); // 12+ numbers => 100
  const lengthScore = lengthOK ? 100 : 40;
  const formattingPenalty = (hasTables ? 15 : 0) + (hasImagesHint ? 10 : 0);
  const fileNameScore = fileScore * 50; // 0, 50, or 100

  const finalScore =
    0.40 * keywordCoverage +
    0.15 * sectionCoverage +
    0.10 * (100 - formattingPenalty) +
    0.10 * actionVerbScore +
    0.10 * contactCoverage +
    0.05 * lengthScore +
    0.05 * impactScore +
    0.05 * fileNameScore; // can exceed 100 slightly; clamp
  const score = Math.max(0, Math.min(100, finalScore));

  // Suggestions (based on misses and checks)
  const suggestions = [];
  if (misses.length) suggestions.push(`Add or rephrase to include missing keywords: ${misses.slice(0, 12).join(", ")}.`);
  if (!emailOK) suggestions.push("Add a professional email at the top.");
  if (!phoneOK) suggestions.push("Include a reachable phone number (with country code if applying internationally).");
  if (!linkedInOK) suggestions.push("Add your LinkedIn profile URL.");
  if (!lengthOK) suggestions.push("Keep resume to 1–2 pages (approx. 350–1200 words).");
  if (actionVerbCount < 8) suggestions.push("Use stronger action verbs (led, built, optimized, delivered, etc.).");
  if (numberCount < 8) suggestions.push("Quantify achievements (e.g., 'reduced load time by 35%').");
  if (hasTables) suggestions.push("Avoid tables or multi-column layouts; many ATS read left-to-right only.");
  if (hasImagesHint) suggestions.push("Avoid images/logos for key info; ATS won’t parse them.");
  if (hits.length / Math.max(1, jdKeywords.length) < 0.5) suggestions.push("Tailor the resume more specifically to this job description.");

  return {
    score,
    keywordsHit: hits,
    keywordsMiss: misses,
    checks,
    suggestions
  };
}