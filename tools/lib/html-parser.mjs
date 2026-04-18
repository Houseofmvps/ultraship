// Zero-dependency SAX-style HTML parser — drop-in replacement for htmlparser2.Parser
// Handles the subset of HTML needed by seo-scanner: tags, attributes, text, script/style content.

const RAW_TAGS = new Set(['script', 'style', 'textarea', 'template']);

function decodeEntities(str) {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, '\u00a0')
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-f]+);/g, (_, n) => String.fromCharCode(parseInt(n, 16)));
}

function parseAttrs(attrStr) {
  const attrs = {};
  // Matches: name="val", name='val', name=val, or bare name (boolean attrs)
  const re = /([a-z][a-z0-9\-:._]*)\s*(?:=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]*)))?/gi;
  let m;
  while ((m = re.exec(attrStr)) !== null) {
    const key = m[1].toLowerCase();
    attrs[key] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : '';
  }
  return attrs;
}

function parseHtml(html, { onopentag, ontext, onclosetag } = {}, shouldDecode = true) {
  let i = 0;
  const len = html.length;

  while (i < len) {
    if (html[i] !== '<') {
      // Text node
      const end = html.indexOf('<', i);
      const slice = end === -1 ? html.slice(i) : html.slice(i, end);
      if (slice) ontext && ontext(shouldDecode ? decodeEntities(slice) : slice);
      i = end === -1 ? len : end;
      continue;
    }

    // We're at '<'
    if (html[i + 1] === '!') {
      // Comment <!-- ... --> or DOCTYPE
      if (html.slice(i, i + 4) === '<!--') {
        const end = html.indexOf('-->', i + 4);
        i = end === -1 ? len : end + 3;
      } else {
        const end = html.indexOf('>', i);
        i = end === -1 ? len : end + 1;
      }
      continue;
    }

    if (html[i + 1] === '/') {
      // Closing tag </tagname>
      const end = html.indexOf('>', i + 2);
      if (end === -1) { i = len; break; }
      const tagName = html.slice(i + 2, end).trim().toLowerCase().split(/\s/)[0];
      onclosetag && onclosetag(tagName);
      i = end + 1;
      continue;
    }

    // Opening tag — find its end, respecting quoted attribute values
    let j = i + 1;
    let inStr = false;
    let strChar = '';
    while (j < len) {
      const ch = html[j];
      if (inStr) {
        if (ch === strChar) inStr = false;
      } else if (ch === '"' || ch === "'") {
        inStr = true;
        strChar = ch;
      } else if (ch === '>') {
        break;
      }
      j++;
    }

    const tagContent = html.slice(i + 1, j);
    const selfClosing = tagContent.trimEnd().endsWith('/');
    const tagStr = selfClosing ? tagContent.slice(0, tagContent.lastIndexOf('/')) : tagContent;

    const spaceIdx = tagStr.search(/[\s/]/);
    const tagName = (spaceIdx === -1 ? tagStr : tagStr.slice(0, spaceIdx)).toLowerCase();
    if (!tagName) { i = j + 1; continue; }

    const attrStr = spaceIdx === -1 ? '' : tagStr.slice(spaceIdx);
    const attrs = parseAttrs(attrStr);

    onopentag && onopentag(tagName, attrs);
    i = j + 1;

    if (RAW_TAGS.has(tagName) && !selfClosing) {
      // Emit raw content as a single text node, then fire close
      const closeTag = `</${tagName}`;
      const closeIdx = html.toLowerCase().indexOf(closeTag, i);
      if (closeIdx !== -1) {
        const rawText = html.slice(i, closeIdx);
        if (rawText) ontext && ontext(rawText);
        const closeEnd = html.indexOf('>', closeIdx);
        onclosetag && onclosetag(tagName);
        i = closeEnd === -1 ? len : closeEnd + 1;
      } else {
        i = len;
      }
    }
  }
}

export class Parser {
  constructor(handlers = {}, opts = {}) {
    this._handlers = handlers;
    this._opts = opts;
    this._chunks = [];
  }

  write(chunk) {
    this._chunks.push(chunk);
  }

  end() {
    const html = this._chunks.join('');
    const decode = this._opts.decodeEntities !== false;
    parseHtml(html, this._handlers, decode);
    this._chunks = [];
  }
}
