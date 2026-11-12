/* GS VCT — Reporte de novedades Vínculo Cliente – Transformador (PWA offline). Desarrollado por Heidi Díaz */
'use strict';
const VER = '1.10.14';
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
const HZ_CD = ['Sin hallazgos', 'Aislador o boquilla del transformador fisurado, roto o desprendido', 'Borne o conexión con sobrecalentamiento', 'Conductor de puesta a tierra interrumpido o suelto', 'Cortacircuito o protección con daño visible', 'Cortacircuito sin portafusible', 'Cuba del transformador con corrosión visible', 'DPS en mal estado', 'Fuga visible de aceite del transformador', 'Portafusible en mal estado', 'Poste desaplomado (inclinación visible)', 'Puesta a tierra mal instalada o con conexión deficiente', 'Sin DPS', 'Sin sistema de puesta a tierra'];
const PLACAS = ['LA PLACA CORRESPONDE CON EL ROTULO DE LA OT', 'LA PLACA NO CORRESPONDE CON EL ROTULO DE LA OT', 'NO TIENE PLACA VISIBLE'];
const OTRA = 'OTRA (ESCRIBIR)', SINMED = 'SIN MEDIDOR', HOTRO = 'OTRO (DESCRIBIR EN OBSERVACIÓN)';
const LECT_BAJA = 'Lectura menor a la última registrada', SIN_SIS = 'Medidor no registrado en sistema';
const HALLAZGOS = ['Sin hallazgo', LECT_BAJA, SIN_SIS, 'Acometida en mal estado (pérdida técnica)', 'Uso diferente al contratado', 'Cliente mal vinculado', 'Cliente no ubicado / dirección no corresponde', 'Servicio directo (sin medidor)', 'Servicio directo (con medidor)', 'Empalmes o conexiones flojas / sulfatadas', 'Medidor con lectura inconsistente', 'Medidor no registra', 'Display apagado', 'Medidor manipulado o alterado', 'Medidor no corresponde a la cuenta (cruce)', 'Medidor sin sellos / sellos violados', 'Sin acceso a la medida', 'Predio desocupado o demolido', 'Puente o bypass en la medida', 'Servicio suspendido con energía'];
const MATERIALES = ['NO PERDURABLE', 'PERDURABLE'];
const HALLAZGOS_UNC = ['Predio con servicio directo monofásico', 'Predio con servicio directo bifásico', 'Predio con servicio directo trifásico', 'Sin instalación externa', 'Instalación externa no conforme', 'Instalación externa cumple norma técnica', 'Se requiere redes para suministrar a UNC', 'Predio habitable sin servicio directo'];
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
const DR = () => (S._dr && S._dr.cd === S.cur ? S._dr : (S._dr = { cd: S.cur }));
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
const COLS = ['ID_REGISTRO', 'CD', 'OT', 'FECHA_HORA', 'TECNICO', 'TIPO_USUARIO', 'CLASIFICACION', 'NRO_SERVICIO', 'NRO_CUENTA', 'NRO_MEDIDOR', 'MARCA_MEDIDOR', 'LECTURA_ENERGIA_ACTIVA', 'CLASE_SERVICIO', 'MATERIAL_PREDIO', 'DIRECCION', 'LATITUD', 'LONGITUD', 'PRECISION_M', 'HALLAZGO_PERDIDAS', 'OBSERVACION', 'PLACA_TRANSFORMADOR', 'ROTULO_REAL', 'CAPACIDAD_KVA', 'HALLAZGOS_CD', 'CD_CORRECTO', 'KVA_CD_CORRECTO', 'OT_CD_CORRECTO', 'FICHA_MEDIDOR', 'FICHA_MARCA', 'DIFIERE_MEDIDOR', 'CLASE_USO', 'DIFIERE_CLASE'];
const WIDTHS = [14, 11, 14, 19, 22, 13, 30, 14, 12, 14, 14, 12, 16, 16, 34, 12, 12, 10, 40, 40, 40, 16, 12, 50, 14, 12, 14, 14, 14, 10];
function buildSheets(cd) {
  const rows = { 1: [], 2: [], 3: [], 4: [] };
  [...cd.registros].sort((a, b) => a.creado.localeCompare(b.creado)).forEach(r => {
    const m = r.tipo === 'CLIENTE' ? matchFicha(cd, r) : { i: null }, c0 = clasif(cd, r, m); if (c0 == null) return; const c = c0 === 0 ? 2 : c0 === 3 ? (r.tipo === 'UNC' ? 3 : 4) : c0;
    const f = m.i != null ? cd.ficha[m.i] : null;
    const dif = f && f.medidor && r.medidor && idn(f.medidor) !== idn(r.medidor) ? 'SI' : (f ? 'NO' : '');
    rows[c].push([r.id, cd.id, cd.ot || '', r.fecha || '', r.tecnico || '', r.tipo === 'UNC' ? 'UNC' : 'CLIENTE', r.tipo === 'UNC' ? 'USUARIO NO CLIENTE (UNC)' : CL[c0].t, r.servicio || '', r.cuenta || '', r.medidor || '', r.marca || '', num(r.lectura), f ? f.clase || '' : r.actividad || '', r.tipo === 'UNC' ? r.material || '' : '', r.direccion || (f ? f.direccion : ''), r.lat, r.lon, r.prec == null ? null : Math.round(r.prec * 10) / 10, hzList(r).join(' / ') || r.hallazgo || '', r.obs || '', cd.placa || '', cd.placa === PLACA_NO ? cd.placaReal || '' : '', cd.capacidad || '', (cd.hallazgosCD || []).join(' / '), c === 2 ? r.cdReal || '' : '', c === 2 ? r.capReal || '' : '', c === 2 ? r.otReal || '' : '', f ? f.medidor : '', f ? f.marca : '', dif, f ? r.actividad || '' : '', f && f.clase && r.actividad ? (f.clase === r.actividad ? 'NO' : 'SI') : '']);
  });
  const ixCl = ['CLASIFICACION', 'TIPO_USUARIO'].map(c => COLS.indexOf(c)), dc = arr => arr.filter((_, i) => !ixCl.includes(i)).map(v => typeof v === 'string' ? v.toUpperCase() : v);
  const ixU = dc(COLS.slice(0, -5)).map((c, k) => k).filter(k => ['NRO_SERVICIO', 'NRO_CUENTA', 'NRO_MEDIDOR', 'MARCA_MEDIDOR', 'LECTURA_ENERGIA_ACTIVA'].includes(dc(COLS.slice(0, -5))[k])), du = arr => arr.filter((_, k) => !ixU.includes(k));
  const reg5 = stats(cd).reg, dc0 = arr => arr.map(v => typeof v === 'string' ? v.toUpperCase() : v);
  return [
    { name: '1_VINCULADO_CD_FICHA', table: 'tblVinculadoCDFicha', columns: dc(COLS), rows: rows[1].map(dc), widths: dc(WIDTHS) },
    { name: '2_VINCULADO_OTRO_CD', table: 'tblVinculadoOtroCD', columns: dc(COLS), rows: rows[2].map(dc), widths: dc(WIDTHS) },
    { name: '3_UNC', table: 'tblUNC', columns: du(dc(COLS.slice(0, -5))), rows: rows[3].map(r => du(dc(r.slice(0, -5)))), widths: du(dc(WIDTHS.slice(0, -5))) },
    { name: '4_PARA_VINCULAR', table: 'tblParaVincular', columns: dc(COLS.slice(0, -5)), rows: rows[4].map(r => dc(r.slice(0, -5))), widths: dc(WIDTHS.slice(0, -5)) },
    { name: '5_FICHA_NO_VERIFICADA', table: 'tblFichaNoVerificada', columns: ['CD', 'OT', 'NRO_SERVICIO', 'NRO_CUENTA', 'NRO_MEDIDOR', 'MARCA_MEDIDOR', 'CLASE_SERVICIO', 'DIRECCION', 'LATITUD', 'LONGITUD', 'ULTIMA_LECTURA', 'PERIODO_ULTIMA_LECTURA', 'CARGA_AFORADA', 'FACTURACION', 'CONTROL_EN_FICHA', 'REINCIDENCIAS', 'ENERGIA_IMPUTADA_KWH'],
      rows: cd.ficha.map((x, i) => reg5.has(i) ? null : [cd.id, cd.ot || '', x.servicio || '', x.cuenta || '', x.medidor || '', x.marca || '', x.clase || '', x.direccion || '', x.lat, x.lon, x.ultimaLectura, x.periodoUlt || '', x.carga, x.facturacion || '', x.cosecha || '', x.reinc || 0, x.imputada || 0]).filter(Boolean).map(dc0),
      widths: [11, 12, 14, 12, 14, 13, 16, 34, 12, 12, 14, 14, 13, 14, 22, 13, 14] }
  ];
}
const mkBlob = (data, type) => new Blob([data], { type });
const XLSX_MIME = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
function download(blob, name) { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 4000); }
const NATIVE = !!(window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform());
async function entregarNativo(blob, name) {
  const P = window.Capacitor.Plugins, b64 = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1]); r.onerror = no; r.readAsDataURL(blob); });
  const w = await P.Filesystem.writeFile({ path: name, data: b64, directory: 'CACHE' });
  try { await P.Share.share({ title: name, url: w.uri, dialogTitle: 'Guardar o enviar ' + name }); return true; } catch (e) { return false; }
}
async function entregar(blob, name, compartir) {
  if (NATIVE) return entregarNativo(blob, name);
  if (compartir && navigator.canShare) { const f = new File([blob], name, { type: blob.type }); if (navigator.canShare({ files: [f] })) { try { await navigator.share({ files: [f], title: name }); return true; } catch (e) { if (e.name === 'AbortError') return false; } } }
  download(blob, name); return true;
}
const baseName = cd => `${cd.id}_${today()}`;
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
const alfa = list => { const fin = o => o === OTRA || o === SINMED || o === HOTRO; return list.filter(o => o === 'Sin hallazgo').concat([...list.filter(o => !fin(o) && o !== 'Sin hallazgo')].sort((x, y) => String(x).localeCompare(String(y), 'es', { numeric: true, sensitivity: 'base' }))).concat(list.filter(fin)); };
const opts = (list, sel, ph) => (ph != null ? `<option value="">${esc(ph)}</option>` : '') + alfa(list).map(o => `<option value="${esc(o)}"${o === sel ? ' selected' : ''}>${esc(o)}</option>`).join('');
const ICO = { rows: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 9h8M8 13h8M8 17h5"/>', home: '<path d="M4 11l8-7 8 7v9H4z"/><path d="M10 20v-5h4v5"/>', back: '<path d="M15 5l-7 7 7 7"/>', list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>', plus: '<circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/>', pin: '<path d="M12 21s7-6.2 7-11a7 7 0 10-14 0c0 4.8 7 11 7 11z"/><circle cx="12" cy="10" r="2.5"/>', sum: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 15v-3M12 15V9M16 15v-5"/>', user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4.4 3.6-7 8-7s8 2.6 8 7"/>', mic: '<rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/>' };
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
  return `<header class="cdh"><button class="ib" data-act="${cd.setup && !S.edSetup ? 'setup' : 'home'}" aria-label="Volver">${ic('back')}</button><div class="brand"><div><h1>${esc(cd.id)}</h1><small>${esc(corto(cfg.usuario))} · ${esc(cd.meta.circuito)}${cd.meta.potencia ? ' · ' + cd.meta.potencia + ' kVA' : ''}${cd.meta.tipoRed ? ' · ' + esc(cd.meta.tipoRed) : ''}</small></div></div><div class="prog">${st.visit}/${st.total}</div></header>`;
}
function nav() {
  if (S.view !== 'cd' || !curCD() || !curCD().setup || S.edSetup) return '';
  const isU = S.form && S.form.tipo === 'UNC', t = [['lista', ic('list'), 'Ficha'], ['reg', ic('plus'), 'Otros clientes'], ['unc', ic('home'), 'UNC'], ['regs', ic('rows'), 'Registros'], ['res', ic('sum'), 'Resumen']];
  const fromL = S.tab === 'reg' && S.from === 'lista' && !isU, fromR = S.tab === 'reg' && S.from === 'regs', on = k => k === 'reg' ? S.tab === 'reg' && !isU && !fromL && !fromR : k === 'unc' ? S.tab === 'reg' && isU && !fromR : k === 'lista' ? S.tab === 'lista' || fromL : k === 'regs' ? S.tab === 'regs' || fromR : S.tab === k;
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
  const mx = Math.max(0.3, ...vals.filter(ok).map(b => b.indice));
  const bars = vals.map(b => {
    const good = ok(b), w = good ? Math.max(1.5, b.indice / mx * 100) : 0;
    return `<div class="hb${b === last ? ' cur' : ''}"><span class="hl">${per(b.periodo)}</span><div class="ht"><i style="width:${w.toFixed(1)}%"></i></div><b class="hv">${good ? fmt(b.indice * 100, 1) + ' %' : '⚠'}</b></div>`;
  }).join('');
  const delta = last && prev ? (last.indice - prev.indice) * 100 : null;
  const tabla = `<details class="det"><summary>Ver tabla</summary><table class="tb"><tr><th>Periodo</th><th>Entradas</th><th>Salidas</th><th>Pérdidas</th><th>Índice</th></tr>${[...all].reverse().map(b => `<tr><td>${esc(b.periodo)}</td><td>${fmt(b.entradas)}</td><td>${fmt(b.salidas)}</td><td>${fmt(b.perdidas)}</td><td style="font-weight:700">${b.indice == null ? '—' : fmt(b.indice * 100, 1) + ' %'}${ok(b) ? '' : ' ⚠'}</td></tr>`).join('')}</table></details>`;
  return `<div class="card dash"><h2>Balance del transformador${last ? ` <span class="sub">· ${per(last.periodo)}</span>` : ''}</h2>
    ${last ? `<div class="kpis"><div class="kpi big"><b style="color:var(--tx)">${fmt(last.indice * 100, 1)} %</b><span>Índice de pérdidas${delta != null ? `<br><i class="${delta > 0 ? 'up' : 'dn'}">${delta > 0 ? '▲' : '▼'} ${fmt(Math.abs(delta), 1)} pts vs ${per(prev.periodo)}</i>` : ''}</span></div><div class="kpi"><b>${fmt(last.perdidas)}</b><span>Pérdidas kWh</span></div><div class="kpi"><b>${fmt(last.entradas)}</b><span>Entradas kWh</span></div></div>` : ''}
    <div class="hbs" role="img" aria-label="Índice de pérdidas por periodo">${bars}</div>
    ${tabla}</div>`;
}
function viewLista(cd) {
  const s = stats(cd), fl = S.flt;
  const fuera = cd.registros.filter(r => r.tipo === 'UNC' || matchFicha(cd, r).i == null).length;
  const ch = [['todos', 'Todos ' + (s.pend + fuera)], ['pend', 'Pendientes ' + s.pend], ['reg', 'Registrados ' + s.n], ['fuera', 'Fuera de ficha ' + fuera]];
  return `<div class="row" style="margin-bottom:6px;flex-wrap:nowrap"><input type="search" id="q" placeholder="Buscar servicio, cuenta, medidor…" value="${esc(S.q)}"><select id="ord" style="flex:0 0 auto;width:auto" aria-label="Ordenar">${[['cerca', 'Cercanía'], ['dir', 'Dirección'], ['ficha', 'Ficha']].map(([k, l]) => `<option value="${k}"${(S.ord || 'dir') === k ? ' selected' : ''}>${l}</option>`).join('')}</select></div>
    <div class="chips">${ch.map(([k, l]) => `<button class="chip ${fl === k ? 'on' : ''}" data-flt="${k}">${l}</button>`).join('')}</div>
    <div id="lst">${listHTML(cd)}</div>${FOOT}`;
}
function hav(a, b) { const R = 6371000, r = Math.PI / 180, dLa = (b.lat - a.lat) * r, dLo = (b.lon - a.lon) * r, h = Math.sin(dLa / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLo / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); }
function listHTML(cd) {
  const s = stats(cd), q = S.q.trim().toLowerCase(), items = [];
  cd.ficha.forEach((f, i) => items.push({ f, i, r: s.reg.get(i) }));
  cd.registros.forEach(r => { if (r.tipo === 'UNC' || matchFicha(cd, r).i == null) items.push({ r, extra: true }); });
  const ord = S.ord || 'dir', dist = it => { const x = it.f || it.r; return S.gps && x && x.lat != null && x.lon != null ? hav(S.gps, x) : Infinity; };
  if (ord === 'dir') items.sort((a, b) => String((a.f || a.r).direccion || (a.r && a.r.direccion) || '').localeCompare(String((b.f || b.r).direccion || (b.r && b.r.direccion) || ''), 'es', { numeric: true, sensitivity: 'base' }));
  else if (ord === 'cerca' && S.gps) items.sort((a, b) => dist(a) - dist(b));
  const out = items.filter(it => {
    if (S.flt === 'todos' && !it.extra && it.r) return false; if (S.flt === 'pend' && (it.extra || it.r)) return false; if (S.flt === 'reg' && !it.r) return false; if (S.flt === 'fuera' && !it.extra) return false;
    if (!q) return true; const x = it.f || it.r; return [x.servicio, x.cuenta, x.medidor, x.direccion, it.r && it.r.direccion].some(v => String(v || '').toLowerCase().includes(q));
  });
  if (!out.length) return '<div class="note">No hay resultados.</div>';
  return out.slice(0, 400).map(it => {
    const x = it.f || it.r, c = it.r ? clasif(cd, it.r) : null;
    const chip = it.r ? (it.r.tipo === 'UNC' ? badge('unc', 'UNC') : badge(CL[c] ? CL[c].c : 'none', c === 1 ? 'Del circuito ✓' : c === 2 || c === 0 ? (otOk(it.r.otReal) ? 'Otro circuito ✓' : 'Otro circuito · falta OT') : c === 3 ? 'No en ficha' : 'Sin clasificar')) : badge('pend', 'Pendiente');
    const unc = it.r && it.r.tipo === 'UNC', rr = it.r || {};
    const med = rr.medidor || x.medidor, marca = rr.marca || x.marca;
    const title = unc ? 'Usuario no cliente' : `Med. ${esc(med || '—')}`;
    const dir = x.direccion || rr.direccion || '';
    const extra = it.f && (it.f.cosecha || !it.f.medidor) ? `<span style="color:var(--warn)">${esc(it.f.cosecha || 'Sin medidor en ficha')}</span>` : '';
    const hz = hzList(rr).length ? '⚠ ' + esc(hzList(rr).join(' / ')) : '';
    const clase = it.f && it.f.clase ? it.f.clase.charAt(0) + it.f.clase.slice(1).toLowerCase() : '';
    const l1 = unc ? '' : [marca ? esc(marca) : '', clase ? esc(clase) : '', extra, hz].filter(Boolean).join(' · ');
    const l2 = unc ? hz : `Serv. ${esc(x.servicio || '—')} · Cta. ${esc(x.cuenta || '—')}`;
    const key = it.extra ? 'r' + it.r.id : 'f' + it.i;
    return `<button class="it${S.hl === key ? ' sel' : ''}" ${it.extra ? `data-act="open-reg" data-id="${esc(it.r.id)}"` : `data-act="open-ficha" data-i="${it.i}"`}><div class="t"><span>${title}</span>${chip}</div>${l1 ? `<div class="s">${l1}</div>` : ''}${l2 ? `<div class="s">${l2}</div>` : ''}<div class="s">${esc(dir) || 'Sin dirección'}${S.ord === 'cerca' && S.gps && it.f && it.f.lat != null ? ` · <b>${(d => d < 1000 ? Math.round(d) + ' m' : (d / 1000).toFixed(1).replace('.', ',') + ' km')(hav(S.gps, it.f))}</b>` : ''}</div></button>`;
  }).join('') + (out.length > 400 ? '<div class="note">Mostrando 400; usa el buscador para acotar.</div>' : '');
}

function newForm(tipo = 'CLIENTE') { return { id: null, tipo, servicio: '', cuenta: '', medidor: '', marca: '', marcaOtra: '', lectura: '', actividad: '', pertenece: null, hallazgo: tipo === 'UNC' ? '' : 'Sin hallazgo', obs: '', sinSis: false, direccion: '', lat: null, lon: null, prec: null, tecnico: cfg.usuario || '', cdReal: '', otReal: '', capReal: '', material: '' }; }
function formFromRec(r) {
  const f = Object.assign(newForm(r.tipo), JSON.parse(JSON.stringify(r)));
  const lista = [...marcasList(), SINMED]; f.marcaOtra = ''; if (f.marca && !lista.includes(f.marca)) { f.marcaOtra = f.marca; f.marca = OTRA; }
  f.lectura = r.lectura == null ? '' : String(r.lectura); return f;
}
function viewReg(cd) {
  const f = S.form || (S.form = newForm()), unc = f.tipo === 'UNC';
  const m0 = unc ? { i: null } : matchFicha(cd, f);
  const cli = `<div class="fld ${m0.i != null ? 'hidden' : ''}" data-show="sinsis"><button type="button" class="btn full${f.sinSis ? ' sel' : ''}" id="btnSinSis" data-act="sinsis" aria-pressed="${!!f.sinSis}">${f.sinSis ? '✓ ' : ''}${SIN_SIS}</button></div>
      <div class="fld ${f.sinSis ? 'hidden' : ''}" data-show="svc"><label class="req">N° de servicio eléctrico</label><input type="text" inputmode="numeric" data-f="servicio" value="${esc(f.servicio)}" autocomplete="off"></div>
      <div class="fld ${f.sinSis ? 'hidden' : ''}" data-show="svc"><label class="req">N° de cuenta</label><input type="text" inputmode="numeric" data-f="cuenta" value="${esc(f.cuenta)}" autocomplete="off"></div>
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
    <div class="fld"><label class="req" id="lblAct">${unc || m0.i == null ? 'Clase de servicio' : 'Clase de uso'}</label><select data-f="actividad">${opts(ACTIVIDADES, f.actividad, 'Selecciona…')}</select></div>
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
  return `<div class="gcard"><div class="ghead"><div class="gpin">${ic('pin')}</div><div class="gcopy"><b>${has ? 'Ubicación capturada' : cap ? 'Buscando señal…' : 'Ubicación pendiente'}</b><small id="geoMsg">${cap ? 'Quédate quieto, al aire libre si puedes.' : has ? 'Precisión recomendada ≤ 12 m' : 'Coordenadas no capturadas.'}</small></div><span class="gbadge ${bd[1]}">${bd[0]}</span></div>
    <div class="gmap"><div class="gring${cap ? ' pulse' : ''}${has && !good ? ' mid' : ''}" style="width:${ring}px;height:${ring}px"><i></i></div></div></div>
    <div class="grid2"><div class="fld"><label>Latitud</label><input type="text" readonly value="${has ? f.lat.toFixed(7) : ''}" placeholder="GPS"></div><div class="fld"><label>Longitud</label><input type="text" readonly value="${has ? f.lon.toFixed(7) : ''}" placeholder="GPS"></div></div>
    <div class="fld"><label>Precisión (m)</label><input type="text" readonly value="${p == null ? '' : p.toFixed(1)}" placeholder="GPS"></div>
    <button class="btn ter full" data-act="geo">${ic('pin')}${cap ? 'Detener y usar la mejor' : has ? 'Capturar de nuevo' : 'Capturar ubicación'}</button>`;
}

// resumen ---------------------------------------------------
function setupOk(cd) { return !!(otOk(cd.ot) && cd.placa && (cd.placa !== PLACA_NO || (cd.placaReal || '').trim()) && cd.capacidad && cd.hallazgosCD && cd.hallazgosCD.length); }
function hzHTML(cd) {
  const sel = cd.hallazgosCD || [], rest = alfa(HZ_CD.filter(h => h !== 'Sin hallazgos'));
  const lista = ['Sin hallazgos', ...rest];
  const txt = !sel.length ? 'Selecciona…' : sel.length === 1 ? sel[0] : `${sel.length} hallazgos seleccionados`;
  return `<details class="ms"${S.hzOpen ? ' open' : ''}><summary><span>${esc(txt)}</span></summary>
    <div class="msl">${lista.map(h => `<button type="button" class="mso${sel.includes(h) ? ' on' : ''}" data-act="hz" data-v="${esc(h)}"><i></i><span>${esc(h)}</span></button>`).join('')}</div></details>`;
}
function hzAdd(cd, v) {
  let a = cd.hallazgosCD = cd.hallazgosCD || [];
  const i = a.indexOf(v);
  if (i >= 0) a.splice(i, 1);
  else if (v === 'Sin hallazgos') a.length = 0, a.push(v);
  else { const k = a.indexOf('Sin hallazgos'); if (k >= 0) a.splice(k, 1); a.push(v); }
  if (!a.length) a.push('Sin hallazgos');
  S.hzOpen = true;
  return saveCD(cd).then(() => { const b = $('#hzbox'); if (b) b.innerHTML = hzHTML(cd); const bs = $('#btnSetup'); if (bs) bs.disabled = !setupOk(cd); });
}
function cdFields(cd) {
  if (!cd.setup && !(cd.hallazgosCD || []).length) cd.hallazgosCD = ['Sin hallazgos'];
  if (!cd.capacidad && cd.meta.potencia != null && KVA.includes(String(cd.meta.potencia))) cd.capacidad = String(cd.meta.potencia);
  return `<div class="fld"><label class="req">Verificación de la placa</label><select data-cdf="placa">${opts(PLACAS, cd.placa, 'Selecciona…')}</select></div>
    <div class="fld${cd.placa === PLACA_NO ? '' : ' hidden'}" data-show="placaReal"><label class="req">Rótulo real del transformador</label><input type="text" data-cdf="placaReal" value="${esc(cd.placaReal || '')}" placeholder="XXXXTRX" style="text-transform:uppercase" autocomplete="off"></div>
    <div class="fld"><label class="req">Capacidad</label><select data-cdf="capacidad">${opts(KVA, cd.capacidad, 'Selecciona…').replace(/>(\d[\d.]*)<\/option>/g, '>$1 kVA</option>')}</select></div>
    <div class="fld"><label class="req">Hallazgos del CD</label><div id="hzbox">${hzHTML(cd)}</div></div>`;
}
function viewSetup(cd) {
  return `<div class="card"><h2>Datos del CD ${esc(cd.id)}</h2>${cd.setup ? '' : `<div class="fld"><label class="req">N° de OT</label><input type="text" ${otAtt} data-cdf="ot" value="${esc(cd.ot)}" autocomplete="off"></div>`}${cdFields(cd)}<button class="btn pri full" id="btnSetup" data-act="setup-ok"${setupOk(cd) ? '' : ' disabled'}>Continuar</button></div>${balanceHTML(cd)}${FOOT}`;
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

// ---------- observaciones para el acta (Forcebeat) ----------
const hzList = r => { const a = []; if (r.hallazgo && r.hallazgo !== 'Sin hallazgo') a.push(r.hallazgo); if (r.lectBaja && !a.includes(LECT_BAJA)) a.push(LECT_BAJA); if (r.sinSis && !a.includes(SIN_SIS)) a.push(SIN_SIS); return a; };
const U = v => String(v ?? '').trim().replace(/\s+/g, ' ').toUpperCase();
function resumenHz(rs) {
  const m = new Map(); rs.forEach(r => hzList(r).forEach(x => { const h = U(x); if (h) m.set(h, (m.get(h) || 0) + 1); }));
  return [...m].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], 'es')).map(([h, n]) => `${n} ${h}`).join('; ');
}
function buildObs(cd) {
  const out = [], regs = cd.registros.map(r => { const m = r.tipo === 'CLIENTE' ? matchFicha(cd, r) : { i: null }; return { r, m, c: clasif(cd, r, m), f: m.i != null ? cd.ficha[m.i] : null }; });
  const st = stats(cd), otros = regs.filter(x => x.c === 2 || x.c === 0), grupos = new Map();
  otros.forEach(x => { const cdr = normCd(x.r.cdReal) || 'SIN CD', k = cdr + '|' + (x.r.otReal || ''); if (!grupos.has(k)) grupos.set(k, { cd: cdr, ot: x.r.otReal || '', xs: [] }); grupos.get(k).xs.push(x); });
  const cdOt = [...grupos.values()].map(g => `${g.ot || 'OT PENDIENTE'} (CD ${g.cd})`);
  // orden inicial
  const cli = regs.filter(x => x.r.tipo === 'CLIENTE' && (x.c === 1 || x.c === 3 || x.c === 2 || x.c === 0)), unc = regs.filter(x => x.r.tipo === 'UNC');
  const dif = regs.filter(x => x.f && x.f.clase && x.r.actividad && U(x.f.clase) !== U(x.r.actividad)).length;
  const hzt = (cd.hallazgosCD || []).map(U).filter(h => h && h !== 'SIN HALLAZGOS');
  const placaTxt = cd.placa === PLACA_NO ? `LA PLACA NO CORRESPONDE CON EL RÓTULO DE LA OT${cd.placaReal ? ' (RÓTULO REAL: ' + U(cd.placaReal) + ')' : ''}` : cd.placa === PLACAS[2] ? 'EL TRANSFORMADOR NO TIENE PLACA VISIBLE' : cd.placa ? 'LA PLACA CORRESPONDE CON EL RÓTULO DE LA OT' : '';
  const p = [`INST.BT.BARR.VCT ORDEN PARA VINCULACIÓN DE CUENTAS AL CD: ${cd.id}, EJECUTAR ACTUALIZACIÓN DEL VÍNCULO CLIENTE-TRANSFORMADOR Y ACTUALIZACIÓN DE ACTIVIDAD ECONÓMICA DE CLIENTES DE ACUERDO CON FICHA ENTREGADA.`,
    placaTxt ? placaTxt + '.' : '', cd.capacidad ? `CAPACIDAD DEL TRANSFORMADOR: ${cd.capacidad} kVA.` : '',
    hzt.length ? `HALLAZGOS DEL TRANSFORMADOR: ${hzt.join(', ')}.` : 'SIN HALLAZGOS EN EL TRANSFORMADOR.',
    `SE VERIFICAN ${st.visit} DE ${st.total} CLIENTES DE LA FICHA${st.pend ? ` (${st.pend} SIN VISITAR)` : ''}.`,
    st.t1 ? `${st.t1} CLIENTE${st.t1 > 1 ? 'S' : ''} DE LA FICHA SE CONFIRMA${st.t1 > 1 ? 'N' : ''} VINCULADO${st.t1 > 1 ? 'S' : ''} A ESTE CD.` : '',
    otros.length ? `SE REQUIERE ACTUALIZAR EL VÍNCULO DE ${otros.length} CLIENTE${otros.length > 1 ? 'S' : ''} VINCULADO${otros.length > 1 ? 'S' : ''} EN TERRENO A OTRO${otros.length > 1 ? 'S' : ''} CD: ${[...grupos.values()].reduce((a, g) => { const e = a.find(y => y.cd === g.cd); if (e) e.n += g.xs.length; else a.push({ cd: g.cd, n: g.xs.length }); return a; }, []).map(y => `${y.n} A CD ${y.cd}`).join(', ')}.` : '',
    st.t4 ? `SE REGISTRA${st.t4 > 1 ? 'N' : ''} ${st.t4} CLIENTE${st.t4 > 1 ? 'S' : ''} NO INCLUIDO${st.t4 > 1 ? 'S' : ''} EN FICHA, VINCULADO${st.t4 > 1 ? 'S' : ''} A ESTE CD.` : '',
    dif ? `${dif} CLIENTE${dif > 1 ? 'S' : ''} CON CLASE DE USO DIFERENTE A LA CLASE DE SERVICIO DE LA FICHA.` : '',
    resumenHz(cli.map(x => x.r)) ? `HALLAZGOS EN CLIENTES: ${resumenHz(cli.map(x => x.r))}.` : (cli.length ? 'SIN HALLAZGOS TÉCNICOS EN LOS CLIENTES VERIFICADOS.' : ''),
    unc.length ? `SE HALLA${unc.length > 1 ? 'N' : ''} ${unc.length} USUARIO${unc.length > 1 ? 'S' : ''} NO CLIENTE${unc.length > 1 ? 'S' : ''} (UNC)${resumenHz(unc.map(x => x.r)) ? ': ' + resumenHz(unc.map(x => x.r)) : ''}.` : 'NO SE HALLAN UNC.',
    cdOt.length ? `ÓRDENES ADICIONALES: ${cdOt.join(', ')}.` : ''].filter(Boolean).join(' ');
  out.push({ key: 'main', ot: cd.ot, titulo: 'Orden inicial', texto: p });
  [...grupos.values()].sort((a, b) => (a.ot || 'Z').localeCompare(b.ot || 'Z') || a.cd.localeCompare(b.cd)).forEach(g => {
    const n = g.xs.length, pl = n > 1, hz = resumenHz(g.xs.map(x => x.r)), svs = g.xs.map(x => x.r.servicio).filter(Boolean), cap = g.xs.map(x => x.r.capReal).find(Boolean);
    const t = [`INSP. ORDEN ADICIONAL PARA ACTUALIZACIÓN DE VÍNCULO DERIVADA DE LA ORDEN ${cd.ot || '—'} DEL CD ${cd.id}.`,
      `SE HALLA${pl ? 'N' : ''} ${n} SE (SERVICIO${pl ? 'S' : ''} ELÉCTRICO${pl ? 'S' : ''}) VINCULADO${pl ? 'S' : ''} EN TERRENO A CD ${g.cd}.`,
      svs.length ? `SE: ${svs.join(', ')}.` : '', cap ? `CAPACIDAD DEL CD: ${U(cap)}.` : '',
      hz ? `SE OBSERVAN HALLAZGOS: ${hz}.` : 'NO SE OBSERVAN HALLAZGOS.'].filter(Boolean).join(' ');
    out.push({ key: 'ot|' + g.cd + '|' + g.ot, ot: g.ot, titulo: `CD ${g.cd}`, texto: t });
  });
  return out;
}
function obsHTML(cd) {
  const ed = cd.obsEd || {};
  return buildObs(cd).map(b => { const v = ed[b.key] != null ? ed[b.key] : b.texto;
    return `<div class="obs"><div class="obh"><div><b>${b.ot ? 'OT ' + esc(b.ot) : 'OT pendiente'}</b><span>${esc(b.titulo)}</span></div><div class="row" style="flex:0 0 auto;flex-wrap:nowrap;gap:6px">${ed[b.key] != null ? `<button class="btn sm" data-act="obs-reset" data-k="${esc(b.key)}">Restablecer</button>` : ''}<button class="btn pri sm" data-act="obs-copy" data-k="${esc(b.key)}">Copiar</button></div></div><textarea class="obt" rows="7" data-obs="${esc(b.key)}" spellcheck="true">${esc(v)}</textarea></div>`; }).join('');
}
async function copiarTxt(txt) {
  try { await navigator.clipboard.writeText(txt); return true; } catch { try { const t = document.createElement('textarea'); t.value = txt; document.body.appendChild(t); t.select(); const ok = document.execCommand('copy'); t.remove(); return ok; } catch { return false; } }
}
// ---------- registros ----------
function viewRegs(cd) {
  const f = S.rf || 'todos', items = cd.registros.map(r => { const m = r.tipo === 'CLIENTE' ? matchFicha(cd, r) : { i: null }; return { r, m, c: clasif(cd, r, m), x: m.i != null ? cd.ficha[m.i] : null }; }).sort((a, b) => String(b.r.creado).localeCompare(String(a.r.creado)));
  const k = it => it.r.tipo === 'UNC' ? 'unc' : it.c === 1 ? 'este' : (it.c === 2 || it.c === 0) ? 'otro' : 'sin';
  const cnt = key => items.filter(it => key === 'todos' || k(it) === key).length;
  const ch = [['todos', 'Todos'], ['este', 'De este CD'], ['otro', 'De otro CD'], ['unc', 'UNC'], ['sin', 'No en ficha']];
  const lst = items.filter(it => f === 'todos' || k(it) === f);
  const card = it => { const r = it.r, unc = r.tipo === 'UNC', c = it.c;
    const chip = unc ? badge('unc', 'UNC') : badge(CL[c] ? CL[c].c : 'none', c === 1 ? 'Del circuito ✓' : c === 2 || c === 0 ? (otOk(r.otReal) ? 'Otro circuito ✓' : 'Otro circuito · falta OT') : c === 3 ? 'No en ficha' : 'Sin clasificar');
    const l1 = unc ? '' : [r.marca, r.actividad ? r.actividad.charAt(0) + r.actividad.slice(1).toLowerCase() : ''].filter(Boolean).map(esc).join(' · ');
    const hz = hzList(r).length ? '⚠ ' + esc(hzList(r).join(' / ')) : esc(r.hallazgo || '');
    const l2 = unc ? esc(r.material ? r.material.charAt(0) + r.material.slice(1).toLowerCase() : '') : `Serv. ${esc(r.servicio || '—')} · Cta. ${esc(r.cuenta || '—')}`;
    const dir = r.direccion || (it.x && it.x.direccion) || '';
    const otro = (c === 2 || c === 0) && r.cdReal ? `CD ${esc(normCd(r.cdReal))}${r.otReal ? ' · OT ' + esc(r.otReal) : ''}` : '';
    return `<button class="it" data-act="open-reg2" data-id="${esc(r.id)}"><div class="t"><span>${unc ? 'Usuario no cliente' : 'Med. ' + esc(r.medidor || (it.x && it.x.medidor) || '—')}</span>${chip}</div>${l1 ? `<div class="s">${l1}</div>` : ''}<div class="s">${l2}</div><div class="s">${esc(dir) || 'Sin dirección'}</div>${otro ? `<div class="s">${otro}</div>` : ''}${hz ? `<div class="s">${hz}</div>` : ''}</button>`; };
  return `<div class="chips" style="margin-top:0">${ch.map(([key, l]) => `<button class="chip ${f === key ? 'on' : ''}" data-rf="${key}">${l} ${cnt(key)}</button>`).join('')}</div>${lst.length ? lst.map(card).join('') : '<div class="note">Aún no hay registros.</div>'}${FOOT}`;
}
function viewRes(cd) {
  const s = stats(cd), warns = [];
  if (!otOk(cd.ot)) warns.push(`La OT del CD debe tener ${OT_LEN} dígitos.`); if (!setupOk(cd)) warns.push('Faltan datos del CD (placa, capacidad o hallazgos).');
  const sinOT = cd.registros.filter(r => [0, 2].includes(clasif(cd, r)) && !otOk(r.otReal)).length; if (sinOT) warns.push(`${sinOT} cliente(s) de otro circuito sin OT: se piden al exportar.`);
  if (s.pend) warns.push(`Quedan ${s.pend} clientes de la ficha sin registrar.`);
  return `
    <div class="card"><h2>Avance</h2><div class="kpis"><div class="kpi"><b>${s.visit}/${s.total}</b><span>Ficha visitada</span></div><div class="kpi"><b>${s.pend}</b><span>Pendientes</span></div></div>
    <div class="kpis k2" style="margin-top:10px"><div class="kpi"><b style="color:var(--ok)">${s.t1}</b><span>En ficha, de este CD</span></div><div class="kpi"><b style="color:var(--bad)">${s.t2}</b><span>En ficha, de otro CD</span></div><div class="kpi"><b style="color:var(--new)">${s.t3}</b><span>UNC</span></div><div class="kpi"><b style="color:var(--new)">${s.t4}</b><span>No en ficha, vinculados</span></div></div>
    ${warns.map(w => `<div class="note warn">${esc(w)}</div>`).join('')}</div>
    <div class="card"><h2>Observaciones para el acta</h2><div id="obsbox">${obsHTML(cd)}</div><button class="btn full" data-act="obs-all" style="margin-top:6px">Copiar todas</button></div>
    <div class="card"><h2>Exportar</h2><div class="row"><button class="btn pri" data-act="xlsx">Exportar Excel</button><button class="btn" data-act="xlsx-share">Compartir</button></div>
    <div class="row" style="margin-top:8px"><button class="btn" data-act="json">Respaldo</button><button class="btn bad" data-act="del-cd">Eliminar CD</button></div>
    <p style="font-size:12px;color:var(--mut)">${cd.exportadoEn ? 'Última exportación: ' + esc(stamp(new Date(cd.exportadoEn))) : 'Aún no exportado.'}</p></div>
    ${FOOT}`;
}

// ajustes ---------------------------------------------------
// ---------- render ----------
function render() {
  const cd = curCD(); let body = '';
  if (S.view === 'home') body = viewHome();
  else if (cd && (!cd.setup || S.edSetup)) body = viewSetup(cd);
  else if (cd) body = S.tab === 'lista' ? viewLista(cd) : S.tab === 'reg' ? viewReg(cd) : S.tab === 'regs' ? viewRegs(cd) : viewRes(cd);
  const key = S.view + ':' + S.tab + (S.tab === 'reg' && S.form ? S.form.tipo : '') + ':' + (cfg.usuario ? 1 : 0) + ':' + (S.cur || ''), cambio = key !== S._key; S._key = key;
  $('#root').innerHTML = header() + `<main${cambio ? ' class="enter"' : ''}>${body}</main>` + nav();
  if (S.view === 'cd' && S.tab === 'reg' && cd && cd.setup && !S.edSetup) { updateDerived(); }
  window.scrollTo(0, 0);
  if (S.view === 'cd' && S.tab === 'lista') { const el = $('.it.sel'); if (el) el.scrollIntoView({ block: 'center' }); }
}

// ---------- formulario de registro ----------
function marcaFinal(f) { return f.marca === OTRA ? f.marcaOtra.trim().toUpperCase() : f.marca; }
function validar(cd, f, m) {
  const e = [], unc = f.tipo === 'UNC';
  if (!otOk(cd.ot)) e.push(`OT del CD (${OT_LEN} dígitos)`);
  if (!unc) {
    if (!f.sinSis) { if (!f.servicio.trim()) e.push('N° de servicio'); if (!f.cuenta.trim()) e.push('N° de cuenta'); }
    if (!f.marca) e.push('Marca del medidor'); else if (f.marca === OTRA && !f.marcaOtra.trim()) e.push('Escribe la marca');
    if (f.marca !== SINMED) { if (!f.medidor.trim()) e.push('N° de medidor'); if (f.lectura === '' || num(f.lectura) == null) e.push('Lectura de energía activa'); }
    if (f.pertenece == null) e.push('¿Cliente vinculado a este CD? (SÍ / NO)');
    if (f.pertenece === false && f.otReal && !otOk(f.otReal)) e.push(`OT del CD correcto (${OT_LEN} dígitos)`);
  }
  if (!f.actividad) e.push(unc || m.i == null ? 'Clase de servicio' : 'Clase de uso'); if (unc && !f.material) e.push('Tipo de material del predio');
  if (unc) { if (f.lat == null) e.push('Capturar coordenada (obligatoria para UNC)'); }
  if (!f.hallazgo) e.push('Hallazgo técnico'); else if (f.hallazgo === HOTRO && !f.obs.trim()) e.push('Describe el hallazgo en la observación');
  // duplicados
  if (!f.id && !unc) {
    const dup = cd.registros.find(r => r.tipo === 'CLIENTE' && ((idn(f.servicio) && idn(r.servicio) === idn(f.servicio)) || (idn(f.cuenta) && idn(r.cuenta) === idn(f.cuenta)) || (f.sinSis && idn(f.medidor) && idn(r.medidor) === idn(f.medidor)) || (m.i != null && matchFicha(cd, r).i === m.i)));
    if (dup) { S.dup = dup.id; e.push('Este cliente ya está registrado'); } else S.dup = null;
  }
  return e;
}
function setIfEmpty(k, v) { const f = S.form; if (v && !f[k]) { f[k] = v; const el = $(`[data-f="${k}"]`); if (el) el.value = v; } }
function updateDerived() {
  if (!$('#errs')) return;
  const cd = curCD(), f = S.form; if (!cd || !f || S.tab !== 'reg') return;
  const unc = f.tipo === 'UNC'; let m = { i: null };
  if (!unc) m = matchFicha(cd, f);
  if (m.i != null && S._autoI !== m.i && !m.conflict) {
    S._autoI = m.i; const fi = cd.ficha[m.i];
    setIfEmpty('servicio', fi.servicio); setIfEmpty('cuenta', fi.cuenta); setIfEmpty('medidor', fi.medidor); setIfEmpty('direccion', String(fi.direccion || '').toUpperCase());
    if (!f.marca) { const mk = fi.marca; if (!fi.medidor && !mk) f.marca = SINMED; else if (mk && marcasList().includes(mk)) f.marca = mk; else if (mk) { f.marca = OTRA; f.marcaOtra = mk; } const sel = $('[data-f="marca"]'); if (sel) sel.value = f.marca; const ot = $('[data-f="marcaOtra"]'); if (ot) ot.value = f.marcaOtra; }
  }
  if (m.i == null) S._autoI = null;
  // mostrar/ocultar
  const sh = (k, on) => { const el = $(`[data-show="${k}"]`); if (el) el.classList.toggle('hidden', !on); };
  if (m.i != null && f.sinSis) { f.sinSis = false; if (f.hallazgo === SIN_SIS) { f.hallazgo = 'Sin hallazgo'; const hs0 = $('[data-f="hallazgo"]'); if (hs0) hs0.value = f.hallazgo; } }
  sh('pert', m.i != null); sh('sinsis', m.i == null); document.querySelectorAll('[data-show="svc"]').forEach(el => el.classList.toggle('hidden', !!f.sinSis));
  { const hs = $('[data-f="hallazgo"]'); if (f.sinSis && (!f.hallazgo || f.hallazgo === 'Sin hallazgo')) { f.hallazgo = SIN_SIS; if (hs) hs.value = SIN_SIS; } else if (!f.sinSis && f.hallazgo === SIN_SIS) { f.hallazgo = 'Sin hallazgo'; if (hs) hs.value = f.hallazgo; } const bt = $('#btnSinSis'); if (bt) { bt.classList.toggle('sel', !!f.sinSis); bt.textContent = (f.sinSis ? '✓ ' : '') + SIN_SIS; bt.setAttribute('aria-pressed', !!f.sinSis); } }
  if (!unc) { if (m.i == null && f.pertenece !== true) { f.pertenece = true; f._auto = true; } else if (m.i != null && f._auto) { f.pertenece = null; f._auto = false; document.querySelectorAll('[data-seg="pertenece"] button').forEach(b => b.classList.remove('on', 'no')); } }
  sh('otra', f.marca === OTRA); sh('lect', f.marca !== SINMED);
  // tarjeta de coincidencia
  const mc = $('#matchCard'); if (mc) mc.innerHTML = unc ? '' : matchHTML(cd, f, m);
  // clasificación
  const la = $('#lblAct'); if (la && !unc) la.textContent = m.i != null ? 'Clase de uso' : 'Clase de servicio';
  const tt = $('#ttl'); if (tt && !unc) tt.textContent = m.i != null ? 'Cliente' : 'Cliente no registrado en ficha · vinculado a este CD';
  const c = clasif(cd, f, m); const clEl = $('#clasif'); if (clEl) clEl.innerHTML = c == null || (c === 3 && !unc) ? '' : badge(CL[c].c, CL[c].t) + '';
  sh('otro', c === 2 || c === 0);
  // lectura vs última
  const lh = $('#lectHint'); if (lh) { const fi = m.i != null ? cd.ficha[m.i] : null, v = num(f.lectura); const baja = !!(fi && fi.ultimaLectura != null && v != null && v < fi.ultimaLectura);
    { const hs = $('[data-f="hallazgo"]'); if (baja && (!f.hallazgo || f.hallazgo === 'Sin hallazgo')) { f.hallazgo = LECT_BAJA; if (hs) hs.value = LECT_BAJA; } else if (!baja && f.hallazgo === LECT_BAJA) { f.hallazgo = 'Sin hallazgo'; if (hs) hs.value = 'Sin hallazgo'; } } lh.innerHTML = fi && fi.ultimaLectura != null ? `<div class="lect${baja ? ' bad' : ''}"><span>Última lectura en ficha<b>${fmt(fi.ultimaLectura)} kWh</b><em>periodo ${esc(fi.periodoUlt)}</em></span>${baja ? '<strong>Menor a la última: revisa</strong>' : ''}</div>` : ''; }
  // errores
  const errs = validar(cd, f, m); $('#errs').innerHTML = errs.length ? `<div class="note warn"><b>Pendiente:</b> ${errs.map(esc).join(' · ')}${S.dup && errs.includes('Este cliente ya está registrado') ? ` <button class="btn sm" data-act="open-reg" data-id="${esc(S.dup)}">Abrir el existente</button>` : ''}</div>` : '';
  $('#btnSave').disabled = errs.length > 0;
}
function matchHTML(cd, f, m) {
  if (!(f.servicio || f.cuenta || f.medidor)) return '';
  if (m.i == null) { const o = otherCD(cd, f); return `<div class="note">No está en la ficha de ${esc(cd.id)}.${o.length ? ` <b>Aparece en la ficha de ${esc(o.join(', '))}.</b>` : ''}</div>`; }
  const x = cd.ficha[m.i], cons = Object.entries(x.cons || {}).sort((p, q) => p[0].localeCompare(q[0])).map(([k, v]) => `<div class="c"><em>${k.slice(4)}/${k.slice(2, 4)}</em><b>${fmt(v)}</b></div>`).join('');
  return `<div class="fx"><div class="fxh"><span class="fxok">✓ En ficha</span>${x.clase ? `<span class="fxc">Clase de servicio <b>${esc(x.clase)}</b></span>` : ''}${x.carga != null ? `<span class="fxc">Carga aforada <b>${x.carga}</b></span>` : ''}</div>${cons ? `<div class="fxl">Consumos (kWh)</div><div class="cons">${cons}</div>` : ''}</div>` +
    (m.conflict ? '<div class="note err">El servicio, la cuenta y el medidor escritos corresponden a clientes distintos de la ficha. Revísalos.</div>' : '') +
    (x.cosecha ? `<div class="note warn">Control en ficha: ${esc(x.cosecha)}</div>` : '') + (x.reinc ? `<div class="note warn">Reincidencias: ${x.reinc}${x.imputada ? ' · energía imputada ' + fmt(x.imputada) + ' kWh' : ''}</div>` : '') + (!x.medidor ? '<div class="note warn">La ficha no tiene medidor para este cliente.</div>' : '');
}
async function guardar() {
  const cd = curCD(), f = S.form, unc = f.tipo === 'UNC', m = unc ? { i: null } : matchFicha(cd, f), errs = validar(cd, f, m);
  if (errs.length) return toast('Pendiente: ' + errs[0]);
  const marca = unc ? '' : marcaFinal(f); if (marca && f.marca === OTRA && !marcasList().includes(marca)) { (cfg.marcasExtra = cfg.marcasExtra || []).push(marca); await saveCfg(); }
  const rec = { id: f.id || uid(), tipo: f.tipo, servicio: unc || f.sinSis ? '' : f.servicio.trim(), cuenta: unc || f.sinSis ? '' : f.cuenta.trim(), sinSis: !unc && !!f.sinSis, medidor: unc || f.marca === SINMED ? '' : f.medidor.trim(), marca: unc ? '' : marca, lectura: unc || f.marca === SINMED ? null : num(f.lectura), actividad: f.actividad, material: unc ? f.material : '', pertenece: unc ? true : f.pertenece, hallazgo: f.hallazgo, lectBaja: !!(!unc && f.marca !== SINMED && m.i != null && cd.ficha[m.i].ultimaLectura != null && num(f.lectura) != null && num(f.lectura) < cd.ficha[m.i].ultimaLectura), obs: f.obs.trim().toUpperCase(), direccion: f.direccion.trim().toUpperCase(), lat: unc ? f.lat : null, lon: unc ? f.lon : null, prec: unc ? f.prec : null,  cdReal: !unc && f.pertenece === false ? normCd(f.cdReal) : '', capReal: !unc && f.pertenece === false ? f.capReal : '', otReal: !unc && f.pertenece === false ? f.otReal.trim().toUpperCase() : '', tecnico: f.tecnico || cfg.usuario, fecha: f.fecha || stamp(), creado: f.creado || new Date().toISOString(), editado: new Date().toISOString() };
  const i = cd.registros.findIndex(r => r.id === rec.id); if (i >= 0) cd.registros[i] = rec; else cd.registros.push(rec);
  await saveCD(cd);
  toast('✓ Registro guardado'); const back = S.from; S.form = newForm(unc ? 'UNC' : 'CLIENTE'); S._autoI = null; S.from = 'reg'; S.tab = back === 'lista' ? 'lista' : back === 'regs' ? 'regs' : 'reg'; render();
}
function abrirFicha(i) {
  const cd = curCD(), fi = cd.ficha[i], ex = stats(cd).reg.get(i);
  if (ex) return abrirReg(ex.id);
  { const D = DR(), df = D.ficha; if (df && df.form.tipo === 'CLIENTE' && !df.form.id && matchFicha(cd, df.form).i === i) { D.ficha = null; S.form = df.form; S.from = df.from; S._autoI = null; S.tab = 'reg'; return render(); } }
  S.form = newForm('CLIENTE'); S._autoI = null; S.form.servicio = fi.servicio; S.form.cuenta = fi.cuenta; S.form.medidor = fi.medidor; S.from = 'lista'; S.tab = 'reg'; render();
}
function abrirReg(id, from = 'lista') { const r = curCD().registros.find(x => x.id === id); if (!r) return; const D = DR(); if (D.ficha && D.ficha.form.id === id) { const df = D.ficha; D.ficha = null; S.form = df.form; S.from = df.from; S._autoI = null; S.tab = 'reg'; return render(); } S.form = formFromRec(r); S.form.creado = r.creado; S.form.fecha = r.fecha; S._autoI = null; S.from = from; S.tab = 'reg'; render(); }

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
  const t = ev.target.closest('[data-act],[data-tab],[data-flt],[data-rf],[data-seg] button'); if (!t) return;
  if (t.dataset.rf) { S.rf = t.dataset.rf; return render(); }
  const cd = curCD();
  if (t.dataset.tab) {
    if (S.tab === 'reg' && S.geo) geoStop(false); const k = t.dataset.tab, D = DR();
    const keepNo = k === 'reg' && S.tab === 'reg' && S.form && S.from !== 'reg' && S.form.tipo === 'CLIENTE' && S.form.pertenece === false;
    if (S.tab === 'reg' && S.form && !keepNo) { const fm = S.form; if (fm.tipo === 'UNC') D.unc = fm; else if (S.from === 'reg') D.otros = fm; else D.ficha = { form: fm, from: S.from }; }
    if (k === 'unc') { S.form = D.unc || newForm('UNC'); D.unc = null; S.tab = 'reg'; S.from = 'reg'; S._autoI = null; return render(); }
    if (k === 'reg') { if (!keepNo) { S.form = D.otros || newForm(); D.otros = null; } S.tab = 'reg'; S.from = 'reg'; S._autoI = null; return render(); }
    S.tab = k; return render();
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
    case 'home': S._dr = null; if (S.geo) geoStop(false); S.view = 'home'; S.cur = null; S.edSetup = false; return render();
    case 'setup': if (S.geo) geoStop(false); S.edSetup = true; return render();
    case 'open-cd': S.cur = t.dataset.id; S.view = 'cd'; S.tab = 'lista'; S.q = ''; S.flt = 'todos'; S.form = newForm(); S.from = 'reg'; return render();
    case 'nuevo': S.form = newForm(); S.from = 'reg'; S._autoI = null; S.tab = 'reg'; return render();
    case 'open-ficha': S.hl = 'f' + t.dataset.i; return abrirFicha(+t.dataset.i);
    case 'open-reg2': return abrirReg(t.dataset.id, 'regs');
    case 'obs-copy': { const ta = $(`[data-obs="${CSS.escape(t.dataset.k)}"]`); return toast(await copiarTxt(ta ? ta.value : '') ? '✓ Observación copiada' : 'No se pudo copiar'); }
    case 'obs-reset': { delete (cd.obsEd || {})[t.dataset.k]; await saveCD(cd); return render(); }
    case 'obs-all': { const bs = buildObs(cd), ed = cd.obsEd || {}; const txt = bs.map(b => `OT ${b.ot || 'PENDIENTE'}\n${ed[b.key] != null ? ed[b.key] : b.texto}`).join('\n\n'); return toast(await copiarTxt(txt) ? '✓ Observaciones copiadas' : 'No se pudo copiar'); }
    case 'open-reg': S.hl = 'r' + t.dataset.id; return abrirReg(t.dataset.id);
    case 'cancelar': if (S.geo) geoStop(false); S.form = newForm(S.form.tipo); S._autoI = null; if (S.from === 'lista') { S.tab = 'lista'; S.from = 'reg'; } return render();
    case 'guardar': return guardar();
    case 'borrar-reg': if (confirm('¿Eliminar este registro?')) { cd.registros = cd.registros.filter(r => r.id !== S.form.id); await saveCD(cd); const bk = S.from; S.form = newForm(); S.tab = bk === 'regs' ? 'regs' : 'lista'; toast('Registro eliminado'); render(); } return;
    case 'sinsis': { const f = S.form; f.sinSis = !f.sinSis; if (f.sinSis) { f.servicio = ''; f.cuenta = ''; document.querySelectorAll('[data-f="servicio"],[data-f="cuenta"]').forEach(i => i.value = ''); } return updateDerived(); }
    case 'geo': return geoStart();
    case 'dictar': return dictar();
    case 'hz': return hzAdd(cd, t.dataset.v);
    case 'setup-ok': if (!setupOk(cd)) return toast('Completa placa, capacidad y hallazgos'); const prim = !cd.setup; cd.setup = true; S.edSetup = false; await saveCD(cd); if (prim) S.tab = 'lista'; return render();
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
  if (el.dataset.obs) { cd.obsEd = cd.obsEd || {}; cd.obsEd[el.dataset.obs] = el.value; clearTimeout(S._obsT); S._obsT = setTimeout(() => saveCD(cd), 600); return; }
  if (el.id === 'q') { S.q = el.value; $('#lst').innerHTML = listHTML(cd); return; }
  if (el.dataset.cdf) { if (el.dataset.cdf === 'ot') el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN); if (el.dataset.cdf === 'placaReal') el.value = el.value.toUpperCase(); cd[el.dataset.cdf] = el.value.trim(); saveCD(cd); const bs0 = $('#btnSetup'); if (bs0) bs0.disabled = !setupOk(cd); if (S.tab === 'reg' && cd.setup && !S.edSetup) updateDerived(); return; }
  const k = el.dataset.f; if (!k || !S.form) return;
  if (k === 'otReal') el.value = el.value.replace(/\D/g, '').slice(0, OT_LEN);
  if (['obs', 'direccion', 'marcaOtra', 'cdReal', 'otReal'].includes(k)) { const p = el.selectionStart; el.value = el.value.toUpperCase(); try { el.setSelectionRange(p, p); } catch { } }
  S.form[k] = el.value; updateDerived();
});
document.addEventListener('change', async ev => {
  const el = ev.target; if (el.dataset.f === 'cdReal' || el.dataset.cdf === 'placaReal' || el.dataset.ro === 'cd') { el.value = normCd(el.value); el.dispatchEvent(new Event('input', { bubbles: true })); } if (el.dataset.usr !== undefined && el.value) { cfg.usuario = el.value; await saveCfg(); S.form = newForm(); return render(); } if (el.id === 'fx' && el.files[0]) { cargarExcel(el.files[0]); el.value = ''; } if (el.id === 'fj' && el.files[0]) { cargarJSON(el.files[0]); el.value = ''; }
  if (el.id === 'ord') {
    S.ord = el.value;
    if (S.ord !== 'cerca') return render();
    if (!navigator.geolocation) { S.ord = 'dir'; toast('Este dispositivo no tiene GPS'); return render(); }
    toast('Buscando tu ubicación…');
    return navigator.geolocation.getCurrentPosition(p => { S.gps = { lat: p.coords.latitude, lon: p.coords.longitude }; render(); }, () => { S.ord = 'dir'; toast('No se pudo obtener la ubicación'); render(); }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 20000 });
  }
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
  if ('serviceWorker' in navigator && location.protocol !== 'file:' && !NATIVE) navigator.serviceWorker.register('sw.js').catch(() => { });
  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) navigator.serviceWorker.addEventListener('controllerchange', () => { if (S._rl) return; S._rl = 1; if (S.view === 'home') location.reload(); else toast('Hay una versión nueva: se aplica al volver al inicio'); });
})();
