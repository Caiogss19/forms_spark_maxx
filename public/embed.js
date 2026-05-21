(function () {
  "use strict";
  if (window.__sparkFormsEmbed) return;
  window.__sparkFormsEmbed = true;

  var SCRIPT = document.currentScript;
  var BASE =
    (SCRIPT && SCRIPT.getAttribute("data-spark-base")) ||
    (SCRIPT && new URL(SCRIPT.src, location.href).origin) ||
    location.origin;

  var iframesBySlug = {};

  /**
   * Resolves the actual host page URL. Falls through three tiers and
   * memoizes the result.
   *
   *  1. window.top.location.href — same-origin all the way up.
   *  2. document.referrer when we're in a srcdoc/about: iframe (Framer
   *     etc.). Note: many hosts ship Referrer-Policy: strict-origin
   *     which strips path + query down to just the origin. When that
   *     happens we still report the origin but rely on the postMessage
   *     fallback (asked from window.top) for the full URL with UTMs.
   *  3. location.href — plain non-wrapped embed.
   */
  function resolveHostUrl() {
    try {
      if (window.top && window.top !== window) {
        var topHref = window.top.location.href;
        if (topHref) return topHref;
      }
    } catch (e) {
      /* cross-origin: can't read window.top */
    }
    if (/^about:/i.test(location.href) && document.referrer) {
      return document.referrer;
    }
    return location.href;
  }

  function resolveHostReferrer() {
    try {
      if (window.top && window.top !== window) {
        return window.top.document.referrer || "";
      }
    } catch (e) {
      /* cross-origin */
    }
    // In a srcdoc iframe we already consumed document.referrer as the
    // host URL, so we can't surface a true upstream referrer.
    if (/^about:/i.test(location.href)) return "";
    return document.referrer || "";
  }

  function resolveHostQuery() {
    try {
      if (window.top && window.top !== window) {
        return new URL(window.top.location.href).searchParams;
      }
    } catch (e) {
      /* cross-origin */
    }
    var hostUrl = resolveHostUrl();
    try {
      return new URL(hostUrl).searchParams;
    } catch (e) {
      return new URLSearchParams();
    }
  }

  function getCookie(name) {
    var target = name + "=";
    var parts = document.cookie ? document.cookie.split(";") : [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf(target) === 0) {
        try {
          return decodeURIComponent(p.slice(target.length));
        } catch (e) {
          return p.slice(target.length);
        }
      }
    }
    return null;
  }

  // ─── Top-page URL bridge (cross-origin) ───────────────────────────
  // When embed.js lives inside a srcdoc wrapper (Framer), it cannot read
  // window.top.location.href and document.referrer is often policy-
  // stripped to just the origin. We ask the top window via postMessage;
  // the host site provides the URL via a tiny listener it ships once
  // (snippet shown in the admin Embed modal). When this code itself is
  // running at the top level, we register the listener inline so any
  // descendant iframe can ask us directly.

  var cachedHostUrl = null;
  var cachedHostReferrer = null;
  var hostUrlReceived = false;

  function askTopForUrl(slug) {
    try {
      if (!window.top || window.top === window) return;
      window.top.postMessage(
        { type: "spark-forms:host-url-request", slug: slug || "_any" },
        "*",
      );
    } catch (e) {
      /* ignore */
    }
  }

  // Repeatedly ask the top page for the host URL until we get a
  // response (host listener may load slightly after embed.js boots) or
  // until we give up. On give-up we log a hint pointing the user at
  // the snippet they need to add to their site head.
  function askTopForUrlWithRetries(slug) {
    var attempts = 0;
    var maxAttempts = 10;
    function tick() {
      if (hostUrlReceived || attempts >= maxAttempts) {
        if (!hostUrlReceived) {
          try {
            console.warn(
              "[spark-forms] No response to host-url-request after " +
                maxAttempts +
                " attempts. The form's payload will only contain the page origin (no path / no UTMs). To fix: paste the host listener snippet from /admin → Embed into the site's <head>.",
            );
          } catch (e) {
            /* ignore */
          }
        }
        return;
      }
      attempts++;
      askTopForUrl(slug);
      setTimeout(tick, 250);
    }
    tick();
  }

  function utmsFromUrl(url) {
    var out = {};
    try {
      var qs = new URL(url).searchParams;
      var keys = [
        "utm_source",
        "utm_medium",
        "utm_campaign",
        "utm_term",
        "utm_content",
        "gclid",
        "fbclid",
        "ttclid",
        "msclkid",
      ];
      for (var i = 0; i < keys.length; i++) {
        var v = qs.get(keys[i]);
        if (v) out[keys[i]] = v;
      }
    } catch (e) {
      /* invalid URL — return empty */
    }
    return out;
  }

  function broadcastHostInfo(url, referrer) {
    if (!url) return;
    var utms = utmsFromUrl(url);
    for (var slug in iframesBySlug) {
      var iframe = iframesBySlug[slug];
      if (!iframe || !iframe.contentWindow) continue;
      var payload = {
        landing_page: url,
        page_url: url,
        referrer: referrer || "",
      };
      for (var k in utms) payload[k] = utms[k];
      try {
        iframe.contentWindow.postMessage(
          { type: "spark-forms:tracking", payload: payload },
          "*",
        );
      } catch (e) {
        /* ignore */
      }
    }
  }

  // Auto-install the host listener when this script is loaded at the
  // top level of a page (the common case — when the user pastes the
  // snippet directly onto a Framer page, not inside an HTML embed
  // block). Idempotent.
  if (
    typeof window !== "undefined" &&
    window === window.top &&
    !window.__sparkFormsHostListener
  ) {
    window.__sparkFormsHostListener = true;
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "spark-forms:host-url-request") {
        try {
          e.source &&
            e.source.postMessage(
              {
                type: "spark-forms:host-url-response",
                url: location.href,
                referrer: document.referrer,
              },
              "*",
            );
        } catch (err) {
          /* ignore */
        }
      }
    });
  }

  function buildTrackingPayload() {
    var hostUrl = resolveHostUrl();
    var qs = resolveHostQuery();
    var keys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
      "ttclid",
      "msclkid",
    ];
    var payload = {
      referrer: resolveHostReferrer(),
      landing_page: hostUrl,
      page_url: hostUrl,
    };
    for (var i = 0; i < keys.length; i++) {
      var v = qs.get(keys[i]);
      if (v) payload[keys[i]] = v;
    }
    var rdtrk = getCookie("rdtrk");
    if (rdtrk) payload.rdtrk = rdtrk;
    var fbp = getCookie("_fbp");
    if (fbp) payload.fbp = fbp;
    var ga = getCookie("_ga");
    if (ga) {
      var ps = ga.split(".");
      if (ps.length >= 4) payload.ga_client_id = ps[ps.length - 2] + "." + ps[ps.length - 1];
    }
    return payload;
  }

  function mount(host) {
    var slug = host.getAttribute("data-spark-form");
    if (!slug || host.querySelector("iframe[data-spark-mounted]")) return;

    var src = BASE + "/embed/" + encodeURIComponent(slug);
    var transparent = host.getAttribute("data-spark-transparent");
    if (transparent === "1" || transparent === "true") src += "?transparent=1";

    // Forward UTMs into the iframe URL so the form sees them even before
    // postMessage fires (covers the very first SSR render).
    var parentQs = resolveHostQuery();
    var fwdKeys = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "gclid",
      "fbclid",
    ];
    var hasQuery = src.indexOf("?") >= 0;
    for (var i = 0; i < fwdKeys.length; i++) {
      var v = parentQs.get(fwdKeys[i]);
      if (v) {
        src += (hasQuery ? "&" : "?") + fwdKeys[i] + "=" + encodeURIComponent(v);
        hasQuery = true;
      }
    }

    // Parent URL + referrer so the iframe captures the host page (not the
    // iframe's own /embed/<slug>) on first paint. Avoids the postMessage
    // race that previously left landing_page pointing at the iframe URL.
    src +=
      (hasQuery ? "&" : "?") + "_p=" + encodeURIComponent(resolveHostUrl());
    src += "&_pr=" + encodeURIComponent(resolveHostReferrer());

    var iframe = document.createElement("iframe");
    iframe.src = src;
    iframe.title = host.getAttribute("data-spark-title") || "Spark Forms";
    iframe.loading = "lazy";
    iframe.setAttribute("data-spark-mounted", "1");
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.display = "block";
    iframe.style.transition = "height 240ms cubic-bezier(0.22, 1, 0.36, 1)";
    iframe.style.minHeight = host.getAttribute("data-spark-min-height") || "560px";
    iframe.allow = "clipboard-write";

    host.innerHTML = "";
    host.appendChild(iframe);
    iframesBySlug[slug] = iframe;

    // Ask the top page for its URL. Works cross-origin (postMessage is
    // allowed). Useful when we're sitting inside Framer/Webflow's srcdoc
    // wrapper that strips path/query from document.referrer. The host
    // page needs a tiny listener — see the snippet in the embed modal.
    askTopForUrlWithRetries(slug);

    iframe.addEventListener("load", function () {
      try {
        // Handshake: tells the iframe that this host has the latest
        // embed.js (with the disqualifier overlay handler). The iframe
        // suppresses its in-form modal once it sees this, so the popup
        // only renders here, full-viewport on the parent page.
        iframe.contentWindow.postMessage(
          {
            type: "spark-forms:host-ready",
            version: 2,
            slug: slug,
          },
          "*",
        );
        iframe.contentWindow.postMessage(
          { type: "spark-forms:tracking", payload: buildTrackingPayload() },
          "*",
        );
      } catch (e) {
        /* cross-origin: post anyway, will be filtered by recipient */
        iframe.contentWindow &&
          iframe.contentWindow.postMessage(
            { type: "spark-forms:tracking", payload: buildTrackingPayload() },
            "*",
          );
      }
    });
  }

  // ─── Disqualifier modal (parent-page overlay) ─────────────────────
  var disqualifierEl = null;
  var disqualifierSourceWindow = null;
  var disqualifierSlug = null;

  function notifyDismissed() {
    if (!disqualifierSourceWindow) return;
    try {
      disqualifierSourceWindow.postMessage(
        {
          type: "spark-forms:disqualifier-dismissed",
          slug: disqualifierSlug,
        },
        "*",
      );
    } catch (e) {
      /* ignore */
    }
  }

  function closeDisqualifier() {
    if (!disqualifierEl) return;
    notifyDismissed();
    if (disqualifierEl.parentNode) {
      disqualifierEl.parentNode.removeChild(disqualifierEl);
    }
    disqualifierEl = null;
    disqualifierSourceWindow = null;
    disqualifierSlug = null;
    document.documentElement.style.overflow = "";
    document.removeEventListener("keydown", onDisqualifierKey);
  }

  function onDisqualifierKey(e) {
    if (e.key === "Escape") closeDisqualifier();
  }

  function showDisqualifier(config, theme, sourceWindow, slug) {
    if (disqualifierEl) closeDisqualifier();
    disqualifierSourceWindow = sourceWindow;
    disqualifierSlug = slug;

    var t = theme || {};
    var bg = t.background || "#FFFFFF";
    var fg = t.foreground || "#0A0A0A";
    var primary = t.primary || "#0A0A0A";
    var primaryFg = t.primaryForeground || "#FFFFFF";
    var radius = t.radius || "1rem";

    var overlay = document.createElement("div");
    overlay.setAttribute("data-spark-disqualifier", "1");
    overlay.style.cssText = [
      "position:fixed",
      "inset:0",
      "z-index:2147483647",
      "display:flex",
      "align-items:center",
      "justify-content:center",
      "padding:16px",
      "background:rgba(0,0,0,0.7)",
      "font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Inter,Roboto,Helvetica,Arial,sans-serif",
      "animation:sparkFormsFadeIn 200ms ease",
    ].join(";");
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) closeDisqualifier();
    });

    var card = document.createElement("div");
    card.style.cssText = [
      "position:relative",
      "width:100%",
      "max-width:420px",
      "padding:28px",
      "background:" + bg,
      "color:" + fg,
      "border-radius:" + radius,
      "box-shadow:0 24px 64px rgba(0,0,0,0.45)",
      "animation:sparkFormsPop 220ms cubic-bezier(0.22,1,0.36,1)",
    ].join(";");
    card.addEventListener("click", function (e) {
      e.stopPropagation();
    });

    var closeBtn = document.createElement("button");
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Fechar");
    closeBtn.innerHTML =
      '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>';
    closeBtn.style.cssText = [
      "position:absolute",
      "top:12px",
      "right:12px",
      "background:transparent",
      "border:0",
      "padding:6px",
      "border-radius:6px",
      "cursor:pointer",
      "color:" + fg,
      "opacity:0.6",
    ].join(";");
    closeBtn.addEventListener("mouseenter", function () {
      closeBtn.style.opacity = "1";
    });
    closeBtn.addEventListener("mouseleave", function () {
      closeBtn.style.opacity = "0.6";
    });
    closeBtn.addEventListener("click", closeDisqualifier);

    var icon = document.createElement("div");
    icon.innerHTML =
      '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>';
    icon.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "justify-content:center",
      "width:40px",
      "height:40px",
      "border-radius:9999px",
      "background:" + primary,
      "color:" + primaryFg,
      "margin-bottom:18px",
    ].join(";");

    var title = document.createElement("h2");
    title.textContent = config.title || "Não foi dessa vez";
    title.style.cssText = [
      "margin:0 0 8px",
      "font-size:20px",
      "font-weight:600",
      "letter-spacing:-0.01em",
      "color:" + fg,
    ].join(";");

    var msg = document.createElement("p");
    msg.textContent = config.message || "";
    msg.style.cssText = [
      "margin:0 0 22px",
      "font-size:14px",
      "line-height:1.55",
      "white-space:pre-line",
      "opacity:0.75",
    ].join(";");

    var actions = document.createElement("div");
    actions.style.cssText = [
      "display:flex",
      "flex-wrap:wrap",
      "align-items:center",
      "gap:12px",
    ].join(";");

    if (config.ctaUrl) {
      var cta = document.createElement("a");
      cta.href = config.ctaUrl;
      cta.target = "_blank";
      cta.rel = "noopener noreferrer";
      cta.textContent = config.ctaLabel || "Saiba mais";
      cta.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "height:42px",
        "padding:0 20px",
        "background:" + primary,
        "color:" + primaryFg,
        "border-radius:8px",
        "font-size:14px",
        "font-weight:500",
        "text-decoration:none",
      ].join(";");
      actions.appendChild(cta);
    }

    var altBtn = document.createElement("button");
    altBtn.type = "button";
    altBtn.textContent = "Voltar e alterar resposta";
    altBtn.style.cssText = [
      "display:inline-flex",
      "align-items:center",
      "height:42px",
      "padding:0 16px",
      "background:transparent",
      "border:0",
      "border-radius:8px",
      "font-size:14px",
      "font-weight:500",
      "color:" + fg,
      "opacity:0.65",
      "cursor:pointer",
    ].join(";");
    altBtn.addEventListener("click", closeDisqualifier);
    actions.appendChild(altBtn);

    card.appendChild(closeBtn);
    card.appendChild(icon);
    card.appendChild(title);
    card.appendChild(msg);
    card.appendChild(actions);
    overlay.appendChild(card);

    if (!document.getElementById("spark-forms-disqualifier-styles")) {
      var style = document.createElement("style");
      style.id = "spark-forms-disqualifier-styles";
      style.textContent =
        "@keyframes sparkFormsFadeIn{from{opacity:0}to{opacity:1}}" +
        "@keyframes sparkFormsPop{from{opacity:0;transform:translateY(8px) scale(0.97)}to{opacity:1;transform:translateY(0) scale(1)}}";
      document.head.appendChild(style);
    }

    document.body.appendChild(overlay);
    document.documentElement.style.overflow = "hidden";
    disqualifierEl = overlay;

    document.addEventListener("keydown", onDisqualifierKey);
  }

  function handleMessage(event) {
    var data = event.data;
    if (!data || typeof data !== "object") return;

    // Top page responded with its true URL/referrer — propagate to all
    // mounted iframes so they update landing_page/page_url and UTMs.
    if (
      data.type === "spark-forms:host-url-response" &&
      typeof data.url === "string"
    ) {
      hostUrlReceived = true;
      cachedHostUrl = data.url;
      cachedHostReferrer = data.referrer || "";
      broadcastHostInfo(cachedHostUrl, cachedHostReferrer);
      return;
    }

    // Iframe announces it's listening — re-send host-ready AND, if we
    // already have a host URL cached from a previous host-url-response,
    // re-broadcast it. Covers the race where the host responded before
    // the iframe's React tree mounted its message listener.
    if (data.type === "spark-forms:iframe-ready") {
      try {
        event.source &&
          event.source.postMessage(
            {
              type: "spark-forms:host-ready",
              version: 2,
              slug: data.slug,
            },
            "*",
          );
        // If we already have the host URL cached (because the top
        // listener responded before this iframe's React tree mounted),
        // re-send it so landing_page/UTMs aren't lost to that race.
        if (hostUrlReceived && cachedHostUrl && event.source) {
          var utms = utmsFromUrl(cachedHostUrl);
          var payload = {
            landing_page: cachedHostUrl,
            page_url: cachedHostUrl,
            referrer: cachedHostReferrer || "",
          };
          for (var k in utms) payload[k] = utms[k];
          event.source.postMessage(
            { type: "spark-forms:tracking", payload: payload },
            "*",
          );
        }
      } catch (e) {
        /* ignore */
      }
      return;
    }

    if (data.type === "spark-forms:resize" && typeof data.height === "number") {
      var iframe = data.slug ? iframesBySlug[data.slug] : null;
      if (!iframe) {
        // Fall back to any frame whose source matches this origin.
        for (var key in iframesBySlug) {
          if (iframesBySlug[key].contentWindow === event.source) {
            iframe = iframesBySlug[key];
            break;
          }
        }
      }
      if (iframe) iframe.style.height = Math.max(120, data.height) + "px";
      return;
    }

    if (
      data.type === "spark-forms:redirect" &&
      typeof data.url === "string" &&
      /^https?:\/\//i.test(data.url)
    ) {
      // Redirect the actual host page, not just the iframe. Try top
      // first (works when same-origin); fall back to our own location
      // which embed.js may also be inside a srcdoc wrapper.
      try {
        if (window.top && window.top !== window) {
          window.top.location.href = data.url;
          return;
        }
      } catch (e) {
        /* cross-origin; fall through */
      }
      try {
        window.parent && window.parent !== window
          ? (window.parent.location.href = data.url)
          : (location.href = data.url);
      } catch (e) {
        location.href = data.url;
      }
      return;
    }

    if (data.type === "spark-forms:disqualifier-show") {
      showDisqualifier(
        data.config || {},
        data.theme || {},
        event.source,
        data.slug,
      );
      return;
    }
    if (data.type === "spark-forms:disqualifier-hide") {
      // Only close if the hide is for our current modal.
      if (disqualifierEl && (!data.slug || data.slug === disqualifierSlug)) {
        // Clear without re-notifying iframe (the iframe already knows).
        disqualifierSourceWindow = null;
        closeDisqualifier();
      }
      return;
    }

    if (data.type === "spark-forms:submitted") {
      // GTM-friendly event surface.
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({
          event: "spark_form_submitted",
          spark_form_slug: data.slug,
          spark_form_submission_id: data.submissionId,
        });
      } catch (e) {
        /* ignore */
      }
      try {
        window.dispatchEvent(
          new CustomEvent("spark:submission", {
            detail: {
              slug: data.slug,
              submissionId: data.submissionId,
            },
          }),
        );
      } catch (e) {
        /* ignore */
      }
    }
  }

  function scan() {
    var hosts = document.querySelectorAll("[data-spark-form]");
    for (var i = 0; i < hosts.length; i++) mount(hosts[i]);
  }

  window.addEventListener("message", handleMessage);

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", scan);
  } else {
    scan();
  }

  // Re-scan when the host page swaps content dynamically (SPAs).
  var mo = new MutationObserver(function () {
    scan();
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Expose a minimal API for advanced callers.
  window.SparkForms = {
    mount: mount,
    scan: scan,
  };
})();
