/**
 * SIRPC - Sistema de Información para Revisión de Planes de Curso
 * Backend Google Apps Script para Google Sheets + GitHub Pages
 *
 * Instalación:
 * 1. Abra el Google Sheets oficial.
 * 2. Extensiones > Apps Script.
 * 3. Pegue este código en Código.gs.
 * 4. Implemente como Aplicación web.
 * 5. Ejecución: Yo. Acceso: Cualquier usuario.
 * 6. Copie la URL /exec y péguela en config.js.
 */

const SIRPC = {
  TZ: 'America/Bogota',
  SPREADSHEET_ID: '', // opcional. Si el script está vinculado al Google Sheets, déjelo vacío.
  SHEETS: {
    PLANES: 'PlanesCurso',
    REVISIONES: 'Revisiones',
    CITAS: 'Citas',
    REVISORES: 'Revisores',
    HORARIOS: 'Horarios',
    CONFIG: 'Configuracion'
  },
  REVISORES_DEFAULT: {
    'SIB': 'Marisorelis Carrillo Cantillo',
    'APA': 'Emilio Alfonso Lara',
    'Rizoma': 'Adriana Milena Jimenez Camacho'
  },
  TIPOS: ['SIB', 'APA', 'Rizoma'],
  ESTADOS_CITA_ACTIVA: ['RESERVADA','ACTIVA','CONFIRMADA','CITA RESERVADA'],
  ESTADOS_NO_CUENTAN_CUPO: ['CANCELADA','ANULADA'],
  HEADERS: {
    CITAS: [
      'NumeroReserva','FechaRegistro','IDPlan','IDHorario','TipoRevision','RevisorAsignado',
      'Documento Profesor','Nombre_Completo','Correo-E','ID Curso','Descripción','Nº Clase',
      'FechaCita','HoraCita','HoraFin','Jornada','EstadoCita','EstadoRevision',
      'FechaCancelacion','MotivoCancelacion','FechaVisado','ObservacionesRevisor','UsuarioRegistro','FechaActualizacion'
    ],
    REVISIONES: [
      'IDRevision','IDPlan','TipoRevision','RevisorAsignado','EstadoRevision','NumeroReserva',
      'FechaReserva','FechaVisado','ObservacionesRevisor','UsuarioRevision','FechaActualizacion'
    ],
    REVISORES: ['TipoRevision','Revisor','Correo','Estado'],
    HORARIOS: ['IDHorario','Fecha','Jornada','HoraInicio','HoraFin','TipoRevision','Revisor','Cupos','Estado','Observaciones'],
    CONFIG: ['Clave','Valor','Descripcion']
  }
};

function doGet(e) {
  const callback = e && e.parameter ? e.parameter.callback : '';
  let response;
  try {
    const action = e.parameter.action || '';
    const payload = e.parameter.payload ? JSON.parse(e.parameter.payload) : {};
    response = routeSirpc(action, payload);
    response.ok = true;
  } catch (err) {
    response = { ok: false, message: err.message || String(err) };
  }
  const body = callback ? `${callback}(${JSON.stringify(response)})` : JSON.stringify(response);
  return ContentService
    .createTextOutput(body)
    .setMimeType(callback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}

function routeSirpc(action, payload) {
  switch (action) {
    case 'ping': return { message: 'SIRPC activo', timestamp: nowText() };
    case 'setup': return setupSirpc();
    case 'buscarPlanes': return buscarPlanes(payload);
    case 'getFechasDisponibles': return getFechasDisponibles(payload);
    case 'getDisponibilidad': return getDisponibilidad(payload);
    case 'reservarCita': return reservarCita(payload);
    case 'cancelarCita': return cancelarCita(payload);
    case 'listarCitas': return listarCitas(payload);
    case 'marcarRevision': return marcarRevision(payload);
    default: throw new Error('Acción no válida: ' + action);
  }
}

function setupSirpc() {
  ensureSheet(SIRPC.SHEETS.CITAS, SIRPC.HEADERS.CITAS);
  ensureSheet(SIRPC.SHEETS.REVISIONES, SIRPC.HEADERS.REVISIONES);
  ensureSheet(SIRPC.SHEETS.REVISORES, SIRPC.HEADERS.REVISORES);
  ensureSheet(SIRPC.SHEETS.HORARIOS, SIRPC.HEADERS.HORARIOS);
  ensureSheet(SIRPC.SHEETS.CONFIG, SIRPC.HEADERS.CONFIG);
  seedRevisores();
  return { message: 'Estructura SIRPC verificada correctamente.' };
}

function buscarPlanes(payload) {
  const q = String(payload.q || '').trim();
  if (!q) throw new Error('Debe ingresar documento o correo del docente.');

  const planesData = readObjects(SIRPC.SHEETS.PLANES);
  const revisiones = readObjectsSafe(SIRPC.SHEETS.REVISIONES);
  const citas = readObjectsSafe(SIRPC.SHEETS.CITAS);
  const revisores = getRevisoresMap();

  const qDoc = onlyDigits(q);
  const qMail = normalize(q);
  const found = [];
  const seen = {};
  let docente = null;

  planesData.objects.forEach(p => {
    const doc = onlyDigits(getVal(p, ['Documento Profesor','DocumentoProfesor','CedulaDocente','Cédula Docente']));
    const mail = normalize(getVal(p, ['Correo-E','Correo','CorreoDocente','Correo Docente']));
    const nombre = String(getVal(p, ['Nombre_Completo','Nombre Completo','NombreDocente','Docente']) || '').trim();

    if (!doc && !mail) return;
    if (isDocenteProvisional(doc, nombre, mail)) return;

    const matchDoc = qDoc && doc === qDoc;
    const matchMail = qMail && mail === qMail;
    if (!matchDoc && !matchMail) return;

    const idPlan = buildIDPlan(p);
    if (!idPlan || seen[idPlan]) return;
    seen[idPlan] = true;

    const plan = clonePlain(p);
    plan.IDPlan = idPlan;
    plan.revisiones = buildRevisionStatus(idPlan, revisiones.objects, citas.objects, revisores);
    found.push(plan);

    if (!docente) {
      docente = { documento: doc, nombre: nombre, correo: getVal(p, ['Correo-E','Correo','CorreoDocente','Correo Docente']) || '' };
    }
  });

  found.sort((a,b) => String(a['Descripción'] || '').localeCompare(String(b['Descripción'] || '')));
  return { docente: docente || {}, planes: found, total: found.length };
}

function getFechasDisponibles(payload) {
  const tipo = validTipo(payload.tipoRevision);
  const disponibilidad = getSlotsDisponibles(tipo, '', '');
  const fechas = [];
  const seen = {};
  disponibilidad.forEach(s => {
    if (!seen[s.Fecha]) { seen[s.Fecha] = true; fechas.push(s.Fecha); }
  });
  fechas.sort();
  return { fechas: fechas };
}

function getDisponibilidad(payload) {
  const tipo = validTipo(payload.tipoRevision);
  const fecha = String(payload.fecha || '').trim();
  const jornada = String(payload.jornada || '').trim();
  if (!fecha) throw new Error('Debe seleccionar una fecha.');
  const slots = getSlotsDisponibles(tipo, fecha, jornada);
  return { slots: slots };
}

function reservarCita(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    setupSirpc();
    const idPlan = String(payload.idPlan || '').trim();
    const tipo = validTipo(payload.tipoRevision);
    const idHorario = String(payload.idHorario || '').trim();
    if (!idPlan) throw new Error('Falta IDPlan.');
    if (!idHorario) throw new Error('Falta IDHorario.');

    const plan = findPlanByID(idPlan);
    if (!plan) throw new Error('No se encontró el plan de curso seleccionado.');
    if (isDocenteProvisional(onlyDigits(getVal(plan, ['Documento Profesor'])), getVal(plan, ['Nombre_Completo']), getVal(plan, ['Correo-E']))) {
      throw new Error('Este plan no tiene docente válido asignado.');
    }

    const estadoActual = getRevisionState(idPlan, tipo);
    if (String(estadoActual.estado || '').toUpperCase() === 'VISADO') {
      throw new Error('Esta revisión ya fue visada. No se puede agendar nuevamente.');
    }
    if (hasActiveCita(idPlan, tipo)) {
      throw new Error('Este plan ya tiene una cita activa para la revisión ' + tipo + '. Debe cancelar la cita actual antes de reservar otra.');
    }

    const slot = getHorarioByID(idHorario);
    if (!slot) throw new Error('El horario seleccionado no existe.');
    if (String(slot.TipoRevision) !== tipo) throw new Error('El horario no corresponde al tipo de revisión seleccionado.');
    if (String(slot.Estado || '').toUpperCase() !== 'ACTIVO') throw new Error('El horario seleccionado no está activo.');

    const cupos = Number(slot.Cupos || 0);
    const ocupados = countOcupados(slot);
    if (ocupados >= cupos) throw new Error('El horario seleccionado ya no tiene cupos disponibles.');

    const numero = makeReservaNumber(tipo);
    const row = {
      'NumeroReserva': numero,
      'FechaRegistro': nowText(),
      'IDPlan': idPlan,
      'IDHorario': slot.IDHorario,
      'TipoRevision': tipo,
      'RevisorAsignado': slot.Revisor || getRevisoresMap()[tipo] || '',
      'Documento Profesor': getVal(plan, ['Documento Profesor']),
      'Nombre_Completo': getVal(plan, ['Nombre_Completo']),
      'Correo-E': getVal(plan, ['Correo-E']),
      'ID Curso': getVal(plan, ['ID Curso']),
      'Descripción': getVal(plan, ['Descripción']),
      'Nº Clase': getVal(plan, ['Nº Clase','N° Clase','No Clase']),
      'FechaCita': formatDateValue(slot.Fecha),
      'HoraCita': formatTimeValue(slot.HoraInicio),
      'HoraFin': formatTimeValue(slot.HoraFin),
      'Jornada': slot.Jornada,
      'EstadoCita': 'RESERVADA',
      'EstadoRevision': 'CITA RESERVADA',
      'UsuarioRegistro': 'DOCENTE',
      'FechaActualizacion': nowText()
    };
    appendObject(SIRPC.SHEETS.CITAS, SIRPC.HEADERS.CITAS, row);
    upsertRevision(idPlan, tipo, {
      EstadoRevision: 'CITA RESERVADA',
      NumeroReserva: numero,
      FechaReserva: nowText(),
      RevisorAsignado: row.RevisorAsignado,
      FechaActualizacion: nowText()
    });
    recalcularEstadoPlan(idPlan);
    return { numeroReserva: numero, cuposRestantes: cupos - ocupados - 1 };
  } finally {
    lock.releaseLock();
  }
}

function cancelarCita(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const numero = String(payload.numeroReserva || '').trim();
    const idPlan = String(payload.idPlan || '').trim();
    const tipo = payload.tipoRevision ? validTipo(payload.tipoRevision) : '';
    const q = String(payload.q || '').trim();
    const motivo = String(payload.motivo || '').trim();

    const data = readObjects(SIRPC.SHEETS.CITAS);
    let target = null;
    for (let i = data.objects.length - 1; i >= 0; i--) {
      const c = data.objects[i];
      const estado = String(c.EstadoCita || '').toUpperCase();
      if (!SIRPC.ESTADOS_CITA_ACTIVA.includes(estado)) continue;
      if (numero && String(c.NumeroReserva) === numero) { target = c; break; }
      if (idPlan && tipo && String(c.IDPlan) === idPlan && String(c.TipoRevision) === tipo) {
        if (!q || matchesDocOrEmail(c, q)) { target = c; break; }
      }
    }
    if (!target) throw new Error('No se encontró una cita activa para cancelar.');

    setCell(SIRPC.SHEETS.CITAS, target.__rowNumber, 'EstadoCita', 'CANCELADA');
    setCell(SIRPC.SHEETS.CITAS, target.__rowNumber, 'EstadoRevision', 'CANCELADA');
    setCell(SIRPC.SHEETS.CITAS, target.__rowNumber, 'FechaCancelacion', nowText());
    setCell(SIRPC.SHEETS.CITAS, target.__rowNumber, 'MotivoCancelacion', motivo);
    setCell(SIRPC.SHEETS.CITAS, target.__rowNumber, 'FechaActualizacion', nowText());

    upsertRevision(target.IDPlan, target.TipoRevision, {
      EstadoRevision: 'PENDIENTE',
      NumeroReserva: '',
      FechaActualizacion: nowText()
    });
    recalcularEstadoPlan(target.IDPlan);
    return { message: 'Cita cancelada correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function listarCitas(payload) {
  const fecha = String(payload.fecha || '').trim();
  const tipo = String(payload.tipoRevision || '').trim();
  const estadoCita = String(payload.estadoCita || '').trim().toUpperCase();
  const texto = normalize(String(payload.texto || '').trim());
  const rows = readObjectsSafe(SIRPC.SHEETS.CITAS).objects.map(formatCitaObject);

  const filtered = rows.filter(r => {
    if (fecha && r.FechaCita !== fecha) return false;
    if (tipo && String(r.TipoRevision) !== tipo) return false;
    if (estadoCita && String(r.EstadoCita || '').toUpperCase() !== estadoCita) return false;
    if (texto) {
      const blob = normalize([r.NumeroReserva, r.IDPlan, r['Documento Profesor'], r.Nombre_Completo, r['Correo-E'], r['ID Curso'], r['Descripción'], r.TipoRevision, r.RevisorAsignado].join(' '));
      if (blob.indexOf(texto) === -1) return false;
    }
    return true;
  });

  filtered.sort((a,b) => String(a.FechaCita + a.HoraCita).localeCompare(String(b.FechaCita + b.HoraCita)));
  const resumen = { total: filtered.length, reservadas: 0, canceladas: 0, visadas: 0 };
  filtered.forEach(r => {
    if (String(r.EstadoCita).toUpperCase() === 'RESERVADA') resumen.reservadas++;
    if (String(r.EstadoCita).toUpperCase() === 'CANCELADA') resumen.canceladas++;
    if (String(r.EstadoRevision).toUpperCase() === 'VISADO') resumen.visadas++;
  });
  return { citas: filtered, resumen: resumen };
}

function marcarRevision(payload) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const numero = String(payload.numeroReserva || '').trim();
    const estadoRevision = normalizeEstadoRevision(payload.estadoRevision);
    const obs = String(payload.observaciones || '').trim();
    const usuario = String(payload.usuario || '').trim();
    if (!numero) throw new Error('Falta el número de reserva.');

    const data = readObjects(SIRPC.SHEETS.CITAS);
    const cita = data.objects.find(c => String(c.NumeroReserva) === numero);
    if (!cita) throw new Error('No se encontró la cita indicada.');
    if (String(cita.EstadoCita || '').toUpperCase() === 'CANCELADA') throw new Error('No se puede visar una cita cancelada.');

    const fecha = nowText();
    let estadoCita = 'ATENDIDA';
    if (estadoRevision === 'NO ASISTIÓ') estadoCita = 'NO ASISTIÓ';

    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'EstadoRevision', estadoRevision);
    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'EstadoCita', estadoCita);
    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'ObservacionesRevisor', obs);
    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'FechaVisado', fecha);
    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'UsuarioRegistro', usuario || cita.UsuarioRegistro || 'REVISOR');
    setCell(SIRPC.SHEETS.CITAS, cita.__rowNumber, 'FechaActualizacion', fecha);

    upsertRevision(cita.IDPlan, cita.TipoRevision, {
      EstadoRevision: estadoRevision,
      NumeroReserva: numero,
      FechaVisado: fecha,
      ObservacionesRevisor: obs,
      UsuarioRevision: usuario,
      RevisorAsignado: cita.RevisorAsignado,
      FechaActualizacion: fecha
    });
    recalcularEstadoPlan(cita.IDPlan);
    return { message: 'Resultado de revisión guardado correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

/* ========================= Helpers de negocio ========================= */

function getSlotsDisponibles(tipo, fecha, jornada) {
  const horarios = readObjects(SIRPC.SHEETS.HORARIOS).objects;
  const revisores = getRevisoresMap();
  const out = [];
  horarios.forEach(h => {
    const f = formatDateValue(h.Fecha);
    const hi = formatTimeValue(h.HoraInicio);
    const hf = formatTimeValue(h.HoraFin);
    const cupos = Number(h.Cupos || 0);
    if (String(h.TipoRevision) !== tipo) return;
    if (String(h.Estado || '').toUpperCase() !== 'ACTIVO') return;
    if (fecha && f !== fecha) return;
    if (jornada && String(h.Jornada) !== jornada) return;
    if (!cupos || cupos < 1) return;
    const slot = {
      IDHorario: String(h.IDHorario || '').trim(),
      Fecha: f,
      Jornada: String(h.Jornada || ''),
      HoraInicio: hi,
      HoraFin: hf,
      TipoRevision: tipo,
      Revisor: h.Revisor || revisores[tipo] || '',
      Cupos: cupos,
      Estado: h.Estado || 'ACTIVO'
    };
    const ocupados = countOcupados(slot);
    slot.CuposOcupados = ocupados;
    slot.CuposRestantes = cupos - ocupados;
    if (slot.CuposRestantes > 0) out.push(slot);
  });
  out.sort((a,b) => String(a.Fecha + a.HoraInicio).localeCompare(String(b.Fecha + b.HoraInicio)));
  return out;
}

function countOcupados(slot) {
  const citas = readObjectsSafe(SIRPC.SHEETS.CITAS).objects;
  let n = 0;
  citas.forEach(c => {
    const estado = String(c.EstadoCita || '').toUpperCase();
    if (SIRPC.ESTADOS_NO_CUENTAN_CUPO.includes(estado)) return;
    const byId = slot.IDHorario && String(c.IDHorario || '') === String(slot.IDHorario);
    const byData = String(c.TipoRevision) === String(slot.TipoRevision) && formatDateValue(c.FechaCita) === slot.Fecha && formatTimeValue(c.HoraCita) === slot.HoraInicio;
    if (byId || byData) n++;
  });
  return n;
}

function getHorarioByID(idHorario) {
  const rows = readObjects(SIRPC.SHEETS.HORARIOS).objects;
  for (let i=0;i<rows.length;i++) {
    if (String(rows[i].IDHorario || '').trim() === String(idHorario).trim()) {
      const h = clonePlain(rows[i]);
      h.Fecha = formatDateValue(h.Fecha);
      h.HoraInicio = formatTimeValue(h.HoraInicio);
      h.HoraFin = formatTimeValue(h.HoraFin);
      h.Cupos = Number(h.Cupos || 0);
      return h;
    }
  }
  return null;
}

function findPlanByID(idPlan) {
  const rows = readObjects(SIRPC.SHEETS.PLANES).objects;
  for (let i=0;i<rows.length;i++) {
    if (buildIDPlan(rows[i]) === idPlan) {
      const p = clonePlain(rows[i]);
      p.IDPlan = idPlan;
      return p;
    }
  }
  return null;
}

function hasActiveCita(idPlan, tipo) {
  const citas = readObjectsSafe(SIRPC.SHEETS.CITAS).objects;
  return citas.some(c => String(c.IDPlan) === idPlan && String(c.TipoRevision) === tipo && SIRPC.ESTADOS_CITA_ACTIVA.includes(String(c.EstadoCita || '').toUpperCase()));
}

function getRevisionState(idPlan, tipo) {
  const revisiones = readObjectsSafe(SIRPC.SHEETS.REVISIONES).objects;
  const match = revisiones.find(r => String(r.IDPlan) === idPlan && String(r.TipoRevision) === tipo);
  return match || { IDPlan: idPlan, TipoRevision: tipo, EstadoRevision: 'PENDIENTE', estado: 'PENDIENTE' };
}

function buildRevisionStatus(idPlan, revisiones, citas, revisores) {
  const status = {};
  SIRPC.TIPOS.forEach(tipo => {
    status[tipo] = { estado: 'PENDIENTE', revisor: revisores[tipo] || '', cita: null, observaciones: '', fechaVisado: '' };
  });

  revisiones.forEach(r => {
    if (String(r.IDPlan) !== idPlan) return;
    const tipo = String(r.TipoRevision || '');
    if (!status[tipo]) return;
    status[tipo].estado = r.EstadoRevision || 'PENDIENTE';
    status[tipo].revisor = r.RevisorAsignado || revisores[tipo] || '';
    status[tipo].observaciones = r.ObservacionesRevisor || '';
    status[tipo].fechaVisado = formatDateTimeValue(r.FechaVisado);
  });

  SIRPC.TIPOS.forEach(tipo => {
    const citasTipo = citas.filter(c => String(c.IDPlan) === idPlan && String(c.TipoRevision) === tipo);
    if (!citasTipo.length) return;
    const active = last(citasTipo.filter(c => SIRPC.ESTADOS_CITA_ACTIVA.includes(String(c.EstadoCita || '').toUpperCase())));
    if (active) {
      const cf = formatCitaObject(active);
      status[tipo].estado = 'CITA RESERVADA';
      status[tipo].cita = cf;
      status[tipo].revisor = cf.RevisorAsignado || revisores[tipo] || '';
      return;
    }
    const visada = last(citasTipo.filter(c => String(c.EstadoRevision || '').toUpperCase() === 'VISADO'));
    if (visada) {
      status[tipo].estado = 'VISADO';
      status[tipo].fechaVisado = formatDateTimeValue(visada.FechaVisado);
      status[tipo].observaciones = visada.ObservacionesRevisor || '';
      return;
    }
    const obs = last(citasTipo.filter(c => String(c.EstadoRevision || '').toUpperCase() === 'CON OBSERVACIONES'));
    if (obs) {
      status[tipo].estado = 'CON OBSERVACIONES';
      status[tipo].observaciones = obs.ObservacionesRevisor || '';
      return;
    }
  });
  return status;
}

function upsertRevision(idPlan, tipo, vals) {
  ensureSheet(SIRPC.SHEETS.REVISIONES, SIRPC.HEADERS.REVISIONES);
  const data = readObjects(SIRPC.SHEETS.REVISIONES);
  let row = data.objects.find(r => String(r.IDPlan) === String(idPlan) && String(r.TipoRevision) === String(tipo));
  const obj = {
    IDRevision: idPlan + '-' + tipo,
    IDPlan: idPlan,
    TipoRevision: tipo,
    RevisorAsignado: vals.RevisorAsignado || getRevisoresMap()[tipo] || '',
    EstadoRevision: vals.EstadoRevision || 'PENDIENTE',
    NumeroReserva: vals.NumeroReserva || '',
    FechaReserva: vals.FechaReserva || '',
    FechaVisado: vals.FechaVisado || '',
    ObservacionesRevisor: vals.ObservacionesRevisor || '',
    UsuarioRevision: vals.UsuarioRevision || '',
    FechaActualizacion: vals.FechaActualizacion || nowText()
  };
  if (row) {
    Object.keys(obj).forEach(k => setCell(SIRPC.SHEETS.REVISIONES, row.__rowNumber, k, obj[k]));
  } else {
    appendObject(SIRPC.SHEETS.REVISIONES, SIRPC.HEADERS.REVISIONES, obj);
  }
}

function recalcularEstadoPlan(idPlan) {
  const revisiones = readObjectsSafe(SIRPC.SHEETS.REVISIONES).objects.filter(r => String(r.IDPlan) === String(idPlan));
  const estados = {};
  SIRPC.TIPOS.forEach(t => estados[t] = 'PENDIENTE');
  revisiones.forEach(r => { if (estados.hasOwnProperty(r.TipoRevision)) estados[r.TipoRevision] = String(r.EstadoRevision || 'PENDIENTE').toUpperCase(); });
  let estado = 'PENDIENTE';
  if (SIRPC.TIPOS.every(t => estados[t] === 'VISADO')) estado = 'COMPLETAMENTE VISADO';
  else if (SIRPC.TIPOS.some(t => estados[t] === 'CON OBSERVACIONES')) estado = 'CON OBSERVACIONES';
  else if (SIRPC.TIPOS.some(t => estados[t] !== 'PENDIENTE')) estado = 'EN PROCESO';

  try {
    const data = readObjects(SIRPC.SHEETS.PLANES);
    const p = data.objects.find(x => buildIDPlan(x) === idPlan);
    if (p && data.headers.indexOf('EstadoPlan') !== -1) setCell(SIRPC.SHEETS.PLANES, p.__rowNumber, 'EstadoPlan', estado);
  } catch (e) {}
}

/* ========================= Helpers de hojas ========================= */

function getSS() {
  if (SIRPC.SPREADSHEET_ID) return SpreadsheetApp.openById(SIRPC.SPREADSHEET_ID);
  return SpreadsheetApp.getActiveSpreadsheet();
}

function ensureSheet(name, headers) {
  const ss = getSS();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  const lastCol = Math.max(sh.getLastColumn(), headers.length);
  if (sh.getLastRow() === 0) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }
  let existing = sh.getRange(1,1,1,lastCol).getValues()[0].map(String).filter(Boolean);
  if (!existing.length) {
    sh.getRange(1,1,1,headers.length).setValues([headers]);
    return sh;
  }
  headers.forEach(h => {
    existing = sh.getRange(1,1,1,Math.max(sh.getLastColumn(),1)).getValues()[0].map(String);
    if (existing.indexOf(h) === -1) {
      sh.getRange(1, sh.getLastColumn()+1).setValue(h);
    }
  });
  return sh;
}

function readObjects(sheetName) {
  const sh = getSS().getSheetByName(sheetName);
  if (!sh) throw new Error('No existe la hoja: ' + sheetName);
  const values = sh.getDataRange().getValues();
  if (values.length < 1) return { headers: [], objects: [], sheet: sh };
  const headers = values[0].map(h => String(h || '').trim());
  const objects = [];
  for (let r=1; r<values.length; r++) {
    const row = values[r];
    if (row.every(v => String(v || '').trim() === '')) continue;
    const obj = { __rowNumber: r+1 };
    headers.forEach((h,i) => { if (h) obj[h] = row[i]; });
    objects.push(obj);
  }
  return { headers: headers, objects: objects, sheet: sh };
}

function readObjectsSafe(sheetName) {
  try { return readObjects(sheetName); }
  catch (e) { return { headers: [], objects: [], sheet: null }; }
}

function appendObject(sheetName, headers, obj) {
  const sh = ensureSheet(sheetName, headers);
  const actualHeaders = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  const row = actualHeaders.map(h => obj.hasOwnProperty(h) ? obj[h] : '');
  sh.appendRow(row);
}

function setCell(sheetName, rowNumber, header, value) {
  const sh = getSS().getSheetByName(sheetName);
  if (!sh) throw new Error('No existe la hoja: ' + sheetName);
  const headers = sh.getRange(1,1,1,sh.getLastColumn()).getValues()[0].map(String);
  let col = headers.indexOf(header) + 1;
  if (col < 1) {
    col = sh.getLastColumn() + 1;
    sh.getRange(1, col).setValue(header);
  }
  sh.getRange(rowNumber, col).setValue(value);
}

function seedRevisores() {
  const data = readObjects(SIRPC.SHEETS.REVISORES);
  const existing = {};
  data.objects.forEach(r => existing[String(r.TipoRevision)] = true);
  Object.keys(SIRPC.REVISORES_DEFAULT).forEach(tipo => {
    if (!existing[tipo]) appendObject(SIRPC.SHEETS.REVISORES, SIRPC.HEADERS.REVISORES, {TipoRevision: tipo, Revisor: SIRPC.REVISORES_DEFAULT[tipo], Correo: '', Estado: 'ACTIVO'});
  });
}

function getRevisoresMap() {
  const map = clonePlain(SIRPC.REVISORES_DEFAULT);
  const rows = readObjectsSafe(SIRPC.SHEETS.REVISORES).objects;
  rows.forEach(r => {
    if (String(r.Estado || 'ACTIVO').toUpperCase() === 'ACTIVO' && r.TipoRevision && r.Revisor) {
      map[String(r.TipoRevision)] = String(r.Revisor);
    }
  });
  return map;
}

/* ========================= Helpers generales ========================= */

function buildIDPlan(p) {
  const existing = String(getVal(p, ['IDPlan','ID Plan']) || '').trim();
  if (existing) return existing;
  const idCurso = cleanKey(getVal(p, ['ID Curso','IDCurso']));
  const nClase = cleanKey(getVal(p, ['Nº Clase','N° Clase','No Clase','N Clase']));
  const doc = cleanKey(getVal(p, ['Documento Profesor','DocumentoProfesor','CedulaDocente','Cédula Docente']));
  return [idCurso,nClase,doc].filter(Boolean).join('-');
}

function getVal(obj, names) {
  for (let i=0;i<names.length;i++) {
    if (obj.hasOwnProperty(names[i])) return obj[names[i]];
  }
  return '';
}

function formatCitaObject(c) {
  const out = clonePlain(c);
  out.FechaRegistro = formatDateTimeValue(c.FechaRegistro);
  out.FechaCita = formatDateValue(c.FechaCita);
  out.HoraCita = formatTimeValue(c.HoraCita);
  out.HoraFin = formatTimeValue(c.HoraFin);
  out.FechaCancelacion = formatDateTimeValue(c.FechaCancelacion);
  out.FechaVisado = formatDateTimeValue(c.FechaVisado);
  out.FechaActualizacion = formatDateTimeValue(c.FechaActualizacion);
  return out;
}

function formatDateValue(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, SIRPC.TZ, 'yyyy-MM-dd');
  }
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
  if (m) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]);
  const d = new Date(s);
  if (!isNaN(d)) return Utilities.formatDate(d, SIRPC.TZ, 'yyyy-MM-dd');
  return s;
}

function formatTimeValue(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, SIRPC.TZ, 'HH:mm');
  }
  let s = String(v).trim();
  const ampm = s.match(/(a\.?\s*m\.?|p\.?\s*m\.?)$/i);
  s = s.replace(/(a\.?\s*m\.?|p\.?\s*m\.?)$/i,'').trim();
  const m = s.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!m) return s;
  let h = Number(m[1]);
  const min = m[2];
  if (ampm) {
    const isPm = /p/i.test(ampm[1]);
    if (isPm && h < 12) h += 12;
    if (!isPm && h === 12) h = 0;
  }
  return pad2(h) + ':' + min;
}

function formatDateTimeValue(v) {
  if (!v) return '';
  if (Object.prototype.toString.call(v) === '[object Date]' && !isNaN(v)) {
    return Utilities.formatDate(v, SIRPC.TZ, 'yyyy-MM-dd HH:mm:ss');
  }
  return String(v || '');
}

function nowText() { return Utilities.formatDate(new Date(), SIRPC.TZ, 'yyyy-MM-dd HH:mm:ss'); }
function pad2(n) { return ('0' + Number(n)).slice(-2); }
function onlyDigits(v) { return String(v || '').replace(/\D/g,''); }
function cleanKey(v) { return String(v || '').trim().replace(/\s+/g,''); }
function normalize(v) { return String(v || '').trim().toLowerCase(); }
function clonePlain(o) {
  const out = {};
  o = o || {};
  Object.keys(o).forEach(k => { out[k] = o[k]; });
  return out;
}
function last(arr) { return arr && arr.length ? arr[arr.length-1] : null; }

function isDocenteProvisional(doc, nombre, mail) {
  const n = normalize(nombre);
  const m = normalize(mail);
  if (!doc || doc === '999999999') return true;
  if (n.indexOf('docente por asignar') !== -1) return true;
  if (n.indexOf('docente paralelo') !== -1) return true;
  if (m.indexOf('docente.prueba') !== -1) return true;
  return false;
}

function matchesDocOrEmail(c, q) {
  const qDoc = onlyDigits(q);
  const qMail = normalize(q);
  const doc = onlyDigits(c['Documento Profesor']);
  const mail = normalize(c['Correo-E']);
  return (qDoc && qDoc === doc) || (qMail && qMail === mail);
}

function validTipo(tipo) {
  const t = String(tipo || '').trim();
  if (SIRPC.TIPOS.indexOf(t) === -1) throw new Error('Tipo de revisión no válido: ' + tipo);
  return t;
}

function normalizeEstadoRevision(v) {
  const e = String(v || '').trim().toUpperCase();
  const map = {
    'VISADO':'VISADO',
    'CON OBSERVACIONES':'CON OBSERVACIONES',
    'NO ASISTIO':'NO ASISTIÓ',
    'NO ASISTIÓ':'NO ASISTIÓ'
  };
  if (!map[e]) throw new Error('Estado de revisión no válido.');
  return map[e];
}

function makeReservaNumber(tipo) {
  const stamp = Utilities.formatDate(new Date(), SIRPC.TZ, 'yyyyMMddHHmmss');
  const rnd = Math.floor(Math.random()*900 + 100);
  return 'SIRPC-' + tipo.toUpperCase().replace(/[^A-Z]/g,'') + '-' + stamp + '-' + rnd;
}
