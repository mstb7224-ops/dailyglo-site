(function (window) {
  'use strict';

  var BASE_AMOUNT = 980;
  var THREE_HOURS = 3 * 60 * 60 * 1000;
  var REDEMPTION_KEY = 'dailyglo_discount_redemption_';
  var DEFAULT_CODES = {
    FIRST90: { percent: 90, label: '90% off', expiresAt: '', paymentWindowHours: 3 }
  };
  var activeCodes = Object.assign({}, DEFAULT_CODES);
  var loadedFromDatabase = false;

  function normalise(code) {
    return String(code || '').trim().toUpperCase();
  }

  function readRedemption(code) {
    if (!window.localStorage) return null;
    try {
      var raw = window.localStorage.getItem(REDEMPTION_KEY + normalise(code));
      if (!raw) return null;
      var state = JSON.parse(raw);
      return state && Number(state.expiresAt) ? state : null;
    } catch (error) {
      return null;
    }
  }

  function startRedemption(code) {
    var normalized = normalise(code);
    if (normalized !== 'FIRST90') return null;
    var existing = readRedemption(normalized);
    if (existing && existing.expiresAt > Date.now()) return existing;
    var state = { redeemedAt: Date.now(), expiresAt: Date.now() + THREE_HOURS };
    if (window.localStorage) {
      try { window.localStorage.setItem(REDEMPTION_KEY + normalized, JSON.stringify(state)); } catch (error) {}
    }
    return state;
  }

  function calculate(code) {
    var requestedCode = normalise(code);
    var normalized = requestedCode;
    var offer = activeCodes[normalized];
    var state = normalized === 'FIRST90' ? readRedemption(normalized) : null;
    if (offer && normalized === 'FIRST90' && state && state.expiresAt <= Date.now()) {
      return {
        code: '', requestedCode: requestedCode, percent: 0, label: 'Voucher expired',
        message: 'This FIRST90 voucher has expired because payment was not completed within 3 hours.',
        expiresAt: new Date(state.expiresAt).toISOString(), redemptionExpired: true,
        baseAmount: BASE_AMOUNT, discountAmount: 0, finalAmount: BASE_AMOUNT, valid: false
      };
    }
    var discount = offer ? Number((BASE_AMOUNT * offer.percent / 100).toFixed(2)) : 0;
    var finalAmount = Number((BASE_AMOUNT - discount).toFixed(2));
    return {
      code: offer ? normalized : '',
      requestedCode: requestedCode,
      percent: offer ? offer.percent : 0,
      label: offer ? offer.label : 'No discount',
      message: offer && normalized === 'FIRST90' ? 'Valid for 3 Hour only' : '',
      expiresAt: state ? new Date(state.expiresAt).toISOString() : (offer && offer.expiresAt ? offer.expiresAt : ''),
      paymentWindowHours: offer && offer.paymentWindowHours ? offer.paymentWindowHours : 0,
      baseAmount: BASE_AMOUNT,
      discountAmount: discount,
      finalAmount: finalAmount,
      valid: Boolean(offer)
    };
  }

  function load() {
    var url = window.DAILYGLO_SUPABASE_URL || 'https://xewxigpmvuxkuqtxhxha.supabase.co';
    var key = window.DAILYGLO_SUPABASE_ANON_KEY || 'sb_publishable_C-f5NVBKOhZBXXb45ybjvw_JKpCpI8h';
    var endpoint = url.replace(/\/$/, '') + '/rest/v1/discount_codes?select=code,percent_off,expires_at,max_uses,used_count&active=eq.true';
    return fetch(endpoint, { headers: { apikey: key, Authorization: 'Bearer ' + key } })
      .then(function (response) {
        if (!response.ok) throw new Error('Discount table is not available.');
        return response.json();
      })
      .then(function (rows) {
        var now = Date.now();
        var databaseCodes = {};
        (rows || []).forEach(function (row) {
          var expiresAt = row.expires_at ? Date.parse(row.expires_at) : null;
          var maxUses = row.max_uses === null || row.max_uses === undefined ? null : Number(row.max_uses);
          var usedCount = Number(row.used_count || 0);
          if (expiresAt && expiresAt <= now) return;
          if (maxUses !== null && usedCount >= maxUses) return;
          var code = normalise(row.code);
          var percent = Number(row.percent_off);
          if (!code || !Number.isFinite(percent) || percent <= 0 || percent > 100) return;
          databaseCodes[code] = { percent: percent, label: percent + '% off', expiresAt: row.expires_at || '', paymentWindowHours: code === 'FIRST90' ? 3 : 0 };
        });
        activeCodes = databaseCodes;
        loadedFromDatabase = true;
        return activeCodes;
      })
      .catch(function () { return activeCodes; });
  }

  window.DailyGloDiscounts = {
    baseAmount: BASE_AMOUNT,
    codes: function () { return Object.keys(activeCodes); },
    calculate: calculate,
    load: load,
    normalise: normalise,
    startRedemption: startRedemption,
    isDatabaseBacked: function () { return loadedFromDatabase; }
  };
}(window));
