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

  function handleMessage(event) {
    var data = event.data;
    if (!data || typeof data !== "object") return;

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
