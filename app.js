/* GS VCT — Reporte de novedades Vínculo Cliente – Transformador (PWA offline). Desarrollado por Heidi Díaz */
'use strict';
const VER = '1.6.1';
const normCd = v => { const x = String(v || '').toUpperCase().replace(/\s+/g, ''); if (!x) return ''; if (/TR\d+$/.test(x)) return x; if (/T(R)?$/.test(x)) return x.replace(/T(R)?$/, 'TR1'); if (/T(\d+)$/.test(x)) return x.replace(/T(\d+)$/, 'TR$1'); if (/^[A-Z]?\d+$/.test(x)) return x + 'TR1'; return x; };
const PLACA_NO = 'LA PLACA NO CORRESPONDE CON EL ROTULO DE LA OT';
const OT_LEN = 10;
const otOk = v => new RegExp('^\\d{' + OT_LEN + '}$').test(v || '');
const otAtt = `inputmode="numeric" maxlength="${OT_LEN}" pattern="[0-9]*"`;
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const pad = n => String(n).padStart(2, '0');
const stamp = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
const today = () => stamp().slice(0, 10);
const fmt = (n, d = 0) => n == null || isNaN(n) ? '—' : Number(n).toLocaleString('es-CO', { minimumFractionDigits: d, maximumFractionDigits: d });
const norm = h => String(h ?? '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '');
const idn = v => { if (v == null || v === '') return ''; let s = String(v).trim().replace(/\.0+$/, '').replace(/[\s.\-]/g, '').toUpperCase(); return s.replace(/^0+(?=.)/, ''); };
const rawId = v => v == null || v === '' ? '' : String(v).trim().replace(/\.0+$/, '');
const num = v => { if (v == null || v === '') return null; if (typeof v === 'number') return v; const s = String(v).trim().replace(/\s/g, ''); const t = s.includes(',') && !s.includes('.') ? s.replace(',', '.') : s.replace(/,/g, ''); const n = parseFloat(t); return isNaN(n) ? null : n; };
function fixCoord(a, b) { // la ficha trae lon/lat intercambiadas: se detectan por rango (Colombia)
  a = num(a); b = num(b); if (a == null || b == null) return { lat: null, lon: null };
  const isLat = x => x >= -5 && x <= 14, isLon = x => x >= -82 && x <= -66;
  if (isLat(a) && isLon(b)) return { lat: a, lon: b };
  if (isLon(a) && isLat(b)) return { lat: b, lon: a };
  return { lat: null, lon: null };
}
const dist = (la1, lo1, la2, lo2) => { const R = 6371000, r = Math.PI / 180, dLa = (la2 - la1) * r, dLo = (lo2 - lo1) * r; const a = Math.sin(dLa / 2) ** 2 + Math.cos(la1 * r) * Math.cos(la2 * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(a)); };

// ---------- almacenamiento local (IndexedDB) ----------
let DB;
const openDB = () => new Promise((res, rej) => { const r = indexedDB.open('gsvct', 1); r.onupgradeneeded = () => { r.result.createObjectStore('cds', { keyPath: 'id' }); r.result.createObjectStore('kv'); }; r.onsuccess = () => { DB = r.result; res(); }; r.onerror = () => rej(r.error); });
const tx = (st, mode, fn) => new Promise((res, rej) => { const t = DB.transaction(st, mode); const o = fn(t.objectStore(st)); t.oncomplete = () => res(o && o.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); });
const dbPutCD = v => tx('cds', 'readwrite', s => s.put(v));
const dbAllCD = () => tx('cds', 'readonly', s => s.getAll());
const dbDelCD = k => tx('cds', 'readwrite', s => s.delete(k));
const dbGetKV = k => tx('kv', 'readonly', s => s.get(k));
const dbPutKV = (k, v) => tx('kv', 'readwrite', s => s.put(v, k));

// ---------- configuración y catálogos ----------
const ACTIVIDADES = ['RESIDENCIAL', 'COMERCIAL', 'INDUSTRIAL', 'OFICIAL', 'OTRO'];
const KVA = ['5', '10', '15', '25', '30', '37.5', '45', '50', '75', '100', '112.5', '150', '225', '300'];
const HZ_CD = ['SIN HALLAZGOS', 'FUGA VISIBLE DE ACEITE DEL TRANSFORMADOR', 'CUBA DEL TRANSFORMADOR CON CORROSIÓN VISIBLE', 'AISLADOR O BOQUILLA DEL TRANSFORMADOR FISURADO, ROTO O DESPRENDIDO', 'BORNE O CONEXIÓN CON SOBRECALENTAMIENTO', 'SIN SISTEMA DE PUESTA A TIERRA', 'PUESTA A TIERRA MAL INSTALADA O CON CONEXIÓN DEFICIENTE', 'CONDUCTOR DE PUESTA A TIERRA INTERRUMPIDO O SUELTO', 'DPS AUSENTE', 'DPS EN MAL ESTADO', 'CORTACIRCUITO SIN PORTAFUSIBLE', 'PORTAFUSIBLE EN MAL ESTADO', 'CORTACIRCUITO O PROTECCIÓN CON DAÑO VISIBLE', 'POSTE DESAPLOMADO (INCLINACIÓN VISIBLE)'];
const PLACAS = ['LA PLACA CORRESPONDE CON EL ROTULO DE LA OT', 'LA PLACA NO CORRESPONDE CON EL ROTULO DE LA OT', 'NO TIENE PLACA VISIBLE'];
const OTRA = 'OTRA (ESCRIBIR)', SINMED = 'SIN MEDIDOR', HOTRO = 'OTRO (DESCRIBIR EN OBSERVACIÓN)';
const HALLAZGOS = ['SIN HALLAZGO', 'MEDIDOR SIN SELLOS / SELLOS VIOLADOS', 'MEDIDOR MANIPULADO O ALTERADO', 'MEDIDOR DETENIDO O SIN REGISTRO', 'MEDIDOR CON LECTURA INCONSISTENTE', 'MEDIDOR NO CORRESPONDE A LA CUENTA (CRUCE)', 'CONEXIÓN DIRECTA (SIN MEDIDOR)', 'PUENTE O BYPASS EN LA MEDIDA', 'DERIVACIÓN CLANDESTINA EN LA RED', 'ACOMETIDA EN MAL ESTADO (PÉRDIDA TÉCNICA)', 'EMPALMES O CONEXIONES FLOJAS / SULFATADAS', 'CARGA NO REGISTRADA / USO DIFERENTE AL CONTRATADO', 'CLIENTE CONECTADO A OTRO TRANSFORMADOR', 'CLIENTE NO UBICADO / DIRECCIÓN NO CORRESPONDE', 'SERVICIO SUSPENDIDO CON ENERGÍA', 'NO PERMITE INSPECCIÓN / SIN ACCESO A LA MEDIDA', 'PREDIO DESOCUPADO O DEMOLIDO', HOTRO];
const MATERIALES = ['NO PERDURABLE', 'PERDURABLE'];
const HALLAZGOS_UNC = ['ACOMETIDA EN MAL ESTADO (PÉRDIDA TÉCNICA)', 'CARGA COMUNITARIA O ALUMBRADO SIN MEDIDA', 'CONEXIÓN DIRECTA A LA RED (SIN MEDIDOR)', 'DERIVACIÓN CLANDESTINA EN LA RED', 'EMPALMES O CONEXIONES FLOJAS / SULFATADAS', 'PREDIO CON CONEXIÓN Y SIN CONTRATO', 'PREDIO DESOCUPADO O DEMOLIDO', 'USO COMERCIAL O INDUSTRIAL SIN MEDIDOR', HOTRO];
// Marcas: las que trae la ficha del Excel (CLIENTES.marca_medidor) + las que se escriban con "OTRA"
const MARCAS_BASE = ['@METER', 'ABB', 'ACTARIS', 'AEG', 'ALDANA', 'CAR-1', 'CDM', 'CHINT', 'COMCORE', 'COMPLANT', 'ELGAMA', 'ELSTER', 'ENEL', 'ESTROM', 'GALILEO', 'GAUGETECH', 'GOMELONG', 'HEXCELL', 'HEXING', 'HIKING', 'HOLLEY', 'INHEMETER', 'ISKRA', 'ITRON', 'KRIZIK', 'LANDIS', 'METCOM', 'MICROSTAR', 'NANSEN', 'NINGBO', 'OSAKI', 'PAFAL', 'SCHLUMBERGER', 'SCORPION', 'SIEMENS', 'SKAITEKS', 'SUMMETER', 'SUNRISE', 'TECUN', 'TR-CEICA/ME-WINSKY', 'WASION', 'WINSKY'];
const CORTO = {"AGUIAR OLIVERA EDUVINO": "Eduvino Aguiar", "ARDILA AMADO ELKIN": "Elkin Ardila", "BABILONIA THOMAS FERNANDO LUIS": "Fernando Babilonia", "BAEZ JUAN CARLOS": "Juan Baez", "CAÑON GONZALEZ RICARDO IGNACIO": "Ricardo Cañon", "CARDENAS GOMEZ RAMIRO": "Ramiro Cardenas", "CASTAÑEDA MINZON HERNAN": "Minzon Castañeda", "DAZA MORENO DUBAN STIVEN": "Duban Daza", "DIAZ RODRIGUEZ NELSON FERNANDO": "Nelson Diaz", "FERNANDEZ SALAS JOHAN SEBASTIAN": "Johan Fernandez", "FONSECA SANTANA WILLIAM GIUSEPPE": "William Fonseca", "GALINDO TORRES HELVER MARTIN": "Helver Galindo", "GONZALEZ CIFUENTES SOFIA LORENA": "Sofia Gonzalez", "GUERRERO RODRIGUEZ KEVIN CAMILO": "Kevin Guerrero", "GUEVARA PÉREZ ANTONY": "Antony Guevara", "IZQUIERDO MURCIA CARLOS EDUARDO": "Carlos Izquierdo", "JIMENEZ CASTILLO OSCAR FERNANDO": "Oscar Jimenez", "LOPEZ SUAREZ RICARDO ENRIQUE": "Ricardo Lopez", "OLIVERO ROCHA IVAN DAVID": "Ivan Olivero", "PERDOMO RAMIREZ CRISTIAN DAVID": "Cristian Perdomo", "PEREZ PIRA RIVEL ESTEBAN": "Rivel Perez", "PINEDA AGUILAR WILKER DE JESUS": "Wilker Pineda", "PINZON TOVAR BRAYAN FELIPE": "Brayan Pinzon", "PORRAS RODRIGUEZ BRIAM STEVENS": "Briam Porras", "QUIJANO CARDOSO JOHN JAIRO": "John Quijano", "RAMIREZ CEPEDA BRAYAN HERNAN": "Brayan Ramirez", "RAMIREZ BARAHONA FERNEY": "Ferney Ramirez", "REYES HERNANDEZ SEBASTIAN DAVID": "Sebastian Reyes", "ROBAYO BOHORQUEZ CARLOS ENRIQUE": "Carlos Robayo", "ROJAS CRUZ KEVIN YESSITH": "Kevin Rojas", "ROMERO JOHN FREDY": "John Romero", "ROMERO SERNA LUIS CAMILO": "Luis Romero", "RONCANCIO RINCON FABIAN ANDRES": "Fabian Roncancio", "SUAREZ CADENA CARLOS FELIPE": "Carlos Suarez", "TIQUE TIQUE YECID": "Yecid Tique", "VERGARA MANRIQUE VICTOR HERNAN": "Victor Vergara", "AMAYA TRIANA LUIS ALEJANDRO": "Luis Amaya", "TRIANA SOLER JOHN ALEXANDER": "John Triana", "BUITRAGO CUESTA JONATHAN ALEXIS": "Jonathan Buitrago", "ACOSTA JUAN CARLOS": "Juan Acosta", "PEREZ ROA JOSE ALFREDO": "Jose Perez", "HERNANDEZ SILVA JHON EDWAR": "Jhon Hernandez", "DIAZ CATILLA CARLOS ALBERTO": "Carlos Diaz", "QUEMBA CAROLINA": "Carolina Quemba", "CASTELLANOS KILLY SEBASTIAN": "Killy Castellanos", "PADILLA ALISON": "Alison Padilla", "BARRAGAN BARRERA ANA MARIA": "Ana Barragan", "VALBUENA LOZANO BRAYAN DAVID": "Brayan Valbuena", "ORTIZ RODRIGUEZ CARLOS FELIPE": "Carlos Ortiz", "RAMIREZ MARTINEZ MIGUEL ALEJANDRO": "Miguel Ramirez", "VARGAS ROMERO JAIRO ANDRES": "Jairo Vargas", "HEIDI YURISSA DIAZ SANABRIA": "Heidi Diaz"};
const corto = n => CORTO[n] || (n || '').split(' ').slice(0, 2).join(' ');
const marcasList = () => { const m = new Set(MARCAS_BASE); Object.values(S.cds).forEach(cd => cd.ficha.forEach(f => { if (f.marca) m.add(f.marca); })); (cfg.marcasExtra || []).forEach(x => m.add(x)); return [...m]; };
const defaultCfg = () => ({ usuario: '', marcasExtra: [] });
// Técnicos: activos de AP_Usuarios (2026-09-28)
const TECNICOS = ["ACOSTA JUAN CARLOS", "AGUIAR OLIVERA EDUVINO", "AMAYA TRIANA LUIS ALEJANDRO", "ARDILA AMADO ELKIN", "BABILONIA THOMAS FERNANDO LUIS", "BAEZ JUAN CARLOS", "BARRAGAN BARRERA ANA MARIA", "BUITRAGO CUESTA JONATHAN ALEXIS", "CAÑON GONZALEZ RICARDO IGNACIO", "CARDENAS GOMEZ RAMIRO", "CASTAÑEDA MINZON HERNAN", "CASTELLANOS KILLY SEBASTIAN", "DAZA MORENO DUBAN STIVEN", "DIAZ CATILLA CARLOS ALBERTO", "DIAZ RODRIGUEZ NELSON FERNANDO", "FERNANDEZ SALAS JOHAN SEBASTIAN", "FONSECA SANTANA WILLIAM GIUSEPPE", "GALINDO TORRES HELVER MARTIN", "GONZALEZ CIFUENTES SOFIA LORENA", "GUERRERO RODRIGUEZ KEVIN CAMILO", "GUEVARA PÉREZ ANTONY", "HEIDI YURISSA DIAZ SANABRIA", "HERNANDEZ SILVA JHON EDWAR", "IZQUIERDO MURCIA CARLOS EDUARDO", "JIMENEZ CASTILLO OSCAR FERNANDO", "LOPEZ SUAREZ RICARDO ENRIQUE", "OLIVERO ROCHA IVAN DAVID", "ORTIZ RODRIGUEZ CARLOS FELIPE", "PADILLA ALISON", "PERDOMO RAMIREZ CRISTIAN DAVID", "PEREZ PIRA RIVEL ESTEBAN", "PEREZ ROA JOSE ALFREDO", "PINEDA AGUILAR WILKER DE JESUS", "PINZON TOVAR BRAYAN FELIPE", "PORRAS RODRIGUEZ BRIAM STEVENS", "QUEMBA CAROLINA", "QUIJANO CARDOSO JOHN JAIRO", "RAMIREZ BARAHONA FERNEY", "RAMIREZ CEPEDA BRAYAN HERNAN", "RAMIREZ MARTINEZ MIGUEL ALEJANDRO", "REYES HERNANDEZ SEBASTIAN DAVID", "ROBAYO BOHORQUEZ CARLOS ENRIQUE", "ROJAS CRUZ KEVIN YESSITH", "ROMERO JOHN FREDY", "ROMERO SERNA LUIS CAMILO", "RONCANCIO RINCON FABIAN ANDRES", "SUAREZ CADENA CARLOS FELIPE", "TIQUE TIQUE YECID", "TRIANA SOLER JOHN ALEXANDER", "VALBUENA LOZANO BRAYAN DAVID", "VARGAS ROMERO JAIRO ANDRES", "VERGARA MANRIQUE VICTOR HERNAN"];
let cfg = defaultCfg();
const saveCfg = () => dbPutKV('cfg', cfg);

// ---------- estado ----------
const S = { view: 'home', tab: 'lista', cds: {}, cur: null, q: '', flt: 'todos', form: null, from: 'reg', pos: null, sel: null, _autoI: null };
const curCD = () => S.cur ? S.cds[S.cur] : null;
const saveCD = cd => dbPutCD(cd);

// ---------- lectura del Excel -> CD ----------
function sheetObjs(rows) {
  const h = rows.findIndex(r => r && r.some(c => c != null && c !== '')); if (h < 0) return [];
  const keys = [], seen = new Set();
  for (let i = 0; i < rows[h].length; i++) { const k = norm(rows[h][i]); if (k && !seen.has(k)) { seen.add(k); keys[i] = k; } }
  const out = [];
  for (let i = h + 1; i < rows.length; i++) { const r = rows[i]; if (!r || !r.some(c => c != null && c !== '')) continue; const o = {}; keys.forEach((k, j) => { if (k) o[k] = r[j]; }); out.push(o); }
  return out;
}
function buildCDs(wb) {
  const names = Object.keys(wb);
  const cn = names.find(n => norm(n) === 'clientes') || names.find(n => (wb[n].find(r => r && r.length) || []).map(norm).includes('nro_servicio'));
  const bn = names.find(n => norm(n).includes('balance'));
  if (!cn) throw new Error('No encontré la hoja CLIENTES en la ficha');
  const cl = sheetObjs(wb[cn]), bl = bn ? sheetObjs(wb[bn]) : [];
  const ids = []; [...cl, ...bl].forEach(o => { const id = rawId(o.cd); if (id && !ids.includes(id)) ids.push(id); });
  if (!ids.length) throw new Error('No encontré la columna CD en la ficha');
  return ids.map(id => {
    const b = bl.filter(o => rawId(o.cd) === id).sort((x, y) => String(y.periodo).localeCompare(String(x.periodo)));
    const b0 = b[0] || {}; const c0 = fixCoord(b0.latitud, b0.longitud);
    const ficha = cl.filter(o => rawId(o.cd) === id).map(o => {
      const co = fixCoord(o.lat, o.lon); const cons = {}; for (const k in o) if (/^20\d{4}$/.test(k) && o[k] != null) cons[k] = num(o[k]);
      return { servicio: rawId(o.nro_servicio), cuenta: rawId(o.nro_cuenta), direccion: String(o.direccion ?? '').trim(), medidor: rawId(o.nro_medidor), marca: String(o.marca_medidor ?? '').trim().toUpperCase(), periodoUlt: rawId(o.periodo_ultima_lectura), ultimaLectura: num(o.ultima_lectura), facturacion: String(o.facturacion ?? '').trim(), carga: num(o.carga_aforada), lat: co.lat, lon: co.lon, clase: String(o.clase_servicio ?? '').trim().toUpperCase(), cosecha: String(o.cosecha ?? '').trim(), reinc: num(o.reincidencias) || 0, imputada: num(o.energia_imputada) || 0, cons };
    });
    return {
      id, creado: new Date().toISOString(), ot: '', placa: '', capacidad: '', hallazgosCD: [], setup: false, placaReal: '', exportadoEn: null,
      meta: { circuito: String(b0.circuito ?? '').trim(), codCircuito: String(b0.cod_circuito ?? '').trim(), potencia: num(b0.potencia_kva), tipoRed: String(b0.tipo_red ?? '').trim(), direccion: String(b0.direccion ?? '').trim(), lat: c0.lat, lon: c0.lon, cantClientes: num(b0.cant_clientes), tecnologia: String(b0.tecnologia_macro ?? '').trim() },
      balances: b.map(o => ({ periodo: rawId(o.periodo), entradas: num(o.entradas), salidas: num(o.salidas), perdidas: num(o.perdidas), indice: num(o.indice) })),
      ficha, registros: []
    };
  });
}

// ---------- búsqueda en ficha y clasificación ----------
const IDX = {};
function idx(cd) {
  const k = cd.id, n = cd.ficha.length; if (IDX[k] && IDX[k].n === n && IDX[k].ref === cd.ficha) return IDX[k];
  const s = new Map(), c = new Map(), m = new Map();
  cd.ficha.forEach((f, i) => { const a = idn(f.servicio), b = idn(f.cuenta), d = idn(f.medidor); if (a) s.set(a, i); if (b) c.set(b, i); if (d) { if (!m.has(d)) m.set(d, []); m.get(d).push(i); } });
  return IDX[k] = { n, ref: cd.ficha, s, c, m };
}
function matchFicha(cd, q) {
  const I = idx(cd), h = [], s = idn(q.servicio), c = idn(q.cuenta), m = idn(q.medidor);
  if (s && I.s.has(s)) h.push(['servicio', I.s.get(s)]);
  if (c && I.c.has(c)) h.push(['cuenta', I.c.get(c)]);
  if (m && I.m.has(m) && I.m.get(m).length === 1) h.push(['medidor', I.m.get(m)[0]]);
  if (!h.length) return { i: null };
  const set = [...new Set(h.map(x => x[1]))];
  return { i: h[0][1], via: h.map(x => x[0]), conflict: set.length > 1, all: set };
}
function otherCD(cd, q) { // ¿aparece en la ficha de otro CD cargado?
  const out = [];
  for (const id in S.cds) { if (id === cd.id) continue; const m = matchFicha(S.cds[id], q); if (m.i != null) out.push(id); }
  return out;
}
const CL = { 1: { t: 'EN FICHA, DE ESTE CD', c: 'ok' }, 2: { t: 'EN FICHA, DE OTRO CD', c: 'bad' }, 3: { t: 'CLIENTE NO REGISTRADO EN FICHA, VINCULADO A ESTE CD', c: 'new' }, 0: { t: 'NO EN FICHA, DE OTRO CD', c: 'bad' } };
function clasif(cd, r, m) {
  if (r.tipo === 'UNC') return 3;
  m = m || matchFicha(cd, r);
  if (m.i != null) return r.pertenece ? 1 : (r.pertenece === false ? 2 : null);
  return r.pertenece ? 3 : (r.pertenece === false ? 0 : null);
}

// ---------- exportación: Excel con 3 tablas ----------
const COLS = ['ID_REGISTRO', 'CD', 'OT', 'FECHA_HORA', 'TECNICO', 'TIPO_USUARIO', 'CLASIFICACION', 'NRO_SERVICIO', 'NRO_CUENTA', 'NRO_MEDIDOR', 'MARCA_MEDIDOR', 'LECTURA_ENERGIA_ACTIVA', 'ACTIVIDAD_ECONOMICA', 'MATERIAL_PREDIO', 'DIRECCION', 'LATITUD', 'LONGITUD', 'PRECISION_M', 'HALLAZGO_PERDIDAS', 'OBSERVACION', 'PLACA_TRANSFORMADOR', 'ROTULO_REAL', 'CAPACIDAD_KVA', 'HALLAZGOS_CD', 'CD_CORRECTO', 'KVA_CD_CORRECTO', 'OT_CD_CORRECTO', 'FICHA_MEDIDOR', 'FICHA_MARCA', 'DIFIERE_MEDIDOR'];
const WIDTHS = [14, 11, 14, 19, 22, 13, 30, 14, 12, 14, 14, 12, 16, 16, 34, 12, 12, 10, 40, 40, 40, 16, 12, 50, 14, 12, 14, 14, 14, 10];
function buildSheets(cd) {
  const rows = { 1: [], 2: [], 3: [], 4: [] };
  [...cd.registros].sort((a, b) => a.creado.localeCompare(b.creado)).forEach(r => {
    const m = r.tipo === 'CLIENTE' ? matchFicha(cd, r) : { i: null }, c0 = clasif(cd, r, m); if (c0 == null) return; const c = c0 === 0 ? 2 : c0 === 3 ? (r.tipo === 'UNC' ? 3 : 4) : c0;
    const f = m.i != null ? cd.ficha[m.i] : null;
    const dif = f && f.medidor && r.medidor && idn(f.medidor) !== idn(r.medidor) ? 'SI' : (f ? 'NO' : '');
    rows[c].push([r.id, cd.id, cd.ot || '', r.fecha || '', r.tecnico || '', r.tipo === 'UNC' ? 'UNC' : 'CLIENTE', r.tipo === 'UNC' ? 'USUARIO NO CLIENTE (UNC)' : CL[c0].t, r.servicio || '', r.cuenta || '', r.medidor || '', r.marca || '', num(r.lectura), r.actividad || '', r.tipo === 'UNC' ? r.material || '' : '', r.direccion || (f ? f.direccion : ''), r.lat, r.lon, r.prec == null ? null : Math.round(r.prec * 10) / 10, r.hallazgo || '', r.obs || '', cd.placa || '', cd.placa === PLACA_NO ? cd.placaReal || '' : '', cd.capacidad || '', (cd.hallazgosCD || []).join(' | '), c === 2 ? r.cdReal || '' : '', c === 2 ? r.capReal || '' : '', c === 2 ? r.otReal || '' : '', f ? f.medidor : '', f ? f.marca : '', dif]);
  });
  return [
    { name: '1_EN_FICHA_DE_ESTE_CD', table: 'tblEnFichaEsteCD', columns: COLS, rows: rows[1], widths: WIDTHS },
    { name: '2_EN_FICHA_DE_OTRO_CD', table: 'tblEnFichaOtroCD', columns: COLS, rows: rows[2], widths: WIDTHS },
    { name: '3_UNC', table: 'tblUNC', columns: COLS, rows: rows[3], widths: WIDTHS },
    { name: '4_NO_EN_FICHA_VINCULADOS', table: 'tblNoEnFichaVinculados', columns: COLS, rows: rows[4], widths: WIDTHS }
  ];
}
const mkBlob = (data, type) => new Blob([data], { type });
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
async function entregar(blob, name, compartir) {
  if (compartir && navigator.canShare) { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; } } }
  download(blob, name); return true;
}
const baseName = cd => `GS_VCT_CD${cd.id}_${today()}`;
async function exportarExcel(cd, compartir) {
  if (!otOk(cd.ot)) return toast(`La OT del CD debe tener ${OT_LEN} dígitos`);
  if (!setupOk(cd)) return toast('Completa los datos del CD');
  if (!await revisarFuera(cd)) return;
  const blob = mkBlob(XLSXLite.writeXlsx(buildSheets(cd)), XLSX_MIME);
  if (await entregar(blob, baseName(cd) + '.xlsx', compartir)) { cd.exportadoEn = new Date().toISOString(); await saveCD(cd); render(); }
}
async function exportarJSON(cd) {
  const blob = mkBlob(JSON.stringify({ app: 'GS_VCT', v: 1, cd }), 'application/json');
  await entregar(blob, baseName(cd) + '.json', false);
}

// ---------- utilidades de interfaz ----------
let toastT; function toast(msg, ms = 2600) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }
const alfa = list => { const fin = o => o === OTRA || o === SINMED || o === HOTRO; return [...list.filter(o => !fin(o))].sort((x, y) => String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' })).concat(list.filter(fin)); };
const opts = (list, sel, ph) => (ph != null ? `<option value="">${esc(ph)}</option>` : '') + alfa(list).map(o => `<option value="${esc(o)}"${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
const ICO = { home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>', back: '<path d="M15 5l-7 7 7 7"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', sum: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15v-3M12 15V9M16 15v-5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>' };
const ic = k => `<svg class="ic" viewBox="0 0 24 24" aria-hidden="true">${ICO[k]}</svg>`;
const LOGO = `<svg width="36" height="36" viewBox="0 0 100 100" aria-hidden="true"><rect width="100" height="100" rx="24" fill="#FF6600"/><circle cx="40" cy="46" r="21" fill="none" stroke="#fff" stroke-width="6"/><circle cx="60" cy="46" r="21" fill="none" stroke="#fff" stroke-width="6"/><path d="M8 46h11M81 46h11" stroke="#fff" stroke-width="6" stroke-linecap="round"/><text x="50" y="88" font-size="18" font-weight="800" fill="#fff" text-anchor="middle" font-family="Manrope,Arial,sans-serif">VCT</text></svg>`;
const FOOT = '<div class="foot">Desarrollado por Heidi Díaz</div>';
const badge = (c, t) => `<span class="badge ${c}">${esc(t)}</span>`;

function stats(cd) {
  const reg = new Map(); let t1 = 0, t2 = 0, t3 = 0, t4 = 0, unc = 0, inv = 0;
  cd.registros.forEach(r => {
    const m = r.tipo === 'CLIENTE' ? matchFicha(cd, r) : { i: null }; if (m.i != null) reg.set(m.i, r);
    const c = clasif(cd, r, m); if (c === 1) t1++; else if (c === 2 || c === 0) t2++; else if (c === 3) { if (r.tipo === 'UNC') t3++; else t4++; } else inv++; if (r.tipo === 'UNC') unc++;
  });
  return { reg, total: cd.ficha.length, visit: reg.size, pend: cd.ficha.length - reg.size, t1, t2, t3, t4, unc, inv, n: cd.registros.length };
}

// ---------- vistas ----------
function header() {
  const cd = curCD();
  if (S.view === 'home') return `<header><div class="brand">${LOGO}<div><h1>GS VCT</h1>${cfg.usuario ? '' : '<small>Vínculo Cliente – Transformador</small>'}</div></div>${cfg.usuario ? `<div class="ib who" style="cursor:default"><span>${esc(corto(cfg.usuario))}</span>${ic('user')}</div>` : ''}</header>`;
  const st = stats(cd);
  return `<header><button class="ib" data-act="home" aria-label="Volver">${ic('back')}</button><div class="brand"><div><h1>${esc(cd.id)}</h1><small>${esc(corto(cfg.usuario))} · ${esc(cd.meta.circuito)}${cd.meta.potencia ? ' · ' + cd.meta.potencia + ' kVA' : ''}${cd.meta.tipoRed ? ' · ' + esc(cd.meta.tipoRed) : ''}</small></div></div><div class="prog">${st.visit}/${st.total}</div></header>`;
}
function nav() {
  if (S.view !== 'cd' || !curCD() || !curCD().setup) return '';
  const isU = S.form && S.form.tipo === 'UNC', t = [['lista', ic('list'), 'Ficha'], ['reg', ic('plus'), 'Otros clientes'], ['unc', ic('home'), 'UNC'], ['res', ic('sum'), 'Resumen']];
  const fromL = S.tab === 'reg' && !isU && S.from === 'lista', on = k => k === 'reg' ? S.tab === 'reg' && !isU && !fromL : k === 'unc' ? S.tab === 'reg' && isU : k === 'lista' ? S.tab === 'lista' || fromL : S.tab === k;
  return `<nav class="bottom">${t.map(([k, i, l]) => `<button data-tab="${k}" class="${on(k) ? 'on' : ''}">${i}${l}</button>`).join('')}</nav>`;
}
function viewHome() {
  const hero = '<div class="hero"><img src="banner.svg" alt=""><div class="ttl"><b>Vínculo Cliente –<br>Transformador</b></div></div>';
  if (!cfg.usuario) return `${hero}<div class="card"><h2>Usuario</h2><select data-usr>${opts(TECNICOS, '', 'Selecciona tu nombre')}</select></div>${FOOT}`;
  const list = Object.values(S.cds).sort((a, b) => b.creado.localeCompare(a.creado));
  return `${hero}<div class="card"><div class="fld"><label class="req">N° de OT</label><input type="text" ${otAtt} data-ot0 value="${esc(S.ot0 || '')}" autocomplete="off"></div><button class="btn pri full" id="btnFicha" data-act="cargar"${otOk(S.ot0) ? '' : ' disabled'}>Cargar ficha</button><input type="file" id="fx" accept=".xlsx" hidden></div>
    ${list.map(cd => { const s = stats(cd); return `<button class="it" data-act="open-cd" data-id="${esc(cd.id)}"><div class="t"><span>${esc(cd.id)} <span style="font-weight:500;color:var(--mut)">· ${esc(cd.meta.circuito)}</span></span><span class="badge ${s.pend === 0 && s.total ? 'ok' : 'pend'}">${s.visit}/${s.total}</span></div><div class="s">${s.n} registros${cd.ot ? ' · OT ' + esc(cd.ot) : ''}${cd.exportadoEn ? '' : ' · sin exportar'}</div></button>`; }).join('')}
    <div style="text-align:center;margin-top:10px"><label class="btn sm"><input type="file" id="fj" accept=".json" hidden>Restaurar respaldo</label></div>${FOOT}`;
}
function balanceHTML(cd) {
  const all = [...(cd.balances || [])].sort((a, b) => String(a.periodo).localeCompare(String(b.periodo)));
  if (!all.length) return '';
  const ok = b => b.indice != null && b.entradas > 0 && b.perdidas >= 0, per = p => String(p).length === 6 ? String(p).slice(4) + '/' + String(p).slice(2, 4) : String(p);
  const vals = all.slice(-12), valid = all.filter(ok), last = valid[valid.length - 1], prev = valid[valid.length - 2];
  const W = 340, H = 168, top = 22, bot = 30, padL = 10, padR = 10, n = vals.length, step = (W - padL - padR) / n, bw = Math.min(34, step * 0.62);
  const mx = Math.max(0.3, ...vals.filter(ok).map(b => b.indice)) * 1.12, y = v => top + (H - top - bot) * (1 - v / mx);
  const bars = vals.map((b, i) => {
    const x = padL + step * i + (step - bw) / 2, good = ok(b), h = good ? Math.max(2, (H - top - bot) * (b.indice / mx)) : 0, col = !good ? 'var(--mut)' : b === last ? 'url(#gOr)' : 'url(#gBl)';
    return `<rect x="${x.toFixed(1)}" y="${(H - bot - h).toFixed(1)}" width="${bw.toFixed(1)}" height="${h.toFixed(1)}" rx="5" style="fill:${col};opacity:${good ? 1 : .35}"/>
      <text x="${(x + bw / 2).toFixed(1)}" y="${(good ? H - bot - h - 5 : H - bot - 5).toFixed(1)}" text-anchor="middle" class="bv">${good ? fmt(b.indice * 100, 1) : '⚠'}</text>
      <text x="${(x + bw / 2).toFixed(1)}" y="${H - 11}" text-anchor="middle" class="bl">${per(b.periodo)}</text>`;
  }).join('');
  const delta = last && prev ? (last.indice - prev.indice) * 100 : null;
  const tabla = `<details class="det"><summary>Ver tabla</summary><table class="tb"><tr><th>Periodo</th><th>Entradas</th><th>Salidas</th><th>Pérdidas</th><th>Índice</th></tr>${[...all].reverse().map(b => `<tr><td>${esc(b.periodo)}</td><td>${fmt(b.entradas)}</td><td>${fmt(b.salidas)}</td><td>${fmt(b.perdidas)}</td><td style="font-weight:700">${b.indice == null ? '—' : fmt(b.indice * 100, 1) + ' %'}${ok(b) ? '' : ' ⚠'}</td></tr>`).join('')}</table></details>`;
  return `<div class="card dash"><h2>Balance del transformador${last ? ` <span class="sub">· ${per(last.periodo)}</span>` : ''}</h2>
    ${last ? `<div class="kpis"><div class="kpi big"><b style="color:var(--tx)">${fmt(last.indice * 100, 1)} %</b><span>Índice de pérdidas${delta != null ? `<br><i class="${delta > 0 ? 'up' : 'dn'}">${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta), 1)} pts vs ${per(prev.periodo)}</i>` : ''}</span></div><div class="kpi"><b>${fmt(last.perdidas)}</b><span>Pérdidas kWh</span></div><div class="kpi"><b>${fmt(last.entradas)}</b><span>Entradas kWh</span></div></div>` : ''}
    <svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Índice de pérdidas por periodo"><defs><linearGradient id="gOr" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FF9A4D"/><stop offset="1" stop-color="#FF6600"/></linearGradient><linearGradient id="gBl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#8FD3F0"/><stop offset="1" stop-color="#35A1D1"/></linearGradient></defs>${bars}</svg>
    ${tabla}</div>`;
}
function viewLista(cd) {
  const s = stats(cd), fl = S.flt;
  const fuera = cd.registros.filter(r => r.tipo === 'UNC' || matchFicha(cd, r).i == null).length;
  const ch = [['todos', 'Todos ' + (s.total + fuera)], ['pend', 'Pendientes ' + s.pend], ['reg', 'Registrados ' + s.n], ['fuera', 'Fuera de ficha ' + fuera]];
  return balanceHTML(cd) + `<div class="row" style="margin-bottom:6px"><input type="search" id="q" placeholder="Buscar servicio, cuenta, medidor…" value="${esc(S.q)}"><button class="btn pri" style="flex:0 0 auto" data-act="nuevo">+ Nuevo</button></div>
    <div class="chips">${ch.map(([k, l]) => `<button class="chip ${fl === k ? 'on' : ''}" data-flt="${k}">${l}</button>`).join('')}</div>
    <div id="lst">${listHTML(cd)}</div>${FOOT}`;
}
function listHTML(cd) {
  const s = stats(cd), q = S.q.trim().toLowerCase(), items = [];
  cd.ficha.forEach((f, i) => items.push({ f, i, r: s.reg.get(i) }));
  cd.registros.forEach(r => { if (r.tipo === 'UNC' || matchFicha(cd, r).i == null) items.push({ r, extra: true }); });
  const out = items.filter(it => {
    if (S.flt === 'pend' && (it.extra || it.r)) return false; if (S.flt === 'reg' && !it.r) return false; if (S.flt === 'fuera' && !it.extra) return false;
    if (!q) return true; const x = it.f || it.r; return [x.servicio, x.cuenta, x.medidor, x.direccion, it.r && it.r.direccion].some(v => String(v || '').toLowerCase().includes(q));
  });
  if (!out.length) return '<div class="note">No hay resultados.</div>';
  return out.slice(0, 400).map(it => {
    const x = it.f || it.r, c = it.r ? clasif(cd, it.r) : null;
    const chip = it.r ? (it.r.tipo === 'UNC' ? badge('unc', 'UNC') : badge(CL[c] ? CL[c].c : 'none', c === 1 ? 'Del circuito ✓' : c === 2 || c === 0 ? (otOk(it.r.otReal) ? 'Otro circuito ✓' : 'Otro circuito · falta OT') : c === 3 ? 'No en ficha' : 'Sin clasificar')) : badge('pend', 'Pendiente');
    const title = it.r && it.r.tipo === 'UNC' ? 'Usuario no cliente' : `Serv. ${esc(x.servicio || '—')} · Cta. ${esc(x.cuenta || '—')} · Med. ${esc(x.medidor || '—')}`;
    const dir = x.direccion || (it.r && it.r.direccion) || '';
    const extra = it.f && (it.f.cosecha || !it.f.medidor) ? ` · <span style="color:var(--warn)">${esc(it.f.cosecha || 'Sin medidor en ficha')}</span>` : '';
    return `<button class="it" ${it.extra ? `data-act="open-reg" data-id="${esc(it.r.id)}"` : `data-act="open-ficha" data-i="${it.i}"`}><div class="t"><span>${title}</span>${chip}</div><div class="s">${esc(dir) || 'Sin dirección'}</div>${[x.marca ? esc(x.marca) : '', extra ? extra.replace(/^ · /, '') : '', it.r && it.r.hallazgo && it.r.hallazgo !== 'SIN HALLAZGO' ? '⚠ ' + esc(it.r.hallazgo) : ''].filter(Boolean).length ? `<div class="s">${[x.marca ? esc(x.marca) : '', extra ? extra.replace(/^ · /, '') : '', it.r && it.r.hallazgo && it.r.hallazgo !== 'SIN HALLAZGO' ? '⚠ ' + esc(it.r.hallazgo) : ''].filter(Boolean).join(' · ')}</div>` : ''}</button>`;
  }).join('') + (out.length > 400 ? '<div class="note">Mostrando 400; usa el buscador para acotar.</div>' : '');
}

function newForm(tipo = 'CLIENTE') { return { id: null, tipo, servicio: '', cuenta: '', medidor: '', marca: '', marcaOtra: '', lectura: '', actividad: '', pertenece: null, hallazgo: tipo === 'UNC' ? '' : 'SIN HALLAZGO', obs: '', direccion: '', lat: null, lon: null, prec: null, tecnico: cfg.usuario || '', cdReal: '', otReal: '', capReal: '', material: '' }; }
function formFromRec(r) {
  const f = Object.assign(newForm(r.tipo), JSON.parse(JSON.stringify(r)));
  const lista = [...marcasList(), SINMED]; f.marcaOtra = ''; if (f.marca && !lista.includes(f.marca)) { f.marcaOtra = f.marca; f.marca = OTRA; }
  f.lectura = r.lectura == null ? '' : String(r.lectura); return f;
}
function viewReg(cd) {
  const f = S.form || (S.form = newForm()), unc = f.tipo === 'UNC';
  const m0 = unc ? { i: null } : matchFicha(cd, f);
  const cli = `<div class="fld"><label class="req">N° de servicio eléctrico</label><input type="text" inputmode="numeric" data-f="servicio" value="${esc(f.servicio)}" autocomplete="off"></div>
      <div class="fld"><label class="req">N° de cuenta</label><input type="text" inputmode="numeric" data-f="cuenta" value="${esc(f.cuenta)}" autocomplete="off"></div>
      <div class="fld"><label class="req">N° de medidor</label><input type="text" inputmode="text" data-f="medidor" value="${esc(f.medidor)}" autocomplete="off"></div>
      <div id="matchCard"></div>
      <div class="fld"><label class="req">Marca del medidor</label><select data-f="marca">${opts([...marcasList(), SINMED, OTRA], f.marca, 'Selecciona…')}</select></div>
      <div class="fld ${f.marca === OTRA ? '' : 'hidden'}" data-show="otra"><label class="req">Escribe la marca</label><input type="text" data-f="marcaOtra" value="${esc(f.marcaOtra)}" style="text-transform:uppercase"></div>
      <div class="fld ${f.marca === SINMED ? 'hidden' : ''}" data-show="lect"><label class="req">Lectura de energía activa (kWh)</label><input type="number" inputmode="decimal" step="any" data-f="lectura" value="${esc(f.lectura)}"><div id="lectHint"></div></div>
      <div class="fld ${m0.i != null ? '' : 'hidden'}" data-show="pert"><label class="req">¿Cliente vinculado a este CD?</label><div class="seg" data-seg="pertenece"><button data-v="1" class="${f.pertenece === true ? 'on' : ''}">SÍ</button><button data-v="0" class="${f.pertenece === false ? 'on no' : ''}">NO</button></div></div>
      <div class="fld" id="clasif"></div>
      <div data-show="otro" class="hidden"><div class="note warn">Otro circuito: la OT de ese CD es obligatoria al exportar.</div>
        <div class="fld" style="margin-top:12px"><label>CD correcto</label><input type="text" data-f="cdReal" value="${esc(f.cdReal)}" placeholder="XXXXTRX" style="text-transform:uppercase" autocomplete="off"></div>
        <div class="fld"><label>Capacidad del CD correcto</label><select data-f="capReal">${opts(KVA.map(k => k + ' kVA'), f.capReal, 'Selecciona…')}</select></div>
        <div class="fld"><label>OT del CD correcto</label><input type="text" ${otAtt} data-f="otReal" value="${esc(f.otReal)}" autocomplete="off"></div></div>`;
  return `<div class="card"><h2 id="ttl">${unc ? 'Usuario no cliente (UNC)' : m0.i != null ? 'Cliente' : 'Cliente no registrado en ficha · vinculado a este CD'}</h2>
    ${unc ? `<div class="fld"><label class="req">Ubicación</label><div id="geo">${geoHTML(f)}</div></div>` : cli}
    ${unc ? `<div class="fld"><label class="req">Tipo de material del predio</label><select data-f="material">${opts(MATERIALES, f.material, 'Selecciona…')}</select></div>` : ''}
    <div class="fld"><label class="req">Actividad económica</label><select data-f="actividad">${opts(ACTIVIDADES, f.actividad, 'Selecciona…')}</select></div>
    <div class="fld"><label>Dirección (opcional)</label><input type="text" data-f="direccion" value="${esc(f.direccion)}" style="text-transform:uppercase"></div>
    <div class="fld"><label class="req">Hallazgo de pérdidas</label><select data-f="hallazgo">${opts(unc ? HALLAZGOS_UNC : HALLAZGOS, f.hallazgo, 'Selecciona…')}</select></div>
    <div class="fld"><label>Observación</label><div class="row" style="align-items:flex-start;flex-wrap:nowrap"><textarea data-f="obs" placeholder="OBSERVACIÓN…">${esc(f.obs)}</textarea><button type="button" class="btn mic" data-act="dictar" aria-label="Dictar">${ic('mic')}</button></div></div>
    <div id="errs"></div>
    <div class="row" style="margin-top:8px"><button class="btn full" data-act="cancelar" style="flex:0 0 36%">${f.id ? 'Cancelar' : 'Limpiar'}</button><button class="btn pri" id="btnSave" data-act="guardar">${f.id ? 'Guardar cambios' : 'Guardar'}</button></div>
    ${f.id ? '<div style="margin-top:10px"><button class="btn bad sm" data-act="borrar-reg">Eliminar este registro</button></div>' : ''}
  </div>${FOOT}`;
}
function geoHTML(f) {
  const has = f.lat != null, p = f.prec, good = p != null && p <= 12, cap = !!S.geo;
  const bd = cap ? ['CAPTURANDO', 'warn'] : !has ? ['SIN GPS', ''] : good ? ['BUENA', 'ok'] : ['REGULAR', 'mid'];
  const ring = p == null ? 28 : Math.round(Math.min(110, Math.max(26, p * 3)));
  return `<div class="gcard"><div class="ghead"><div class="gpin">${ic('pin')}</div><div class="gcopy"><b>${has ? 'Ubicación capturada' : cap ? 'Buscando señal…' : 'Ubicación pendiente'}</b><small id="geoMsg">${cap ? 'Quédate quieto, al aire libre si puedes.' : has ? `Precisión ${p.toFixed(1)} m · recomendada ≤ 12 m` : 'Coordenadas no capturadas.'}</small></div><span class="gbadge ${bd[1]}">${bd[0]}</span></div>
    <div class="gmap"><div class="gring${cap ? ' pulse' : ''}${has && !good ? ' mid' : ''}" style="width:${ring}px;height:${ring}px"><i></i></div></div></div>
    <div class="grid2"><div class="fld"><label>Latitud</label><input type="text" readonly value="${has ? f.lat.toFixed(7) : ''}" placeholder="GPS"></div><div class="fld"><label>Longitud</label><input type="text" readonly value="${has ? f.lon.toFixed(7) : ''}" placeholder="GPS"></div></div>
    <button class="btn ter full" data-act="geo">${ic('pin')}${cap ? 'Detener y usar la mejor' : has ? 'Capturar de nuevo' : 'Capturar ubicación'}</button>`;
}

// resumen ---------------------------------------------------
function setupOk(cd) { return !!(otOk(cd.ot) && cd.placa && (cd.placa !== PLACA_NO || (cd.placaReal || '').trim()) && cd.capacidad && cd.hallazgosCD && cd.hallazgosCD.length); }
function hzHTML(cd) {
  const sel = cd.hallazgosCD || [], libres = HZ_CD.filter(h => !sel.includes(h));
  return `<select data-hzadd>${opts(libres, '', sel.length ? 'Agregar otro hallazgo…' : 'Selecciona un hallazgo…')}</select>
    <div class="chips" style="margin-top:8px">${sel.map(h => `<button class="chip on" data-act="hz" data-v="${esc(h)}">${esc(h)} ✕</button>`).join('')}</div>`;
}
function hzAdd(cd, v) {
  const a = cd.hallazgosCD = cd.hallazgosCD || [], i = a.indexOf(v);
  if (i >= 0) a.splice(i, 1); else { if (v === 'SIN HALLAZGOS') a.length = 0; else { const k = a.indexOf('SIN HALLAZGOS'); if (k >= 0) a.splice(k, 1); } a.push(v); }
  return saveCD(cd).then(() => { const b = $('#hzbox'); if (b) b.innerHTML = hzHTML(cd); const bs = $('#btnSetup'); if (bs) bs.disabled = !setupOk(cd); });
}
function cdFields(cd) {
  if (!cd.setup && !(cd.hallazgosCD || []).length) cd.hallazgosCD = ['SIN HALLAZGOS'];
  if (!cd.capacidad && cd.meta.potencia != null && KVA.includes(String(cd.meta.potencia))) cd.capacidad = String(cd.meta.potencia);
  return `<div class="fld"><label class="req">Verificación de la placa</label><select data-cdf="placa">${opts(PLACAS, cd.placa, 'Selecciona…')}</select></div>
    <div class="fld${cd.placa === PLACA_NO ? '' : ' hidden'}" data-show="placaReal"><label class="req">Rótulo real del transformador</label><input type="text" data-cdf="placaReal" value="${esc(cd.placaReal || '')}" placeholder="XXXXTRX" style="text-transform:uppercase" autocomplete="off"></div>
    <div class="fld"><label class="req">Capacidad</label><select data-cdf="capacidad">${opts(KVA, cd.capacidad, 'Selecciona…').replace(/>(\d[\d.]*)<\/option>/g, '>$1 kVA</option>')}</select></div>
    <div class="fld"><label class="req">Hallazgos del CD</label><div id="hzbox">${hzHTML(cd)}</div></div>`;
}
function viewSetup(cd) {
  return `<div class="card"><h2>Datos del CD ${esc(cd.id)}</h2><div class="fld"><label class="req">N° de OT</label><input type="text" ${otAtt} data-cdf="ot" value="${esc(cd.ot)}" autocomplete="off"></div>${cdFields(cd)}<button class="btn pri full" id="btnSetup" data-act="setup-ok"${setupOk(cd) ? '' : ' disabled'}>Continuar</button></div>${FOOT}`;
}
function revisarFuera(cd) {
  const lst = cd.registros.filter(r => [0, 2].includes(clasif(cd, r)));
  if (!lst.length) return Promise.resolve(true);
  return new Promise(res => {
    const box = document.createElement('div'); box.className = 'modal';
    box.innerHTML = `<div class="box"><h3>OT de los CD correctos</h3><p style="color:var(--mut);font-size:13px">Estos clientes no son de este circuito. Registra el CD y la OT de cada uno para exportar.</p>${lst.map(r => `<div class="card" data-rid="${esc(r.id)}"><b>Serv. ${esc(r.servicio || '—')} · Cta. ${esc(r.cuenta || '—')}</b>
      <div class="fld" style="margin:8px 0 0"><label>CD correcto</label><input type="text" data-ro="cd" value="${esc(r.cdReal || '')}" style="text-transform:uppercase" autocomplete="off"></div>
      <div class="fld" style="margin:8px 0 0"><label>Capacidad</label><select data-ro="kva">${opts(KVA.map(k => k + ' kVA'), r.capReal, 'Selecciona…')}</select></div>
      <div class="fld" style="margin:8px 0 0"><label class="req">OT del CD correcto</label><input type="text" ${otAtt} data-ro="ot" value="${esc(r.otReal || '')}" autocomplete="off"></div></div>`).join('')}
      <div class="row"><button class="btn" id="roNo">Cancelar</button><button class="btn pri" id="roSi" disabled>Guardar y exportar</button></div></div>`;
    document.body.appendChild(box);
    const chk = () => { box.querySelectorAll('[data-ro="ot"]').forEach(i => i.value = i.value.replace(/\D/g, '').slice(0, OT_LEN)); box.querySelectorAll('[data-ro="cd"]').forEach(i => i.value = i.value.toUpperCase()); $('#roSi').disabled = !lst.every(r => { const c = box.querySelector(`[data-rid="${r.id}"]`); return otOk(c.querySelector('[data-ro="ot"]').value) && c.querySelector('[data-ro="cd"]').value.trim(); }); };
    box.addEventListener('input', chk); chk();
    $('#roNo').onclick = () => { box.remove(); res(false); };
    $('#roSi').onclick = async () => {
      lst.forEach(r => { const c = box.querySelector(`[data-rid="${r.id}"]`); r.cdReal = normCd(c.querySelector('[data-ro="cd"]').value); r.capReal = c.querySelector('[data-ro="kva"]').value; r.otReal = c.querySelector('[data-ro="ot"]').value; });
      await saveCD(cd); box.remove(); res(true);
    };
  });
}
function viewRes(cd) {
  const s = stats(cd), warns = [];
  if (!otOk(cd.ot)) warns.push(`La OT del CD debe tener ${OT_LEN} dígitos.`); if (!setupOk(cd)) warns.push('Faltan datos del CD (placa, capacidad o hallazgos).');
  const sinOT = cd.registros.filter(r => [0, 2].includes(clasif(cd, r)) && !otOk(r.otReal)).length; if (sinOT) warns.push(`${sinOT} cliente(s) de otro circuito sin OT: se piden al exportar.`);
  if (s.pend) warns.push(`Quedan ${s.pend} clientes de la ficha sin registrar.`);
  return `<div class="card"><h2>Datos del CD</h2><div class="fld"><label class="req">N° de OT</label><input type="text" ${otAtt} data-cdf="ot" value="${esc(cd.ot)}" autocomplete="off"></div>${cdFields(cd)}</div>
    <div class="card"><h2>Avance</h2><div class="kpis"><div class="kpi"><b>${s.visit}/${s.total}</b><span>Ficha visitada</span></div><div class="kpi"><b>${s.pend}</b><span>Pendientes</span></div></div>
    <div class="kpis k2" style="margin-top:10px"><div class="kpi"><b style="color:var(--ok)">${s.t1}</b><span>En ficha, de este CD</span></div><div class="kpi"><b style="color:var(--bad)">${s.t2}</b><span>En ficha, de otro CD</span></div><div class="kpi"><b style="color:var(--new)">${s.t3}</b><span>UNC</span></div><div class="kpi"><b style="color:var(--new)">${s.t4}</b><span>No en ficha, vinculados</span></div></div>
    ${warns.map(w => `<div class="note warn">${esc(w)}</div>`).join('')}</div>
    <div class="card"><h2>Exportar</h2><div class="row"><button class="btn pri" data-act="xlsx">Exportar Excel</button><button class="btn" data-act="xlsx-share">Compartir</button></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="json">Respaldo</button><button class="btn bad" data-act="del-cd">Eliminar CD</button></div>
    <p style="font-size:12px;color:var(--mut)">${cd.exportadoEn ? 'Última exportación: ' + esc(stamp(new Date(cd.exportadoEn))) : 'Aún no exportado.'}</p></div>
    ${balanceHTML(cd)}${FOOT}`;
}

// ajustes ---------------------------------------------------
// ---------- render ----------
function render() {
  const cd = curCD(); let body = '';
  if (S.view === 'home') body = viewHome();
  else if (cd && !cd.setup) body = viewSetup(cd);
  else if (cd) body = S.tab === 'lista' ? viewLista(cd) : S.tab === 'reg' ? viewReg(cd) : viewRes(cd);
  const key = S.view + ':' + S.tab + (S.tab === 'reg' && S.form ? S.form.tipo : '') + ':' + (cfg.usuario ? 1 : 0) + ':' + (S.cur || ''), cambio = key !== S._key; S._key = key;
  $('#root').innerHTML = header() + `<main${cambio ? ' class="enter"' : ''}>${body}</main>` + nav();
  if (S.view === 'cd' && S.tab === 'reg') { updateDerived(); }
  window.scrollTo(0, 0);
}

// ---------- formulario de registro ----------
function marcaFinal(f) { return f.marca === OTRA ? f.marcaOtra.trim().toUpperCase() : f.marca; }
function validar(cd, f, m) {
  const e = [], unc = f.tipo === 'UNC';
  if (!otOk(cd.ot)) e.push(`OT del CD (${OT_LEN} dígitos)`);
  if (!unc) {
    if (!f.servicio.trim()) e.push('N° de servicio'); if (!f.cuenta.trim()) e.push('N° de cuenta');
    if (!f.marca) e.push('Marca del medidor'); else if (f.marca === OTRA && !f.marcaOtra.trim()) e.push('Escribe la marca');
    if (f.marca !== SINMED) { if (!f.medidor.trim()) e.push('N° de medidor'); if (f.lectura === '' || num(f.lectura) == null) e.push('Lectura de energía activa'); }
    if (f.pertenece == null) e.push('¿Cliente vinculado a este CD? (SÍ / NO)');
    if (f.pertenece === false && f.otReal && !otOk(f.otReal)) e.push(`OT del CD correcto (${OT_LEN} dígitos)`);
  }
  if (!f.actividad) e.push('Actividad económica'); if (unc && !f.material) e.push('Tipo de material del predio');
  if (unc) { if (f.lat == null) e.push('Capturar coordenada (obligatoria para UNC)'); }
  if (!f.hallazgo) e.push('Hallazgo técnico'); else if (f.hallazgo === HOTRO && !f.obs.trim()) e.push('Describe el hallazgo en la observación');
  // duplicados
  if (!f.id && !unc) {
    const dup = cd.registros.find(r => r.tipo === 'CLIENTE' && ((idn(f.servicio) && idn(r.servicio) === idn(f.servicio)) || (idn(f.cuenta) && idn(r.cuenta) === idn(f.cuenta)) || (m.i != null && matchFicha(cd, r).i === m.i)));
    if (dup) { S.dup = dup.id; e.push('Este cliente ya está registrado'); } else S.dup = null;
  }
  return e;
}
function setIfEmpty(k, v) { const f = S.form; if (v && !f[k]) { f[k] = v; const el = $(`[data-f="${k}"]`); if (el) el.value = v; } }
function updateDerived() {
  const cd = curCD(), f = S.form; if (!cd || !f || S.tab !== 'reg') return;
  const unc = f.tipo === 'UNC'; let m = { i: null };
  if (!unc) m = matchFicha(cd, f);
  if (m.i != null && S._autoI !== m.i && !m.conflict) {
    S._autoI = m.i; const fi = cd.ficha[m.i];
    setIfEmpty('servicio', fi.servicio); setIfEmpty('cuenta', fi.cuenta); setIfEmpty('medidor', fi.medidor); setIfEmpty('direccion', String(fi.direccion || '').toUpperCase());
    if (!f.marca) { const mk = fi.marca; if (!fi.medidor && !mk) f.marca = SINMED; else if (mk && marcasList().includes(mk)) f.marca = mk; else if (mk) { f.marca = OTRA; f.marcaOtra = mk; } const sel = $('[data-f="marca"]'); if (sel) sel.value = f.marca; const ot = $('[data-f="marcaOtra"]'); if (ot) ot.value = f.marcaOtra; }
    if (!f.actividad) { const a = ACTIVIDADES.find(x => x === fi.clase); if (a) { f.actividad = a; const sel = $('[data-f="actividad"]'); if (sel) sel.value = a; } }
  }
  if (m.i == null) S._autoI = null;
  // mostrar/ocultar
  const sh = (k, on) => { const el = $(`[data-show="${k}"]`); if (el) el.classList.toggle('hidden', !on); };
  sh('pert', m.i != null);
  if (!unc) { if (m.i == null && f.pertenece !== true) { f.pertenece = true; f._auto = true; } else if (m.i != null && f._auto) { f.pertenece = null; f._auto = false; document.querySelectorAll('[data-seg="pertenece"] button').forEach(b => b.classList.remove('on', 'no')); } }
  sh('otra', f.marca === OTRA); sh('lect', f.marca !== SINMED);
  // tarjeta de coincidencia
  const mc = $('#matchCard'); if (mc) mc.innerHTML = unc ? '' : matchHTML(cd, f, m);
  // clasificación
  const tt = $('#ttl'); if (tt && !unc) tt.textContent = m.i != null ? 'Cliente' : 'Cliente no registrado en ficha · vinculado a este CD';
  const c = clasif(cd, f, m); const clEl = $('#clasif'); if (clEl) clEl.innerHTML = c == null || (c === 3 && !unc) ? '' : badge(CL[c].c, CL[c].t) + '';
  sh('otro', c === 2 || c === 0);
  // lectura vs última
  const lh = $('#lectHint'); if (lh) { const fi = m.i != null ? cd.ficha[m.i] : null, v = num(f.lectura); const baja = fi && fi.ultimaLectura != null && v != null && v < fi.ultimaLectura; lh.innerHTML = fi && fi.ultimaLectura != null ? `<div class="lect${baja ? ' bad' : ''}"><span>Última lectura en ficha<b>${fmt(fi.ultimaLectura)} kWh</b><em>periodo ${esc(fi.periodoUlt)}</em></span>${baja ? '<strong>Menor a la última: revisa</strong>' : ''}</div>` : ''; }
  // errores
  const errs = validar(cd, f, m); $('#errs').innerHTML = errs.length ? `<div class="note warn"><b>Pendiente:</b> ${errs.map(esc).join(' · ')}${S.dup && errs.includes('Este cliente ya está registrado') ? ` <button class="btn sm" data-act="open-reg" data-id="${esc(S.dup)}">Abrir el existente</button>` : ''}</div>` : '';
  $('#btnSave').disabled = errs.length > 0;
}
function matchHTML(cd, f, m) {
  if (!(f.servicio || f.cuenta || f.medidor)) return '';
  if (m.i == null) { const o = otherCD(cd, f); return `<div class="note">No está en la ficha de ${esc(cd.id)}.${o.length ? ` <b>Aparece en la ficha de ${esc(o.join(', '))}.</b>` : ''}</div>`; }
  const x = cd.ficha[m.i], cons = Object.entries(x.cons || {}).sort((p, q) => p[0].localeCompare(q[0])).map(([k, v]) => `<div class="c"><em>${k.slice(4)}/${k.slice(2, 4)}</em><b>${fmt(v)}</b></div>`).join('');
  return `<div class="fx"><div class="fxh"><span class="fxok">✓ En ficha</span>${x.carga != null ? `<span class="fxc">Carga aforada <b>${x.carga}</b></span>` : ''}</div>${cons ? `<div class="fxl">Consumos (kWh)</div><div class="cons">${cons}</div>` : ''}</div>` +
    (m.conflict ? '<div class="note err">El servicio, la cuenta y el medidor escritos corresponden a clientes distintos de la ficha. Revísalos.</div>' : '') +
    (x.cosecha ? `<div class="note warn">Control en ficha: ${esc(x.cosecha)}</div>` : '') + (x.reinc ? `<div class="note warn">Reincidencias: ${x.reinc}${x.imputada ? ' · energía imputada ' + fmt(x.imputada) + ' kWh' : ''}</div>` : '') + (!x.medidor ? '<div class="note warn">La ficha no tiene medidor para este cliente.</div>' : '');
}
async function guardar() {
  const cd = curCD(), f = S.form, unc = f.tipo === 'UNC', m = unc ? { i: null } : matchFicha(cd, f), errs = validar(cd, f, m);
  if (errs.length) return toast('Pendiente: ' + errs[0]);
  const marca = unc ? '' : marcaFinal(f); if (marca && f.marca === OTRA && !marcasList().includes(marca)) { (cfg.marcasExtra = cfg.marcasExtra || []).push(marca); await saveCfg(); }
  const rec = { id: f.id || uid(), tipo: f.tipo, servicio: unc ? '' : f.servicio.trim(), cuenta: unc ? '' : f.cuenta.trim(), medidor: unc || f.marca === SINMED ? '' : f.medidor.trim(), marca: unc ? '' : marca, lectura: unc || f.marca === SINMED ? null : num(f.lectura), actividad: f.actividad, material: unc ? f.material : '', pertenece: unc ? true : f.pertenece, hallazgo: f.hallazgo, obs: f.obs.trim().toUpperCase(), direccion: f.direccion.trim().toUpperCase(), lat: unc ? f.lat : null, lon: unc ? f.lon : null, prec: unc ? f.prec : null,  cdReal: !unc && f.pertenece === false ? normCd(f.cdReal) : '', capReal: !unc && f.pertenece === false ? f.capReal : '', otReal: !unc && f.pertenece === false ? f.otReal.trim().toUpperCase() : '', tecnico: f.tecnico || cfg.usuario, fecha: f.fecha || stamp(), creado: f.creado || new Date().toISOString(), editado: new Date().toISOString() };
  const i = cd.registros.findIndex(r => r.id === rec.id); if (i >= 0) cd.registros[i] = rec; else cd.registros.push(rec);
  await saveCD(cd);
  toast('✓ Registro guardado'); const back = S.from; S.form = newForm(unc ? 'UNC' : 'CLIENTE'); S._autoI = null; S.from = 'reg'; S.tab = back === 'lista' ? 'lista' : 'reg'; render();
}
function abrirFicha(i) {
  const cd = curCD(), fi = cd.ficha[i], ex = stats(cd).reg.get(i);
  if (ex) return abrirReg(ex.id);
  S.form = newForm('CLIENTE'); S._autoI = null; S.form.servicio = fi.servicio; S.form.cuenta = fi.cuenta; S.form.medidor = fi.medidor; S.from = 'lista'; S.tab = 'reg'; render();
}
function abrirReg(id) { const r = curCD().registros.find(x => x.id === id); if (!r) return; S.form = formFromRec(r); S.form.creado = r.creado; S.form.fecha = r.fecha; S._autoI = null; S.from = 'lista'; S.tab = 'reg'; render(); }

// ---------- GPS ----------
function geoStop(usar) {
  const g = S.geo; if (!g) return; navigator.geolocation.clearWatch(g.w); clearTimeout(g.t); S.geo = null;
  if (g.best && usar) { Object.assign(S.form, { lat: g.best.lat, lon: g.best.lon, prec: g.best.prec }); } else if (usar) toast('No se obtuvo ubicación');
  const el = $('#geo'); if (el) el.innerHTML = geoHTML(S.form); updateDerived();
}
function geoStart() {
  if (S.geo) return geoStop(true);
  if (!navigator.geolocation) return toast('Este dispositivo no tiene GPS');
  const g = S.geo = { best: null, t0: Date.now() };
  g.w = navigator.geolocation.watchPosition(p => { const c = p.coords; if (!g.best || c.accuracy < g.best.prec) g.best = { lat: c.latitude, lon: c.longitude, prec: c.accuracy }; const m = $('#geoMsg'); if (m) { m.classList.remove('hidden'); m.textContent = `Mejor precisión: ${g.best.prec.toFixed(1)} m · ${Math.round((Date.now() - g.t0) / 1000)} s`; } if (g.best.prec <= 5) geoStop(true); },
    e => { toast('GPS: ' + (e.code === 1 ? 'permiso denegado' : 'sin señal')); geoStop(false); }, { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 });
  g.t = setTimeout(() => geoStop(true), 15000);
  const el = $('#geo'); if (el) el.innerHTML = geoHTML(S.form);
}

// ---------- dictado por voz ----------
let REC = null;
function dictar() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition; if (!SR) return toast('Este navegador no permite dictado');
  const btn = $('[data-act="dictar"]'); if (REC) { REC.stop(); return; }
  REC = new SR(); REC.lang = 'es-CO'; REC.interimResults = false; REC.continuous = false; btn.classList.add('rec');
  REC.onresult = e => { const t = [...e.results].map(r => r[0].transcript).join(' ').toUpperCase(); const f = S.form; f.obs = (f.obs ? f.obs.replace(/\s+$/, '') + ' ' : '') + t; const ta = $('[data-f="obs"]'); if (ta) ta.value = f.obs; updateDerived(); };
  REC.onerror = e => toast('Dictado: ' + (e.error === 'not-allowed' ? 'permiso de micrófono denegado' : e.error === 'network' ? 'requiere conexión' : e.error));
  REC.onend = () => { REC = null; const b = $('[data-act="dictar"]'); if (b) b.classList.remove('rec'); };
  REC.start();
}

// ---------- importar Excel / JSON ----------
async function cargarExcel(file) {
  try {
    const wb = await XLSXLite.readXlsx(await file.arrayBuffer()), cds = buildCDs(wb);
    const box = document.createElement('div'); box.className = 'modal'; box.innerHTML = `<div class="box"><h3>Crear CD</h3>${cds.map(c => `<div class="card"><b>${esc(c.id)}</b> · ${esc(c.meta.circuito)}<br>${c.ficha.length} clientes${S.cds[c.id] ? `<div class="note warn">Ya existe: se actualiza la ficha y se conservan sus ${S.cds[c.id].registros.length} registros.</div>` : ''}</div>`).join('')}<div class="row"><button class="btn" id="mNo">Cancelar</button><button class="btn pri" id="mSi">Aceptar</button></div></div>`;
    document.body.appendChild(box); $('#mNo').onclick = () => box.remove();
    $('#mSi').onclick = async () => {
      for (const c of cds) {
        const old = S.cds[c.id], ot = cds.indexOf(c) === 0 ? S.ot0 || '' : '';
        if (old) { old.ficha = c.ficha; old.meta = c.meta; old.balances = c.balances; if (ot) old.ot = ot; S.cds[c.id] = old; } else { c.ot = ot; S.cds[c.id] = c; }
        await saveCD(S.cds[c.id]);
      }
      await saveCfg(); box.remove(); S.ot0 = ''; toast(`✓ ${cds.length} CD listo(s)`); if (cds.length === 1) { S.cur = cds[0].id; S.view = 'cd'; S.tab = 'lista'; S.form = newForm(); } render();
    };
  } catch (e) { toast('No pude leer la ficha: ' + (e.message || e), 5000); }
}
async function cargarJSON(file) {
  try { const j = JSON.parse(await file.text()); if (j.app !== 'GS_VCT' || !j.cd || !j.cd.id) throw new Error('No es un respaldo de GS VCT'); if (S.cds[j.cd.id] && !confirm(`Ya existe el CD ${j.cd.id}. ¿Reemplazarlo con el respaldo?`)) return; S.cds[j.cd.id] = j.cd; await saveCD(j.cd); toast('✓ Respaldo restaurado'); S.view = 'home'; render(); }
  catch (e) { toast('Respaldo inválido: ' + e.message, 4000); }
}

// ---------- eventos ----------
document.addEventListener('click', async ev => {
  const t = ev.target.closest('[data-act],[data-tab],[data-flt],[data-seg] button'); if (!t) return;
  const cd = curCD();
  if (t.dataset.tab) {
    if (S.tab === 'reg' && S.geo) geoStop(false); const k = t.dataset.tab;
    if (k === 'unc') { if (!(S.form && S.form.tipo === 'UNC')) S.form = newForm('UNC'); S.tab = 'reg'; S.from = 'reg'; S._autoI = null; return render(); }
    if (k === 'reg' && S.form && S.form.tipo === 'UNC') { S.form = newForm(); S._autoI = null; }
    S.tab = k; if (k === 'reg') S.from = 'reg'; return render();
  }
  if (t.dataset.flt) { S.flt = t.dataset.flt; return render(); }
  const sg = t.closest('[data-seg]');
  if (sg) {
    const k = sg.dataset.seg, v = t.dataset.v;
    if (k === 'tipo') { const cur = S.form; if (cur.tipo === v) return; const nf = newForm(v); nf.tecnico = cur.tecnico; nf.actividad = cur.actividad; S.form = nf; S._autoI = null; return render(); }
    if (k === 'pertenece') { S.form.pertenece = v === '1'; sg.querySelectorAll('button').forEach(b => { b.classList.toggle('on', b === t); b.classList.toggle('no', b === t && v === '0'); }); return updateDerived(); }
  }
  switch (t.dataset.act) {
    case 'cambiar-usuario': cfg.usuario = ''; await saveCfg(); return render();
    case 'cargar': if (!otOk(S.ot0)) return toast(`La OT debe tener ${OT_LEN} dígitos`); return $('#fx').click();
    case 'home': if (S.geo) geoStop(false); S.view = 'home'; S.cur = null; return render();
    case 'open-cd': S.cur = t.dataset.id; S.view = 'cd'; S.tab = 'lista'; S.q = ''; S.flt = 'todos'; S.form = newForm(); S.from = 'reg'; return render();
    case 'nuevo': S.form = newForm(); S.from = 'reg'; S._autoI = null; S.tab = 'reg'; return render();
    case 'open-ficha': return abrirFicha(+t.dataset.i);
    case 'open-reg': return abrirReg(t.dataset.id);
    case 'cancelar': if (S.geo) geoStop(false); S.form = newForm(S.form.tipo); S._autoI = null; if (S.from === 'lista') { S.tab = 'lista'; S.from = 'reg'; } return render();
    case 'guardar': return guardar();
    case 'borrar-reg': if (confirm('¿Eliminar este registro?')) { cd.registros = cd.registros.filter(r => r.id !== S.form.id); await saveCD(cd); S.form = newForm(); S.tab = 'lista'; toast('Registro eliminado'); render(); } return;
    case 'geo': return geoStart();
    case 'dictar': return dictar();
    case 'hz': return hzAdd(cd, t.dataset.v);
    case 'setup-ok': if (!setupOk(cd)) return toast('Completa placa, capacidad y hallazgos'); cd.setup = true; await saveCD(cd); S.tab = 'lista'; return render();
    case 'xlsx': return exportarExcel(cd, false);
    case 'xlsx-share': return exportarExcel(cd, true);
    case 'json': return exportarJSON(cd);
    case 'del-cd': if (!cd.exportadoEn && !confirm('Este CD no se ha exportado. ¿Eliminarlo de todos modos?')) return; if (confirm(`¿Eliminar el CD ${cd.id} y sus ${cd.registros.length} registros de este dispositivo?`)) { await dbDelCD(cd.id); delete S.cds[cd.id]; S.cur = null; S.view = 'home'; render(); } return;
  }
});
document.addEventListener('input', ev => {
  const el = ev.target, cd = curCD();
  if (el.dataset.ot0 !== undefined) { el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN); S.ot0 = el.value; const b = $('#btnFicha'); if (b) b.disabled = !otOk(S.ot0); return; }
  if (el.dataset.newot !== undefined) { el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN); return; }
  if (el.id === 'q') { S.q = el.value; $('#lst').innerHTML = listHTML(cd); return; }
  if (el.dataset.cdf) { if (el.dataset.cdf === 'ot') el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN); if (el.dataset.cdf === 'placaReal') el.value = el.value.toUpperCase(); cd[el.dataset.cdf] = el.value.trim(); saveCD(cd); const bs0 = $('#btnSetup'); if (bs0) bs0.disabled = !setupOk(cd); if (S.tab === 'reg') updateDerived(); return; }
  const k = el.dataset.f; if (!k || !S.form) return;
  if (k === 'otReal') el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN);
  if (['obs', 'direccion', 'marcaOtra', 'cdReal', 'otReal'].includes(k)) { const p = el.selectionStart; el.value = el.value.toUpperCase(); try { el.setSelectionRange(p, p); } catch { } }
  S.form[k] = el.value; updateDerived();
});
document.addEventListener('change', async ev => {
  const el = ev.target; if (el.dataset.f === 'cdReal' || el.dataset.cdf === 'placaReal' || el.dataset.ro === 'cd') { el.value = normCd(el.value); el.dispatchEvent(new Event('input', { bubbles: true })); } if (el.dataset.usr !== undefined && el.value) { cfg.usuario = el.value; await saveCfg(); S.form = newForm(); return render(); } if (el.id === 'fx' && el.files[0]) { cargarExcel(el.files[0]); el.value = ''; } if (el.id === 'fj' && el.files[0]) { cargarJSON(el.files[0]); el.value = ''; }
  if (el.dataset.hzadd !== undefined && el.value) return hzAdd(curCD(), el.value);
  if (el.dataset.cdf) { const cd = curCD(); cd[el.dataset.cdf] = el.value; saveCD(cd); if (el.dataset.cdf === 'placa') { const pr = $('[data-show="placaReal"]'); if (pr) pr.classList.toggle('hidden', el.value !== PLACA_NO); } const bs = $('#btnSetup'); if (bs) bs.disabled = !setupOk(cd); }
});
window.addEventListener('error', e => toast('Error: ' + e.message, 5000));

// ---------- arranque ----------
(async function init() {
  try {
    await openDB(); const saved = await dbGetKV('cfg'); if (saved) { cfg = Object.assign(defaultCfg(), saved); }
    (await dbAllCD()).forEach(c => S.cds[c.id] = c); 
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist();
  } catch (e) { toast('No pude abrir el almacenamiento local: ' + e.message, 6000); }
  S.form = newForm(); render();
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => { });
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if (S._rl) return; S._rl = 1; if (S.view === 'home') location.reload(); else toast('Hay una versión nueva: se aplica al volver al inicio'); });
})();
