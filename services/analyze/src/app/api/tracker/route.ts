export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TRACKER_SCRIPT = String.raw`
(function () {
  var currentScript = document.currentScript;
  var endpoint = new URL("/api/track", currentScript.src).toString();
  var site = currentScript.getAttribute("data-site") || window.location.hostname;
  var countryCode = currentScript.getAttribute("data-country-code") || "";
  var country = currentScript.getAttribute("data-country") || "";

  function safeRandomId(prefix) {
    if (window.crypto && window.crypto.randomUUID) {
      return prefix + "-" + window.crypto.randomUUID();
    }

    return prefix + "-" + Date.now() + "-" + Math.random().toString(16).slice(2);
  }

  function getVisitorId() {
    var key = "ays_visitor_id";

    try {
      var existing = window.localStorage.getItem(key);

      if (existing) return existing;

      var created = safeRandomId("visitor");
      window.localStorage.setItem(key, created);
      return created;
    } catch {
      return safeRandomId("visitor");
    }
  }

  function getSessionId() {
    var key = "ays_session_id";

    try {
      var existing = window.sessionStorage.getItem(key);

      if (existing) return existing;

      var created = safeRandomId("session");
      window.sessionStorage.setItem(key, created);
      return created;
    } catch {
      return safeRandomId("session");
    }
  }

  function getBrowser() {
    var userAgent = navigator.userAgent.toLowerCase();

    if (userAgent.indexOf("edg/") > -1) return "Edge";
    if (userAgent.indexOf("opr/") > -1 || userAgent.indexOf("opera") > -1) return "Opera";
    if (userAgent.indexOf("firefox") > -1) return "Firefox";
    if (userAgent.indexOf("safari") > -1 && userAgent.indexOf("chrome") === -1) return "Safari";
    if (userAgent.indexOf("chrome") > -1 || userAgent.indexOf("chromium") > -1) return "Chrome";

    return "Unknown";
  }

  var visitorId = getVisitorId();
  var sessionId = getSessionId();
  var activePageViewId = "";
  var pageStartTime = Date.now();

  function getSafePath() {
    var path = window.location.pathname || "/";

    if (/^\/invite\/[^/]+/.test(path)) return "/invite/[code]";
    if (/^\/embed\/[^/]+/.test(path)) return "/embed/[serverId]";

    return path;
  }

  function createPayload(eventType) {
    var duration = Math.max(0, Math.round((Date.now() - pageStartTime) / 1000));

    var safePath = getSafePath();
    return {
      id: activePageViewId,
      eventType: eventType,
      site: site,
      createdAt: new Date(pageStartTime).toISOString(),
      visitorId: visitorId,
      sessionId: sessionId,
      url: window.location.origin + safePath,
      path: safePath,
      referrer: document.referrer || "direct",
      userAgent: navigator.userAgent,
      browser: getBrowser(),
      language: navigator.language || "",
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
      screen: window.screen ? window.screen.width + "x" + window.screen.height : "",
      countryCode: countryCode,
      country: country,
      duration: eventType === "duration" ? duration : 0
    };
  }

  function sendPayload(payload, useBeacon) {
    var body = JSON.stringify(payload);

    if (useBeacon && navigator.sendBeacon) {
      navigator.sendBeacon(endpoint, new Blob([body], { type: "application/json" }));
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: body,
      keepalive: true
    }).catch(function () {});
  }

  function trackPageView() {
    activePageViewId = safeRandomId("pageview");
    pageStartTime = Date.now();
    sendPayload(createPayload("pageview"), false);
  }

  function sendDuration() {
    if (!activePageViewId) return;
    sendPayload(createPayload("duration"), true);
  }

  function patchHistory(methodName) {
    var original = history[methodName];

    history[methodName] = function () {
      sendDuration();

      var result = original.apply(this, arguments);

      setTimeout(function () {
        trackPageView();
      }, 0);

      return result;
    };
  }

  patchHistory("pushState");
  patchHistory("replaceState");

  window.addEventListener("popstate", function () {
    sendDuration();

    setTimeout(function () {
      trackPageView();
    }, 0);
  });

  window.addEventListener("pagehide", function () {
    sendDuration();
  });

  trackPageView();
})();
`;

export async function GET() {
  return new Response(TRACKER_SCRIPT, {
    headers: {
      "Content-Type": "application/javascript; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
