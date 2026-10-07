// myBoxStock site: one place to point Log in and Sign up at the app. Change APP_URL and every page follows.
(function () {
  var APP_URL = 'https://app.myboxstock.com';
  document.querySelectorAll('[data-app]').forEach(function (a) { a.href = a.dataset.app === 'signup' ? APP_URL + '/app/#/signup' : APP_URL + '/app/'; });
  var y = document.getElementById('yr'); if (y) y.textContent = new Date().getFullYear();
})();
