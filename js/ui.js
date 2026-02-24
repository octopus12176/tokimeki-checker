// js/ui.js

const UI = {
  // 指定した ID の画面を表示し、他をすべて非表示にする
  showScreen(id) {
    document
      .querySelectorAll('.screen')
      .forEach((s) => s.classList.remove('active'));
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) el.classList.add('active');
    }, 30);
  },

  // プログレスバー下のステップドットを描画する
  renderStepDots(current, total) {
    const el = document.getElementById('step-dots');
    if (!el) return;
    el.innerHTML = '';
    for (let i = 0; i < total; i++) {
      const d = document.createElement('div');
      d.className =
        'step-dot' + (i < current ? ' done' : i === current ? ' active' : '');
      el.appendChild(d);
    }
  },

  // フィードバックバブルをローディング状態（ドットアニメーション）で表示する
  showFeedbackLoading() {
    const bubble = document.getElementById('feedback-bubble');
    const text   = document.getElementById('fb-text');
    if (!bubble || !text) return;
    text.innerHTML =
      '<span class="feedback-loading"><span></span><span></span><span></span></span>';
    bubble.style.display = 'flex';
  },

  // フィードバックバブルに AI の返答テキストを表示し、「次へ」ボタンを有効化する
  showFeedbackText(text) {
    const el = document.getElementById('fb-text');
    if (el) el.textContent = text;
    const btn = document.getElementById('btn-next');
    if (btn) btn.disabled = false;
  },

  // 「次の質問へ」ボタンを表示する（最終問は「結果を見る」に変える）
  showNextButton(isLast) {
    const btn = document.getElementById('btn-next');
    if (!btn) return;
    btn.style.display = 'flex';
    btn.disabled      = true; // フィードバック受信後に showFeedbackText で有効化される
    btn.textContent   = isLast ? '結果を見る 🎉' : '次の質問へ →';
  },

  // 「買う」判定のときに結果アイコン周りにコンフェティを飛ばす
  spawnConfetti() {
    const c = document.getElementById('confetti-container');
    if (!c) return;
    c.innerHTML = '';
    const colors = [
      'var(--pink)',
      'var(--yellow)',
      'var(--mint)',
      'var(--purple)',
      'var(--blue)',
    ];
    for (let i = 0; i < 12; i++) {
      const bit   = document.createElement('div');
      const angle = (i / 12) * 360;
      const dist  = 50 + Math.random() * 30;
      bit.className = 'confetti-bit';
      bit.style.cssText = [
        `background:${colors[i % colors.length]}`,
        `--tx:${Math.cos((angle * Math.PI) / 180) * dist}px`,
        `--ty:${Math.sin((angle * Math.PI) / 180) * dist}px`,
        `--rot:${Math.random() * 360}deg`,
        `--delay:${Math.random() * 0.3}s`,
        'top:50%',
        'left:50%',
      ].join(';');
      c.appendChild(bit);
    }
  },

  // 結果画面のタイムラインを描画する（各質問の回答とフィードバックを一覧表示）
  renderTimeline(answers, feedbacks) {
    const el = document.getElementById('timeline');
    if (!el) return;
    el.innerHTML = answers
      .map((a, i) => {
        const isActivism = a.theme === 'shihonshugi';
        // スコアに応じてドットの色クラスを決定する
        const cls = isActivism
          ? 'activism'
          : a.score >= 2
          ? 'positive'
          : a.score <= -2
          ? 'negative'
          : 'neutral';
        const icon = isActivism
          ? '🌍'
          : a.score >= 2
          ? '✅'
          : a.score <= -2
          ? '⚠️'
          : '📊';
        return `
        <div class="tl-item">
          <div class="tl-dot ${cls}">${icon}</div>
          <div class="tl-body">
            <div class="tl-q">${a.themeLabel}</div>
            <div class="tl-a">「${a.a}」を選択</div>
            <div class="tl-fb">${feedbacks[i] || '—'}</div>
          </div>
        </div>`;
      })
      .join('');
  },

  // 履歴モーダルの一覧を描画する
  // saved: null（未決定）のレコードには購入・見送りボタンを表示する
  renderHistory(history) {
    const el = document.getElementById('history-list');
    if (!el) return;
    if (!history.length) {
      el.innerHTML = '<div class="empty-hist">😊 まだ履歴がありません</div>';
      return;
    }
    el.innerHTML = history
      .map(
        (h) => `
      <div class="hist-item">
        <div>
          <div class="hist-name">${h.itemName}</div>
          <div class="hist-meta">
            ${h.date}
            ${h.itemPrice ? ' · ¥' + Number(h.itemPrice).toLocaleString() : ''}
            · ${h.score}点
          </div>
        </div>
        <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end">
          ${
            h.saved === true
              ? `<span class="saved-badge">¥${Number(h.itemPrice).toLocaleString()} 節約</span>`
              : h.saved === null && h.itemPrice > 0
              ? `<button class="decision-btn-small bought" onclick="App.updateHistoryDecision('${h.id}',true)">🛒 買った</button>
                 <button class="decision-btn-small skipped" onclick="App.updateHistoryDecision('${h.id}',false)">🌿 見送った</button>`
              : ''
          }
          <span class="hist-badge ${h.type}">${h.verdict}</span>
        </div>
      </div>`
      )
      .join('');
  },

  // 節約ダッシュボードを描画する（累計・月別内訳・節約アイテム一覧）
  renderSavings(total, monthly = [], savedItems = []) {
    const amountEl = document.getElementById('savings-amount');
    if (amountEl) amountEl.textContent = '¥' + Number(total).toLocaleString();

    const listEl = document.getElementById('savings-list');
    if (!listEl) return;

    if (!savedItems.length) {
      listEl.innerHTML = '<div class="empty-hist">まだ節約記録がありません</div>';
      return;
    }

    // 月別内訳セクション
    const monthlyHtml = monthly.length
      ? `
      <div class="savings-monthly">
        <div class="savings-monthly-title">📅 月別内訳</div>
        ${monthly
          .map(
            (m) => `
          <div class="savings-monthly-row">
            <span class="savings-monthly-label">${m.month.replace('-', '年')}月</span>
            <span class="savings-monthly-amount">¥${Number(m.amount).toLocaleString()}</span>
          </div>`
          )
          .join('')}
      </div>`
      : '';

    // 節約アイテム一覧
    const itemsHtml = savedItems
      .map(
        (h) => `
      <div class="hist-item">
        <div>
          <div class="hist-name">${h.itemName}</div>
          <div class="hist-meta">${h.date}</div>
        </div>
        <span class="saved-badge">¥${Number(h.itemPrice).toLocaleString()}</span>
      </div>`
      )
      .join('');

    listEl.innerHTML = monthlyHtml + itemsHtml;
  },

  // 背景に浮かぶ装飾絵文字（フローティー）を初期化する
  initFloaties() {
    const container = document.getElementById('floaties');
    if (!container) return;
    [
      '✨', '💫', '⭐', '🌟', '💖',
      '🛍️', '💸', '🌈', '🎀', '💝', '🌸', '🍭',
    ].forEach((em) => {
      const el = document.createElement('div');
      el.className   = 'floaty';
      el.textContent = em;
      el.style.cssText = [
        `left:${Math.random() * 90}%`,
        `top:${Math.random() * 90}%`,
        `animation-duration:${6 + Math.random() * 8}s`,
        `animation-delay:${Math.random() * 5}s`,
        `font-size:${18 + Math.random() * 18}px`,
      ].join(';');
      container.appendChild(el);
    });
  },
};
