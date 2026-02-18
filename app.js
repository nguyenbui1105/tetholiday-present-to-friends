var SHEETS_ENDPOINT = 'https://script.google.com/macros/s/AKfycbzpWpEzwwZjhV0DJgxDPEZBuAhppiO1FGc5gXBhYCfq/exec';
var SHEETS_API_KEY  = 'YOUR_REAL_KEY';
var APP_VERSION     = '20260217b';

function normalizeSheetsUrl(url) {
  return url.replace(/\/dev$/, '/exec');
}

async function submitToSheets(payload) {
  var endpoint = normalizeSheetsUrl(SHEETS_ENDPOINT);
  var headers  = { 'Content-Type': 'application/json' };
  if (SHEETS_API_KEY) headers['X-API-Key'] = SHEETS_API_KEY;

  if (typeof payload.wishes_json === 'object') {
    payload.wishes_json = JSON.stringify(payload.wishes_json);
  }
  payload.amount = parseInt(payload.amount, 10) || 0;

  var response = await fetch(endpoint, {
    method:  'POST',
    headers: headers,
    body:    JSON.stringify(payload)
  });

  var text = await response.text();
  var json;
  try { json = JSON.parse(text); } catch (_) { json = {}; }

  if (DEV) console.log('[SHEETS]', endpoint, response.status, json.ok, text.slice(0, 200));

  if (!json.ok) {
    throw new Error('HTTP ' + response.status + ': ' + (json.error || text.slice(0, 120)));
  }
  return true;
}

function formatVND(amount) {
  return amount.toLocaleString('vi-VN') + ' VND';
}

function rewardOrderKey(playerKey) { return 'rewardOrder_' + playerKey; }

function getOrCreateRewardOrder(playerKey) {
  var stored = localStorage.getItem(rewardOrderKey(playerKey));
  if (stored) {
    try { return JSON.parse(stored); } catch (e) {}
  }
  // Fisher-Yates shuffle of [0..4] indices into LUCKY_REWARDS
  var order = [0, 1, 2, 3, 4];
  for (var i = order.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var t = order[i]; order[i] = order[j]; order[j] = t;
  }
  localStorage.setItem(rewardOrderKey(playerKey), JSON.stringify(order));
  return order;
}

/* ── Per-player bias ──────────────────────────────────────────
   After a standard 52-card shuffle, we nudge a couple of cards
   matching favoredRanks into the player's opening hand (pos 0-1).
   This keeps each deal random but gives a "lucky" feel.          */
var PLAYER_BIAS = {
  han_bui: ['A', '2', '3', '4', '5'],   // low cards → ngũ linh friendly
  boi:     ['10', '9', '8'],             // high pair → stand-and-win
  ngan:    ['5', '6', '7', '10'],        // mid range, adaptable
  diep:    ['A', 'K', 'Q', '10'],        // high → xì dách potential
  ngoc:    ['10', '9', '8']              // strong start
};

var DEV = new URL(location.href).searchParams.has('dev');

var state = {
  playerKey: null,
  playerName: null,
  game: null
};

function pickedKey(playerKey) {
  return 'pickedEnvelope_' + playerKey;
}

function getPickedEnvIndex(playerKey) {
  var v = localStorage.getItem(pickedKey(playerKey));
  if (v === null) return null;
  var n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function setPickedEnvIndex(playerKey, idx) {
  localStorage.setItem(pickedKey(playerKey), String(idx));
}

function hasPickedEnvelope(playerKey) {
  return localStorage.getItem(pickedKey(playerKey)) !== null;
}

function claimedKey(playerKey) {
  return 'claimed_' + playerKey;
}

function isClaimed(playerKey) {
  return localStorage.getItem(claimedKey(playerKey)) === '1';
}

function setClaimed(playerKey) {
  localStorage.setItem(claimedKey(playerKey), '1');
}

function attemptKey(playerKey) {
  return 'attempt_' + playerKey;
}

function getAttempt(playerKey) {
  var v = localStorage.getItem(attemptKey(playerKey));
  return v ? Number(v) : 0;
}

function bumpAttempt(playerKey) {
  localStorage.setItem(attemptKey(playerKey), String(getAttempt(playerKey) + 1));
}

function resetAttempt(playerKey) {
  localStorage.removeItem(attemptKey(playerKey));
}

function winsKey(playerKey)  { return 'wins_' + playerKey; }
function getWins(playerKey)  { return parseInt(localStorage.getItem(winsKey(playerKey)) || '0', 10); }
function setWins(playerKey, n) { localStorage.setItem(winsKey(playerKey), String(n)); }
function incWins(playerKey)  { var n = getWins(playerKey) + 1; setWins(playerKey, n); return n; }

function wishesKey(playerKey) { return 'wishes_' + playerKey; }
function getWishes(playerKey) {
  try { return JSON.parse(localStorage.getItem(wishesKey(playerKey)) || '{}'); } catch (e) { return {}; }
}
function setWishes(playerKey, obj) { localStorage.setItem(wishesKey(playerKey), JSON.stringify(obj)); }

function resetAllPlayerData() {
  PLAYERS.forEach(function (p) {
    localStorage.removeItem(pickedKey(p.key));
    localStorage.removeItem(claimedKey(p.key));
    localStorage.removeItem(attemptKey(p.key));
    localStorage.removeItem(winsKey(p.key));
    localStorage.removeItem(rewardOrderKey(p.key));
    localStorage.removeItem(wishesKey(p.key));
  });
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
  if (id === 's-reward') {
    if (DEV) console.log('[nav] entered reward');
    setupRewardUI();
  }
}

function parseCard(str) {
  var suit = str.slice(-1);
  var rank = str.slice(0, -1);
  return { rank: rank, suit: suit };
}

function createCardEl(cardStr, isBack, animClass, delay) {
  var el = document.createElement('div');
  el.className = 'playing-card';

  if (isBack) {
    el.classList.add('back');
  } else {
    var p = parseCard(cardStr);
    el.classList.add('face');
    el.classList.add((p.suit === '♥' || p.suit === '♦') ? 'red' : 'black');

    var rankSpan = document.createElement('span');
    rankSpan.className = 'rank';
    rankSpan.textContent = p.rank;
    el.appendChild(rankSpan);

    var suitSpan = document.createElement('span');
    suitSpan.className = 'suit';
    suitSpan.textContent = p.suit;
    el.appendChild(suitSpan);
  }

  if (animClass) {
    el.classList.add(animClass);
    if (delay) el.style.animationDelay = delay + 'ms';
  }
  return el;
}

/* ── Scoring ── */

var SUITS = ['♠', '♦', '♥', '♣'];
var RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

function cardValue(rank) {
  if (rank === 'A') return 11;
  if (rank === 'K' || rank === 'Q' || rank === 'J') return 10;
  return Number(rank);
}

function calcTotal(cards) {
  var total = 0;
  var aces = 0;
  for (var i = 0; i < cards.length; i++) {
    var r = parseCard(cards[i]).rank;
    total += cardValue(r);
    if (r === 'A') aces++;
  }
  while (total > 21 && aces > 0) {
    total -= 10;
    aces--;
  }
  return total;
}

function isXiDach(cards) {
  return cards.length === 2 && calcTotal(cards) === 21;
}

function isNguLinh(cards) {
  return cards.length === 5 && calcTotal(cards) <= 21;
}

function buildStandardDeck() {
  var deck = [];
  for (var r = 0; r < RANKS.length; r++) {
    for (var s = 0; s < SUITS.length; s++) {
      deck.push(RANKS[r] + SUITS[s]);
    }
  }
  return deck;
}

function shuffle(arr) {
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i];
    arr[i] = arr[j];
    arr[j] = tmp;
  }
  return arr;
}

function applyBias(deck, favoredRanks) {
  if (!favoredRanks || favoredRanks.length === 0) return;
  // Find indices of cards whose rank is in favoredRanks (skip pos 0-1)
  var candidates = [];
  for (var i = 2; i < deck.length; i++) {
    var rank = parseCard(deck[i]).rank;
    if (favoredRanks.indexOf(rank) !== -1) candidates.push(i);
  }
  if (candidates.length === 0) return;
  // Swap 1-2 random favored cards into player positions (0, 1)
  var count = Math.min(2, candidates.length);
  for (var p = 0; p < count; p++) {
    var pick = Math.floor(Math.random() * candidates.length);
    var ci = candidates[pick];
    var tmp = deck[p];
    deck[p] = deck[ci];
    deck[ci] = tmp;
    candidates.splice(pick, 1);
  }
}

function drawCard(g) {
  return g.deck[g.deckIndex++];
}

function renderGame() {
  var g = state.game;
  var section = document.getElementById('s-game');
  var mode = g.animateMode || 'none';
  g.animateMode = 'none';

  section.innerHTML = '';

  var table = document.createElement('div');
  table.className = 'table';

  // --- Progress pill ---
  var pill = document.createElement('div');
  pill.className = 'progress-pill';
  pill.textContent = 'Ván thắng: ' + getWins(state.playerKey) + ' / 3';
  table.appendChild(pill);

  // --- Dealer hand ---
  var dealerBlock = document.createElement('div');
  dealerBlock.className = 'hand-block';
  var dealerInfo = document.createElement('div');
  dealerInfo.className = 'player-info';
  var dealerAvatar = document.createElement('img');
  dealerAvatar.src = './assets/nguyen.jpg';
  dealerAvatar.alt = 'Nguyên';
  dealerAvatar.className = 'avatar avatar-dealer';
  var dealerLabel = document.createElement('span');
  dealerLabel.className = 'hand-title';
  dealerLabel.textContent = 'CHỦ SÒNG – NGUYÊN';
  dealerInfo.appendChild(dealerAvatar);
  dealerInfo.appendChild(dealerLabel);
  dealerBlock.appendChild(dealerInfo);

  var dealerHand = document.createElement('div');
  dealerHand.className = 'hand';
  g.dealerCards.forEach(function (c, i) {
    // During play: card[1] face-down. After finished: all face-up.
    var isBack = !g.finished && i === 1;
    var anim = null;
    var delay = 0;

    if (mode === 'deal') {
      anim = 'deal-in';
      delay = i * 80;
    } else if (mode === 'reveal') {
      if (i === 1) {
        anim = 'flip-in';
      } else if (i >= 2) {
        anim = 'deal-in';
        delay = 300 + (i - 2) * 150;
      }
    }
    dealerHand.appendChild(createCardEl(c, isBack, anim, delay));
  });
  dealerBlock.appendChild(dealerHand);
  table.appendChild(dealerBlock);

  // --- Player hand ---
  var currentPlayer = PLAYERS.find(function (p) { return p.key === state.playerKey; });
  var playerBlock = document.createElement('div');
  playerBlock.className = 'hand-block';
  var playerInfo = document.createElement('div');
  playerInfo.className = 'player-info';
  var playerAvatar = document.createElement('img');
  playerAvatar.src = currentPlayer ? currentPlayer.avatar : '';
  playerAvatar.alt = state.playerName;
  playerAvatar.className = 'avatar avatar-player';
  var playerLabel = document.createElement('span');
  playerLabel.className = 'hand-title';
  playerLabel.textContent = 'CON BẠC: ' + state.playerName;
  playerInfo.appendChild(playerAvatar);
  playerInfo.appendChild(playerLabel);
  playerBlock.appendChild(playerInfo);

  var playerHand = document.createElement('div');
  playerHand.className = 'hand';
  var staggerBase = 2; // initial dealer card count for stagger
  g.playerCards.forEach(function (c, i) {
    var anim = null;
    var delay = 0;

    if (mode === 'deal') {
      anim = 'deal-in';
      delay = (staggerBase + i) * 80;
    } else if ((mode === 'hit' || mode === 'bust') && i === g.playerCards.length - 1) {
      anim = 'deal-in';
    }
    playerHand.appendChild(createCardEl(c, false, anim, delay));
  });
  playerBlock.appendChild(playerHand);
  table.appendChild(playerBlock);

  // --- Buttons (only during active play; result screen handles finished state) ---
  if (!g.finished) {
    var btnRow = document.createElement('div');
    btnRow.className = 'btn-row';

    var hitBtn = document.createElement('button');
    hitBtn.type = 'button';
    hitBtn.textContent = 'Bốc';
    hitBtn.addEventListener('click', hit);
    btnRow.appendChild(hitBtn);

    var standBtn = document.createElement('button');
    standBtn.type = 'button';
    standBtn.textContent = 'Thôi';
    standBtn.addEventListener('click', stand);
    btnRow.appendChild(standBtn);

    table.appendChild(btnRow);
  }

  section.appendChild(table);
}

function startGame() {
  var deck = buildStandardDeck();
  shuffle(deck);
  applyBias(deck, PLAYER_BIAS[state.playerKey]);

  state.game = {
    playerCards: [deck[0], deck[1]],
    dealerCards: [deck[2], deck[3]],
    deck: deck,
    deckIndex: 4,
    finished: false,
    outcome: null,
    statusText: '',
    winLabel: '',
    animateMode: 'deal'
  };

  if (DEV) console.log('[game] start | player:', deck[0], deck[1],
    '| dealer:', deck[2], deck[3],
    '| bias:', PLAYER_BIAS[state.playerKey] || 'none');

  renderGame();

  // Auto-resolve xì dách (2-card 21)
  if (isXiDach(state.game.playerCards)) {
    if (DEV) console.log('[game] player xì dách — auto-resolve');
    setTimeout(function () { resolveRound(); }, 800);
  }
}

function hit() {
  var g = state.game;
  if (g.finished) return;

  var card = drawCard(g);
  g.playerCards.push(card);
  var total = calcTotal(g.playerCards);

  if (DEV) console.log('[game] hit:', card, '| total:', total,
    '| cards:', g.playerCards.length);

  if (total > 21) {
    g.finished = true;
    g.outcome = 'lose';
    g.statusText = 'Quắc! ' + total + ' điểm 😭';
    g.winLabel = 'Quắc';
    bumpAttempt(state.playerKey);
    g.animateMode = 'bust';
    renderGame();
    setTimeout(function () { showResult(); showScreen('s-result'); }, 900);
    return;
  }

  g.animateMode = 'hit';
  renderGame();
}

function stand() {
  var g = state.game;
  if (g.finished) return;
  resolveRound();
}

function showResult() {
  var g    = state.game;
  var wins = getWins(state.playerKey);
  var summary = document.getElementById('resultSummary');
  summary.innerHTML = '';

  // Dealer hand (fully revealed)
  var dLabel = document.createElement('p');
  dLabel.className = 'result-label';
  dLabel.textContent = 'CHỦ SÒNG – NGUYÊN (' + calcTotal(g.dealerCards) + ')';
  summary.appendChild(dLabel);
  var dHand = document.createElement('div');
  dHand.className = 'hand';
  g.dealerCards.forEach(function (c) { dHand.appendChild(createCardEl(c, false, null, 0)); });
  summary.appendChild(dHand);

  // Player hand
  var pLabel = document.createElement('p');
  pLabel.className = 'result-label';
  pLabel.textContent = 'CON BẠC: ' + state.playerName + ' (' + calcTotal(g.playerCards) + ')';
  summary.appendChild(pLabel);
  var pHand = document.createElement('div');
  pHand.className = 'hand';
  g.playerCards.forEach(function (c) { pHand.appendChild(createCardEl(c, false, null, 0)); });
  summary.appendChild(pHand);

  // Outcome + win label
  var msg = document.createElement('p');
  msg.className = 'result-outcome';
  msg.textContent = g.statusText + (g.winLabel ? '  (' + g.winLabel + ')' : '');
  summary.appendChild(msg);

  // Progress
  var prog = document.createElement('p');
  prog.className = 'result-progress';
  prog.textContent = 'Ván thắng: ' + wins + ' / 3';
  summary.appendChild(prog);

  // Update "Tiếp" button label
  var btn = document.getElementById('btnResultNext');
  if (btn) {
    btn.textContent = (g.outcome === 'win' && wins >= 3) ? 'Nhận thưởng 🧧' : 'Tiếp tục';
  }
}

function resolveRound() {
  var g = state.game;
  g.finished = true;

  var playerTotal = calcTotal(g.playerCards);
  var playerXD = isXiDach(g.playerCards);
  var playerNL = isNguLinh(g.playerCards);

  // Dealer draws to 17+
  while (calcTotal(g.dealerCards) < 17) {
    g.dealerCards.push(drawCard(g));
  }
  var dealerTotal = calcTotal(g.dealerCards);
  var dealerBust = dealerTotal > 21;
  var dealerXD = isXiDach(g.dealerCards);
  var dealerNL = isNguLinh(g.dealerCards);

  if (DEV) console.log('[game] resolve | player:', playerTotal,
    'xd:', playerXD, 'nl:', playerNL,
    '| dealer:', dealerTotal, 'xd:', dealerXD, 'nl:', dealerNL,
    'bust:', dealerBust);

  // Outcome evaluation (precedence per Xì Lác rules)
  if (playerXD) {
    g.winLabel = 'Xì dách';
    if (dealerXD) {
      g.outcome = 'draw';
      g.statusText = 'Cả hai xì dách! Hòa 🤝';
    } else {
      g.outcome = 'win';
      g.statusText = 'Xì dách! Bạn thắng 😎';
    }
  } else if (playerNL) {
    g.winLabel = 'Ngũ linh';
    if (dealerNL) {
      g.outcome = 'draw';
      g.statusText = 'Cả hai ngũ linh! Hòa 🤝';
    } else {
      g.outcome = 'win';
      g.statusText = 'Ngũ linh! 5 lá ≤ 21. Bạn thắng 😎';
    }
  } else if (dealerBust) {
    g.outcome = 'win';
    g.statusText = 'Chủ sòng quắc! ' + dealerTotal + ' điểm. Bạn thắng 😎';
    g.winLabel = 'Dealer quắc';
  } else if (playerTotal > dealerTotal) {
    g.outcome = 'win';
    g.statusText = playerTotal + ' vs ' + dealerTotal + '. Bạn thắng 😎';
    g.winLabel = 'Thắng điểm';
  } else if (playerTotal === dealerTotal) {
    g.outcome = 'draw';
    g.statusText = 'Hòa ' + playerTotal + ' điểm 🤝';
    g.winLabel = '';
  } else {
    g.outcome = 'lose';
    g.statusText = playerTotal + ' vs ' + dealerTotal + '. Chủ sòng ăn 😅';
    g.winLabel = 'Thua điểm';
  }

  if (g.outcome === 'win') {
    resetAttempt(state.playerKey);
    incWins(state.playerKey);
  } else {
    bumpAttempt(state.playerKey);
  }

  g.animateMode = 'reveal';
  renderGame();

  setTimeout(function () { showResult(); showScreen('s-result'); }, 700);
}

function setRewardState(s) {
  var closed   = document.getElementById('rewardClosed');
  var opened   = document.getElementById('rewardOpened');
  var envStage = document.getElementById('envelopeStage');
  var result   = document.getElementById('rewardResult');
  var box      = document.getElementById('rewardBox');
  if (!closed || !opened || !envStage || !result) return;

  closed.style.display   = s === 'A' ? 'block' : 'none';
  opened.style.display   = s === 'A' ? 'none'  : 'block';
  envStage.style.display = s === 'B' ? 'block' : 'none';
  result.style.display   = s === 'C' ? 'block' : 'none';
  if (box) box.dataset.rewardState = s;

  if (DEV) console.log('[reward] setState:', s,
    '| closed:', closed.style.display,
    '| opened:', opened.style.display,
    '| envStage:', envStage.style.display,
    '| result:', result.style.display);
}

function shuffleEnvelopeGrid() {
  var grid = document.getElementById('envelopeGrid');
  if (!grid) return;
  var buttons = Array.prototype.slice.call(grid.querySelectorAll('.envelope'));
  // Fisher-Yates shuffle
  for (var i = buttons.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var temp = buttons[i];
    buttons[i] = buttons[j];
    buttons[j] = temp;
  }
  buttons.forEach(function (btn) { grid.appendChild(btn); });
  if (DEV) console.log('[reward] shuffled envelopes:',
    buttons.map(function (b) { return b.dataset.env; }).join(','));
}

function setupRewardUI() {
  if (!state.playerKey) {
    showScreen('s-pick');
    return;
  }

  var picked = getPickedEnvIndex(state.playerKey);
  if (DEV) console.log('[reward] setupRewardUI | playerKey:', state.playerKey,
    '| picked:', picked,
    '| raw:', localStorage.getItem(pickedKey(state.playerKey)));

  // State C: already picked — show result directly
  if (picked !== null) {
    if (DEV) console.log('[reward] → State C (already picked)');
    setRewardState('C');
    renderReward();
    return;
  }

  // State A: show gift teaser, clear any stale result content
  if (DEV) console.log('[reward] → State A (teaser)');
  setRewardState('A');
  state.amount = null;
  document.getElementById('amountText').textContent = '';
  document.getElementById('wishText').textContent = '';

  // Wire "Mở quà" -> State B (shuffle + show envelopes)
  var openBtn = document.getElementById('btnOpenReward');
  if (openBtn) {
    var freshOpen = openBtn.cloneNode(true);
    openBtn.parentNode.replaceChild(freshOpen, openBtn);
    freshOpen.addEventListener('click', function () {
      if (DEV) console.log('[reward] → State B (envelopes)');
      shuffleEnvelopeGrid();
      wireEnvelopeButtons();
      setRewardState('B');
    });
  }
}

function wireEnvelopeButtons() {
  document.querySelectorAll('#envelopeGrid .envelope').forEach(function (envBtn) {
    var fresh = envBtn.cloneNode(true);
    envBtn.parentNode.replaceChild(fresh, envBtn);
    fresh.addEventListener('click', function () {
      if (getPickedEnvIndex(state.playerKey) !== null) return;
      var idx = Number(fresh.dataset.env);
      if (DEV) console.log('[reward] envelope clicked idx:', idx, '→ State C');
      setPickedEnvIndex(state.playerKey, idx);
      setRewardState('C');
      renderReward();
    });
  });
}

function renderReward() {
  var player = PLAYERS.find(function (p) { return p.key === state.playerKey; });
  var picked  = getPickedEnvIndex(state.playerKey);
  if (picked === null) return;

  var order  = getOrCreateRewardOrder(state.playerKey);
  var reward = LUCKY_REWARDS[order[picked]];
  state.amount = reward.amount;

  document.getElementById('amountText').textContent = 'Lì xì: ' + formatVND(reward.amount);

  var wishEl = document.getElementById('wishText');
  wishEl.innerHTML = '';

  // Reward title
  var titleEl = document.createElement('strong');
  titleEl.className = 'reward-reward-title';
  titleEl.textContent = reward.title;
  wishEl.appendChild(titleEl);

  // Number meaning
  var meaningEl = document.createElement('span');
  meaningEl.className = 'reward-number-meaning';
  meaningEl.textContent = reward.numberMeaning;
  wishEl.appendChild(meaningEl);

  // Blessing
  var blessingEl = document.createElement('span');
  blessingEl.className = 'reward-blessing';
  blessingEl.textContent = reward.blessing;
  wishEl.appendChild(blessingEl);

  // Personal wish from Nguyen
  if (player && player.wish) {
    var wishMsgEl = document.createElement('span');
    wishMsgEl.className = 'reward-personal-wish';
    wishMsgEl.textContent = player.wish;
    wishEl.appendChild(wishMsgEl);
  }
}

function buildWishSection(playerKey) {
  var section = document.getElementById('wishSection');
  if (!section) return;
  section.innerHTML = '';

  var recipients = PLAYERS.filter(function (p) { return p.key !== playerKey; });
  var saved = getWishes(playerKey);

  var hdr = document.createElement('div');
  hdr.className = 'wish-header';
  var hdrTitle = document.createElement('h3');
  hdrTitle.textContent = 'Gửi lời chúc';
  var hdrHint = document.createElement('p');
  hdrHint.className = 'wish-hint';
  hdrHint.innerHTML = 'P/S: Khi cả nhóm hoàn thành,<br>Chủ Sòng sẽ tổng hợp và bật mí một điều thú vị 😉';
  hdr.appendChild(hdrTitle);
  hdr.appendChild(hdrHint);
  section.appendChild(hdr);

  var grid = document.createElement('div');
  grid.className = 'wish-grid';

  recipients.forEach(function (p) {
    var card = document.createElement('div');
    card.className = 'wish-card';

    var info = document.createElement('div');
    info.className = 'wish-card-info';
    var img = document.createElement('img');
    img.src = p.avatar;
    img.alt = p.name;
    img.className = 'wish-avatar';
    var nameEl = document.createElement('span');
    nameEl.className = 'wish-name';
    nameEl.textContent = p.name;
    info.appendChild(img);
    info.appendChild(nameEl);

    var ta = document.createElement('textarea');
    ta.className = 'wish-textarea';
    ta.maxLength = 220;
    ta.rows = 3;
    ta.placeholder = 'Viết lời chúc cho ' + p.name + '\u2026';
    ta.dataset.recipientKey = p.key;
    ta.value = saved[p.key] || '';

    var counter = document.createElement('span');
    counter.className = 'wish-counter';
    counter.textContent = (saved[p.key] || '').length + '/220';

    ta.addEventListener('input', (function (recipientKey, counterEl) {
      return function () {
        var wishes = getWishes(playerKey);
        wishes[recipientKey] = ta.value;
        setWishes(playerKey, wishes);
        counterEl.textContent = ta.value.length + '/220';
      };
    }(p.key, counter)));

    card.appendChild(info);
    card.appendChild(ta);
    card.appendChild(counter);
    grid.appendChild(card);
  });

  section.appendChild(grid);
}

function goForm() {
  if (!state.playerKey) {
    showScreen('s-pick');
    return;
  }
  if (!hasPickedEnvelope(state.playerKey)) {
    alert('Bốc 1 bao lì xì trước đã nha 😎');
    showScreen('s-reward');
    return;
  }
  renderReward();
  var pn = document.getElementById('playerName');
  var amt = document.getElementById('amountInput');
  if (pn) pn.value = state.playerName || '';
  if (amt) amt.value = String(state.amount || '');
  buildWishSection(state.playerKey);
  showScreen('s-form');
}

/* ── How-to-play modal ── */

var _howtoCallback = null;

function showHowto(onClose) {
  _howtoCallback = typeof onClose === 'function' ? onClose : null;
  var overlay = document.getElementById('howtoOverlay');
  overlay.classList.add('active');
  overlay.setAttribute('aria-hidden', 'false');
  document.getElementById('btnHowtoClose').focus();
}

function hideHowto() {
  var overlay = document.getElementById('howtoOverlay');
  overlay.classList.remove('active');
  overlay.setAttribute('aria-hidden', 'true');
  var cb = _howtoCallback;
  _howtoCallback = null;
  if (cb) cb();
}

function renderNameList() {
  var container = document.getElementById('nameList');
  container.innerHTML = '';
  PLAYERS.filter(function (p) { return p.key !== 'nguyen'; }).forEach(function (player) {
    var btn = document.createElement('button');
    btn.type = 'button';
    btn.textContent = player.name;
    btn.addEventListener('click', function () {
      state.playerKey = player.key;
      state.playerName = player.name;
      if (isClaimed(state.playerKey)) {
        showScreen('s-end');
        return;
      }
      showHowto(function () {
        showScreen('s-game');
        startGame();
      });
    });
    container.appendChild(btn);
  });
}

/* ── Tet transition ── */

var WISH_TEXTS = [
  'Chúc mừng năm mới! 🎉',
  'An khang thịnh vượng ✨',
  'Tiền vô như nước 💰',
  'Vạn sự như ý 🌟',
  '8386 🧧',
  'Lộc lá đầy nhà 🍀',
  'Sức khỏe dồi dào 💪',
  'Phát tài phát lộc 🎊',
  'Năm mới vui vẻ 😊',
  'Bình an may mắn 🌸',
  'Crush tự đổ, không cần push 😌',
  'Sáng dậy thấy tiền về tài khoản 💳',
  'Chơi đâu thắng đó 🎰',
  'Con đường sự nghiệp full xanh 🟢',
  'Deadline né bạn như né drama 🏃',
  'Học đâu hiểu đó, thi đâu trúng đó 📚',
  'Ăn hoài không mập 🍜',
  'Ngủ ít vẫn đẹp 😴✨',
  'Trúng lì xì to như jackpot 💎',
  'Năm mới không “red flag” 🚩❌',
  'Tài khoản ngân hàng nở hoa 🌺💵',
  'May mắn bao vây như WiFi full vạch 📶',
  'Chủ Sòng luôn đứng về phía bạn 🧧😌',
  'Mở bài là thắng, kết bài là giàu 💰',
  'Làm ít hưởng nhiều 😆',
  'Cười nhiều hơn stress 😂',
  'Đầu năm rực rỡ, cuối năm dư dả 🌟',
  'Mọi ván bài đều ra 21 🎴',
  'Sống chill như nghỉ lễ dài ngày 🌴'
];


function launchTetTransition(callback, opts) {
  var done = typeof callback === 'function' ? callback : function () {};
  opts = opts || {};
  var DURATION    = opts.durationMs  || 2500;
  var wishesCount = opts.wishesCount || 12;
  var wishEveryMs = opts.wishEveryMs || 180;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    done();
    return;
  }

  var overlay = document.getElementById('fwOverlay');
  var canvas  = document.getElementById('fwCanvas');
  overlay.classList.add('fw-active');

  // Size canvas to full viewport at device pixel ratio
  var dpr = window.devicePixelRatio || 1;
  var W = window.innerWidth;
  var H = window.innerHeight;
  canvas.width  = W * dpr;
  canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  var particles  = [];
  var startTime  = 0;
  var lastLaunch = -9999;
  var rafId      = null;

  var FW_COLORS = ['#ffd700', '#ff4444', '#ff9933', '#ff66aa', '#ffee33', '#ff3366', '#ff8800'];

  function Particle(x, y, vx, vy, color, r) {
    this.x = x; this.y = y; this.vx = vx; this.vy = vy;
    this.color = color; this.r = r;
    this.alpha = 1; this.life = 0;
  }
  Particle.prototype.update = function () {
    this.vy += 0.055;
    this.vx *= 0.97;
    this.vy *= 0.97;
    this.x  += this.vx;
    this.y  += this.vy;
    this.life++;
    this.alpha = Math.max(0, 1 - this.life / 65);
  };
  Particle.prototype.draw = function (c) {
    c.globalAlpha = this.alpha;
    c.beginPath();
    c.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    c.fillStyle = this.color;
    c.fill();
  };

  function launchFirework() {
    var x = W * (0.18 + Math.random() * 0.64);
    var y = H * (0.08 + Math.random() * 0.42);
    var n = 55 + Math.floor(Math.random() * 45);
    for (var i = 0; i < n; i++) {
      var angle = (Math.PI * 2 * i) / n;
      var speed = 1.8 + Math.random() * 4.2;
      var color = FW_COLORS[Math.floor(Math.random() * FW_COLORS.length)];
      particles.push(new Particle(
        x, y,
        Math.cos(angle) * speed,
        Math.sin(angle) * speed,
        color,
        1.4 + Math.random() * 1.6
      ));
    }
  }

  function spawnWishes() {
    // Fisher-Yates shuffle on a copy
    var pool = WISH_TEXTS.slice();
    for (var i = pool.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }

    // Nine evenly-spaced horizontal lanes across the full viewport
    var LANES    = [0.08, 0.18, 0.28, 0.38, 0.50, 0.62, 0.72, 0.82, 0.92];
    var laneIdx  = Math.floor(Math.random() * LANES.length); // start at random lane
    var lastX    = -999;
    var idx      = 0;
    var lastText = '';

    function spawnOne() {
      if (idx >= wishesCount) return;

      // No-immediate-repeat text guard
      var text = pool[idx % pool.length];
      if (text === lastText && pool.length > 1) {
        text = pool[(idx + 1) % pool.length];
      }
      lastText = text;

      // Lane-based X: pick next lane + small jitter (±3% of width)
      var jitter = (Math.random() - 0.5) * 0.06;
      var xPct   = LANES[laneIdx % LANES.length] + jitter;
      laneIdx++;
      var x = Math.max(24, Math.min(xPct * W, W - 24));

      // No-overlap guard: if within 120px of previous wish, shift right ~140px
      if (Math.abs(x - lastX) < 120) {
        x = x + 140 > W - 24 ? 24 + Math.random() * 60 : x + 140;
      }
      lastX = x;

      var el = document.createElement('div');
      el.className = 'wish';
      el.textContent = text;
      el.style.left = x + 'px';
      // Vertical: between 25%–85% of viewport height
      el.style.top  = (H * (0.25 + Math.random() * 0.60)) + 'px';
      el.style.animationDelay = '0ms';
      document.body.appendChild(el);
      idx++;

      setTimeout(function () {
        if (el.parentNode) el.parentNode.removeChild(el);
      }, 2500);
      setTimeout(spawnOne, wishEveryMs);
    }
    spawnOne();
  }

  function frame(now) {
    if (!startTime) startTime = now;
    var elapsed = now - startTime;

    ctx.clearRect(0, 0, W, H);

    if (now - lastLaunch > 370) {
      launchFirework();
      lastLaunch = now;
    }

    ctx.save();
    for (var i = particles.length - 1; i >= 0; i--) {
      particles[i].update();
      particles[i].draw(ctx);
      if (particles[i].alpha <= 0) particles.splice(i, 1);
    }
    ctx.restore();
    ctx.globalAlpha = 1;

    if (elapsed < DURATION) {
      rafId = requestAnimationFrame(frame);
    } else {
      cancelAnimationFrame(rafId);
      overlay.classList.remove('fw-active');
      canvas.width = 0; // free memory
      done();
    }
  }

  spawnWishes();
  launchFirework(); // immediate first burst
  rafId = requestAnimationFrame(frame);
}

var OPTS_PREVIEW = { durationMs: 4200, wishesCount: 18, wishEveryMs: 160 };

function getIntroUnlocked() {
  return localStorage.getItem('introFwPlayed') === '1';
}
function setIntroUnlocked() {
  localStorage.setItem('introFwPlayed', '1');
}
function applyIntroGate() {
  var enterBtn = document.getElementById('btnLetterNext');
  if (!enterBtn) return;
  var unlocked = getIntroUnlocked();
  enterBtn.classList.toggle('hidden', !unlocked);
}

document.addEventListener('DOMContentLoaded', function () {
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    resetAllPlayerData();
    if (DEV) console.log('[reset] cleared all player keys');
    window.history.replaceState({}, '', window.location.pathname);
  }

  // Strip ALL previous listeners by replacing node (cloneNode drops addEventListener bindings)
  function rebind(id, fn) {
    var el = document.getElementById(id);
    if (!el) return null;
    var fresh = el.cloneNode(true);
    el.parentNode.replaceChild(fresh, el);
    fresh.addEventListener('click', fn);
    return fresh;
  }

  applyIntroGate();

  rebind('btnPreviewFireworks', function () {
    launchTetTransition(function () {
      setIntroUnlocked();
      applyIntroGate();
    }, OPTS_PREVIEW);
  });

  rebind('btnLetterNext', function (e) {
    e.preventDefault();
    e.stopPropagation();
    if (!getIntroUnlocked()) return; // hard guard
    showScreen('s-pick');
  });

  // applyIntroGate again — rebind replaced the DOM node, re-apply disabled state
  applyIntroGate();

  renderNameList();

  document.getElementById('btnHowtoClose').onclick = hideHowto;

  document.getElementById('btnResultNext').onclick = function () {
    var g = state.game;
    var wins = getWins(state.playerKey);
    if (g && g.outcome === 'win' && wins >= 3) {
      showScreen('s-reward');
    } else {
      showScreen('s-game');
      startGame();
    }
  };

  var form = document.getElementById('giftForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    // Build normalised wishes object (all 6 keys present)
    var ALL_KEYS = ['nguyen', 'han_bui', 'boi', 'ngan', 'diep', 'ngoc'];
    var savedWishes = getWishes(state.playerKey);
    var wishesObj = {};
    ALL_KEYS.forEach(function (k) { wishesObj[k] = savedWishes[k] || ''; });

    // Find the reward for amount_label
    var rewardOrder  = getOrCreateRewardOrder(state.playerKey);
    var pickedIdx    = getPickedEnvIndex(state.playerKey);
    var reward       = LUCKY_REWARDS[rewardOrder[pickedIdx]] || {};

    // Assemble exact payload
    var payload = {
      timestamp:         new Date().toISOString(),
      version:           APP_VERSION,
      player_key:        state.playerKey  || '',
      player_name:       state.playerName || '',
      amount:            parseInt(state.amount, 10) || 0,
      amount_label:      reward.title     || '',
      bank_account:      ((document.getElementById('bankInput')    || {}).value || '') +
                         ' / ' +
                         ((document.getElementById('accountInput') || {}).value || ''),
      message_to_nguyen: (document.getElementById('messageInput')  || {}).value || '',
      wishes_json:       JSON.stringify(wishesObj)
    };

    submitToSheets(payload).then(function () {
      setClaimed(state.playerKey);
      form.reset();
      showScreen('s-end');
    }).catch(function () {
      alert('Gửi chưa thành công, thử lại giúp mình nhé.');
    }).finally(function () {
      submitBtn.disabled = false;
    });
  });

  // DEV panel: player state table + reset button
  if (DEV) {
    var panel = document.createElement('div');
    panel.id = 'devPanel';
    panel.style.cssText = 'position:fixed;bottom:0;left:0;right:0;background:rgba(0,0,0,0.9);' +
      'color:#aaa;font:11px/1.4 monospace;padding:8px 12px;z-index:9999;border-top:1px solid #333;';

    var table = document.createElement('div');
    table.id = 'devTable';
    panel.appendChild(table);

    var resetBtn = document.createElement('button');
    resetBtn.type = 'button';
    resetBtn.textContent = 'Reset all test data';
    resetBtn.style.cssText = 'margin-top:6px;padding:4px 10px;font:11px monospace;' +
      'background:#611;color:#faa;border:1px solid #833;border-radius:4px;cursor:pointer;';
    resetBtn.addEventListener('click', function () {
      resetAllPlayerData();
      location.reload();
    });
    panel.appendChild(resetBtn);
    document.body.appendChild(panel);

    function refreshDevTable() {
      var rows = PLAYERS.map(function (p) {
        var c = isClaimed(p.key) ? '1' : '0';
        var pk = getPickedEnvIndex(p.key);
        var att = getAttempt(p.key);
        return p.key + '  claimed=' + c + '  picked=' + (pk !== null ? pk : '-') + '  attempt=' + att;
      });
      table.textContent = rows.join('  |  ');
    }
    refreshDevTable();
    setInterval(refreshDevTable, 1000);
  }
});
