import { randomUUID } from 'crypto';
import { Resvg } from '@resvg/resvg-js';
import createDOMPurify from 'dompurify';
import { JSDOM } from 'jsdom';
import mermaid from 'mermaid';
import { createHTMLWindow } from 'svgdom';

class CSSStyleSheetPolyfill {
  constructor() {
    this.cssRules = [];
  }

  replaceSync(text = '') {
    this.cssRules = text ? [{ cssText: text }] : [];
  }

  insertRule(rule = '', index = this.cssRules.length) {
    this.cssRules.splice(index, 0, { cssText: rule });
    return index;
  }
}

let initialized = false;
let renderQueue = Promise.resolve();

function ensureMermaidRuntime() {
  if (initialized) return;

  const purifierWindow = new JSDOM('').window;
  const DOMPurify = createDOMPurify(purifierWindow);
  Object.assign(createDOMPurify, DOMPurify);

  const htmlWindow = createHTMLWindow();
  globalThis.window = htmlWindow;
  globalThis.document = htmlWindow.document;
  globalThis.CSSStyleSheet = CSSStyleSheetPolyfill;

  if (!Object.getOwnPropertyDescriptor(htmlWindow.Element.prototype, 'parentElement')) {
    Object.defineProperty(htmlWindow.Element.prototype, 'parentElement', {
      get() {
        return this.parentNode || null;
      },
      configurable: true,
    });
  }

  Object.defineProperty(htmlWindow.HTMLElement.prototype, 'offsetWidth', {
    get() {
      return this.__offsetWidth || 1200;
    },
    set(value) {
      this.__offsetWidth = value;
    },
    configurable: true,
  });

  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'strict',
    htmlLabels: false,
    theme: 'base',
    flowchart: {
      htmlLabels: false,
      useMaxWidth: true,
    },
    gantt: {
      useMaxWidth: true,
    },
  });

  initialized = true;
}

function queueRender(task) {
  const run = renderQueue.then(task, task);
  renderQueue = run.catch(() => {});
  return run;
}

export async function renderMermaidToPng(source, { width = 1536, background = '#FFFFFF' } = {}) {
  return queueRender(async () => {
    ensureMermaidRuntime();
    const mermaidSource = String(source || '').trim();
    if (!mermaidSource) throw new Error('Mermaid source is required.');

    const renderId = `mermaid-${randomUUID()}`;
    const host = document.createElement('div');
    const mount = document.createElement('div');
    mount.id = renderId;
    host.offsetWidth = width;
    host.appendChild(mount);
    (document.body || document.documentElement).appendChild(host);

    let svg;
    try {
      ({ svg } = await mermaid.render(renderId, mermaidSource));
    } finally {
      if (host.parentNode) {
        host.parentNode.removeChild(host);
      }
    }

    const png = new Resvg(svg, {
      background,
      fitTo: { mode: 'width', value: width },
    }).render().asPng();

    return { svg, png };
  });
}
