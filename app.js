var FORMSPREE_ENDPOINT = 'https://formspree.io/f/xgolypwz';

var ENVELOPES = [68000, 99000, 128000, 188000, 159000];

var DEMO_SCRIPT = {
  playerStart: ['10♠', '6♦'],
  playerHit: ['5♥'],
  dealerCards: ['9♣', '7♠', '8♦']
};

var state = {
  playerKey: null,
  playerName: null,
  game: null
};

function getPickedEnvIndex(playerKey) {
  var v = localStorage.getItem('pickedEnvelope_' + playerKey);
  if (v === null) return null;
  var n = Number(v);
  return Number.isInteger(n) ? n : null;
}

function setPickedEnvIndex(playerKey, idx) {
  localStorage.setItem('pickedEnvelope_' + playerKey, String(idx));
}

function isClaimed(playerKey) {
  return localStorage.getItem('claimed_' + playerKey) === '1';
}

function setClaimed(playerKey) {
  localStorage.setItem('claimed_' + playerKey, '1');
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
  if (id === 's-reward') {
    console.log('[nav] entered reward');
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

  section.innerHTML =
    '<h1>Player: ' + state.playerName + '</h1>' +
    '<p>Your cards: ' + playerCardsText + '</p>' +
    '<p>Dealer cards: ' + dealerCardsText + '</p>' +
    '<p id="gameStatus">' + g.statusText + '</p>' +
    '<button type="button" onclick="hit()">Hit</button> ' +
    '<button type="button" onclick="stand()">Stand</button>';
}

function startGame() {
  state.game = {
    playerCards: DEMO_SCRIPT.playerStart.slice(),
    dealerCards: DEMO_SCRIPT.dealerCards.slice(),
    hitIndex: 0,
    finished: false,
    statusText: 'Hit or Stand?'
  };
  renderGame();
}

function hit() {
  var g = state.game;
  if (g.finished) return;
  if (g.hitIndex < DEMO_SCRIPT.playerHit.length) {
    g.playerCards.push(DEMO_SCRIPT.playerHit[g.hitIndex]);
    g.hitIndex++;
    if (g.hitIndex >= DEMO_SCRIPT.playerHit.length) {
      g.statusText = 'No more hits. Stand to finish.';
    }
    renderGame();
  }
}

function stand() {
  var g = state.game;
  if (g.finished) return;
  g.finished = true;
  g.statusText = 'Dealer bust. You win.';
  renderGame();
  setTimeout(function () {
    showScreen('s-reward');
  }, 700);
}

function setupRewardUI() {
  var btn = document.getElementById('btnOpenReward');
  var closed = document.getElementById('rewardClosed');
  var opened = document.getElementById('rewardOpened');
  var envStage = document.getElementById('envelopeStage');
  var result = document.getElementById('rewardResult');
  if (!btn || !closed || !opened) return;

  var picked = getPickedEnvIndex(state.playerKey);

  if (picked !== null) {
    closed.style.display = 'none';
    opened.style.display = 'block';
    envStage.style.display = 'none';
    result.style.display = 'block';
    renderReward();
    return;
  }

  closed.style.display = 'block';
  opened.style.display = 'none';
  envStage.style.display = 'block';
  result.style.display = 'none';

  var newBtn = btn.cloneNode(true);
  btn.parentNode.replaceChild(newBtn, btn);
  newBtn.addEventListener('click', function () {
    console.log('[reward] open clicked', { playerKey: state.playerKey, playerName: state.playerName });
    closed.style.display = 'none';
    opened.style.display = 'block';
  });

  document.querySelectorAll('#envelopeGrid .envelope').forEach(function (envBtn) {
    envBtn.addEventListener('click', function () {
      if (getPickedEnvIndex(state.playerKey) !== null) return;
      var idx = Number(envBtn.dataset.env);
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
  showScreen('s-form');
  document.getElementById('playerName').value = state.playerName;
  document.getElementById('amountInput').value = state.amount;
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
});
