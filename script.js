/**
 * ก.พ. Quiz Master - Encrypted Build
 */

let quizData = [];
let quizDataReady = false;

let activeQuestions = [];
let currentQuestionIndex = 0;
let selectedAnswers = new Map();
let skippedQuestions = new Set();
let skippedPanelVisible = false;

function b64ToBytes(input) {
    const binary = atob(input);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function getSecretMaterial() {
    const codes = [75, 80, 81, 45, 69, 120, 97, 109, 83, 104, 105, 101, 108, 100, 58, 58, 118, 49];
    return String.fromCharCode(...codes);
}

function lockBasicInspection() {
    document.addEventListener('contextmenu', (event) => event.preventDefault());
    window.addEventListener('keydown', (event) => {
        const key = event.key.toLowerCase();
        const blocked = event.key === 'F12' ||
            (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c')) ||
            (event.ctrlKey && key === 'u');
        if (blocked) {
            event.preventDefault();
        }
    });
}

async function decryptQuizData(payload) {
    const encoder = new TextEncoder();
    const baseKey = await crypto.subtle.importKey(
        'raw',
        encoder.encode(getSecretMaterial()),
        { name: 'PBKDF2' },
        false,
        ['deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
        {
            name: 'PBKDF2',
            salt: b64ToBytes(payload.salt),
            iterations: payload.iter,
            hash: 'SHA-256'
        },
        baseKey,
        { name: 'AES-GCM', length: 256 },
        false,
        ['decrypt']
    );

    const decrypted = await crypto.subtle.decrypt(
        {
            name: 'AES-GCM',
            iv: b64ToBytes(payload.iv),
            tagLength: 128
        },
        key,
        b64ToBytes(payload.data)
    );

    return JSON.parse(new TextDecoder().decode(decrypted));
}

async function ensureQuizDataReady() {
    if (quizDataReady) return;
    const response = await fetch('quiz-data.enc.json', { cache: 'no-store' });
    if (!response.ok) {
        throw new Error('ไม่สามารถโหลดไฟล์ข้อสอบที่เข้ารหัสได้');
    }

    const payload = await response.json();
    quizData = await decryptQuizData(payload);
    quizDataReady = true;
}

function resetSessionState() {
    currentQuestionIndex = 0;
    selectedAnswers = new Map();
    skippedQuestions = new Set();
    skippedPanelVisible = false;
}

function showFeedback(message, isCorrect) {
    const feedbackOverlay = document.createElement('div');
    feedbackOverlay.className = `feedback-overlay ${isCorrect ? 'feedback-correct' : 'feedback-wrong'}`;
    feedbackOverlay.innerHTML = `
        <div class="text-4xl mb-2 font-bold">${isCorrect ? 'ถูกต้อง!' : 'ผิดครับ...'}</div>
        <div class="text-xl">${escapeHtml(message)}</div>
    `;
    document.body.appendChild(feedbackOverlay);

    setTimeout(() => {
        feedbackOverlay.classList.add('opacity-0');
        setTimeout(() => feedbackOverlay.remove(), 400);
    }, 1000);
}

function initCategorySelection() {
    const container = document.getElementById('quiz-container');
    const resultScreen = document.getElementById('result-screen');
    const progress = document.getElementById('progress');
    const subLabel = document.getElementById('sub-category-label');

    container.classList.remove('hidden');
    progress.classList.add('hidden');
    resultScreen.classList.add('hidden');
    subLabel.innerText = 'เลือกหมวดหมู่ที่ต้องการฝึกฝน';

    container.innerHTML = `
        <div class="category-grid pt-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <button onclick="startQuiz('math')" class="category-card group">
                <div class="icon-box group-hover:bg-blue-600 group-hover:text-white transition-colors">🔢</div>
                <div>
                    <h3>คณิตศาสตร์และตรรกะ</h3>
                    <p>อนุกรม, โจทย์คณิต, โอเปอเรชั่น, ตาราง, สัญลักษณ์</p>
                </div>
            </button>
            <button onclick="startQuiz('analogy')" class="category-card group">
                <div class="icon-box group-hover:bg-indigo-600 group-hover:text-white transition-colors">🔎</div>
                <div>
                    <h3>อุปมาอุปไมย</h3>
                    <p>การเปรียบเทียบความสัมพันธ์ของคำและเหตุผล</p>
                </div>
            </button>
            <button onclick="startQuiz('thai')" class="category-card group">
                <div class="icon-box group-hover:bg-emerald-600 group-hover:text-white transition-colors">🇹🇭</div>
                <div>
                    <h3>ภาษาไทย</h3>
                    <p>สรุปความ, เรียงประโยค, ความเข้าใจภาษา</p>
                </div>
            </button>
            <button onclick="startQuiz('law')" class="category-card group">
                <div class="icon-box group-hover:bg-amber-600 group-hover:text-white transition-colors">⚖️</div>
                <div>
                    <h3>กฎหมายและระเบียบฯ</h3>
                    <p>พ.ร.บ. ข้าราชการที่ดี และกฎหมายที่เกี่ยวข้อง</p>
                </div>
            </button>
            <button onclick="startQuiz('english')" class="category-card group">
                <div class="icon-box group-hover:bg-orange-600 group-hover:text-white transition-colors">🇬🇧</div>
                <div>
                    <h3>ภาษาอังกฤษ</h3>
                    <p>Vocabulary, Grammar, Conversation, Reading</p>
                </div>
            </button>
            <button onclick="startQuiz('all')" class="category-card group border-blue-200 bg-blue-50/50">
                <div class="icon-box bg-blue-600 text-white">🌟</div>
                <div>
                    <h3>สุ่มรวมทุกหมวด</h3>
                    <p>คัดข้อสอบ 100 ข้อจากทุกหมวดหมู่มาทดสอบ</p>
                </div>
            </button>
        </div>
    `;
}

async function startQuiz(mainCategory) {
    await ensureQuizDataReady();

    const mathSub = ['อนุกรม', 'โจทย์ปัญหาคณิตศาสตร์', 'โอเปอเรชั่น', 'วิเคราะห์ข้อมูลตาราง', 'สรุปความจากสัญลักษณ์'];
    const thaiSub = ['สรุปความจากภาษา', 'การเรียงประโยค', 'ความเข้าใจในภาษา'];
    const lawSub = ['พ.ร.บ ระเบียบบริหารราชการแผ่นดิน', 'พ ร ฏ การบริหารกิจการบ้านเมืองที่ดี', 'พรบ วิธีปฏิบัติราชการทางการปกครอง', 'พรบ ความรับผิดทางละเมิดเจ้าหน้าที่', 'พรบ มาตรฐานทางจริยธรรม'];
    const engSub = ['English Vocabulary', 'English Grammar', 'English Conversation', 'English Reading'];

    let filtered = [];
    if (mainCategory === 'math') filtered = quizData.filter(q => mathSub.includes(q.category));
    else if (mainCategory === 'analogy') filtered = quizData.filter(q => q.category === 'อุปมาอุปไมย');
    else if (mainCategory === 'thai') filtered = quizData.filter(q => thaiSub.includes(q.category));
    else if (mainCategory === 'law') filtered = quizData.filter(q => lawSub.includes(q.category));
    else if (mainCategory === 'english') filtered = quizData.filter(q => engSub.includes(q.category));
    else filtered = [...quizData];

    filtered.sort(() => Math.random() - 0.5);

    if (mainCategory === 'all' || filtered.length > 100) {
        activeQuestions = filtered.slice(0, 100);
    } else {
        activeQuestions = filtered;
    }

    resetSessionState();
    document.getElementById('progress').classList.remove('hidden');
    loadQuiz();
}

function renderSkippedList() {
    const wrap = document.getElementById('skipped-list-wrap');
    if (!wrap) return;

    if (skippedQuestions.size === 0) {
        wrap.innerHTML = '<p class="text-sm text-slate-500">ยังไม่มีข้อที่ข้าม</p>';
        return;
    }

    const buttons = [...skippedQuestions]
        .sort((a, b) => a - b)
        .map(idx => `<button class="skip-chip" onclick="jumpToQuestion(${idx})">ข้อที่ ${idx + 1}</button>`)
        .join('');

    wrap.innerHTML = `<div class="skip-chip-wrap">${buttons}</div>`;
}

function toggleSkippedPanel() {
    skippedPanelVisible = !skippedPanelVisible;
    const panel = document.getElementById('skipped-panel');
    if (panel) {
        panel.classList.toggle('hidden', !skippedPanelVisible);
    }
}

function jumpToQuestion(index) {
    if (index < 0 || index >= activeQuestions.length) return;
    currentQuestionIndex = index;
    skippedPanelVisible = false;
    loadQuiz();
}

function skipCurrentQuestion() {
    if (!selectedAnswers.has(currentQuestionIndex)) {
        skippedQuestions.add(currentQuestionIndex);
    }
    moveToNextQuestion();
}

function moveToNextQuestion() {
    if (currentQuestionIndex < activeQuestions.length - 1) {
        currentQuestionIndex += 1;
        loadQuiz();
        return;
    }

    if (skippedQuestions.size > 0) {
        currentQuestionIndex = [...skippedQuestions].sort((a, b) => a - b)[0];
        loadQuiz();
        return;
    }

    showResult();
}

function loadQuiz() {
    const currentData = activeQuestions[currentQuestionIndex];
    const container = document.getElementById('quiz-container');
    const subLabel = document.getElementById('sub-category-label');
    const progress = document.getElementById('progress');

    subLabel.innerText = `หมวด: ${currentData.category}`;
    progress.innerText = `ข้อที่ ${currentQuestionIndex + 1}/${activeQuestions.length}`;

    const answeredCount = selectedAnswers.size;
    const skippedCount = skippedQuestions.size;

    container.innerHTML = `
        <div class="quiz-shell animate-in fade-in duration-500">
            <div class="quiz-meta-card mb-6">
                <div class="chip">ตอบแล้ว ${answeredCount}/${activeQuestions.length}</div>
                <div class="chip chip-skip">ข้ามไว้ ${skippedCount}</div>
            </div>
            <p class="text-xl text-slate-700 leading-relaxed font-semibold mb-8 question-card">
                ${escapeHtml(currentData.question)}
            </p>
            <div id="options-container" class="space-y-4"></div>
            <div class="action-row mt-6">
                <button id="skip-btn" class="quiz-action-btn">ข้ามข้อนี้ไว้ก่อน</button>
                <button id="skipped-btn" class="quiz-action-btn quiz-action-secondary">ดูข้อที่ข้าม (${skippedCount})</button>
            </div>
            <div id="skipped-panel" class="skipped-panel ${skippedPanelVisible ? '' : 'hidden'}">
                <div class="text-sm font-semibold text-slate-700 mb-3">รายการข้อที่ข้าม</div>
                <div id="skipped-list-wrap"></div>
            </div>
        </div>
    `;

    const optionsContainer = document.getElementById('options-container');
    currentData.options.forEach((option, index) => {
        const button = document.createElement('button');
        button.className = 'choice-btn';
        button.innerHTML = `<span class="choice-number">${index + 1}</span> <span>${escapeHtml(option)}</span>`;
        button.onclick = () => checkAnswer(index);
        optionsContainer.appendChild(button);
    });

    document.getElementById('skip-btn').onclick = skipCurrentQuestion;
    document.getElementById('skipped-btn').onclick = toggleSkippedPanel;
    renderSkippedList();
}

function checkAnswer(selectedIndex) {
    const currentData = activeQuestions[currentQuestionIndex];
    const correct = currentData.answer;

    selectedAnswers.set(currentQuestionIndex, selectedIndex);
    skippedQuestions.delete(currentQuestionIndex);

    const buttons = document.querySelectorAll('.choice-btn');
    buttons.forEach(btn => btn.disabled = true);

    if (selectedIndex === correct) {
        buttons[selectedIndex].classList.add('correct-choice');
        showFeedback('ยอดเยี่ยม!', true);
    } else {
        buttons[selectedIndex].classList.add('wrong-choice');
        buttons[correct].classList.add('hint-choice');
        showFeedback('ไว้แก้ตัวข้อถัดไป', false);
    }

    setTimeout(() => {
        moveToNextQuestion();
    }, 1200);
}

function getResultSummary() {
    let score = 0;
    const wrongAnswers = [];

    activeQuestions.forEach((item, index) => {
        if (!selectedAnswers.has(index)) return;

        const selected = selectedAnswers.get(index);
        if (selected === item.answer) {
            score += 1;
            return;
        }

        wrongAnswers.push({
            question: item.question,
            yourAnswer: item.options[selected],
            correctAnswer: item.options[item.answer],
            explanation: item.explanation,
            category: item.category
        });
    });

    return {
        score,
        wrongAnswers,
        answeredCount: selectedAnswers.size,
        skippedCount: skippedQuestions.size
    };
}

function showResult() {
    const container = document.getElementById('quiz-container');
    const resultScreen = document.getElementById('result-screen');
    const subLabel = document.getElementById('sub-category-label');
    const result = getResultSummary();

    container.classList.add('hidden');
    resultScreen.classList.remove('hidden');
    subLabel.innerText = 'วิเคราะห์ผลการทดสอบ';

    let reviewHTML = `
        <div class="text-center mb-10 p-6 bg-blue-50 rounded-3xl border border-blue-100">
            <div class="text-5xl font-black text-blue-600 mb-2">${result.score}/${activeQuestions.length}</div>
            <div class="text-slate-500 font-medium">คะแนนที่คุณทำได้</div>
            <div class="text-sm text-slate-500 mt-2">ตอบแล้ว ${result.answeredCount} ข้อ | ข้ามไว้ ${result.skippedCount} ข้อ</div>
            <button onclick="location.reload()" class="mt-6 bg-blue-600 text-white px-8 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200">
                ทำแบบฝึกหัดใหม่
            </button>
        </div>
    `;

    if (result.wrongAnswers.length > 0) {
        reviewHTML += `<h3 class="text-xl font-bold text-slate-800 mb-6">ข้อที่ควรทบทวนเพิ่มเติม</h3>`;
        result.wrongAnswers.forEach((item) => {
            reviewHTML += `
                <div class="review-card">
                    <span class="review-badge badge-wrong">${escapeHtml(item.category)}</span>
                    <p class="font-bold text-slate-700 mb-4">${escapeHtml(item.question)}</p>
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div class="p-3 rounded-xl bg-red-50 text-red-700 text-sm">
                            <strong>คำตอบของคุณ:</strong> ${escapeHtml(item.yourAnswer)}
                        </div>
                        <div class="p-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
                            <strong>คำตอบที่ถูก:</strong> ${escapeHtml(item.correctAnswer)}
                        </div>
                    </div>
                    <div class="p-4 rounded-2xl bg-slate-100 text-slate-600 text-sm italic">
                        <strong>คำอธิบาย:</strong> ${escapeHtml(item.explanation)}
                    </div>
                </div>
            `;
        });
    } else {
        reviewHTML += `
            <div class="text-center py-10">
                <h3 class="text-2xl font-bold text-slate-800">Perfect Score!</h3>
                <p class="text-slate-500">ยอดเยี่ยมมาก คุณตอบถูกทุกข้อ</p>
            </div>
        `;
    }

    resultScreen.innerHTML = reviewHTML;
}

window.startQuiz = startQuiz;
window.jumpToQuestion = jumpToQuestion;

window.onload = async () => {
    lockBasicInspection();
    try {
        await ensureQuizDataReady();
        initCategorySelection();
    } catch (error) {
        const container = document.getElementById('quiz-container');
        container.innerHTML = '<p class="text-red-600 font-semibold">โหลดข้อสอบไม่สำเร็จ กรุณารีเฟรชหน้าอีกครั้ง</p>';
    }
};
