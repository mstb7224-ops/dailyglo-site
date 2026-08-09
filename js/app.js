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
    var statusType = type || 'info';
    element.textContent = message;
    element.className = 'status-msg show ' + statusType;
    element.setAttribute('role', statusType === 'error' ? 'alert' : 'status');
    element.setAttribute('aria-live', statusType === 'error' ? 'assertive' : 'polite');
  }

  function setButtonState(button, busy, label) {
    if (!button) return;
    if (!button.dataset.defaultLabel) {
      button.dataset.defaultLabel = button.textContent.trim();
    }
    button.disabled = busy;
    button.classList.toggle('is-loading', busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    if (busy) {
      button.innerHTML = '<span class="button-spinner" aria-hidden="true"></span><span>' + label + '</span>';
    } else {
      button.textContent = button.dataset.defaultLabel;
    }
  }

  function showValidationError(form) {
    showStatus(getStatusElement(form), 'Please complete all required fields before continuing.', 'error');
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

  var API_BASE = (window.DAILYGLO_API_BASE || 'https://api.dailyglo.online').replace(/\/$/, '');

  function apiFetch(path, options) {
    var request = options || {};
    request.credentials = 'include';
    request.headers = request.headers || {};
    var token = window.localStorage.getItem('dailyglo_member_token');
    if (token) request.headers.Authorization = 'Bearer ' + token;
    return fetch(API_BASE + path, request).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok) {
          var apiError = new Error(body.error || 'The request could not be completed.');
          apiError.status = response.status;
          throw apiError;
        }
        return body;
      });
    });
  }

  function backendUnavailable(form, message) {
    var status = getStatusElement(form);
    var button = form && form.querySelector('button[type="submit"]');
    setButtonState(button, false);
    showStatus(status, message || 'Frontend validation completed. Backend/API connection is not configured yet, so no data was sent.', 'info');
  }

  function handleApiError(form, error) {
    var button = form && form.querySelector('button[type="submit"]');
    setButtonState(button, false);
    var message = 'Something went wrong. Please try again.';
    if (error && error.status === 401) {
      message = 'The email/mobile or password is incorrect. Please check your details and try again.';
    } else if (error && error.status === 409) {
      message = 'An account with this email or mobile number already exists. Try logging in instead.';
    } else if (error && error.status === 413) {
      message = 'The uploaded file is too large. Please choose an image smaller than 5 MB.';
    } else if (error && error.status === 415) {
      message = 'This file type is not supported. Please upload a JPG, PNG, or WebP image.';
    } else if (error && error.status === 429) {
      message = 'Too many attempts. Please wait a moment and try again.';
    } else if (error && error.name === 'TypeError') {
      message = 'We could not reach DailyGlo right now. Check your internet connection and try again.';
    } else if (error && error.message) {
      message = error.message;
    }
    showStatus(getStatusElement(form), message, 'error');
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
        showValidationError(form);
        form.reportValidity();
        return;
      }
      if (!validateFile(byId('iqamaFile'), status, 'Iqama image')) return;
      var button = byId('submitBtn');
      setButtonState(button, true, 'Submitting...');
      var data = new FormData();
      ['fullName', 'email', 'mobile', 'city', 'country', 'password'].forEach(function (id) {
        data.append(id, byId(id).value.trim());
      });
      data.append('iqama', byId('iqamaFile').files[0]);
      apiFetch('/api/auth/register', { method: 'POST', body: data }).then(function (result) {
        setButtonState(button, false);
        showStatus(status, 'Registration received. Your Member ID is ' + result.member.memberCode + '. Please log in to submit payment.', 'success');
        form.reset();
      }).catch(function (error) { handleApiError(form, error); });
    });
  }

  function bindLoginForm() {
    var form = byId('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        showValidationError(form);
        form.reportValidity();
        return;
      }
      var button = byId('submitBtn');
      setButtonState(button, true, 'Signing in...');
      apiFetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login: byId('loginId').value.trim(), password: byId('password').value })
      }).then(function (result) {
        setButtonState(button, false);
        if (result.token) window.localStorage.setItem('dailyglo_member_token', result.token);
        showStatus(getStatusElement(form), 'Login successful. Redirecting to payment...', 'success');
        window.setTimeout(function () { window.location.href = 'payment.html'; }, 500);
      }).catch(function (error) { handleApiError(form, error); });
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
      var button = byId('submitBtn');
      setButtonState(button, true, 'Uploading...');
      var selected = document.querySelector('input[name="paymentMethod"]:checked');
      var methodMap = { bkash: 'bkash', bank: 'bank_transfer', binance: 'binance_pay' };
      var data = new FormData();
      data.append('method', methodMap[selected ? selected.value : 'bkash']);
      data.append('transactionReference', (byId('transactionId') && byId('transactionId').value.trim()) || '');
      data.append('screenshot', byId('screenshotFile').files[0]);
      apiFetch('/api/payments', { method: 'POST', body: data }).then(function () {
        setButtonState(button, false);
        showStatus(status, 'Payment proof submitted successfully. It is now awaiting admin review.', 'success');
        form.reset();
      }).catch(function (error) { handleApiError(form, error); });
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
    // 16 Aug 2026, 12:00:00 GMT+3 = 2026-08-16T09:00:00.000Z.
    var targetUtc = new Date('2026-08-16T09:00:00.000Z').getTime();

    function pad(value) { return String(Math.max(0, value)).padStart(2, '0'); }

    // Bind every visible + accessible countdown on the page so all start ticking.
    document.querySelectorAll('[data-countdown]').forEach(function (countdown) {
      var days = countdown.querySelector('[data-countdown-days]');
      var hours = countdown.querySelector('[data-countdown-hours]');
      var minutes = countdown.querySelector('[data-countdown-minutes]');
      var seconds = countdown.querySelector('[data-countdown-seconds]');
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
        countdown.classList.toggle('countdown-ended', totalSeconds === 0);
      }
      render();
      window.setInterval(render, 1000);
    });

    // Local draw time, once per page (shared between hidden and visible copies).
    document.querySelectorAll('[data-local-draw-time]').forEach(function (localTime) {
      localTime.textContent = new Intl.DateTimeFormat(undefined, {
        dateStyle: 'medium', timeStyle: 'short'
      }).format(new Date(targetUtc));
    });
    document.querySelectorAll('[data-local-timezone]').forEach(function (timezone) {
      timezone.textContent = (Intl.DateTimeFormat().resolvedOptions().timeZone || 'Local time').replace(/_/g, ' ');
    });
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
