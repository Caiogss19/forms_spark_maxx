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

  // UTM persistence keys on the parent page. We snapshot whatever
  // tracking params we see (URL or first-touch storage) so a visitor
  // who comes back without a querystring still triggers the correct
  // attribution downstream.
  var UTM_STORAGE_KEY = "spark:utms";
  var TRACKING_PARAM_KEYS = [
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

  function readStoredUtms() {
    try {
      var raw = window.localStorage.getItem(UTM_STORAGE_KEY);
      if (!raw) return {};
      var parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function persistUtmsFromUrl(url) {
    try {
      var qs = new URL(url, location.href).searchParams;
      var fresh = {};
      for (var i = 0; i < TRACKING_PARAM_KEYS.length; i++) {
        var k = TRACKING_PARAM_KEYS[i];
        var v = qs.get(k);
        if (v) fresh[k] = v;
      }
      if (!Object.keys(fresh).length) return;
      var merged = readStoredUtms();
      for (var key in fresh) merged[key] = fresh[key];
      window.localStorage.setItem(UTM_STORAGE_KEY, JSON.stringify(merged));
    } catch (e) {
      /* private mode / quota / parse — silently no-op */
    }
  }

  // Returns the input URL augmented with any persisted UTMs that are
  // not already present in its querystring. Used when the live URL has
  // been stripped (Framer / SPA replaceState) and the load-time
  // snapshot also lacks UTMs — typically a returning visitor.
  function augmentUrlWithStoredUtms(url) {
    try {
      var stored = readStoredUtms();
      if (!Object.keys(stored).length) return url;
      var u = new URL(url, location.href);
      var changed = false;
      for (var i = 0; i < TRACKING_PARAM_KEYS.length; i++) {
        var k = TRACKING_PARAM_KEYS[i];
        if (!u.searchParams.has(k) && stored[k]) {
          u.searchParams.set(k, stored[k]);
          changed = true;
        }
      }
      return changed ? u.toString() : url;
    } catch (e) {
      return url;
    }
  }

  // Auto-install the host listener when this script is loaded at the
  // top level of a page (the common case — when the user pastes the
  // snippet directly onto a Framer page, not inside an HTML embed
  // block). Idempotent.
  //
  // Snapshot location.href / document.referrer at script-load time so a
  // SPA host (Framer, Next.js, etc.) that strips ?utm_* via
  // history.replaceState before the iframe gets around to asking still
  // sees the original URL with UTMs.
  if (
    typeof window !== "undefined" &&
    window === window.top &&
    !window.__sparkFormsHostListener
  ) {
    window.__sparkFormsHostListener = true;
    var initialUrl = location.href;
    var initialReferrer = document.referrer;
    // First-touch persistence: if the visitor lands with UTMs, save
    // them so a SPA replaceState — or a return visit — can still
    // surface them downstream.
    persistUtmsFromUrl(initialUrl);
    window.addEventListener("message", function (e) {
      var d = e.data;
      if (!d || typeof d !== "object") return;
      if (d.type === "spark-forms:host-url-request") {
        try {
          // Prefer the current URL when it still has UTMs (covers SPA
          // navigations to deeper pages with new UTMs), and fall back to
          // the load-time snapshot when the SPA has wiped them via
          // history.replaceState before the iframe got around to asking.
          // If neither URL has UTMs, hydrate from localStorage so a
          // returning visitor still gets attribution.
          var urlNow = location.href;
          persistUtmsFromUrl(urlNow);
          var chosen = /[?&]utm_/i.test(urlNow)
            ? urlNow
            : /[?&]utm_/i.test(initialUrl)
              ? initialUrl
              : augmentUrlWithStoredUtms(urlNow);
          e.source &&
            e.source.postMessage(
              {
                type: "spark-forms:host-url-response",
                url: chosen,
                referrer: document.referrer || initialReferrer,
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
    var stored = {};
    try {
      if (window === window.top) stored = readStoredUtms();
    } catch (e) {
      /* ignore */
    }
    var payload = {
      referrer: resolveHostReferrer(),
      landing_page: hostUrl,
      page_url: hostUrl,
    };
    for (var i = 0; i < TRACKING_PARAM_KEYS.length; i++) {
      var k = TRACKING_PARAM_KEYS[i];
      var v = qs.get(k) || stored[k];
      if (v) payload[k] = v;
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

  function buildSrc(slug, transparent) {
    var src = BASE + "/embed/" + encodeURIComponent(slug);
    if (transparent) src += "?transparent=1";

    // Forward UTMs into the iframe URL so the form sees them even before
    // postMessage fires (covers the very first SSR render). Falls back
    // to localStorage when the live URL has been stripped (Framer SPA
    // replaceState) or the visitor is returning without UTMs.
    var parentQs = resolveHostQuery();
    var storedUtms = (function () {
      try {
        if (window === window.top) return readStoredUtms();
        return {};
      } catch (e) {
        return {};
      }
    })();
    var hasQuery = src.indexOf("?") >= 0;
    for (var i = 0; i < TRACKING_PARAM_KEYS.length; i++) {
      var key = TRACKING_PARAM_KEYS[i];
      var v = parentQs.get(key) || storedUtms[key];
      if (v) {
        src += (hasQuery ? "&" : "?") + key + "=" + encodeURIComponent(v);
        hasQuery = true;
      }
    }

    // Parent URL + referrer so the iframe captures the host page (not the
    // iframe's own /embed/<slug>) on first paint. Avoids the postMessage
    // race that previously left landing_page pointing at the iframe URL.
    src +=
      (hasQuery ? "&" : "?") + "_p=" + encodeURIComponent(resolveHostUrl());
    src += "&_pr=" + encodeURIComponent(resolveHostReferrer());
    return src;
  }

  function createFrame(slug, title) {
    var iframe = document.createElement("iframe");
    iframe.title = title || "Spark Forms";
    iframe.setAttribute("data-spark-mounted", "1");
    iframe.style.border = "0";
    iframe.style.width = "100%";
    iframe.style.display = "block";
    iframe.allow = "clipboard-write; payment";

    // Register the load handler before assigning `src` and appending —
    // a cached iframe can fire `load` synchronously inside appendChild,
    // and we'd miss the chance to post tracking on first paint.
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
    return iframe;
  }

  function mount(host) {
    var slug = host.getAttribute("data-spark-form");
    if (!slug || host.querySelector("iframe[data-spark-mounted]")) return;

    var transparent = host.getAttribute("data-spark-transparent");
    var iframe = createFrame(slug, host.getAttribute("data-spark-title"));
    iframe.loading = "lazy";
    iframe.style.transition = "height 240ms cubic-bezier(0.22, 1, 0.36, 1)";
    iframe.style.minHeight = host.getAttribute("data-spark-min-height") || "560px";

    iframe.src = buildSrc(slug, transparent === "1" || transparent === "true");
    host.innerHTML = "";
    host.appendChild(iframe);
    iframesBySlug[slug] = iframe;

    // Ask the top page for its URL. Works cross-origin (postMessage is
    // allowed). Useful when we're sitting inside Framer/Webflow's srcdoc
    // wrapper that strips path/query from document.referrer. The host
    // page needs a tiny listener — see the snippet in the embed modal.
    askTopForUrlWithRetries(slug);
  }

  // ─── Launcher (floating chat button) ──────────────────────────────
  // <script src=".../embed.js" data-spark-launcher="sprout-chat"> adds a
  // round button at the corner of every page that opens the form in a
  // floating panel (full screen on phones). Paste it once in the site's
  // Custom Code (end of body) — inside an Embed block the button would be
  // trapped in the block.
  //
  // - Built when the browser is idle, so it never competes with the page.
  // - The chat iframe warms up on hover/touch and loads for real on the
  //   first open; it stays mounted, so closing or navigating (Framer is a
  //   SPA) never loses the conversation.
  // - Stacks above a floating WhatsApp button (or [data-spark-avoid])
  //   sitting in the same corner, page by page.
  // - data-spark-launcher-pages / -exclude: comma-separated paths, `*`
  //   as wildcard ("/blog*,/obrigado"). Re-evaluated on every navigation.
  // - Links to #spark-chat (or [data-spark-open]) and
  //   window.SparkForms.open() open it.

  var launcher = null;

  var LAUNCHER_CSS =
    ".spk-l{--spk-off:0px;position:fixed;bottom:calc(20px + var(--spk-off));right:20px;z-index:2147483000;font-family:'Area Normal',system-ui,sans-serif;transition:bottom 320ms cubic-bezier(.22,1,.36,1)}" +
    ".spk-l--left{right:auto;left:20px}" +
    ".spk-l[hidden]{display:none}" +
    ".spk-l__btn{position:relative;width:60px;height:60px;border:0;padding:0;border-radius:50%;background:#1F2C41;cursor:pointer;box-shadow:0 0 0 1px rgba(255,255,255,.22),0 24px 60px -20px rgba(18,28,43,.45),0 2px 10px rgba(0,0,0,.25);transition:transform 160ms cubic-bezier(.22,1,.36,1);-webkit-tap-highlight-color:transparent}" +
    ".spk-l__btn:hover{transform:translateY(-2px)}" +
    ".spk-l__btn:focus-visible{outline:2px solid #DFE8F2;outline-offset:3px}" +
    ".spk-l__btn img{width:100%;height:100%;border-radius:50%;display:block;transition:opacity 160ms,transform 320ms cubic-bezier(.22,1,.36,1)}" +
    ".spk-l__x{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;color:#fff;opacity:0;transform:rotate(-90deg);transition:opacity 160ms,transform 320ms cubic-bezier(.22,1,.36,1)}" +
    ".spk-l--open .spk-l__btn img{opacity:0;transform:rotate(90deg)}" +
    ".spk-l--open .spk-l__x{opacity:1;transform:none}" +
    ".spk-l__dot{position:absolute;top:2px;right:2px;width:14px;height:14px;border-radius:50%;background:#FC0038;border:2px solid #fff}" +
    ".spk-l__teaser{position:absolute;bottom:8px;right:72px;max-width:240px;width:max-content;background:#fff;color:#1F2C41;border:1px solid rgba(27,44,66,.12);border-radius:18px 18px 7px 18px;padding:10px 14px;font-size:14px;line-height:1.35;box-shadow:0 24px 60px -20px rgba(18,28,43,.45);cursor:pointer;opacity:0;transform:translateY(6px);transition:opacity 320ms,transform 320ms cubic-bezier(.22,1,.36,1);pointer-events:none}" +
    ".spk-l--left .spk-l__teaser{right:auto;left:72px;border-radius:18px 18px 18px 7px}" +
    ".spk-l__teaser.is-in{opacity:1;transform:none;pointer-events:auto}" +
    ".spk-l--open .spk-l__teaser{display:none}" +
    ".spk-l__panel{position:absolute;bottom:76px;right:0;width:380px;height:min(620px,calc(100vh - 116px - var(--spk-off)));height:min(620px,calc(100dvh - 116px - var(--spk-off)));background:#fff;border-radius:24px;overflow:hidden;box-shadow:0 24px 60px -20px rgba(18,28,43,.45),0 0 0 1px rgba(27,44,66,.08);opacity:0;transform:translateY(12px) scale(.98);transform-origin:bottom right;visibility:hidden;transition:opacity 320ms cubic-bezier(.22,1,.36,1),transform 320ms cubic-bezier(.22,1,.36,1),visibility 0s 320ms}" +
    ".spk-l--left .spk-l__panel{right:auto;left:0;transform-origin:bottom left}" +
    ".spk-l--open .spk-l__panel{opacity:1;transform:none;visibility:visible;transition-delay:0s}" +
    ".spk-l__panel iframe{height:100%}" +
    ".spk-l__close{position:absolute;top:18px;right:14px;width:36px;height:36px;border:0;border-radius:50%;background:transparent;color:#1F2C41;cursor:pointer;display:flex;align-items:center;justify-content:center}" +
    ".spk-l__close:hover{background:rgba(27,44,66,.06)}" +
    "@media (max-width:480px){" +
    ".spk-l{bottom:calc(16px + var(--spk-off));right:16px}.spk-l--left{left:16px}" +
    ".spk-l__panel{position:fixed;inset:0;width:auto;height:100%;border-radius:0}" +
    ".spk-l--open .spk-l__btn{display:none}" +
    ".spk-l__teaser{max-width:200px}" +
    "}" +
    "@media (prefers-reduced-motion:reduce){.spk-l,.spk-l *{transition:none!important}}";

  var X_ICON =
    '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

  function onIdle(fn) {
    if ("requestIdleCallback" in window) window.requestIdleCallback(fn, { timeout: 2500 });
    else setTimeout(fn, 600);
  }

  function pathPatterns(attr) {
    var raw = SCRIPT && SCRIPT.getAttribute(attr);
    if (!raw) return null;
    return raw
      .split(",")
      .map(function (p) {
        return p.trim();
      })
      .filter(Boolean)
      .map(function (p) {
        var re = p.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
        return new RegExp("^" + re + "/?$");
      });
  }

  function matchesAny(patterns, path) {
    for (var i = 0; i < patterns.length; i++) if (patterns[i].test(path)) return true;
    return false;
  }

  // Framer navigates with history.pushState: announce route changes.
  function onRouteChange(fn) {
    if (!window.__sparkFormsRouteHook) {
      window.__sparkFormsRouteHook = true;
      ["pushState", "replaceState"].forEach(function (m) {
        var orig = history[m];
        history[m] = function () {
          var r = orig.apply(this, arguments);
          window.dispatchEvent(new Event("spark-forms:route"));
          return r;
        };
      });
      window.addEventListener("popstate", function () {
        window.dispatchEvent(new Event("spark-forms:route"));
      });
    }
    window.addEventListener("spark-forms:route", fn);
  }

  function setupLauncher() {
    var slug = SCRIPT && SCRIPT.getAttribute("data-spark-launcher");
    if (!slug || launcher || window !== window.top || !document.body) return;

    var label = SCRIPT.getAttribute("data-spark-launcher-label") || "Abrir chat";
    var teaserText = SCRIPT.getAttribute("data-spark-launcher-teaser");
    var side = SCRIPT.getAttribute("data-spark-launcher-position");
    var icon =
      SCRIPT.getAttribute("data-spark-launcher-icon") ||
      BASE + "/brand/spark-avatar-navy.png";
    var fixedOffset = parseInt(SCRIPT.getAttribute("data-spark-launcher-offset") || "", 10);
    var include = pathPatterns("data-spark-launcher-pages");
    var exclude = pathPatterns("data-spark-launcher-exclude");

    var style = document.createElement("style");
    style.textContent = LAUNCHER_CSS;
    document.head.appendChild(style);

    var root = document.createElement("div");
    root.className = "spk-l" + (side === "left" ? " spk-l--left" : "");
    root.setAttribute("data-spark-launcher-root", "");

    var panel = document.createElement("div");
    panel.className = "spk-l__panel";
    panel.setAttribute("role", "dialog");
    panel.setAttribute("aria-label", label);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "spk-l__close";
    close.setAttribute("aria-label", "Fechar chat");
    close.innerHTML = X_ICON;
    panel.appendChild(close);

    var btn = document.createElement("button");
    btn.type = "button";
    btn.className = "spk-l__btn";
    btn.setAttribute("aria-label", label);
    btn.setAttribute("aria-expanded", "false");
    btn.innerHTML =
      '<img alt="" width="60" height="60" decoding="async" src="' + icon + '"><span class="spk-l__x">' + X_ICON + "</span>";
    var dot = document.createElement("span");
    dot.className = "spk-l__dot";
    dot.setAttribute("aria-hidden", "true");
    btn.appendChild(dot);

    var teaser = null;
    if (teaserText) {
      teaser = document.createElement("div");
      teaser.className = "spk-l__teaser";
      teaser.textContent = teaserText;
      root.appendChild(teaser);
    }

    root.appendChild(panel);
    root.appendChild(btn);
    document.body.appendChild(root);

    var iframe = null;
    var isOpen = false;

    function ensureFrame() {
      if (iframe) return;
      iframe = createFrame(slug, label);
      iframe.setAttribute("data-spark-launcher", "1");
      iframe.src = buildSrc(slug, false);
      panel.insertBefore(iframe, close);
      iframesBySlug[slug] = iframe;
    }

    function open() {
      if (isOpen || root.hidden) return;
      isOpen = true;
      ensureFrame();
      root.classList.add("spk-l--open");
      btn.setAttribute("aria-expanded", "true");
      btn.setAttribute("aria-label", "Fechar chat");
      if (dot.parentNode) dot.parentNode.removeChild(dot);
      dismissTeaser();
      if (window.matchMedia("(max-width: 480px)").matches) {
        document.documentElement.style.overflow = "hidden";
      }
      try {
        window.dataLayer = window.dataLayer || [];
        window.dataLayer.push({ event: "spark_chat_opened", spark_form_slug: slug });
      } catch (e) {
        /* ignore */
      }
    }

    function hide() {
      if (!isOpen) return;
      isOpen = false;
      root.classList.remove("spk-l--open");
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-label", label);
      document.documentElement.style.overflow = "";
      btn.focus({ preventScroll: true });
    }

    // Warm the chat on intent so the click opens it instantly.
    btn.addEventListener("pointerenter", ensureFrame, { once: true });
    btn.addEventListener("touchstart", ensureFrame, { once: true, passive: true });
    btn.addEventListener("focus", ensureFrame, { once: true });

    btn.addEventListener("click", function () {
      isOpen ? hide() : open();
    });
    close.addEventListener("click", hide);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape") hide();
    });
    document.addEventListener("click", function (e) {
      var t = e.target && e.target.closest && e.target.closest('a[href$="#spark-chat"], [data-spark-open]');
      if (!t) return;
      e.preventDefault();
      open();
    });

    // Teaser: once per session, 3 s after the first eligible page.
    var TEASER_KEY = "spark-forms:teaser-dismissed:" + slug;
    var teaserTimer = null;
    function teaserDismissed() {
      try {
        return sessionStorage.getItem(TEASER_KEY) === "1";
      } catch (e) {
        return false;
      }
    }
    function dismissTeaser() {
      if (!teaser) return;
      teaser.classList.remove("is-in");
      try {
        sessionStorage.setItem(TEASER_KEY, "1");
      } catch (e) {
        /* ignore */
      }
    }
    function scheduleTeaser() {
      if (!teaser || teaserTimer || teaserDismissed()) return;
      teaserTimer = setTimeout(function () {
        if (!isOpen && !root.hidden) teaser.classList.add("is-in");
      }, 3000);
    }
    if (teaser) teaser.addEventListener("click", open);

    // Stack above a floating WhatsApp button in the same corner.
    function cornerOffset() {
      if (fixedOffset >= 0) return fixedOffset;
      var nodes = document.querySelectorAll('a[href*="wa.me"], a[href*="api.whatsapp.com"], [data-spark-avoid]');
      var vw = window.innerWidth;
      var vh = window.innerHeight;
      var lift = 0;
      for (var i = 0; i < nodes.length; i++) {
        var r = nodes[i].getBoundingClientRect();
        if (!r.width || !r.height) continue;
        var inCorner =
          r.bottom > vh - 160 &&
          (side === "left" ? r.left < 160 : r.right > vw - 160);
        if (inCorner) lift = Math.max(lift, vh - r.top - 20 + 12);
      }
      return lift;
    }
    var offTimer = null;
    function updateOffset() {
      clearTimeout(offTimer);
      offTimer = setTimeout(function () {
        root.style.setProperty("--spk-off", cornerOffset() + "px");
      }, 120);
    }

    function applyRoute() {
      var path = location.pathname;
      var show =
        (!include || matchesAny(include, path)) &&
        !(exclude && matchesAny(exclude, path));
      if (!show) hide();
      root.hidden = !show;
      if (show) scheduleTeaser();
      // Framer renders the new page after the URL changes: re-check the
      // corner now and once the page has painted.
      updateOffset();
      setTimeout(updateOffset, 1200);
    }

    onRouteChange(applyRoute);
    window.addEventListener("resize", updateOffset, { passive: true });
    applyRoute();

    launcher = { open: open, close: hide };
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
      // The launcher panel sizes its iframe; resize only applies inline.
      if (iframe && !iframe.hasAttribute("data-spark-launcher")) {
        iframe.style.height = Math.max(120, data.height) + "px";
      }
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

  function boot() {
    scan();
    if (SCRIPT && SCRIPT.getAttribute("data-spark-launcher")) {
      onIdle(function () {
        var pc = document.createElement("link");
        pc.rel = "preconnect";
        pc.href = BASE;
        document.head.appendChild(pc);
        setupLauncher();
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  // Re-scan when the host page swaps content dynamically (SPAs).
  // Framer mutates the DOM constantly (animations): one scan per frame.
  var scanQueued = false;
  var mo = new MutationObserver(function () {
    if (scanQueued) return;
    scanQueued = true;
    requestAnimationFrame(function () {
      scanQueued = false;
      scan();
    });
  });
  mo.observe(document.documentElement, { childList: true, subtree: true });

  // Expose a minimal API for advanced callers.
  window.SparkForms = {
    mount: mount,
    scan: scan,
    open: function () {
      if (launcher) launcher.open();
    },
    close: function () {
      if (launcher) launcher.close();
    },
  };
})();
