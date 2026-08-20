/*!
 * pmb-pixel.js — Meta Pixel + helpers de conversion (Quiz Pilates&Me)
 *
 * Rôle :
 *   1. Initialise le Meta Pixel (unique tous marchés) + tire PageView à l'arrivée
 *   2. Expose des helpers globaux pour l'event Lead :
 *      - window.pmbGenEventId()      → UUID (dédup Pixel ↔ CAPI)
 *      - window.pmbGetGA4ClientId()  → client_id GA4 lu depuis le cookie _ga
 *      - window.pmbFireLead(payload) → fbq('track','Lead',{...},{eventID}) avec
 *        advanced matching (em/ph/fn/ln/ct/zp/country) + value/currency
 *
 * Ces IDs sont ré-envoyés au webhook Make (via l'edge fn quiz-lead-ingest)
 * pour que le module CAPI puisse dédupliquer côté serveur.
 *
 * Pixel ID : 754625003929301 (unique FR + DE + toutes langues)
 */
(function () {
  'use strict';
  var PIXEL_ID = '754625003929301';

  // ---- Base Meta Pixel (identique à celle utilisée sur Shopify) ----
  !function(f,b,e,v,n,t,s){
    if(f.fbq)return;n=f.fbq=function(){n.callMethod?
    n.callMethod.apply(n,arguments):n.queue.push(arguments)};
    if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
    n.queue=[];t=b.createElement(e);t.async=!0;
    t.src=v;s=b.getElementsByTagName(e)[0];
    s.parentNode.insertBefore(t,s);
  }(window, document,'script','https://connect.facebook.net/en_US/fbevents.js');

  try {
    fbq('init', PIXEL_ID);
    fbq('track', 'PageView');
  } catch (e) {}

  // ---- Helper : génère un UUID v4 pour l'event_id (dédup Pixel ↔ CAPI) ----
  window.pmbGenEventId = function () {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      try { return crypto.randomUUID(); } catch (e) {}
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      var r = (Math.random() * 16) | 0;
      var v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
  };

  // ---- Helper : extrait le client_id GA4 depuis le cookie _ga ----
  // Format cookie : "GA1.2.1234567890.1699999999" → client_id = "1234567890.1699999999"
  // Nécessaire pour que GA4 stitche l'event server-side (via MP) avec la session client.
  window.pmbGetGA4ClientId = function () {
    try {
      var m = document.cookie.match(/(?:^|;\s*)_ga=GA\d\.\d\.([\d]+\.[\d]+)/);
      if (m) return m[1];
    } catch (e) {}
    // Fallback : génère un ID stable + timestamp (moins bon pour l'attribution)
    return (Math.floor(Math.random() * 1e10) + '.' + Math.floor(Date.now() / 1000));
  };

  // ---- Helper : tire l'event Lead avec advanced matching + dédup ----
  //   payload = {
  //     event_id, value, currency,
  //     content_name, content_category, content_ids, contents, num_items,
  //     email, phone, first_name, last_name, city, postal_code, country
  //   }
  window.pmbFireLead = function (p) {
    if (typeof fbq !== 'function') return;
    p = p || {};
    var customData = {
      content_name: p.content_name || 'Demande de devis (Quiz)',
      content_category: p.content_category || 'B2B',
      content_type: 'product',
      value: (typeof p.value === 'number' && !isNaN(p.value)) ? p.value : 0,
      currency: p.currency || 'EUR'
    };
    if (p.content_ids) customData.content_ids = p.content_ids;
    if (p.contents)    customData.contents = p.contents;
    if (p.num_items)   customData.num_items = p.num_items;
    // Advanced matching — Meta hash em/ph/fn/ln/ct/zp/country automatiquement
    if (p.email)       customData.em = p.email;
    if (p.phone)       customData.ph = p.phone;
    if (p.first_name)  customData.fn = p.first_name;
    if (p.last_name)   customData.ln = p.last_name;
    if (p.city)        customData.ct = p.city;
    if (p.postal_code) customData.zp = p.postal_code;
    if (p.country)     customData.country = p.country;

    var options = p.event_id ? { eventID: p.event_id } : undefined;
    try {
      fbq('track', 'Lead', customData, options);
    } catch (e) {}
  };
})();
