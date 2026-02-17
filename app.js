var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgolypwz';

var ENVELOPES = [68000, 99000, 128000, 188000, 159000];

var GAME_SCRIPTS = {
  han_bui: [
    { label: 'Ngũ linh may mắn', outcome: 'win',
      playerStart: ['A♠', '2♦'], playerHit: ['3♥', 'A♣', '4♠'],
      dealerCards: ['10♣', '7♠', '6♦'],
      winText: 'Ngũ linh! 5 lá không quắc. Bạn thắng 😎' }
  ],
  boi: [
    { label: 'Dealer quắc', outcome: 'win',
      playerStart: ['10♠', '8♦'], playerHit: [],
      dealerCards: ['9♣', '7♠', '8♦'],
      winText: 'Dealer quắc. Bạn thắng 😎' }
  ],
  ngan: [
    { label: 'Xui nhẹ đầu năm', outcome: 'lose',
      playerStart: ['10♠', '6♦'], playerHit: ['9♥'],
      dealerCards: ['10♣', '9♠'],
      loseText: 'Quắc rồi 😭 Chơi lại nha!' },
    { label: 'Lật kèo phút chót', outcome: 'win',
      playerStart: ['5♠', '6♦'], playerHit: ['10♥'],
      dealerCards: ['10♣', '7♠', '8♦'],
      winText: 'Lật kèo! Dealer quắc. Bạn thắng 😎' }
  ],
  diep: [
    { label: 'Thử vận may', outcome: 'lose',
      playerStart: ['8♠', '7♦'], playerHit: ['K♥'],
      dealerCards: ['10♣', '10♠'],
      loseText: 'Quắc nhẹ 😅 Thử lại nha!' },
    { label: '21 tự nhiên', outcome: 'win',
      playerStart: ['A♠', 'K♦'], playerHit: [],
      dealerCards: ['9♣', '8♠'],
      winText: 'Xì dách! 21 tự nhiên. Bạn thắng 😎' }
  ],
  ngoc: [
    { label: 'Đánh đâu thắng đó', outcome: 'win',
      playerStart: ['10♠', '9♦'], playerHit: ['A♥'],
      dealerCards: ['10♣', '6♠', '9♦'],
      winText: '20 điểm! Dealer quắc. Bạn thắng 😎' }
  ]
};

var FALLBACK_SCRIPT = {
  label: 'Ván may mắn', outcome: 'win',
  playerStart: ['10♠', '6♦'], playerHit: ['5♥'],
  dealerCards: ['9♣', '7♠', '8♦'],
  winText: 'Dealer quắc. Bạn thắng 😎'
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

function renderGame() {
  var g = state.game;
  var section = document.getElementById('s-game');
  var playerCardsText = g.playerCards.join('  ');
  var dealerCardsText = g.dealerCards.map(function (c, i) {
    if (!g.finished && i === g.dealerCards.length - 1) {
      return '🂠';
    }
    return c;
  }).join('  ');

  var buttons;
  if (g.finished && g.outcome === 'lose') {
    buttons = '<button type="button" onclick="startGame()">Chơi lại</button>';
  } else if (g.finished) {
    buttons = '';
  } else {
    buttons = '<button type="button" onclick="hit()">Hit</button> ' +
      '<button type="button" onclick="stand()">Stand</button>';
  }

  section.innerHTML =
    '<h1>' + state.playerName + '</h1>' +
    '<p>Kiểu ván: ' + g.winLabel + '</p>' +
    '<p>Your cards: ' + playerCardsText + '</p>' +
    '<p>Dealer cards: ' + dealerCardsText + '</p>' +
    '<p id="gameStatus">' + g.statusText + '</p>' +
    buttons;
}

function startGame() {
  var scripts = GAME_SCRIPTS[state.playerKey] || [FALLBACK_SCRIPT];
  var a = getAttempt(state.playerKey);
  var script = scripts[a % scripts.length];

  state.game = {
    playerCards: script.playerStart.slice(),
    dealerCards: script.dealerCards.slice(),
    playerHit: script.playerHit.slice(),
    hitIndex: 0,
    finished: false,
    outcome: script.outcome,
    winLabel: script.label,
    winText: script.winText || '',
    loseText: script.loseText || '',
    statusText: 'Hit or Stand?'
  };
  renderGame();
}

function hit() {
  var g = state.game;
  if (g.finished) return;
  if (g.hitIndex < g.playerHit.length) {
    g.playerCards.push(g.playerHit[g.hitIndex]);
    g.hitIndex++;
    if (g.hitIndex >= g.playerHit.length) {
      g.statusText = 'Hết bài rồi. Stand để chốt.';
    }
    renderGame();
  }
}

function stand() {
  var g = state.game;
  if (g.finished) return;
  g.finished = true;

  if (g.outcome === 'win') {
    g.statusText = g.winText;
    resetAttempt(state.playerKey);
    renderGame();
    setTimeout(function () {
      showScreen('s-reward');
    }, 700);
  } else {
    g.statusText = g.loseText;
    bumpAttempt(state.playerKey);
    renderGame();
  }
}

function setupRewardUI() {
  if (!state.playerKey) {
    showScreen('s-pick');
    return;
  }
  var closed = document.getElementById('rewardClosed');
  var opened = document.getElementById('rewardOpened');
  var envStage = document.getElementById('envelopeStage');
  var result = document.getElementById('rewardResult');
  if (!closed || !opened || !envStage || !result) {
    console.warn('[setupRewardUI] missing element:', { closed: !!closed, opened: !!opened, envStage: !!envStage, result: !!result });
    return;
  }
  var picked = getPickedEnvIndex(state.playerKey);
  if (DEV) console.log('[setupRewardUI] playerKey:', state.playerKey, 'picked:', picked);

  if (picked !== null) {
    // Already picked — skip teaser, show result directly
    closed.style.display = 'none';
    opened.style.display = 'block';
    envStage.style.display = 'none';
    result.style.display = 'block';
    renderReward();
    return;
  }

  // Not yet picked — show gift teaser, wire up "Mở quà"
  closed.style.display = 'block';
  opened.style.display = 'none';
  envStage.style.display = 'block';
  result.style.display = 'none';
  state.amount = null;

  var openBtn = document.getElementById('btnOpenReward');
  if (openBtn) {
    var freshOpen = openBtn.cloneNode(true);
    openBtn.parentNode.replaceChild(freshOpen, openBtn);
    freshOpen.addEventListener('click', function () {
      closed.style.display = 'none';
      opened.style.display = 'block';
    });
  }

  document.querySelectorAll('#envelopeGrid .envelope').forEach(function (envBtn) {
    var fresh = envBtn.cloneNode(true);
    envBtn.parentNode.replaceChild(fresh, envBtn);
    fresh.addEventListener('click', function () {
      if (getPickedEnvIndex(state.playerKey) !== null) return;
      var idx = Number(fresh.dataset.env);
      setPickedEnvIndex(state.playerKey, idx);
      envStage.style.display = 'none';
      result.style.display = 'block';
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
