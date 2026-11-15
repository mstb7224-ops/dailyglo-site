(function (window) {
  'use strict';

  var BASE_AMOUNT = 980;
  var DEFAULT_CODES = {
    PRIME75: { percent: 75, label: '75% off' }
  };
  var activeCodes = Object.assign({}, DEFAULT_CODES);
  var loadedFromDatabase = false;

  function normalise(code) {
    return String(code || '').trim().toUpperCase();
  }

  function calculate(code) {
    var normalized = normalise(code);
    var offer = activeCodes[normalized];
    var fallbackMessage = '';
    if (normalized === 'SPECIAL5' && !offer && activeCodes.PRIME75) {
      offer = activeCodes.PRIME75;
      normalized = 'PRIME75';
      fallbackMessage = 'Thank you for your interest in SPECIAL5. This 90% offer was reserved for the first five customers, and all five places have now been claimed. The offer is no longer active, so PRIME75 (75% off) has been applied instead.';
    }
    var discount = offer ? Number((BASE_AMOUNT * offer.percent / 100).toFixed(2)) : 0;
    var finalAmount = Number((BASE_AMOUNT - discount).toFixed(2));
    return {
      code: offer ? normalized : '',
      requestedCode: normalise(code),
      percent: offer ? offer.percent : 0,
      label: fallbackMessage || (offer ? offer.label : 'No discount'),
      message: fallbackMessage,
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
          databaseCodes[code] = { percent: percent, label: percent + '% off' };
        });
        activeCodes = databaseCodes;
        loadedFromDatabase = true;
        return activeCodes;
      })
      .catch(function () {
        return activeCodes;
      });
  }

  window.DailyGloDiscounts = {
    baseAmount: BASE_AMOUNT,
    codes: function () { return Object.keys(activeCodes); },
    calculate: calculate,
    load: load,
    normalise: normalise,
    isDatabaseBacked: function () { return loadedFromDatabase; }
  };
}(window));
