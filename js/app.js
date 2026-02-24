// js/app.js

const App = (() => {
  // ── 状態管理 ─────────────────────────────────────────────────────────────────
  let state = {
    user:        null,  // { id, name, email, picture }
    itemName:    '',
    itemPrice:   '',
    currentQ:    0,     // 現在の質問インデックス
    scores:      [],    // 各質問のスコア（数値の配列）
    feedbacks:   [],    // AI が生成したフィードバック文の配列
    answers:     [],    // { theme, themeLabel, q, a, score } の配列
    lastResult:  null,  // { id, type, verdict, scorePct, ... }
    history:     [],
    totalSaved:  0,
  };

  // ── 認証 ─────────────────────────────────────────────────────────────────────

  // サーバーに現在のセッションを問い合わせ、ユーザー情報を返す
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

  // ── データ取得・API 呼び出し ──────────────────────────────────────────────────

  // 履歴一覧と累計節約額を取得して state に反映する
  async function loadHistory() {
    try {
      const res = await fetch('/api/history');
      if (!res.ok) return;
      const data        = await res.json();
      state.history     = data.history    || [];
      state.totalSaved  = data.totalSaved || 0;
    } catch (e) {
      console.error('loadHistory:', e);
    }
  }

  // チェック結果をサーバーに保存する
  // payload: { id, itemName, itemPrice, type, verdict, score, saved, date }
  async function saveResult(payload) {
    try {
      await fetch('/api/history', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(payload),
      });
    } catch (e) {
      console.error('saveResult:', e);
    }
  }

  // 選択した回答を AI に送り、フィードバック文を取得する
  async function fetchFeedback(opt, questionIndex) {
    const res = await fetch('/api/feedback', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemName:      state.itemName,
        itemPrice:     state.itemPrice,
        questionText:  QUESTIONS[questionIndex].text,
        answerText:    opt.label,
        answerScore:   opt.score,
        questionIndex,
        questionTheme: QUESTIONS[questionIndex].theme,
      }),
    });
    if (!res.ok) throw new Error('feedback API error');
    const data = await res.json();
    return data.feedback;
  }

  // ── 質問フロー ────────────────────────────────────────────────────────────────

  // 商品名・価格を確定してチェックを開始する
  function startCheck() {
    if (!state.user) { UI.showScreen('screen-login'); return; }
    state.itemName   = document.getElementById('item-name').value.trim() || 'この商品';
    state.itemPrice  = document.getElementById('item-price').value;
    state.currentQ   = 0;
    state.scores     = [];
    state.feedbacks  = [];
    state.answers    = [];
    state.lastResult = null;
    UI.showScreen('screen-questions');
    renderQuestion();
  }

  // 現在の質問を画面に描画する
  function renderQuestion() {
    const q          = QUESTIONS[state.currentQ];
    const total      = QUESTIONS.length;
    const isActivism = q.theme === 'shihonshugi';

    // 消費文化テーマはダークカラーの特別カードで表示する
    document.getElementById('q-card').className = isActivism ? 'card activism-card' : 'card';

    const chip = document.getElementById('q-chip');
    chip.className = isActivism ? 'q-item-chip activism' : 'q-item-chip';
    document.getElementById('q-chip-name').textContent = state.itemName;

    // プログレスバーとステップドット
    document.getElementById('progress-fill').style.width =
      (state.currentQ / total) * 100 + '%';
    document.getElementById('q-number-label').textContent =
      `質問 ${state.currentQ + 1} / ${total}`;
    UI.renderStepDots(state.currentQ, total);

    // テーマタグの色をテーマカラーに合わせる
    const tag = document.getElementById('q-theme-tag');
    tag.textContent = q.themeLabel;
    if (isActivism) {
      tag.style.cssText = 'background:rgba(199,125,255,.2);border-color:#C77DFF;color:#C77DFF';
    } else {
      const c = q.themeColor;
      tag.style.cssText = `background:${c}33;border-color:${c};color:${
        c === 'var(--yellow)' ? '#b89300' : c
      }`;
    }

    document.getElementById('q-text').textContent = q.text;
    document.getElementById('q-sub').textContent  = q.sub;

    // 選択肢ボタンを生成する
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

    // フィードバックバブルと「次へ」ボタンをリセット
    document.getElementById('feedback-bubble').style.display = 'none';
    document.getElementById('btn-next').style.display        = 'none';
  }

  // 選択肢を選んだときの処理（他の選択肢を無効化 → AI フィードバック取得）
  async function pickAnswer(opt, btn) {
    document.querySelectorAll('.opt-btn').forEach((b) => {
      b.disabled = true;
      b.classList.remove('selected');
    });
    btn.classList.add('selected');

    state.scores.push(opt.score);
    state.answers.push({
      theme:      QUESTIONS[state.currentQ].theme,
      themeLabel: QUESTIONS[state.currentQ].themeLabel,
      q:          QUESTIONS[state.currentQ].text,
      a:          opt.label,
      score:      opt.score,
    });

    UI.showFeedbackLoading();
    UI.showNextButton(state.currentQ === QUESTIONS.length - 1);

    try {
      const text = await fetchFeedback(opt, state.currentQ);
      state.feedbacks.push(text);
      UI.showFeedbackText(text);
    } catch {
      // API 失敗時はスコアに応じたフォールバックメッセージを表示する
      const fallback =
        opt.score >= 2  ? '✅ 良いサインです！' :
        opt.score <= -2 ? '⚠️ 少し立ち止まってみましょう' :
                          '📊 バランスが大切ですね';
      state.feedbacks.push(fallback);
      UI.showFeedbackText(fallback);
    }
  }

  // 「次の質問へ」ボタンが押されたときの処理
  function nextQuestion() {
    state.currentQ++;
    if (state.currentQ >= QUESTIONS.length) {
      // 全問終了 → ローディング画面を経由して結果を生成する
      UI.showScreen('screen-loading');
      setTimeout(buildResult, 1200);
    } else {
      renderQuestion();
    }
  }

  // ── 結果生成 ──────────────────────────────────────────────────────────────────

  async function buildResult() {
    // スコアを 0〜100 に正規化する（理論値: MAX=18, MIN=-17）
    const MAX = 18, MIN = -17;
    const total    = state.scores.reduce((a, b) => a + b, 0);
    const pct      = Math.max(0, Math.min(1, (total - MIN) / (MAX - MIN)));
    const scorePct = Math.round(pct * 100);

    // スコアに応じて判定タイプを決定する
    let type, emoji, verdict, desc;
    if (pct >= 0.65) {
      type    = 'buy';
      emoji   = '🛒';
      verdict = '買っちゃおう！';
      desc    = `「${state.itemName}」は6つの視点からも本物の価値があると出ました。後悔しないでしょう！`;
    } else if (pct >= 0.4) {
      type    = 'wait';
      emoji   = '⏳';
      verdict = 'もう少し待って';
      desc    = `「${state.itemName}」への気持ちはポジティブな面もありますが、引っかかる点もあります。1週間後に再考を。`;
    } else {
      type    = 'skip';
      emoji   = '🌊';
      verdict = '今回は見送ろう';
      desc    = `「${state.itemName}」への欲求は一時的かもしれません。節約した分を本当に大切なものへ。`;
    }

    // 結果を一意の ID で保存する（購入決定は後から PATCH で更新）
    const recordId = crypto.randomUUID();
    state.lastResult = { id: recordId, type, emoji, verdict, desc, scorePct };

    saveResult({
      id:        recordId,
      itemName:  state.itemName,
      itemPrice: parseFloat(state.itemPrice) || 0,
      type, verdict, score: scorePct,
      saved: null, // 未決定
      date:  new Date().toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' }),
    });

    // 結果 UI を描画する
    const circle = document.getElementById('result-circle');
    circle.className   = `result-circle ${type}`;
    circle.textContent = emoji;
    if (type === 'buy') UI.spawnConfetti();

    document.getElementById('result-score').textContent =
      `⭐ スコア ${scorePct}点 / 100点`;

    const vEl = document.getElementById('result-verdict');
    vEl.className   = `result-verdict ${type}`;
    vEl.textContent = verdict;

    document.getElementById('result-desc').textContent = desc;

    UI.renderTimeline(state.answers, state.feedbacks);

    // 価格未入力の場合は「購入した / しなかった」の決定セクションを非表示にする
    const priceNum = parseFloat(state.itemPrice) || 0;
    document.getElementById('decision-section').style.display =
      priceNum > 0 ? 'block' : 'none';

    UI.showScreen('screen-result');
  }

  // ── 購入決定ヘルパー ─────────────────────────────────────────────────────────

  // 履歴レコードの saved フィールドを PATCH で更新する
  // saved: true = 見送り（節約）/ false = 購入
  async function patchDecision(id, saved) {
    try {
      await fetch('/api/history', {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ id, saved }),
      });
    } catch (e) {
      console.error('patchDecision:', e);
    }
  }

  // 履歴モーダルから後から購入・見送りを登録する
  async function updateHistoryDecision(id, bought) {
    await patchDecision(id, !bought); // bought=false → saved=true（見送り）
    await loadHistory();
    UI.renderHistory(state.history);
    showToast(bought ? '購入を記録しました！' : '節約を記録しました 💰');
  }

  // 結果画面の「買った / 買わなかった」ボタンから決定を登録する
  async function recordDecision(bought) {
    const priceNum = parseFloat(state.itemPrice) || 0;
    await patchDecision(state.lastResult.id, !bought);
    await loadHistory();

    const msg = bought
      ? '購入を記録しました！'
      : `¥${priceNum.toLocaleString()} の節約を記録しました 💰`;
    showToast(msg);

    // 決定ボタンを隠し、見送りの場合は節約額ブロックを表示する
    document.getElementById('decision-section').style.display = 'none';
    document.getElementById('savings-result-block').style.display =
      bought ? 'none' : 'block';
    document.getElementById('savings-result-amount').textContent =
      '¥' + priceNum.toLocaleString();
    document.getElementById('savings-total-inline').textContent =
      '¥' + state.totalSaved.toLocaleString();
  }

  // ── 節約画面 ─────────────────────────────────────────────────────────────────

  async function showSavings() {
    if (!state.user) { UI.showScreen('screen-login'); return; }
    try {
      const res = await fetch('/api/savings');
      if (!res.ok) throw new Error('savings fetch failed');
      const data       = await res.json();
      state.totalSaved = data.totalSaved || 0;
      UI.renderSavings(data.totalSaved, data.monthly, data.savedItems);
    } catch (e) {
      console.error('showSavings:', e);
      UI.renderSavings(state.totalSaved, [], []);
    }
    UI.showScreen('screen-savings');
  }

  // ── 履歴モーダル ─────────────────────────────────────────────────────────────

  async function openHistory() {
    if (!state.user) { UI.showScreen('screen-login'); return; }
    await loadHistory();
    UI.renderHistory(state.history);
    document.getElementById('modal-overlay').classList.add('open');
  }

  function closeHistory() {
    document.getElementById('modal-overlay').classList.remove('open');
  }

  // モーダル背景クリックで閉じる
  function handleOverlayClick(e) {
    if (e.target === document.getElementById('modal-overlay')) closeHistory();
  }

  // ── トースト通知 ─────────────────────────────────────────────────────────────

  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('visible');
    setTimeout(() => t.classList.remove('visible'), 3000);
  }

  // ── リセット ─────────────────────────────────────────────────────────────────

  // 入力フォームをクリアして入力画面に戻る
  function resetApp() {
    document.getElementById('item-name').value  = '';
    document.getElementById('item-price').value = '';
    UI.showScreen('screen-input');
  }

  // ── 初期化 ───────────────────────────────────────────────────────────────────

  async function boot() {
    UI.initFloaties();

    // セッション確認：未認証ならログイン画面を表示する
    const user = await checkAuth();
    if (!user) {
      UI.showScreen('screen-login');
      // URL クエリパラメータでエラー種別を確認してメッセージを表示する
      const params = new URLSearchParams(window.location.search);
      if (params.get('error') === 'unauthorized') {
        const el = document.getElementById('login-error');
        if (el) {
          el.style.display = 'block';
          el.textContent   = '⚠️ このGoogleアカウントはアクセス許可されていません。';
        }
      }
      return;
    }

    // 認証済み：ヘッダーにユーザー情報を表示して入力画面へ
    state.user = user;
    document.getElementById('header-right').style.display = '';
    document.getElementById('user-name').textContent      = user.name;
    document.getElementById('user-picture').src           = user.picture || '';
    document.getElementById('user-picture').style.display = user.picture ? 'block' : 'none';

    await loadHistory();
    UI.showScreen('screen-input');
  }

  // ── 公開 API ─────────────────────────────────────────────────────────────────
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
    updateHistoryDecision,
  };
})();

document.addEventListener('DOMContentLoaded', () => App.boot());
