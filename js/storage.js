/* Хранилище прогресса: localStorage + cookie fallback.
   Работает без бэкенда. */
window.MemStorage = (function () {
  'use strict';

  var KEY_LS = 'stup_done';
  var KEY_CK = 'stup_done';
  var DAYS = 365;            // срок жизни cookie
  var COOKIE_MAX = 3800;     // безопасный лимит ~4KB

  function safeParse(s) {
    try { return JSON.parse(s); } catch (e) { return null; }
  }

  function readLS() {
    try { return safeParse(localStorage.getItem(KEY_LS)); }
    catch (e) { return null; }
  }

  function readCookie() {
    try {
      var m = document.cookie.match(new RegExp('(?:^|;\\s*)' + KEY_CK + '=([^;]*)'));
      return m ? safeParse(decodeURIComponent(m[1])) : null;
    } catch (e) { return null; }
  }

  function writeLS(obj) {
    try { localStorage.setItem(KEY_LS, JSON.stringify(obj)); } catch (e) {}
  }

  function writeCookie(obj) {
    try {
      var raw = encodeURIComponent(JSON.stringify(obj));
      if (raw.length > COOKIE_MAX) return;
      var d = new Date();
      d.setTime(d.getTime() + DAYS * 864e5);
      document.cookie =
        KEY_CK + '=' + raw +
        '; expires=' + d.toUTCString() +
        '; path=/; SameSite=Lax';
    } catch (e) {}
  }

  return {
    load: function () {
      return readLS() || readCookie() || {};
    },

    save: function (obj) {
      writeLS(obj);
      writeCookie(obj);
    },

    clear: function () {
      try { localStorage.removeItem(KEY_LS); } catch (e) {}
      try { document.cookie = KEY_CK + '=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/'; } catch (e) {}
    },

    /* Синхронизация между вкладками */
    onChange: function (cb) {
      window.addEventListener('storage', function (e) {
        if (e.key !== KEY_LS || !e.newValue) return;
        var v = safeParse(e.newValue);
        if (v) cb(v);
      });
    }
  };
})();