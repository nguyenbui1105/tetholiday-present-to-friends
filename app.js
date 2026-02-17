var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgolypwz';

var ENVELOPES = [68000, 99000, 128000, 188000, 159000];

/* ── Rigged decks ──────────────────────────────────────────────
   Order: [player0, player1, dealer0, dealer1, draw0, draw1, …]
   Player gets [0],[1]; dealer gets [2],[3]; remaining drawn in order.
   Multiple variants per player keyed by attempt index.           */
var RIGGED_DECKS = {
  han_bui: [
    // Ngũ linh path: bốc 3× → 5 cards total 20 ≤ 21. Past 5 → K♦ busts.
    ['3♠', '4♦', '10♣', '9♠', '2♥', '5♣', '6♠', 'K♦', 'Q♥', '7♣']
  ],
  boi: [
    // Stand at 18 → dealer 16 draws 6♥ → 22 bust. Bốc 6♥ → 24 bust.
    ['10♠', '8♦', '9♣', '7♠', '6♥', 'K♦', '3♣', '9♦']
  ],
  ngan: [
    // Attempt 0: player 16, dealer 18. Bốc 9♥→25 bust. Stand→lose.
    ['10♠', '6♦', '10♣', '8♠', '9♥', 'K♦', '7♣'],
    // Attempt 1: player 11, bốc 10♥→21, stand→win vs dealer 17.
    ['5♠', '6♦', '10♣', '7♠', '10♥', '3♣', '8♦', 'K♠']
  ],
  diep: [
    // Attempt 0: player 15, bốc K♥→25 bust. Stand→lose vs 20.
    ['8♠', '7♦', '10♣', '10♠', 'K♥', '5♣', '3♦'],
    // Attempt 1: A♠ + K♦ = xì dách! Auto-win.
    ['A♠', 'K♦', '9♣', '8♠', '2♥', '3♣', '4♦']
  ],
  ngoc: [
    // Player 19, stand → dealer 16+A→17, 19 > 17 win.
    ['10♠', '9♦', '10♣', '6♠', 'A♥', '2♣', '9♣', '7♥']
  ]
};

var FALLBACK_DECK = ['10♠', '8♦', '9♣', '7♠', '5♥', '3♣', '7♦', 'K♠', '6♥'];

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

function resetAllPlayerData() {
  PLAYERS.forEach(function (p) {
    localStorage.removeItem(pickedKey(p.key));
    localStorage.removeItem(claimedKey(p.key));
    localStorage.removeItem(attemptKey(p.key));
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

function randomCard() {
  return RANKS[Math.floor(Math.random() * RANKS.length)] +
         SUITS[Math.floor(Math.random() * SUITS.length)];
}

function drawCard(g) {
  if (g.deckIndex < g.deck.length) {
    return g.deck[g.deckIndex++];
  }
  return randomCard();
}

function renderGame() {
  var g = state.game;
  var section = document.getElementById('s-game');
  var mode = g.animateMode || 'none';
  g.animateMode = 'none';

  section.innerHTML = '';

  var table = document.createElement('div');
  table.className = 'table';

  var h1 = document.createElement('h1');
  h1.textContent = state.playerName;
  table.appendChild(h1);

  // --- Dealer hand ---
  var dealerBlock = document.createElement('div');
  dealerBlock.className = 'hand-block';
  var dealerTitle = document.createElement('div');
  dealerTitle.className = 'hand-title';
  dealerTitle.textContent = 'CHỦ SÒNG';
  dealerBlock.appendChild(dealerTitle);

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
  var playerBlock = document.createElement('div');
  playerBlock.className = 'hand-block';
  var playerTitle = document.createElement('div');
  playerTitle.className = 'hand-title';
  playerTitle.textContent = 'CON BẠC: ' + state.playerName;
  playerBlock.appendChild(playerTitle);

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

  // --- Status (only when finished) ---
  if (g.finished) {
    var status = document.createElement('p');
    status.id = 'gameStatus';
    status.textContent = g.statusText;
    table.appendChild(status);
  }

  // --- Reveal line (win only) ---
  if (g.finished && g.outcome === 'win') {
    var reveal = document.createElement('p');
    reveal.className = 'reveal';
    reveal.textContent = '✨ Ván này là: ' + g.winLabel;
    table.appendChild(reveal);
  }

  // --- Buttons ---
  var btnRow = document.createElement('div');
  btnRow.className = 'btn-row';

  if (g.finished && (g.outcome === 'lose' || g.outcome === 'draw')) {
    var retryBtn = document.createElement('button');
    retryBtn.type = 'button';
    retryBtn.textContent = 'Chơi lại';
    retryBtn.addEventListener('click', startGame);
    btnRow.appendChild(retryBtn);
  } else if (!g.finished) {
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
  }
  table.appendChild(btnRow);

  section.appendChild(table);
}

function startGame() {
  var decks = RIGGED_DECKS[state.playerKey] || [FALLBACK_DECK];
  var a = getAttempt(state.playerKey);
  var deck = decks[a % decks.length].slice();

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

  if (DEV) console.log('[game] start | deck:', deck.join(', '),
    '| player:', deck[0], deck[1], '| dealer:', deck[2], deck[3]);

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
  } else {
    bumpAttempt(state.playerKey);
  }

  g.animateMode = 'reveal';
  renderGame();

  if (g.outcome === 'win') {
    setTimeout(function () { showScreen('s-reward'); }, 700);
  }
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
  var picked = getPickedEnvIndex(state.playerKey);
  if (picked === null) return;
  state.amount = ENVELOPES[picked];
  document.getElementById('amountText').textContent = 'Lì xì: ' + state.amount.toLocaleString('vi-VN') + 'đ';
  document.getElementById('wishText').textContent = player ? player.wish : '';
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
  showScreen('s-form');
}

function renderNameList() {
  var container = document.getElementById('nameList');
  container.innerHTML = '';
  PLAYERS.forEach(function (player) {
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
      showScreen('s-game');
      startGame();
    });
    container.appendChild(btn);
  });
}

document.addEventListener('DOMContentLoaded', function () {
  if (new URLSearchParams(window.location.search).get('reset') === '1') {
    resetAllPlayerData();
    if (DEV) console.log('[reset] cleared all player keys');
    window.history.replaceState({}, '', window.location.pathname);
  }

  document.getElementById('btnLetterNext').addEventListener('click', function () {
    showScreen('s-pick');
  });
  renderNameList();

  var form = document.getElementById('giftForm');
  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var submitBtn = form.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    fetch(FORMSPREE_ENDPOINT, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    }).then(function (response) {
      if (response.ok) {
        setClaimed(state.playerKey);
        form.reset();
        showScreen('s-end');
      } else {
        alert('Gửi chưa thành công, thử lại giúp mình nhé.');
      }
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
