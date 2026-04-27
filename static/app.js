// ================================================================
// ArXiv for Dummies — App Logic
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
    initParticles();
    initTabs();
    initUrlForm();
    initPdfUpload();
    initResultTabs();
    initCopyButtons();
    initNewPaperBtn();
});

// ---- Particles ----
function initParticles() {
    const container = document.getElementById("particles");
    for (let i = 0; i < 30; i++) {
        const p = document.createElement("div");
        p.className = "particle";
        p.style.left = Math.random() * 100 + "%";
        p.style.top = (40 + Math.random() * 60) + "%";
        p.style.animationDelay = Math.random() * 8 + "s";
        p.style.animationDuration = (6 + Math.random() * 6) + "s";
        const colors = ["#8b5cf6", "#3b82f6", "#06b6d4"];
        p.style.background = colors[Math.floor(Math.random() * colors.length)];
        container.appendChild(p);
    }
}

// ---- Input Tabs (URL / PDF) ----
function initTabs() {
    document.querySelectorAll(".tab-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
            document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
            btn.classList.add("active");
            document.getElementById("content-" + btn.dataset.tab).classList.add("active");
        });
    });
}

// ---- URL Form ----
function initUrlForm() {
    const form = document.getElementById("url-form");
    const btn = document.getElementById("url-submit-btn");
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const url = document.getElementById("arxiv-url").value.trim();
        if (!url) return showToast("Vui lòng nhập URL ArXiv");
        btn.classList.add("loading");
        btn.disabled = true;
        showLoading();
        try {
            const res = await fetch("/api/analyze-url", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ url })
            });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Lỗi server");
            }
            const data = await res.json();
            renderResults(data);
        } catch (err) {
            showToast(err.message);
            hideLoading();
        } finally {
            btn.classList.remove("loading");
            btn.disabled = false;
        }
    });
}

// ---- PDF Upload ----
function initPdfUpload() {
    const dropZone = document.getElementById("drop-zone");
    const fileInput = document.getElementById("pdf-input");
    const submitBtn = document.getElementById("pdf-submit-btn");
    const selectedUI = document.getElementById("drop-zone-selected");
    const filenamEl = document.getElementById("selected-filename");
    const removeBtn = document.getElementById("remove-file");
    let selectedFile = null;

    dropZone.addEventListener("click", () => fileInput.click());
    dropZone.addEventListener("dragover", (e) => { e.preventDefault(); dropZone.classList.add("dragover"); });
    dropZone.addEventListener("dragleave", () => dropZone.classList.remove("dragover"));
    dropZone.addEventListener("drop", (e) => {
        e.preventDefault();
        dropZone.classList.remove("dragover");
        const files = e.dataTransfer.files;
        if (files.length > 0 && files[0].name.toLowerCase().endsWith(".pdf")) {
            selectFile(files[0]);
        } else {
            showToast("Chỉ chấp nhận file PDF");
        }
    });
    fileInput.addEventListener("change", () => {
        if (fileInput.files.length > 0) selectFile(fileInput.files[0]);
    });
    removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        clearFile();
    });

    function selectFile(file) {
        selectedFile = file;
        filenamEl.textContent = file.name;
        dropZone.querySelector(".drop-zone-content").style.display = "none";
        selectedUI.style.display = "flex";
        submitBtn.disabled = false;
    }
    function clearFile() {
        selectedFile = null;
        fileInput.value = "";
        dropZone.querySelector(".drop-zone-content").style.display = "block";
        selectedUI.style.display = "none";
        submitBtn.disabled = true;
    }

    submitBtn.addEventListener("click", async () => {
        if (!selectedFile) return;
        submitBtn.classList.add("loading");
        submitBtn.disabled = true;
        showLoading();
        try {
            const formData = new FormData();
            formData.append("file", selectedFile);
            const res = await fetch("/api/analyze-pdf", { method: "POST", body: formData });
            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.detail || "Lỗi server");
            }
            const data = await res.json();
            renderResults(data);
        } catch (err) {
            showToast(err.message);
            hideLoading();
        } finally {
            submitBtn.classList.remove("loading");
            submitBtn.disabled = false;
        }
    });
}

// ---- Loading ----
function showLoading() {
    document.getElementById("input-section").style.display = "none";
    document.getElementById("results-section").style.display = "none";
    document.getElementById("loading-section").style.display = "block";
    animateLoadingSteps();
}
function hideLoading() {
    document.getElementById("loading-section").style.display = "none";
    document.getElementById("input-section").style.display = "block";
}
function animateLoadingSteps() {
    const steps = ["step-fetch", "step-extract", "step-analyze", "step-generate"];
    let i = 0;
    const interval = setInterval(() => {
        if (i > 0) document.getElementById(steps[i - 1]).classList.replace("active", "done");
        if (i < steps.length) {
            document.getElementById(steps[i]).classList.add("active");
            i++;
        } else {
            clearInterval(interval);
        }
    }, 2500);
    // Store interval so we can clear on early finish
    window._loadingInterval = interval;
}

// ---- Render Results ----
function renderResults(data) {
    if (window._loadingInterval) clearInterval(window._loadingInterval);
    document.getElementById("loading-section").style.display = "none";
    document.getElementById("results-section").style.display = "block";

    // Paper header
    document.getElementById("paper-title").textContent = data.paper_title || "Untitled";
    document.getElementById("paper-title-vi").textContent = data.paper_title_vi || "";
    document.getElementById("paper-authors").textContent = data.authors || "";
    const pdfLink = document.getElementById("paper-pdf-link");
    if (data.pdf_url) { pdfLink.href = data.pdf_url; pdfLink.style.display = "inline"; }
    else { pdfLink.style.display = "none"; }

    // TL;DR
    document.getElementById("tldr-text").textContent = data.tldr || "";

    // ELI5
    document.getElementById("eli5-text").textContent = data.eli5 || "";

    // Key Concepts
    const grid = document.getElementById("concepts-grid");
    grid.innerHTML = "";
    (data.key_concepts || []).forEach(c => {
        const card = document.createElement("div");
        card.className = "concept-card";
        card.innerHTML = `
            <div class="concept-term">${esc(c.term)}</div>
            <div class="concept-term-vi">${esc(c.term_vi)}</div>
            <div class="concept-explanation">${esc(c.explanation)}</div>
        `;
        grid.appendChild(card);
    });

    // Sections Deep Dive
    renderSectionsDeepDive(data.sections || []);

    // Novelty
    document.getElementById("novelty-text").textContent = data.novelty || "";

    // Quiz
    renderQuiz(data.quiz || []);

    // Activate first tab
    document.querySelectorAll(".result-tab").forEach((t, i) => t.classList.toggle("active", i === 0));
    document.querySelectorAll(".result-panel").forEach((p, i) => p.classList.toggle("active", i === 0));

    // Scroll to results
    document.getElementById("results-section").scrollIntoView({ behavior: "smooth", block: "start" });
}

// ---- Sections Deep Dive ----
function renderSectionsDeepDive(sections) {
    const container = document.getElementById("sections-deep-dive");
    container.innerHTML = "";

    sections.forEach((s, idx) => {
        const card = document.createElement("div");
        card.className = "section-deep-card" + (idx === 0 ? " open" : "");

        // Header (click to toggle)
        const header = document.createElement("div");
        header.className = "section-deep-header";
        header.innerHTML = `
            <div class="section-deep-number">${idx + 1}</div>
            <div class="section-deep-title">${esc(s.title)}</div>
            <div class="section-deep-toggle">▼</div>
        `;
        header.addEventListener("click", () => card.classList.toggle("open"));

        // Body content
        const body = document.createElement("div");
        body.className = "section-deep-body";

        let bodyHTML = '<div class="section-deep-content">';

        // Summary
        if (s.summary) {
            bodyHTML += `<div class="section-summary-block">${esc(s.summary)}</div>`;
        }

        // Details
        if (s.details) {
            bodyHTML += `<div class="section-details-block">${esc(s.details)}</div>`;
        }

        // Concepts chips
        if (s.concepts && s.concepts.length > 0) {
            bodyHTML += '<div class="section-concepts-label">📌 Thuật ngữ trong phần này</div>';
            bodyHTML += '<div class="section-concepts-grid">';
            s.concepts.forEach(c => {
                bodyHTML += `<div class="section-concept-chip">${esc(c.term)}<div class="chip-tooltip">${esc(c.explanation)}</div></div>`;
            });
            bodyHTML += '</div>';
        }

        // Formulas
        if (s.formulas && s.formulas.length > 0) {
            bodyHTML += '<div class="section-formulas-label">📐 Công thức toán học</div>';
            s.formulas.forEach(f => {
                bodyHTML += `<div class="section-formula-card">`;
                if (f.name) bodyHTML += `<div class="formula-name">${esc(f.name)}</div>`;
                if (f.latex) bodyHTML += `<div class="formula-display" data-latex="${esc(f.latex)}"></div>`;
                if (f.variables) bodyHTML += `<div class="formula-variables">${esc(f.variables)}</div>`;
                if (f.explanation) bodyHTML += `<div class="formula-explanation">${esc(f.explanation)}</div>`;
                bodyHTML += `</div>`;
            });
        }

        // Algorithms
        if (s.algorithms && s.algorithms.length > 0) {
            bodyHTML += '<div class="section-algos-label">⚙️ Thuật toán / Quy trình</div>';
            s.algorithms.forEach(a => {
                bodyHTML += `<div class="section-algo-card">`;
                if (a.name) bodyHTML += `<div class="algo-name">⚙️ ${esc(a.name)}</div>`;
                if (a.steps && a.steps.length > 0) {
                    bodyHTML += '<ul class="algo-steps">';
                    a.steps.forEach((step, si) => {
                        bodyHTML += `<li class="algo-step"><div class="algo-step-number">${si + 1}</div><div>${esc(step)}</div></li>`;
                    });
                    bodyHTML += '</ul>';
                }
                if (a.explanation) bodyHTML += `<div class="algo-explanation">${esc(a.explanation)}</div>`;
                bodyHTML += `</div>`;
            });
        }

        bodyHTML += '</div>';
        body.innerHTML = bodyHTML;

        card.appendChild(header);
        card.appendChild(body);
        container.appendChild(card);
    });

    // Render KaTeX formulas
    renderAllKatex(container);
}

function renderAllKatex(container) {
    container.querySelectorAll(".formula-display[data-latex]").forEach(el => {
        const latex = el.getAttribute("data-latex");
        try {
            katex.render(latex, el, { throwOnError: false, displayMode: true });
        } catch (e) {
            el.textContent = latex; // Fallback to raw text
        }
    });
}

// ---- Quiz ----
let quizData = [];
let quizAnswered = 0;
let quizCorrect = 0;

function renderQuiz(questions) {
    quizData = questions;
    quizAnswered = 0;
    quizCorrect = 0;
    const container = document.getElementById("quiz-container");
    container.innerHTML = "";
    document.getElementById("quiz-score").style.display = "none";
    document.getElementById("reset-quiz-btn").style.display = "none";

    questions.forEach((q, qi) => {
        const div = document.createElement("div");
        div.className = "quiz-question";
        div.id = `quiz-q-${qi}`;
        let optionsHTML = q.options.map((opt, oi) =>
            `<button class="quiz-option" data-qi="${qi}" data-oi="${oi}">${esc(opt)}</button>`
        ).join("");
        div.innerHTML = `
            <div class="quiz-q-number">Câu ${qi + 1}/${questions.length}</div>
            <div class="quiz-q-text">${esc(q.question)}</div>
            <div class="quiz-options">${optionsHTML}</div>
            <div class="quiz-explanation" id="quiz-exp-${qi}">${esc(q.explanation)}</div>
        `;
        container.appendChild(div);
    });

    container.querySelectorAll(".quiz-option").forEach(btn => {
        btn.addEventListener("click", handleQuizAnswer);
    });
}

function handleQuizAnswer(e) {
    const btn = e.currentTarget;
    const qi = parseInt(btn.dataset.qi);
    const oi = parseInt(btn.dataset.oi);
    const q = quizData[qi];
    const questionDiv = document.getElementById(`quiz-q-${qi}`);
    const allBtns = questionDiv.querySelectorAll(".quiz-option");

    // Disable all options for this question
    allBtns.forEach(b => b.disabled = true);

    if (oi === q.correct) {
        btn.classList.add("correct");
        quizCorrect++;
    } else {
        btn.classList.add("wrong");
        allBtns[q.correct].classList.add("correct");
    }

    // Show explanation
    document.getElementById(`quiz-exp-${qi}`).classList.add("visible");

    quizAnswered++;
    if (quizAnswered === quizData.length) {
        const scoreEl = document.getElementById("quiz-score");
        scoreEl.style.display = "block";
        document.getElementById("score-text").textContent = `${quizCorrect}/${quizData.length} đúng`;
        document.getElementById("reset-quiz-btn").style.display = "inline-block";
    }
}

document.getElementById("reset-quiz-btn")?.addEventListener("click", () => renderQuiz(quizData));

// ---- Result Tabs ----
function initResultTabs() {
    document.getElementById("result-tabs").addEventListener("click", (e) => {
        const tab = e.target.closest(".result-tab");
        if (!tab) return;
        document.querySelectorAll(".result-tab").forEach(t => t.classList.remove("active"));
        document.querySelectorAll(".result-panel").forEach(p => p.classList.remove("active"));
        tab.classList.add("active");
        document.getElementById("panel-" + tab.dataset.section).classList.add("active");
    });
}

// ---- Copy Buttons ----
function initCopyButtons() {
    document.querySelectorAll(".copy-btn").forEach(btn => {
        btn.addEventListener("click", () => {
            const target = document.getElementById(btn.dataset.target);
            if (target) {
                navigator.clipboard.writeText(target.textContent).then(() => {
                    btn.classList.add("copied");
                    setTimeout(() => btn.classList.remove("copied"), 1500);
                    showToast("Đã copy!", true);
                });
            }
        });
    });
}

// ---- New Paper ----
function initNewPaperBtn() {
    document.getElementById("new-paper-btn").addEventListener("click", () => {
        document.getElementById("results-section").style.display = "none";
        document.getElementById("input-section").style.display = "block";
        document.getElementById("input-section").scrollIntoView({ behavior: "smooth" });
        // Reset loading steps
        ["step-fetch", "step-extract", "step-analyze", "step-generate"].forEach(id => {
            const el = document.getElementById(id);
            el.classList.remove("active", "done");
        });
    });
}

// ---- Toast ----
function showToast(msg, success = false) {
    const toast = document.getElementById("toast");
    document.getElementById("toast-message").textContent = msg;
    toast.classList.toggle("success", success);
    document.querySelector(".toast-icon").textContent = success ? "✅" : "⚠️";
    toast.classList.add("visible");
    setTimeout(() => toast.classList.remove("visible"), 3500);
}

// ---- Helpers ----
function esc(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
}
