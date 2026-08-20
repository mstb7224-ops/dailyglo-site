/* DailyGlo frontend interactions.
 * This file intentionally does not pretend to submit data without a backend/API.
 */
(function () {
  'use strict';

  var MAX_FILE_SIZE = 5 * 1024 * 1024;
  var SUPABASE_URL = window.DAILYGLO_SUPABASE_URL || 'https://xewxigpmvuxkuqtxhxha.supabase.co';
  var SUPABASE_ANON_KEY = window.DAILYGLO_SUPABASE_ANON_KEY || 'sb_publishable_C-f5NVBKOhZBXXb45ybjvw_JKpCpI8h';
  var SUPABASE_BUCKET = window.DAILYGLO_IQAMA_BUCKET || 'iqama_documents';
  var supabaseClientPromise = null;

  function loadExternalScript(src) {
    return new Promise(function (resolve, reject) {
      var existing = document.querySelector('script[data-dailyglo-supabase-sdk]');
      if (existing) {
        existing.addEventListener('load', resolve, { once: true });
        existing.addEventListener('error', reject, { once: true });
        if (window.supabase && typeof window.supabase.createClient === 'function') resolve();
        return;
      }
      var script = document.createElement('script');
      script.src = src;
      script.async = true;
      script.dataset.dailygloSupabaseSdk = 'true';
      script.onload = resolve;
      script.onerror = function () { reject(new Error('Supabase SDK could not be loaded.')); };
      document.head.appendChild(script);
    });
  }

  function getSupabaseClient() {
    if (window.__DAILYGLO_SUPABASE_CLIENT) {
      return Promise.resolve(window.__DAILYGLO_SUPABASE_CLIENT);
    }
    if (!supabaseClientPromise) {
      var sdkReady = window.supabase && typeof window.supabase.createClient === 'function'
        ? Promise.resolve()
        : loadExternalScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2');
      supabaseClientPromise = sdkReady.then(function () {
        if (!window.supabase || typeof window.supabase.createClient !== 'function') {
          throw new Error('Supabase SDK is unavailable.');
        }
        window.__DAILYGLO_SUPABASE_CLIENT = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return window.__DAILYGLO_SUPABASE_CLIENT;
      });
    }
    return supabaseClientPromise;
  }

  function getFileExtension(file) {
    var typeMap = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };
    if (typeMap[file.type]) return typeMap[file.type];
    var match = file.name.toLowerCase().match(/\.([a-z0-9]+)$/);
    return match ? match[1] : 'jpg';
  }

  function validateIqamaFile(input, statusElement) {
    if (!validateFile(input, statusElement, 'Iqama image')) return false;
    var file = input.files[0];
    var allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowedTypes.indexOf(file.type) === -1) {
      showStatus(statusElement, 'Please upload a JPG, PNG, or WebP image. HEIC images should be converted before upload.', 'error');
      input.value = '';
      return false;
    }
    return true;
  }

  function supabaseErrorMessage(error) {
    var message = error && (error.message || error.error_description || error.error) || 'The request could not be completed.';
    var lower = String(message).toLowerCase();
    if (lower.indexOf('bucket') !== -1 && (lower.indexOf('not found') !== -1 || lower.indexOf('does not exist') !== -1)) {
      return 'Supabase Storage bucket "' + SUPABASE_BUCKET + '" was not found. Create the bucket first.';
    }
    if (lower.indexOf('row-level security') !== -1 || lower.indexOf('not authorized') !== -1 || lower.indexOf('permission') !== -1 || lower.indexOf('policy') !== -1) {
      return 'Supabase rejected the request because the Storage or database RLS policy is not configured for this user.';
    }
    if (lower.indexOf('email not confirmed') !== -1 || lower.indexOf('confirm your email') !== -1) {
      return 'Your account was created, but email confirmation is required before the Iqama can be uploaded. Confirm your email and try again.';
    }
    if (lower.indexOf('already registered') !== -1 || lower.indexOf('already exists') !== -1) {
      return 'An account with this email already exists. Please log in instead.';
    }
    return message;
  }

  async function registerWithSupabase(form, file) {
    var client = await getSupabaseClient();
    var values = {
      full_name: byId('fullName').value.trim(),
      email: byId('email').value.trim().toLowerCase(),
      mobile: byId('mobile').value.trim(),
      city: byId('city').value.trim(),
      country: byId('country').value,
      password: byId('password').value
    };

    var signUpResult = await client.auth.signUp({
      email: values.email,
      password: values.password,
      options: {
        data: {
          full_name: values.full_name,
          mobile: values.mobile,
          city: values.city,
          country: values.country
        }
      }
    });
    if (signUpResult.error) throw signUpResult.error;
    if (!signUpResult.data || !signUpResult.data.user) throw new Error('Supabase did not return a user account.');
    if (!signUpResult.data.session) {
      throw new Error('Account created, but Supabase email confirmation is enabled. Confirm the email before uploading the Iqama, or disable email confirmation in Supabase Auth settings.');
    }

    var user = signUpResult.data.user;
    var uploadedPath = '';
    try {
      var extension = getFileExtension(file);
      var randomId = window.crypto && typeof window.crypto.randomUUID === 'function'
        ? window.crypto.randomUUID()
        : String(Date.now()) + '-' + Math.random().toString(36).slice(2);
      uploadedPath = 'iqama/' + user.id + '/' + randomId + '.' + extension;

      var uploadResult = await client.storage.from(SUPABASE_BUCKET).upload(uploadedPath, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false
      });
      if (uploadResult.error) throw uploadResult.error;

      var memberResult = await client.from('members').upsert([{
        email: values.email,
        user_type: 'free'
      }], { onConflict: 'email' });
      if (memberResult.error) throw memberResult.error;

      var profileResult = await client.auth.updateUser({
        data: {
          full_name: values.full_name,
          mobile: values.mobile,
          city: values.city,
          country: values.country,
          iqama_path: uploadedPath,
          iqama_uploaded_at: new Date().toISOString()
        }
      });
      if (profileResult.error) throw profileResult.error;
    } catch (error) {
      if (uploadedPath) {
        await client.storage.from(SUPABASE_BUCKET).remove([uploadedPath]).catch(function () {});
      }
      throw error;
    }

    return { user: user, iqamaPath: uploadedPath };
  }

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
      var isBank = value !== 'bkash';
      document.querySelectorAll('.method-details').forEach(function (panel) {
        panel.style.display = panel.id.toLowerCase().indexOf(value) !== -1 ? 'block' : 'none';
      });
      var transaction = byId('transactionId');
      var transactionLabel = byId('transactionLabel');
      var transactionHint = byId('transactionHint');
      var screenshotGroup = byId('screenshotGroup');
      var screenshot = byId('screenshotFile');
      if (transaction) {
        transaction.required = true;
        transaction.placeholder = isBank ? 'Enter bank transfer reference' : 'Enter bKash TrxID';
      }
      if (transactionLabel) {
        transactionLabel.innerHTML = (isBank ? 'Bank Transaction Reference' : 'bKash Transaction ID / TrxID') + ' <span class="required">*</span>';
      }
      if (transactionHint) {
        transactionHint.textContent = isBank ? 'Enter the reference shown on your bank transfer.' : 'Never enter your bKash PIN or OTP.';
      }
      if (screenshotGroup) screenshotGroup.style.display = isBank ? 'block' : 'none';
      if (screenshot) {
        screenshot.required = isBank;
        screenshot.disabled = !isBank;
        if (!isBank) screenshot.value = '';
      }
      document.querySelectorAll('.payment-option, .payment-method').forEach(function (option) {
        var input = option.querySelector('input[name="paymentMethod"]');
        if (input) option.classList.toggle('active', input.checked);
      });
    }
    methods.forEach(function (method) { method.addEventListener('change', update); });
    update();
  }

  function bindDiscountFields() {
    var codeInput = byId('discountCode');
    var applyButton = byId('applyDiscountBtn');
    var message = byId('discountMessage');
    var discountAmount = byId('discountAmount');
    var finalAmount = byId('finalAmount');
    var amountInput = byId('amount');
    if (!codeInput || !applyButton || !message || !discountAmount || !finalAmount || !amountInput || !window.DailyGloDiscounts) return;

    function update(showMessage) {
      var result = window.DailyGloDiscounts.calculate(codeInput.value);
      amountInput.value = result.finalAmount;
      discountAmount.textContent = '-' + result.discountAmount + ' SAR';
      finalAmount.textContent = result.finalAmount + ' SAR';
      if (showMessage) {
        message.textContent = result.valid ? result.label + ' applied. You save ' + result.discountAmount + ' SAR.' : 'Invalid code. Try DAILYGLO75 or DAILYGLO60.';
        message.className = 'discount-message ' + (result.valid ? 'success' : 'error');
      }
      return result;
    }

    applyButton.addEventListener('click', function () { update(true); });
    codeInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') { event.preventDefault(); update(true); }
    });
    codeInput.addEventListener('input', function () {
      message.textContent = 'Press Apply to calculate your discount.';
      message.className = 'discount-message';
    });
    update(false);
  }

  function bindRegisterForm() {
    var form = byId('regForm');
    if (!form) return;
    var status = getStatusElement(form);
    bindFileInput('iqamaFile', 'filePreview', '.file-text strong', status, 'Iqama image');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      if (!form.checkValidity()) {
        showValidationError(form);
        form.reportValidity();
        return;
      }
      var input = byId('iqamaFile');
      if (!validateIqamaFile(input, status)) return;
      var button = byId('submitBtn');
      setButtonState(button, true, 'Uploading...');
      registerWithSupabase(form, input.files[0]).then(function () {
        setButtonState(button, false);
        showStatus(status, 'Registration and Iqama upload completed successfully. You can now log in.', 'success');
        form.reset();
        var fileText = form.querySelector('.file-text strong');
        if (fileText) fileText.textContent = 'Click to upload Iqama';
        var preview = byId('filePreview');
        if (preview) preview.style.display = 'none';
      }).catch(function (error) {
        setButtonState(button, false);
        showStatus(status, supabaseErrorMessage(error), 'error');
      });
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
      var status = getStatusElement(form);
      setButtonState(button, true, 'Signing in...');
      getSupabaseClient().then(function (client) {
        return client.auth.signInWithPassword({
          email: byId('loginId').value.trim(),
          password: byId('password').value
        });
      }).then(function (result) {
        if (result.error) throw result.error;
        setButtonState(button, false);
        showStatus(status, 'Login successful. Redirecting to payment...', 'success');
        window.setTimeout(function () { window.location.href = '../payment.html'; }, 500);
      }).catch(function (error) {
        setButtonState(button, false);
        showStatus(status, supabaseErrorMessage(error), 'error');
      });
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
    var discountInput = byId('discountCode');
    bindFileInput('screenshotFile', 'filePreview', '.file-text strong', status, 'Payment screenshot');
    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var selected = document.querySelector('input[name="paymentMethod"]:checked');
      var methodValue = selected ? selected.value : 'bkash';
      var isBank = methodValue !== 'bkash';
      var transaction = byId('transactionId');
      var screenshot = byId('screenshotFile');
      var discount = window.DailyGloDiscounts ? window.DailyGloDiscounts.calculate(discountInput ? discountInput.value : '') : { valid: false, code: '', percent: 0, finalAmount: 750 };
      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }
      if (discountInput && discountInput.value.trim() && !discount.valid) {
        showStatus(status, 'The discount code is invalid.', 'error');
        return;
      }
      if (isBank && !validateFile(screenshot, status, 'Payment screenshot')) return;
      var button = byId('submitBtn');
      setButtonState(button, true, isBank ? 'Uploading...' : 'Submitting...');
      var methodMap = { bkash: 'bkash', alrajhi: 'al_rajhi_bank', bangkok_bank: 'bangkok_bank' };
      var data = new FormData();
      data.append('method', methodMap[methodValue] || 'bkash');
      data.append('requiredAmount', '750');
      data.append('finalAmount', String(discount.finalAmount));
      data.append('discountCode', discount.code);
      data.append('discountPercent', String(discount.percent));
      data.append('transactionReference', (transaction && transaction.value.trim()) || '');
      if (isBank && screenshot && screenshot.files && screenshot.files.length) {
        data.append('screenshot', screenshot.files[0]);
      }
      apiFetch('/api/payments', { method: 'POST', body: data }).then(function () {
        setButtonState(button, false);
        showStatus(status, 'Payment details submitted successfully. It is now awaiting admin review.', 'success');
        form.reset();
        var defaultMethod = document.querySelector('input[name="paymentMethod"][value="bkash"]');
        if (defaultMethod) {
          defaultMethod.checked = true;
          defaultMethod.dispatchEvent(new Event('change'));
        }
        if (window.DailyGloDiscounts && byId('amount')) {
          byId('amount').value = '750';
          if (byId('discountAmount')) byId('discountAmount').textContent = '-0 SAR';
          if (byId('finalAmount')) byId('finalAmount').textContent = '750 SAR';
          if (discountInput) discountInput.value = '';
          if (byId('discountMessage')) { byId('discountMessage').textContent = 'Try DAILYGLO75 or DAILYGLO60.'; byId('discountMessage').className = 'discount-message'; }
        }
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
    // Thailand Lottery 2026 schedule: every draw is at 12:00 PM Saudi Arabia time (UTC+3 = 09:00 UTC).
    var drawMonthDays = [
      [0, 2], [0, 17], [1, 1], [1, 16], [2, 1], [2, 16],
      [3, 1], [3, 16], [4, 2], [4, 16], [5, 1], [5, 16],
      [6, 1], [6, 16], [7, 1], [7, 16], [8, 1], [8, 16],
      [9, 1], [9, 16], [10, 1], [10, 16], [11, 1], [11, 16]
    ];

    function getDrawSchedule(year) {
      return drawMonthDays.map(function (monthDay) {
        return new Date(Date.UTC(year, monthDay[0], monthDay[1], 9, 0, 0, 0));
      });
    }

    function getNextDraw(now) {
      var currentYear = now.getUTCFullYear();
      var schedules = getDrawSchedule(currentYear).concat(getDrawSchedule(currentYear + 1));
      return schedules.find(function (draw) { return draw.getTime() > now.getTime(); }) || schedules[schedules.length - 1];
    }

    function pad(value) { return String(Math.max(0, value)).padStart(2, '0'); }

    function updateDrawLabels(draw) {
      var dateText = new Intl.DateTimeFormat('en-GB', {
        timeZone: 'Asia/Riyadh', day: 'numeric', month: 'long', year: 'numeric'
      }).format(draw);
      var timeText = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Riyadh', hour: 'numeric', minute: '2-digit', hour12: true
      }).format(draw) + ' • SAUDI ARABIA TIME';
      document.querySelectorAll('[data-next-draw-date]').forEach(function (element) {
        element.textContent = dateText.toUpperCase();
      });
      document.querySelectorAll('[data-next-draw-time]').forEach(function (element) {
        element.textContent = timeText;
      });
      document.querySelectorAll('[data-local-draw-time]').forEach(function (element) {
        element.textContent = dateText + ' at ' + timeText;
      });
      document.querySelectorAll('[data-local-timezone]').forEach(function (element) {
        element.textContent = 'Saudi Arabia Time (GMT+3)';
      });
    }

    document.querySelectorAll('[data-countdown]').forEach(function (countdown) {
      var days = countdown.querySelector('[data-countdown-days]');
      var hours = countdown.querySelector('[data-countdown-hours]');
      var minutes = countdown.querySelector('[data-countdown-minutes]');
      var seconds = countdown.querySelector('[data-countdown-seconds]');
      var activeDraw = null;
      function render() {
        var now = new Date();
        if (!activeDraw || now.getTime() >= activeDraw.getTime()) {
          activeDraw = getNextDraw(now);
          updateDrawLabels(activeDraw);
        }
        var totalSeconds = Math.max(0, Math.floor((activeDraw.getTime() - now.getTime()) / 1000));
        var d = Math.floor(totalSeconds / 86400);
        var h = Math.floor((totalSeconds % 86400) / 3600);
        var m = Math.floor((totalSeconds % 3600) / 60);
        var s = totalSeconds % 60;
        if (days) days.textContent = pad(d);
        if (hours) hours.textContent = pad(h);
        if (minutes) minutes.textContent = pad(m);
        if (seconds) seconds.textContent = pad(s);
        countdown.classList.remove('countdown-ended');
      }
      render();
      window.setInterval(render, 1000);
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
    bindDiscountFields();
    bindRegisterForm();
    bindLoginForm();
    bindContactForm();
    bindPaymentForm();
    bindAdminLogin();
    bindCountdown();
    bindScrollEffects();
  });
}());
