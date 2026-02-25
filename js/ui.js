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
    const CONFETTI_COUNT = 12;
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
    for (let i = 0; i < CONFETTI_COUNT; i++) {
      const bit   = document.createElement('div');
      const angle = (i / CONFETTI_COUNT) * 360;
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
    el.innerHTML = '';

    answers.forEach((a, i) => {
      const isActivism = a.theme === 'shihonshugi';
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

      const item = document.createElement('div');
      item.className = 'tl-item';

      const dot = document.createElement('div');
      dot.className = `tl-dot ${cls}`;
      dot.textContent = icon;

      const body = document.createElement('div');
      body.className = 'tl-body';

      const q = document.createElement('div');
      q.className = 'tl-q';
      q.textContent = a.themeLabel;

      const ans = document.createElement('div');
      ans.className = 'tl-a';
      ans.textContent = `「${a.a}」を選択`;

      const fb = document.createElement('div');
      fb.className = 'tl-fb';
      fb.textContent = feedbacks[i] || '—';

      body.appendChild(q);
      body.appendChild(ans);
      body.appendChild(fb);

      item.appendChild(dot);
      item.appendChild(body);
      el.appendChild(item);
    });
  },

  // 履歴モーダルの一覧を描画する
  // saved: null（未決定）のレコードには購入・見送りボタンを表示する
  renderHistory(history) {
    const el = document.getElementById('history-list');
    if (!el) return;
    el.innerHTML = '';

    if (!history.length) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-hist';
      emptyDiv.textContent = '😊 まだ履歴がありません';
      el.appendChild(emptyDiv);
      return;
    }

    history.forEach((h) => {
      const item = document.createElement('div');
      item.className = 'hist-item';

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'hist-name';
      name.textContent = h.itemName;

      const meta = document.createElement('div');
      meta.className = 'hist-meta';
      let metaText = h.date;
      if (h.itemPrice) metaText += ` · ¥${Number(h.itemPrice).toLocaleString()}`;
      metaText += ` · ${h.score}点`;
      meta.textContent = metaText;

      info.appendChild(name);
      info.appendChild(meta);

      const actions = document.createElement('div');
      actions.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end';

      if (h.saved === true) {
        const badge = document.createElement('span');
        badge.className = 'saved-badge';
        badge.textContent = `¥${Number(h.itemPrice).toLocaleString()} 節約`;
        actions.appendChild(badge);
      } else if (h.saved === null && h.itemPrice > 0) {
        const boughtBtn = document.createElement('button');
        boughtBtn.className = 'decision-btn-small bought';
        boughtBtn.textContent = '🛒 買った';
        boughtBtn.dataset.historyId = h.id;
        boughtBtn.dataset.isBought = 'true';

        const skippedBtn = document.createElement('button');
        skippedBtn.className = 'decision-btn-small skipped';
        skippedBtn.textContent = '🌿 見送った';
        skippedBtn.dataset.historyId = h.id;
        skippedBtn.dataset.isBought = 'false';

        actions.appendChild(boughtBtn);
        actions.appendChild(skippedBtn);
      }

      const badge = document.createElement('span');
      badge.className = `hist-badge ${h.type}`;
      badge.textContent = h.verdict;
      actions.appendChild(badge);

      item.appendChild(info);
      item.appendChild(actions);
      el.appendChild(item);
    });

    // イベントデリゲーション：ボタンクリック時の処理
    el.addEventListener('click', (e) => {
      if (e.target.classList.contains('decision-btn-small')) {
        const historyId = e.target.dataset.historyId;
        const isBought = e.target.dataset.isBought === 'true';
        App.updateHistoryDecision(historyId, isBought);
      }
    });
  },

  // 節約ダッシュボードを描画する（累計・月別内訳・節約アイテム一覧）
  renderSavings(total, monthly = [], savedItems = []) {
    const amountEl = document.getElementById('savings-amount');
    if (amountEl) amountEl.textContent = '¥' + Number(total).toLocaleString();

    const listEl = document.getElementById('savings-list');
    if (!listEl) return;

    listEl.innerHTML = '';

    if (!savedItems.length) {
      const emptyDiv = document.createElement('div');
      emptyDiv.className = 'empty-hist';
      emptyDiv.textContent = 'まだ節約記録がありません';
      listEl.appendChild(emptyDiv);
      return;
    }

    // 月別内訳セクション
    if (monthly.length) {
      const monthlyDiv = document.createElement('div');
      monthlyDiv.className = 'savings-monthly';

      const title = document.createElement('div');
      title.className = 'savings-monthly-title';
      title.textContent = '📅 月別内訳';
      monthlyDiv.appendChild(title);

      monthly.forEach((m) => {
        const row = document.createElement('div');
        row.className = 'savings-monthly-row';

        const label = document.createElement('span');
        label.className = 'savings-monthly-label';
        label.textContent = m.month.replace('-', '年') + '月';

        const amount = document.createElement('span');
        amount.className = 'savings-monthly-amount';
        amount.textContent = '¥' + Number(m.amount).toLocaleString();

        row.appendChild(label);
        row.appendChild(amount);
        monthlyDiv.appendChild(row);
      });

      listEl.appendChild(monthlyDiv);
    }

    // 節約アイテム一覧
    savedItems.forEach((h) => {
      const item = document.createElement('div');
      item.className = 'hist-item';

      const info = document.createElement('div');
      const name = document.createElement('div');
      name.className = 'hist-name';
      name.textContent = h.itemName;

      const meta = document.createElement('div');
      meta.className = 'hist-meta';
      meta.textContent = h.date;

      info.appendChild(name);
      info.appendChild(meta);

      const badge = document.createElement('span');
      badge.className = 'saved-badge';
      badge.textContent = '¥' + Number(h.itemPrice).toLocaleString();

      item.appendChild(info);
      item.appendChild(badge);
      listEl.appendChild(item);
    });
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
