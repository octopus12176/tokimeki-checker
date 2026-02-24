// js/app.js

const App = (() => {
  // ── State ────────────────────────────────────────────────────────────────
  let state = {
    user: null, // { id, name, email, picture }
    itemName: '',
    itemPrice: '',
    currentQ: 0,
    scores: [],
    feedbacks: [],
    answers: [],
    lastResult: null, // { type, verdict, scorePct, ... }
    history: [],
    totalSaved: 0,
  };

  // ── Auth ─────────────────────────────────────────────────────────────────
  async function checkAuth() {
    try {
      const res = await fetch('/api/auth');
      if (!res.ok) return null;
      return await res.json(); // { id, name, email, picture }
    } catch {
      return null;
    }
  }

  function handleLogin() {
    window.location.href = '/api/auth?action=login';
  }

  function handleLogout() {
    window.location.href = '/api/auth?action=logout';
  }

  // ── Data / API calls ─────────────────────────────────────────────────────
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) return;
      const data = await res.json();
      state.history = data.history || [];
      state.totalSaved = data.totalSaved || 0;
    } catch (e) {
      console.error('loadHistory:', e);
    }
  }

  async function saveResult(payload) {
    // payload: { itemName, itemPrice, type, verdict, score, saved }
    try {
      await fetch('/api/history', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
    } catch (e) {
      console.error('saveResult:', e);
    }
  }

  async function fetchFeedback(opt, questionIndex) {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName: state.itemName,
        itemPrice: state.itemPrice,
        questionText: QUESTIONS[questionIndex].text,
        answerText: opt.label,
        answerScore: opt.score,
        questionIndex,
        questionTheme: QUESTIONS[questionIndex].theme,
      }),
    });
    if (!res.ok) throw new Error('feedback API error');
    const data = await res.json();
    return data.feedback;
  }

  // ── Question flow ────────────────────────────────────────────────────────
  function startCheck() {
    state.itemName =
      document.getElementById('item-name').value.trim() || 'この商品';
    state.itemPrice = document.getElementById('item-price').value;
    state.currentQ = 0;
    state.scores = [];
    state.feedbacks = [];
    state.answers = [];
    state.lastResult = null;
    UI.showScreen('screen-questions');
    renderQuestion();
  }

  function renderQuestion() {
    const q = QUESTIONS[state.currentQ];
    const total = QUESTIONS.length;
    const isActivism = q.theme === 'shihonshugi';

    // Card theme
    document.getElementById('q-card').className = isActivism
      ? 'card activism-card'
      : 'card';

    // Chip
    const chip = document.getElementById('q-chip');
    chip.className = isActivism ? 'q-item-chip activism' : 'q-item-chip';
    document.getElementById('q-chip-name').textContent = state.itemName;

    // Progress
    document.getElementById('progress-fill').style.width =
      (state.currentQ / total) * 100 + '%';
    document.getElementById('q-number-label').textContent = `質問 ${
      state.currentQ + 1
    } / ${total}`;
    UI.renderStepDots(state.currentQ, total);

    // Theme tag
    const tag = document.getElementById('q-theme-tag');
    tag.textContent = q.themeLabel;
    if (isActivism) {
      tag.style.cssText =
        'background:rgba(199,125,255,.2);border-color:#C77DFF;color:#C77DFF';
    } else {
      const c = q.themeColor;
      tag.style.cssText = `background:${c}33;border-color:${c};color:${
        c === 'var(--yellow)' ? '#b89300' : c
      }`;
    }

    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-sub').textContent = q.sub;

    // Option buttons
    const optsEl = document.getElementById('q-options');
    optsEl.innerHTML = '';
    q.options.forEach((opt) => {
      const btn = document.createElement('button');
      btn.className = 'opt-btn';
      btn.style.setProperty('--opt-color', opt.color);
      btn.innerHTML = `
        <span class="opt-icon">${opt.icon}</span>
        <span class="opt-label">${opt.label}</span>
        <span class="opt-sub">${opt.sub}</span>`;
      btn.onclick = () => pickAnswer(opt, btn);
      optsEl.appendChild(btn);
    });

    // Reset feedback + next
    document.getElementById('feedback-bubble').style.display = 'none';
    document.getElementById('btn-next').style.display = 'none';
  }

  async function pickAnswer(opt, btn) {
    document.querySelectorAll('.opt-btn').forEach((b) => {
      b.disabled = true;
      b.classList.remove('selected');
    });
    btn.classList.add('selected');

    state.scores.push(opt.score);
    state.answers.push({
      theme: QUESTIONS[state.currentQ].theme,
      themeLabel: QUESTIONS[state.currentQ].themeLabel,
      q: QUESTIONS[state.currentQ].text,
      a: opt.label,
      score: opt.score,
    });

    UI.showFeedbackLoading();
    UI.showNextButton(state.currentQ === QUESTIONS.length - 1);

    try {
      const text = await fetchFeedback(opt, state.currentQ);
      state.feedbacks.push(text);
      UI.showFeedbackText(text);
    } catch {
      const fallback =
        opt.score >= 2
          ? '✅ 良いサインです！'
          : opt.score <= -2
          ? '⚠️ 少し立ち止まってみましょう'
          : '📊 バランスが大切ですね';
      state.feedbacks.push(fallback);
      UI.showFeedbackText(fallback);
    }
  }

  function nextQuestion() {
    state.currentQ++;
    if (state.currentQ >= QUESTIONS.length) {
      UI.showScreen('screen-loading');
      setTimeout(buildResult, 1200);
    } else {
      renderQuestion();
    }
  }

  // ── Result ───────────────────────────────────────────────────────────────
  function buildResult() {
    const MAX = 18,
      MIN = -17;
    const total = state.scores.reduce((a, b) => a + b, 0);
    const pct = Math.max(0, Math.min(1, (total - MIN) / (MAX - MIN)));
    const scorePct = Math.round(pct * 100);

    let type, emoji, verdict, desc;
    if (pct >= 0.65) {
      type = 'buy';
      emoji = '🛒';
      verdict = '買っちゃおう！';
      desc = `「${state.itemName}」は6つの視点からも本物の価値があると出ました。後悔しないでしょう！`;
    } else if (pct >= 0.4) {
      type = 'wait';
      emoji = '⏳';
      verdict = 'もう少し待って';
      desc = `「${state.itemName}」への気持ちはポジティブな面もありますが、引っかかる点もあります。1週間後に再考を。`;
    } else {
      type = 'skip';
      emoji = '🌊';
      verdict = '今回は見送ろう';
      desc = `「${state.itemName}」への欲求は一時的かもしれません。節約した分を本当に大切なものへ。`;
    }

    state.lastResult = { type, emoji, verdict, desc, scorePct };

    // Render result UI
    const circle = document.getElementById('result-circle');
    circle.className = `result-circle ${type}`;
    circle.textContent = emoji;
    if (type === 'buy') UI.spawnConfetti();

    document.getElementById(
      'result-score'
    ).textContent = `⭐ スコア ${scorePct}点 / 100点`;
    const vEl = document.getElementById('result-verdict');
    vEl.className = `result-verdict ${type}`;
    vEl.textContent = verdict;
    document.getElementById('result-desc').textContent = desc;

    UI.renderTimeline(state.answers, state.feedbacks);

    // Show/hide the "Did you buy it?" section
    const priceNum = parseFloat(state.itemPrice) || 0;
    const decisionSection = document.getElementById('decision-section');
    decisionSection.style.display = priceNum > 0 ? 'block' : 'none';

    UI.showScreen('screen-result');
  }

  // Called when user taps 買った / 買わなかった
  async function recordDecision(bought) {
    const priceNum = parseFloat(state.itemPrice) || 0;
    const { type, verdict, scorePct } = state.lastResult;

    const payload = {
      itemName: state.itemName,
      itemPrice: priceNum,
      type,
      verdict,
      score: scorePct,
      saved: !bought,
      date: new Date().toLocaleDateString('ja-JP', {
        month: 'short',
        day: 'numeric',
      }),
    };

    await saveResult(payload);
    await loadHistory();

    // Show toast
    const msg = bought
      ? '購入を記録しました！'
      : `¥${priceNum.toLocaleString()} の節約を記録しました 💰`;
    showToast(msg);

    // Hide decision buttons, update savings display
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('savings-result-block').style.display = bought
      ? 'none'
      : 'block';
    document.getElementById('savings-result-amount').textContent =
      '¥' + priceNum.toLocaleString();
    document.getElementById('savings-total-inline').textContent =
      '¥' + state.totalSaved.toLocaleString();
  }

  // ── Savings screen ───────────────────────────────────────────────────────
  async function showSavings() {
    try {
      const res = await fetch('/api/savings');
      if (!res.ok) throw new Error('savings fetch failed');
      const data = await res.json();
      state.totalSaved = data.totalSaved || 0;
      UI.renderSavings(data.totalSaved, data.monthly, data.savedItems);
    } catch (e) {
      console.error('showSavings:', e);
      UI.renderSavings(state.totalSaved, [], []);
    }
    UI.showScreen('screen-savings');
  }

  // ── History modal ────────────────────────────────────────────────────────
  async function openHistory() {
    await loadHistory();
    UI.renderHistory(state.history);
    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeHistory() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  function handleOverlayClick(e) {
    if (e.target === document.getElementById('modal-overlay')) closeHistory();
  }

  // ── Toast ────────────────────────────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3000);
  }

  // ── Reset ────────────────────────────────────────────────────────────────
  function resetApp() {
    document.getElementById('item-name').value = '';
    document.getElementById('item-price').value = '';
    UI.showScreen('screen-input');
  }

  // ── Boot ─────────────────────────────────────────────────────────────────
  async function boot() {
    UI.initFloaties();

    const user = await checkAuth();
    if (!user) {
      UI.showScreen('screen-login');
      return;
    }

    state.user = user;
    document.getElementById('user-name').textContent = user.name;
    document.getElementById('user-picture').src = user.picture || '';
    document.getElementById('user-picture').style.display = user.picture
      ? 'block'
      : 'none';
    await loadHistory();
    UI.showScreen('screen-input');
  }

  // ── Public API ───────────────────────────────────────────────────────────
  return {
    boot,
    handleLogin,
    handleLogout,
    startCheck,
    nextQuestion,
    recordDecision,
    showSavings,
    openHistory,
    closeHistory,
    handleOverlayClick,
    resetApp,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.boot());
