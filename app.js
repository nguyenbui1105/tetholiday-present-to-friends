function showScreen(id) {
  document.querySelectorAll('.screen').forEach(function (el) {
    el.classList.remove('active');
  });
  document.getElementById(id).classList.add('active');
}

document.getElementById('btnLetterNext').addEventListener('click', function () {
  showScreen('s-pick');
});
