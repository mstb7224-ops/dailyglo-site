/* DailyGlo frontend interactions.
 * This file intentionally does not pretend to submit data without a backend/API.
 */
(function () {
  'use strict';

  var MAX_FILE_SIZE = 5 * 1024 * 1024;

  function byId(id) {
    return document.getElementById(id);
  }

  function showStatus(element, message, type) {
    if (!element) return;
    element.textContent = message;
    element.className = 'status-msg show ' + (type || 'info');
    element.setAttribute('role', 'status');
  }

  function setButtonState(button, busy, label) {
    if (!button) return;
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
    button.disabled = busy;
    button.textContent = busy ? label : button.dataset.defaultLabel;
  }

  function getStatusElement(form) {
    return form ? form.querySelector('.status-msg') : null;
  }

  function validateFile(input, statusElement, label) {
    if (!input || !input.files || !input.files.length) {
      showStatus(statusElement, label + ' is required.', 'error');
      return false;
    }
    var file = input.files[0];
    if (file.size > MAX_FILE_SIZE) {
      showStatus(statusElement, label + ' must be 5 MB or smaller.', 'error');
      input.value = '';
      return false;
    }
    if (file.type && file.type.indexOf('image/') !== 0) {
      showStatus(statusElement, label + ' must be an image file.', 'error');
      input.value = '';
      return false;
    }
    return true;
  }

  function bindFileInput(inputId, previewId, textSelector, statusElement, label) {
    var input = byId(inputId);
    if (!input) return;
    input.addEventListener('change', function () {
      if (!validateFile(input, statusElement, label)) return;
      var file = input.files[0];
      var text = input.closest('.form-file') && input.closest('.form-file').querySelector(textSelector);
      if (text) text.textContent = file.name;
      var preview = previewId ? byId(previewId) : null;
      if (preview && file.type.indexOf('image/') === 0) {
        if (preview.dataset.objectUrl) URL.revokeObjectURL(preview.dataset.objectUrl);
        var objectUrl = URL.createObjectURL(file);
        preview.dataset.objectUrl = objectUrl;
        preview.src = objectUrl;
        preview.style.display = 'block';
      }
    });
  }

  function backendUnavailable(form, message) {
    var status = getStatusElement(form);
    var button = form && form.querySelector('button[type="submit"]');
    setButtonState(button, false);
    showStatus(status, message || 'Frontend validation completed. Backend/API connection is not configured yet, so no data was sent.', 'info');
  }

  window.toggleMobileMenu = function () {
    var menu = byId('mobileMenu');
    if (!menu) return;
    menu.classList.toggle('show');
    menu.setAttribute('aria-hidden', menu.classList.contains('show') ? 'false' : 'true');
  };

  function bindMobileMenu() {
    var menu = byId('mobileMenu');
    if (!menu) return;
    menu.setAttribute('aria-hidden', 'true');
    menu.querySelectorAll('a').forEach(function (link) {
      link.addEventListener('click', function () {
        menu.classList.remove('show');
        menu.setAttribute('aria-hidden', 'true');
      });
    });
  }

  function bindFaq() {
    document.querySelectorAll('.faq-question').forEach(function (button) {
      button.addEventListener('click', function () {
        var item = button.closest('.faq-item');
        var answer = item && item.querySelector('.faq-answer');
        if (!item || !answer) return;
        var wasOpen = item.classList.contains('open');
        document.querySelectorAll('.faq-item.open').forEach(function (openItem) {
          openItem.classList.remove('open');
          var openAnswer = openItem.querySelector('.faq-answer');
          if (openAnswer) openAnswer.style.maxHeight = null;
        });
        if (!wasOpen) {
          item.classList.add('open');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    });
  }

  function bindPaymentMethods() {
    var methods = document.querySelectorAll('input[name="paymentMethod"]');
    if (!methods.length) return;
    function update() {
      var selected = document.querySelector('input[name="paymentMethod"]:checked');
      var value = selected ? selected.value : 'bkash';
      document.querySelectorAll('.method-details').forEach(function (panel) {
        panel.style.display = panel.id.toLowerCase().indexOf(value) !== -1 ? 'block' : 'none';
      });
      var transaction = byId('transactionId');
      if (transaction) transaction.required = value === 'bkash';
    }
    methods.forEach(function (method) { method.addEventListener('change', update); });
    update();
  }

  function bindRegisterForm() {
    var form = byId('regForm');
    if (!form) return;
    var status = getStatusElement(form);
    bindFileInput('iqamaFile', null, '.file-text strong', status, 'Iqama image');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (!validateFile(byId('iqamaFile'), status, 'Iqama image')) return;
      backendUnavailable(form, 'Registration form is valid. Backend/API is not connected yet, so the registration was not submitted.');
    });
  }

  function bindLoginForm() {
    var form = byId('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      backendUnavailable(form, 'Login form is valid. Authentication backend is not connected yet, so no login was performed.');
    });
  }

  function bindContactForm() {
    var form = byId('contactForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      backendUnavailable(form, 'Message form is valid. Contact API is not connected yet, so the message was not sent.');
    });
  }

  function bindPaymentForm() {
    var form = byId('paymentForm');
    if (!form) return;
    var status = getStatusElement(form);
    bindFileInput('screenshotFile', 'filePreview', '.file-text strong', status, 'Payment screenshot');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (!validateFile(byId('screenshotFile'), status, 'Payment screenshot')) return;
      backendUnavailable(form, 'Payment form is valid. Payment verification/upload backend is not connected yet, so no payment record was submitted.');
    });
  }

  function bindAdminLogin() {
    var form = byId('adminLoginForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      backendUnavailable(form, 'Admin form is valid. Secure admin authentication and dashboard API are not connected yet.');
    });
  }

  window.AdminDashboard = window.AdminDashboard || {
    load: function () {
      var message = byId('adminContent') && byId('adminContent').querySelector('.status-msg');
      if (message) showStatus(message, 'Dashboard refresh requires the backend/API connection.', 'info');
    }
  };

  function bindCountdown() {
    var countdown = document.querySelector('[data-countdown]');
    if (!countdown) return;

    // 16 Aug 2026, 12:00:00 GMT+3 = 2026-08-16T09:00:00.000Z.
    var targetUtc = new Date('2026-08-16T09:00:00.000Z').getTime();
    var days = countdown.querySelector('[data-countdown-days]');
    var hours = countdown.querySelector('[data-countdown-hours]');
    var minutes = countdown.querySelector('[data-countdown-minutes]');
    var seconds = countdown.querySelector('[data-countdown-seconds]');
    var localTime = document.querySelector('[data-local-draw-time]');
    var timezone = document.querySelector('[data-local-timezone]');
    function pad(value) { return String(Math.max(0, value)).padStart(2, '0'); }
    function render() {
      var remaining = Math.max(0, targetUtc - Date.now());
      var totalSeconds = Math.floor(remaining / 1000);
      var d = Math.floor(totalSeconds / 86400);
      var h = Math.floor((totalSeconds % 86400) / 3600);
      var m = Math.floor((totalSeconds % 3600) / 60);
      var s = totalSeconds % 60;
      if (days) days.textContent = pad(d);
      if (hours) hours.textContent = pad(h);
      if (minutes) minutes.textContent = pad(m);
      if (seconds) seconds.textContent = pad(s);
      if (localTime) {
        localTime.textContent = new Intl.DateTimeFormat(undefined, {
          dateStyle: 'medium', timeStyle: 'short'
        }).format(new Date(targetUtc));
      }
      if (timezone) timezone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time';
      countdown.classList.toggle('countdown-ended', totalSeconds === 0);
    }
    render();
    window.setInterval(render, 1000);
  }

  function bindScrollEffects() {
    var navbar = byId('navbar');
    if (navbar) {
      window.addEventListener('scroll', function () {
        navbar.classList.toggle('scrolled', window.scrollY > 20);
      }, { passive: true });
    }
    var items = document.querySelectorAll('.animate-in');
    if (!items.length || !('IntersectionObserver' in window)) {
      items.forEach(function (item) { item.classList.add('visible'); });
      return;
    }
    var observer = new IntersectionObserver(function (entries, currentObserver) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    items.forEach(function (item) { observer.observe(item); });
  }

  document.addEventListener('DOMContentLoaded', function () {
    bindMobileMenu();
    bindFaq();
    bindPaymentMethods();
    bindRegisterForm();
    bindLoginForm();
    bindContactForm();
    bindPaymentForm();
    bindAdminLogin();
    bindCountdown();
    bindScrollEffects();
  });
}());
