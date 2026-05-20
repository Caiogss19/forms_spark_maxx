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

  function buildTrackingPayload() {
    var url = new URL(location.href);
    var qs = url.searchParams;
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
      referrer: document.referrer || "",
      landing_page: location.href,
      page_url: location.href,
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
    var parentQs = new URL(location.href).searchParams;
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
      (hasQuery ? "&" : "?") + "_p=" + encodeURIComponent(location.href);
    src += "&_pr=" + encodeURIComponent(document.referrer || "");

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

    // Iframe announces it's listening — re-send host-ready so the form
    // can suppress its in-form fallback modal even if the initial
    // post-on-load fired before the iframe's listener was wired up.
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
