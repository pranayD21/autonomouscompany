import assert from "node:assert/strict";
import {devices, expect, webkit, type BrowserContext, type Page} from "@playwright/test";

const base = "http://127.0.0.1:4290/";
const caseId = "11111111-1111-4111-8111-111111111111";
const title = "Fictional navigation check";
const fixture = {id: caseId, owner_id: "phone:fictional-owner", title, case_type: "health_insurance", revision: 1, status: "active", bill_cents: null, eob_cents: null, analysis: null, notes: "Fictional", intake: {}, created_at: "2026-11-08T00:00:00Z"};

async function mock(context: BrowserContext) {
  await context.addInitScript("window.__name=(f)=>f");
  await context.addInitScript((item) => {
    Object.assign(window, {__CASES__: [item], __hashChanges: 0});
    window.addEventListener("hashchange", () => {
      const state = window as unknown as {__hashChanges: number};
      state.__hashChanges++;
    });
    localStorage.setItem("assurance-phone-session", "fictional");
    localStorage.setItem("assurance-auth-mode", "phone");
  }, fixture);
  await context.route("**/*", async route => {
    const request = route.request();
    const url = new URL(request.url());
    if (url.origin === new URL(base).origin) return route.continue();
    if (!/^mock-(phone|cases|auth|rt)\./.test(url.hostname)) return route.abort();
    const path = url.pathname;
    let body: unknown = {};
    if (request.method() !== "OPTIONS") {
      if (url.hostname.startsWith("mock-auth")) body = null;
      else if (path.endsWith("/get-session")) body = {user: {id: "fictional-owner", linkedOwnerId: fixture.owner_id, phoneNumber: "+14155550123", name: ""}, session: {id: "fictional"}};
      else if (path.endsWith("/token")) body = {token: "fictional"};
      else if (path.endsWith("/status") && url.hostname.startsWith("mock-phone")) body = {enabled: true, smsReady: false, onboardingEnabled: false, testNumbers: [], testCode: null};
      else if (path === "/cases/live") body = {sealed: true};
      else if (path === "/stack/status") body = {naive: {configured: true, enabledForUser: true}};
      else if (path === "/phone/onboarding") body = {enabled: false, status: "completed", case_id: caseId};
      else if (path.startsWith("/phone/")) body = [];
      else if (path.endsWith("/messages")) body = {messages: [], state: "waiting", can_send: true};
      else if (path.endsWith("/autonomy")) body = {authorities: [], decisions: [], sessions: [], activation_available: true};
      else if (path.endsWith("/replies")) body = {replies: []};
      else if (/\/(documents|outcomes|actions)$/.test(path)) body = [];
      else if (path.endsWith("/crew")) body = null;
      else if (path === "/firm/contact") body = {email: "fictional@assurance.example"};
    }
    await route.fulfill({status: 200, contentType: "application/json", body: JSON.stringify(body), headers: {
      "access-control-allow-origin": new URL(base).origin,
      "access-control-allow-credentials": "true",
      "access-control-allow-headers": "content-type,authorization",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
    }});
  });
}

async function swipe(page: Page, selector: string, points: number[][], cancel = false, multiple = false) {
  await page.locator(selector).first().evaluate((element, gesture) => {
    const [start, ...moves] = gesture.points;
    const dispatch = (type: string, point: number[]) => {
      const touch = {identifier: 1, target: element, clientX: point[0], clientY: point[1]};
      const touches = type === "touchend" || type === "touchcancel" ? [] : [touch];
      if (gesture.multiple && touches.length) touches.push({identifier: 2, target: element, clientX: point[0] + 20, clientY: point[1]});
      const event = new TouchEvent(type, {bubbles: true, cancelable: true});
      Object.defineProperties(event, {touches: {value: touches}, changedTouches: {value: [touch]}, targetTouches: {value: touches}});
      element.dispatchEvent(event);
    };
    dispatch("touchstart", start);
    if (gesture.cancel) dispatch("touchcancel", start);
    for (const point of moves) dispatch("touchmove", point);
    dispatch("touchend", moves.at(-1) ?? start);
  }, {points, cancel, multiple});
}

async function hash(page: Page, value: string) {
  await expect.poll(() => page.evaluate(() => location.hash)).toBe(value);
}

const browser = await webkit.launch();
try {
  const context = await browser.newContext({...devices["iPhone 15"], reducedMotion: "reduce"});
  await mock(context);
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.goto(base + "#workspace");
  await expect(page.locator(".ov-row")).toBeVisible();
  const historyLength = await page.evaluate(() => history.length);
  await page.locator(".ov-row").click();
  await hash(page, "#case/" + caseId);
  await expect(page.getByRole("button", {name: "Case info", exact: true})).toBeVisible();
  await page.getByRole("link", {name: "All cases", exact: true}).click();
  await hash(page, "#workspace");
  await page.getByRole("link", {name: "Open another case", exact: true}).click();
  await hash(page, "#new");
  await page.getByRole("button", {name: "All cases", exact: true}).click();
  await hash(page, "#workspace");
  assert.equal(await page.evaluate(() => history.length), historyLength);
  assert.equal(await page.evaluate(() => (window as unknown as {__hashChanges: number}).__hashChanges), 4);
  console.log("PASS iPhone: overview → case → overview → new → overview replaces history and emits hashchange");

  const drawer = page.getByRole("dialog", {name: "Workspace navigation"});
  await swipe(page, ".surface", [[10, 200], [35, 201], [100, 202]]);
  await expect(drawer).toBeVisible();
  await swipe(page, ".sheet", [[200, 200], [170, 201], [100, 202]]);
  await expect(drawer).toHaveCount(0);
  await swipe(page, ".surface", [[10, 200], [100, 202]]);
  await expect(drawer).toBeVisible();
  await drawer.getByRole("link", {name: "New case", exact: true}).click();
  await hash(page, "#new");
  await expect(drawer).toHaveCount(0);
  await page.getByRole("button", {name: "Open navigation"}).click();
  await drawer.getByRole("link", {name: "New case", exact: true}).click();
  await expect(drawer).toHaveCount(0);
  assert.equal(await page.evaluate(() => history.length), historyLength);
  console.log("PASS iPhone: edge open, left close, drawer link navigation and same-route close");

  await page.getByRole("button", {name: "All cases", exact: true}).click();
  await hash(page, "#workspace");
  await expect(page.locator(".ov-filters")).toBeVisible();
  await swipe(page, ".ov-filters", [[10, 200], [100, 200]]);
  await swipe(page, ".surface", [[10, 200], [12, 230], [100, 230]]);
  await swipe(page, ".surface", [[10, 200], [100, 200]], true);
  await swipe(page, ".surface", [[10, 200], [100, 200]], false, true);
  await swipe(page, ".surface", [[100, 200], [200, 200]]);
  await expect(drawer).toHaveCount(0);
  await page.evaluate(() => {
    const range = document.createRange();
    range.selectNodeContents(document.querySelector(".ov-row")!);
    window.getSelection()?.addRange(range);
  });
  await swipe(page, ".surface", [[10, 200], [100, 200]]);
  await expect(drawer).toHaveCount(0);
  await page.evaluate(() => window.getSelection()?.removeAllRanges());
  await page.locator(".ov-row").click();
  await page.getByRole("button", {name: "Case info", exact: true}).click();
  await expect(page.locator(".chat-sheet")).toBeVisible();
  await swipe(page, ".surface", [[10, 200], [100, 200]]);
  await expect(drawer).toHaveCount(0);
  await page.keyboard.press("Escape");
  console.log("PASS iPhone: filter scrolling, vertical intent, cancel, multitouch, selection and Case info exclusions");

  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "navigation-fixture";
    host.innerHTML = '<a id="target-link" href="#new" target="_self">Target</a><a id="download-link" href="#new" download>Download</a><a id="modifier-link" href="#new">Modifier</a><a id="cancelled-link" href="#new">Cancelled</a><a id="absolute-link">Absolute</a>';
    document.body.append(host);
    host.querySelector<HTMLAnchorElement>("#absolute-link")!.href = location.origin + location.pathname + "#new";
    host.querySelector("#cancelled-link")!.addEventListener("click", event => event.preventDefault());
  });
  const decisions = await page.evaluate(() => {
    return ["target-link", "download-link", "modifier-link", "cancelled-link", "absolute-link"].map(id => {
      const link = document.getElementById(id)!;
      const event = new MouseEvent("click", {bubbles: true, cancelable: true, ctrlKey: id === "modifier-link"});
      const cancelled = !link.dispatchEvent(event);
      return {id, cancelled};
    });
  });
  assert.deepEqual(decisions.map(decision => decision.cancelled), [false, false, false, true, true]);
  await hash(page, "#new");
  await page.evaluate(() => document.getElementById("navigation-fixture")?.remove());
  await page.getByRole("button", {name: "Open navigation"}).click();
  await drawer.getByRole("link", {name: "Assurance home"}).click();
  await hash(page, "#home");
  await expect(page.locator(".hero-how-link")).toBeVisible();
  const landingHistory = await page.evaluate(() => history.length);
  await page.locator(".hero-how-link").click();
  await hash(page, "#how-it-works");
  assert.equal(await page.evaluate(() => history.length), landingHistory + 1);
  await expect(page.locator("#how-it-works")).toBeInViewport();
  await page.locator(".skip-link").focus();
  await page.keyboard.press("Enter");
  await hash(page, "#main-content");
  await expect(page.locator("#main-content")).toBeInViewport();
  assert.deepEqual(errors, []);
  await context.close();
  console.log("PASS iPhone: target/download/modifier/cancel handling, absolute routes, landing anchors and skip links");

  const desktop = await browser.newContext({viewport: {width: 1280, height: 900}, reducedMotion: "reduce"});
  await mock(desktop);
  const desktopPage = await desktop.newPage();
  await desktopPage.goto(base + "#workspace");
  await expect(desktopPage.locator(".ov-row")).toBeVisible();
  const desktopHistory = await desktopPage.evaluate(() => history.length);
  await desktopPage.locator(".ov-row").click();
  await hash(desktopPage, "#case/" + caseId);
  assert.equal(await desktopPage.evaluate(() => history.length), desktopHistory + 1);
  await desktopPage.getByRole("link", {name: "All cases", exact: true}).click();
  await hash(desktopPage, "#workspace");
  await desktopPage.getByRole("link", {name: "Open another case", exact: true}).click();
  await hash(desktopPage, "#new");
  await desktopPage.getByRole("button", {name: "All cases", exact: true}).click();
  await hash(desktopPage, "#workspace");
  assert.equal(await desktopPage.evaluate(() => history.length), desktopHistory + 4);
  await desktopPage.goBack();
  await hash(desktopPage, "#new");
  await desktop.close();
  console.log("PASS desktop WebKit: links/buttons push history and Back restores the new-case route");
} finally {
  await browser.close();
}
