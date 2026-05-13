#!/usr/bin/env node

import assert from "node:assert/strict";
import { readFileSync, watch } from "node:fs";
import { resolve } from "node:path";
import vm from "node:vm";

const root = resolve(import.meta.dirname, "..");

class FakeClassList {
  constructor() {
    this.classes = new Set();
  }

  add(name) {
    this.classes.add(name);
  }

  remove(name) {
    this.classes.delete(name);
  }

  contains(name) {
    return this.classes.has(name);
  }
}

class FakeElement {
  constructor({ textContent = "", value = "", attributes = {} } = {}) {
    this.textContent = textContent;
    this.innerHTML = "";
    this.value = value;
    this.attributes = attributes;
    this.disabled = false;
    this.classList = new FakeClassList();
    this.listeners = new Map();
  }

  addEventListener(event, handler) {
    this.listeners.set(event, handler);
  }

  async dispatch(event) {
    const handler = this.listeners.get(event);
    if (handler) await handler();
  }

  getAttribute(name) {
    return this.attributes[name] ?? null;
  }
}

function runScript(relativePath, globals) {
  const filename = resolve(root, relativePath);
  const source = readFileSync(filename, "utf8");
  const context = vm.createContext({
    console,
    Error,
    JSON,
    Promise,
    URL,
    ...globals,
  });
  vm.runInContext(source, context, { filename });
  return context;
}

function makeContentDocument({
  nextData,
  jsonScripts = [],
  title,
  documentTitle = "",
  meta = {},
  description,
  skills = [],
}) {
  const nextDataEl = nextData
    ? new FakeElement({ textContent: JSON.stringify(nextData) })
    : null;
  const titleEl = title ? new FakeElement({ textContent: title }) : null;
  const descriptionEl = description ? new FakeElement({ textContent: description }) : null;
  const skillEls = skills.map((skill) => new FakeElement({ textContent: skill }));
  const jsonScriptEls = jsonScripts.map((data) =>
    new FakeElement({ textContent: typeof data === "string" ? data : JSON.stringify(data) })
  );

  function metaElement(selector) {
    const match = selector.match(/meta\[(?:property|name)="([^"]+)"\]/);
    const value = match ? meta[match[1]] : null;
    return value ? new FakeElement({ attributes: { content: value } }) : null;
  }

  return {
    title: documentTitle,
    getElementById(id) {
      return id === "__NEXT_DATA__" ? nextDataEl : null;
    },
    querySelector(selector) {
      if (selector.includes("meta[")) return metaElement(selector);
      if (selector.includes("h1") || selector.includes("job-title")) return titleEl;
      if (selector.includes("description")) return descriptionEl;
      return null;
    },
    querySelectorAll(selector) {
      if (selector.includes("script")) return jsonScriptEls;
      return selector.includes("token") ? skillEls : [];
    },
  };
}

function extractWithContentScript(document) {
  let listener = null;
  const chrome = {
    runtime: {
      onMessage: {
        addListener(fn) {
          listener = fn;
        },
      },
    },
  };

  runScript("extension/content.js", {
    chrome,
    document,
    window: { location: { href: "https://www.upwork.com/jobs/~sandbox" } },
  });

  assert.equal(typeof listener, "function", "content script did not register a message listener");

  let response;
  listener({ action: "extract" }, {}, (value) => {
    response = value;
  });
  return response;
}

function makePopupDocument() {
  const elements = {
    apiUrl: new FakeElement(),
    analyzeBtn: new FakeElement(),
    status: new FakeElement(),
    analysisCard: new FakeElement(),
    cardPain: new FakeElement(),
    cardRoot: new FakeElement(),
    cardPattern: new FakeElement(),
    cardPitch: new FakeElement(),
  };

  return {
    elements,
    getElementById(id) {
      const element = elements[id];
      assert.ok(element, `unexpected document.getElementById("${id}")`);
      return element;
    },
  };
}

function visibleText(element) {
  return element.textContent || element.innerHTML;
}

async function runPopup({
  contentResponse,
  fetchResponse,
  fetchError = null,
  apiUrl,
  tabs = [{ id: 42 }],
  lastError = null,
}) {
  const document = makePopupDocument();
  const fetchCalls = [];
  const chrome = {
    runtime: { lastError },
    storage: {
      local: {
        get(keys, callback) {
          callback({ apiUrl });
        },
        set() {},
      },
    },
    tabs: {
      async query() {
        return tabs;
      },
      sendMessage(tabId, message, callback) {
        assert.equal(tabId, 42);
        assert.equal(JSON.stringify(message), JSON.stringify({ action: "extract" }));
        callback(contentResponse);
      },
    },
  };

  runScript("extension/popup.js", {
    chrome,
    document,
    fetch: async (url, options) => {
      fetchCalls.push({ url, options });
      if (fetchError) throw fetchError;
      return fetchResponse;
    },
  });

  await document.elements.analyzeBtn.dispatch("click");
  return { document, fetchCalls };
}

async function testContentNextDataExtraction() {
  const response = extractWithContentScript(
    makeContentDocument({
      nextData: {
        props: {
          pageProps: {
            jobDetails: {
              job: {
                title: "Automate CRM exports",
                description: "Export weekly CSVs from Notion.",
                hourlyBudget: { min: 50, max: 75 },
                skills: [{ prefLabel: "Notion" }, { name: "Automation" }],
              },
            },
          },
        },
      },
    })
  );

  assert.equal(response.job.title, "Automate CRM exports");
  assert.equal(response.job.budgetType, "hourly");
  assert.equal(response.job.budgetMin, 50);
  assert.deepEqual([...response.job.skills], ["Notion", "Automation"]);
}

async function testContentDomFallbackExtraction() {
  const response = extractWithContentScript(
    makeContentDocument({
      title: "Build a dashboard",
      description: "Need reports for sales ops.",
      skills: ["React", "PostgreSQL"],
    })
  );

  assert.equal(response.job.title, "Build a dashboard");
  assert.equal(response.job.description, "Need reports for sales ops.");
  assert.deepEqual([...response.job.skills], ["React", "PostgreSQL"]);
}

async function testContentNestedJsonExtraction() {
  const response = extractWithContentScript(
    makeContentDocument({
      jsonScripts: [
        {
          bootstrap: {
            deeply: {
              nested: {
                posting: {
                  title: "Audit Zapier workflows",
                  descriptionText: "Find and fix brittle automation flows.",
                  amount: { amount: 1200 },
                  attrs: [{ name: "Zapier" }, { prefLabel: "Operations" }],
                },
              },
            },
          },
        },
      ],
    })
  );

  assert.equal(response.job.title, "Audit Zapier workflows");
  assert.equal(response.job.description, "Find and fix brittle automation flows.");
  assert.equal(response.job.budgetMin, 1200);
  assert.deepEqual([...response.job.skills], ["Zapier", "Operations"]);
}

async function testContentMetadataTitleFallback() {
  const response = extractWithContentScript(
    makeContentDocument({
      documentTitle: "Build Airtable reporting workflow - Upwork",
      meta: {
        "og:description": "We need weekly reports generated from Airtable.",
      },
    })
  );

  assert.equal(response.job.title, "Build Airtable reporting workflow");
  assert.equal(response.job.description, "We need weekly reports generated from Airtable.");
  assert.deepEqual([...response.job.skills], []);
}

async function testPopupSaveListingHappyPath() {
  const job = {
    title: "Automate support triage",
    description: "Route tickets by customer intent.",
    skills: ["AI", "Support"],
    budgetType: "fixed",
    budgetMin: null,
    budgetMax: null,
    url: "https://www.upwork.com/jobs/~sandbox",
  };

  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3005/api/listings",
    contentResponse: { job },
    fetchResponse: {
      status: 201,
      ok: true,
      async json() {
        return { inserted: 1, skipped: 0, errors: [] };
      },
    },
  });

  assert.equal(
    fetchCalls.length,
    1,
    `expected one backend call, status was "${visibleText(document.elements.status)}"`
  );
  assert.equal(fetchCalls[0].url, "http://localhost:3005/api/listings");
  assert.deepEqual(JSON.parse(fetchCalls[0].options.body), job);
  assert.equal(visibleText(document.elements.status), "Saved to Pangolin.");
  assert.equal(document.elements.status.innerHTML, "");
  assert.equal(document.elements.cardPain.textContent, "");
  assert.equal(document.elements.cardRoot.textContent, "");
  assert.equal(document.elements.cardPattern.textContent, "");
  assert.equal(document.elements.cardPitch.textContent, "");
  assert.equal(document.elements.analysisCard.classList.contains("visible"), false);
  assert.equal(document.elements.analyzeBtn.disabled, false);
}

async function testPopupAlreadySavedResponse() {
  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3005/api/analyze-single",
    contentResponse: { job: { title: "Existing listing", url: "https://www.upwork.com/jobs/~sandbox" } },
    fetchResponse: {
      ok: true,
      async json() {
        return { inserted: 0, skipped: 1, errors: [] };
      },
    },
  });

  assert.equal(fetchCalls[0].url, "http://localhost:3005/api/listings");
  assert.equal(visibleText(document.elements.status), "Already saved.");
  assert.equal(document.elements.analysisCard.classList.contains("visible"), false);
}

async function testPopupExtractionError() {
  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3005/api/listings",
    contentResponse: { error: "Could not read job data from this page" },
    fetchResponse: {
      ok: true,
      async json() {
        return {};
      },
    },
  });

  assert.equal(fetchCalls.length, 0);
  assert.equal(
    document.elements.status.textContent,
    "Error: Could not read job data from this page"
  );
  assert.equal(document.elements.analyzeBtn.disabled, false);
}

async function testPopupNoActiveTabError() {
  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3005/api/listings",
    tabs: [],
    contentResponse: { job: { title: "Unused" } },
    fetchResponse: {
      ok: true,
      async json() {
        return {};
      },
    },
  });

  assert.equal(fetchCalls.length, 0);
  assert.equal(visibleText(document.elements.status), "Error: Open an Upwork job page before saving.");
  assert.equal(document.elements.analyzeBtn.disabled, false);
}

async function testPopupContentScriptConnectionError() {
  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3005/api/listings",
    lastError: { message: "Receiving end does not exist" },
    contentResponse: null,
    fetchResponse: {
      ok: true,
      async json() {
        return {};
      },
    },
  });

  assert.equal(fetchCalls.length, 0);
  assert.match(
    visibleText(document.elements.status),
    /^Error: Could not connect to this page: Receiving end does not exist\. Reload the Upwork tab/
  );
  assert.equal(document.elements.analyzeBtn.disabled, false);
}

async function testPopupBackendConnectionError() {
  const { document, fetchCalls } = await runPopup({
    apiUrl: "http://localhost:3939/api/listings",
    contentResponse: { job: { title: "Backend down", url: "https://www.upwork.com/jobs/~sandbox" } },
    fetchError: new Error("Failed to fetch"),
    fetchResponse: null,
  });

  assert.equal(fetchCalls.length, 1);
  assert.equal(
    visibleText(document.elements.status),
    "Error: Could not reach Pangolin at http://localhost:3939/api/listings. Check that the local app is running and the API URL is correct."
  );
  assert.equal(document.elements.analyzeBtn.disabled, false);
}

const tests = [
  testContentNextDataExtraction,
  testContentDomFallbackExtraction,
  testContentNestedJsonExtraction,
  testContentMetadataTitleFallback,
  testPopupSaveListingHappyPath,
  testPopupAlreadySavedResponse,
  testPopupExtractionError,
  testPopupNoActiveTabError,
  testPopupContentScriptConnectionError,
  testPopupBackendConnectionError,
];

async function runAll() {
  for (const test of tests) {
    await test();
    console.log(`PASS ${test.name}`);
  }

  console.log(`\nExtension sandbox passed ${tests.length} checks.`);
}

if (process.argv.includes("--watch")) {
  let running = false;
  let queued = false;

  async function rerun() {
    if (running) {
      queued = true;
      return;
    }

    running = true;
    queued = false;
    console.clear();
    try {
      await runAll();
      console.log("\nWatching extension files. Press Ctrl+C to stop.");
    } catch (error) {
      console.error(error);
    } finally {
      running = false;
      if (queued) await rerun();
    }
  }

  watch(resolve(root, "extension"), { recursive: false }, rerun);
  watch(import.meta.dirname, { recursive: false }, rerun);
  await rerun();
} else {
  await runAll();
}
