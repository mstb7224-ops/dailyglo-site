(function (window) {
  'use strict';

  var BASE_AMOUNT = 750;
  var CODES = {
    DAILYGLO75: { percent: 75, label: '75% off' },
    DAILYGLO60: { percent: 60, label: '60% off' }
  };

  function normalise(code) {
    return String(code || '').trim().toUpperCase();
  }

  function calculate(code) {
    var normalized = normalise(code);
    var offer = CODES[normalized];
    var discount = offer ? Number((BASE_AMOUNT * offer.percent / 100).toFixed(2)) : 0;
    var finalAmount = Number((BASE_AMOUNT - discount).toFixed(2));
    return {
      code: offer ? normalized : '',
      percent: offer ? offer.percent : 0,
      label: offer ? offer.label : 'No discount',
      baseAmount: BASE_AMOUNT,
      discountAmount: discount,
      finalAmount: finalAmount,
      valid: Boolean(offer)
    };
  }

  window.DailyGloDiscounts = {
    baseAmount: BASE_AMOUNT,
    codes: Object.keys(CODES),
    calculate: calculate,
    normalise: normalise
  };
}(window));
