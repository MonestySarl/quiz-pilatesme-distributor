/*!
 * pmb-tracker.js — visitor tracking for Pilates&Me Distributor Quiz.
 *
 * Endpoint: `track-visitor-event` edge fn (CRM Supabase).
 *   https://coiizesawqbutfryausx.supabase.co/functions/v1/track-visitor-event
 *
 * Each visitor gets a `visitor_id` (uuid v4) stored in localStorage.
 * Each funnel step sends a `page_view` event with
 *   payload = { funnel: 'distributor', step: '<name>', value: '<opt>' }
 * The final submit sends `quote_submitted`.
 *
 * Usage:
 *   <script src="/assets/pmb-tracker.js" defer></script>
 *   <script>pmbTrack('landing');</script>
 *
 * Never blocks UI (fire-and-forget via fetch keepalive).
 */
(function () {
  'use strict';

  var CRM_URL = 'https://coiizesawqbutfryausx.supabase.co/functions/v1/track-visitor-event';
  var FUNNEL = 'distributor';
  var STORAGE_KEY = 'pmd_visitor_id';

  function uuid() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  }

  var visitorId;
  try {
    visitorId = localStorage.getItem(STORAGE_KEY);
    if (!visitorId) {
      visitorId = uuid();
      localStorage.setItem(STORAGE_KEY, visitorId);
    }
  } catch (e) {
    visitorId = uuid();
  }

  var sentSteps = {};

  window.pmbTrack = function (step, extraPayload) {
    if (!step) return;
    var dedupKey = step + '::' + (extraPayload && extraPayload.value ? extraPayload.value : '');
    if (sentSteps[dedupKey]) return;
    sentSteps[dedupKey] = true;

    var eventType = step === 'quote_submitted' ? 'quote_submitted' : 'page_view';
    var payload = { funnel: FUNNEL, step: step };
    if (extraPayload) {
      for (var k in extraPayload) {
        if (Object.prototype.hasOwnProperty.call(extraPayload, k)) {
          payload[k] = extraPayload[k];
        }
      }
    }

    var body = {
      visitor_id: visitorId,
      event_type: eventType,
      payload: payload,
      market: 'world',
      referrer: document.referrer || null,
      landing_page: window.location.href,
      user_agent: navigator.userAgent
    };

    try {
      fetch(CRM_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
        keepalive: true,
        credentials: 'omit',
        mode: 'cors'
      }).catch(function () {});
    } catch (e) {}
  };

  window.pmbVisitorId = visitorId;
})();
