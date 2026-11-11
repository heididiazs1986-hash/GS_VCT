/* xlsx.js — lector y escritor mínimo de .xlsx sin dependencias (offline). Desarrollado por Heidi Díaz */
(function (root) {
  const enc = new TextEncoder(), dec = new TextDecoder();
  const CT = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  const crc32 = u8 => { let c = 0xFFFFFFFF; for (let i = 0; i < u8.length; i++) c = CT[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };

  async function inflate(data) {
    const s = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(s).arrayBuffer());
  }
  async function unzip(buf) {
    const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
    let e = u8.length - 22;
    while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
    if (e < 0) throw new Error('El archivo no es un .xlsx válido');
    const n = dv.getUint16(e + 10, true); let p = dv.getUint32(e + 16, true);
    const out = {};
    for (let i = 0; i < n; i++) {
      if (dv.getUint32(p, true) !== 0x02014b50) throw new Error('Archivo .xlsx dañado');
      const method = dv.getUint16(p + 10, true), cs = dv.getUint32(p + 20, true);
      const nl = dv.getUint16(p + 28, true), el = dv.getUint16(p + 30, true), cl = dv.getUint16(p + 32, true), lho = dv.getUint32(p + 42, true);
      const name = dec.decode(u8.subarray(p + 46, p + 46 + nl));
      p += 46 + nl + el + cl;
      const start = lho + 30 + dv.getUint16(lho + 26, true) + dv.getUint16(lho + 28, true);
      const data = u8.subarray(start, start + cs);
      out[name] = method === 0 ? data : await inflate(data);
    }
    return out;
  }
  const unesc = s => s.replace(/&(#x?[0-9a-fA-F]+|lt|gt|amp|quot|apos);/g, (m, g) => {
    if (g === 'lt') return '<'; if (g === 'gt') return '>'; if (g === 'amp') return '&'; if (g === 'quot') return '"'; if (g === 'apos') return "'";
    return String.fromCodePoint(g[1] === 'x' ? parseInt(g.slice(2), 16) : parseInt(g.slice(1), 10));
  });
  const colIdx = ref => { let n = 0; for (const ch of ref.replace(/[^A-Z]/g, '')) n = n * 26 + ch.charCodeAt(0) - 64; return n - 1; };
  const txt = s => { let o = '', m; const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g; while ((m = re.exec(s))) o += m[1]; return unesc(o); };

  // Devuelve { nombreHoja: [[celda,...], ...] }
  async function readXlsx(buf) {
    const z = await unzip(buf);
    const get = n => z[n] ? dec.decode(z[n]) : null;
    const wb = get('xl/workbook.xml'); if (!wb) throw new Error('No se encontró el libro de Excel');
    const rels = get('xl/_rels/workbook.xml.rels') || '';
    const relMap = {}; let m; const rr = /<Relationship\b[^>]*>/g;
    while ((m = rr.exec(rels))) { const a = m[0]; const id = /Id="([^"]+)"/.exec(a), t = /Target="([^"]+)"/.exec(a); if (id && t) relMap[id[1]] = t[1]; }
    const ss = []; const sst = get('xl/sharedStrings.xml');
    if (sst) { const re = /<si\b[^>]*>([\s\S]*?)<\/si>/g; while ((m = re.exec(sst))) ss.push(txt(m[1])); }
    const res = {}; const sr = /<sheet\b[^>]*>/g;
    while ((m = sr.exec(wb))) {
      const a = m[0]; const name = unesc(/name="([^"]*)"/.exec(a)[1]); const rid = /r:id="([^"]+)"/.exec(a);
      let tg = rid && relMap[rid[1]]; if (!tg) continue;
      tg = tg.replace(/^\/?(xl\/)?/, 'xl/'); const xml = get(tg); if (!xml) continue;
      const rows = []; const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g; let rm, ri = 0;
      while ((rm = rowRe.exec(xml))) {
        const rn = /\br="(\d+)"/.exec(rm[1]); const idx = rn ? +rn[1] - 1 : ri; ri = idx + 1;
        const row = []; const body = rm[2] || ''; const cre = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g; let cm, ci = 0;
        while ((cm = cre.exec(body))) {
          const at = cm[1], inner = cm[2] || ''; const r = /\br="([A-Z]+)\d+"/.exec(at); const col = r ? colIdx(r[1]) : ci; ci = col + 1;
          const t = (/\bt="([^"]+)"/.exec(at) || [])[1]; let v = null; const vm = /<v>([\s\S]*?)<\/v>/.exec(inner);
          if (t === 'inlineStr') v = txt(inner);
          else if (vm) { const raw = vm[1]; if (t === 's') v = ss[+raw]; else if (t === 'str') v = unesc(raw); else if (t === 'b') v = raw === '1'; else if (t === 'e') v = null; else { v = Number(raw); if (Number.isNaN(v)) v = unesc(raw); } }
          row[col] = v;
        }
        rows[idx] = row;
      }
      for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = [];
      res[name] = rows;
    }
    return res;
  }

  // ---------- escritor ----------
  const xe = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])).replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, '');
  const colName = i => { let s = ''; i++; while (i > 0) { const m = (i - 1) % 26; s = String.fromCharCode(65 + m) + s; i = Math.floor((i - 1) / 26); } return s; };

  function zipStore(files) { // files: [{name, data(Uint8Array)}]
    const parts = [], central = []; let off = 0;
    const d = new Date(), dt = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(), tm = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
    for (const f of files) {
      const nm = enc.encode(f.name), crc = crc32(f.data), sz = f.data.length;
      const lh = new DataView(new ArrayBuffer(30)); lh.setUint32(0, 0x04034b50, true); lh.setUint16(4, 20, true); lh.setUint16(6, 0x0800, true); lh.setUint16(8, 0, true);
      lh.setUint16(10, tm, true); lh.setUint16(12, dt, true); lh.setUint32(14, crc, true); lh.setUint32(18, sz, true); lh.setUint32(22, sz, true); lh.setUint16(26, nm.length, true); lh.setUint16(28, 0, true);
      parts.push(new Uint8Array(lh.buffer), nm, f.data);
      const ch = new DataView(new ArrayBuffer(46)); ch.setUint32(0, 0x02014b50, true); ch.setUint16(4, 20, true); ch.setUint16(6, 20, true); ch.setUint16(8, 0x0800, true); ch.setUint16(10, 0, true);
      ch.setUint16(12, tm, true); ch.setUint16(14, dt, true); ch.setUint32(16, crc, true); ch.setUint32(20, sz, true); ch.setUint32(24, sz, true); ch.setUint16(28, nm.length, true); ch.setUint32(42, off, true);
      central.push(new Uint8Array(ch.buffer), nm);
      off += 30 + nm.length + sz;
    }
    const csz = central.reduce((a, b) => a + b.length, 0);
    const end = new DataView(new ArrayBuffer(22)); end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true); end.setUint32(12, csz, true); end.setUint32(16, off, true);
    const all = [...parts, ...central, new Uint8Array(end.buffer)];
    const out = new Uint8Array(all.reduce((a, b) => a + b.length, 0)); let p = 0; for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }

  // sheets: [{ name, table, columns:[...], rows:[[...]], widths:[...] }]  -> cada hoja lleva una Tabla de Excel real
  function writeXlsx(sheets) {
    const sst = [], sidx = new Map(); const si = s => { s = String(s); if (!sidx.has(s)) { sidx.set(s, sst.length); sst.push(s); } return sidx.get(s); };
    const files = []; const add = (n, s) => files.push({ name: n, data: enc.encode(s) });
    const H = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n';
    const NS = 'xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"';
    sheets.forEach((sh, k) => {
      const n = k + 1, nc = sh.columns.length; const rows = sh.rows.length ? sh.rows : [new Array(nc).fill('')]; // una tabla necesita al menos 1 fila de datos
      let sd = '<row r="1">' + sh.columns.map((c, i) => `<c r="${colName(i)}1" t="s"><v>${si(c)}</v></c>`).join('') + '</row>';
      rows.forEach((r, ri) => {
        sd += `<row r="${ri + 2}">`;
        r.forEach((v, ci) => {
          if (v === null || v === undefined || v === '') return;
          const ref = colName(ci) + (ri + 2);
          sd += typeof v === 'number' && isFinite(v) ? `<c r="${ref}"><v>${v}</v></c>` : `<c r="${ref}" t="s"><v>${si(v)}</v></c>`;
        });
        sd += '</row>';
      });
      const last = colName(nc - 1) + (rows.length + 1), ref = 'A1:' + last;
      const cols = (sh.widths || []).map((w, i) => `<col min="${i + 1}" max="${i + 1}" width="${w}" customWidth="1"/>`).join('');
      add(`xl/worksheets/sheet${n}.xml`, H + `<worksheet ${NS}><dimension ref="${ref}"/><sheetViews><sheetView workbookViewId="0"${k === 0 ? ' tabSelected="1"' : ''}><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/>${cols ? '<cols>' + cols + '</cols>' : ''}<sheetData>${sd}</sheetData><tableParts count="1"><tablePart r:id="rId1"/></tableParts></worksheet>`);
      add(`xl/worksheets/_rels/sheet${n}.xml.rels`, H + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/table" Target="../tables/table${n}.xml"/></Relationships>`);
      add(`xl/tables/table${n}.xml`, H + `<table xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" id="${n}" name="${xe(sh.table)}" displayName="${xe(sh.table)}" ref="${ref}" totalsRowShown="0"><autoFilter ref="${ref}"/><tableColumns count="${nc}">${sh.columns.map((c, i) => `<tableColumn id="${i + 1}" name="${xe(c)}"/>`).join('')}</tableColumns><tableStyleInfo name="TableStyleMedium3" showFirstColumn="0" showLastColumn="0" showRowStripes="1" showColumnStripes="0"/></table>`);
    });
    add('xl/sharedStrings.xml', H + `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${sst.length}" uniqueCount="${sst.length}">${sst.map(s => `<si><t xml:space="preserve">${xe(s)}</t></si>`).join('')}</sst>`);
    add('xl/styles.xml', H + `<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`);
    add('xl/workbook.xml', H + `<workbook ${NS}><bookViews><workbookView activeTab="0"/></bookViews><sheets>${sheets.map((s, i) => `<sheet name="${xe(s.name)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`).join('')}</sheets></workbook>`);
    add('xl/_rels/workbook.xml.rels', H + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((s, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/><Relationship Id="rId${sheets.length + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);
    add('_rels/.rels', H + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`);
    add('[Content_Types].xml', H + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>${sheets.map((s, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/tables/table${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.table+xml"/>`).join('')}<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/xl/sharedStrings.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sharedStrings+xml"/></Types>`);
    // [Content_Types].xml debe ir primero
    files.unshift(files.pop());
    return zipStore(files);
  }
  root.XLSXLite = { readXlsx, writeXlsx };
  if (typeof module !== 'undefined') module.exports = root.XLSXLite;
})(typeof window !== 'undefined' ? window : globalThis);
