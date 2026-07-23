/**
 * SIRPC · Backend Google Apps Script
 * Sistema de Información para la Revisión de Planes de Curso
 *
 * Instalación:
 * 1. Abrir el Google Sheets creado desde Plantilla_SIRPC_GoogleSheets.xlsx.
 * 2. Extensiones > Apps Script.
 * 3. Borrar todo y pegar este archivo como Código.gs.
 * 4. Implementar > Nueva implementación > Aplicación web.
 * 5. Ejecutar como: Yo.
 * 6. Quién tiene acceso: Cualquier usuario.
 * 7. Copiar URL /exec y pegarla en config.js.
 */

const SIRPC = {
  SHEETS: {
    PLANES: 'PlanesCurso',
    CITAS: 'Citas',
    REVISIONES: 'Revisiones',
    REVISORES: 'Revisores'
  },
  MAX_CUPOS: 4,
  ESTADOS_CITA_ACTIVOS: ['RESERVADA', 'ACTIVA', 'CONFIRMADA'],
  TIPOS_REVISION: ['SIB', 'APA', 'Rizoma'],
  REVISORES: {
    'SIB': 'Marisorelis Carrillo Cantillo',
    'APA': 'Emilio Alfonso Lara',
    'Rizoma': 'Adriana Milena Jimenez Camacho'
  }
};

function doGet(e) {
  return handleRequest_(e, true);
}

function doPost(e) {
  return handleRequest_(e, false);
}

function handleRequest_(e, isGet) {
  try {
    const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'ping';
    let payload = {};

    if (isGet && e.parameter && e.parameter.payload) {
      payload = JSON.parse(e.parameter.payload);
    } else if (!isGet && e.postData && e.postData.contents) {
      payload = JSON.parse(e.postData.contents);
    }

    const result = route_(action, payload || {});
    return output_(result, e);
  } catch (err) {
    return output_({
      ok: false,
      message: err && err.message ? err.message : String(err)
    }, e);
  }
}

function route_(action, payload) {
  if (action === 'ping') return { ok: true, message: 'SIRPC backend activo', timestamp: now_() };
  if (action === 'buscarPlanes') return buscarPlanes_(payload);
  if (action === 'getDisponibilidad') return getDisponibilidad_(payload);
  if (action === 'reservarCita') return reservarCita_(payload);
  if (action === 'cancelarCita') return cancelarCita_(payload);
  if (action === 'listarCitas') return listarCitas_(payload);
  if (action === 'actualizarRevision') return actualizarRevision_(payload);
  throw new Error('Acción no reconocida: ' + action);
}

function output_(obj, e) {
  const json = JSON.stringify(obj);
  const callback = e && e.parameter && e.parameter.callback;
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}

function ss_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) throw new Error('No se encontró Spreadsheet activo. Cree este Apps Script desde el Google Sheets.');
  return ss;
}

function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('No existe la hoja requerida: ' + name);
  return sh;
}

function headers_(sh) {
  const lastCol = Math.max(1, sh.getLastColumn());
  const arr = sh.getRange(1, 1, 1, lastCol).getDisplayValues()[0];
  const map = {};
  arr.forEach(function(h, i) {
    if (h) map[String(h).trim()] = i + 1;
  });
  return { list: arr, map: map };
}

function rows_(sheetName) {
  const sh = sheet_(sheetName);
  const hm = headers_(sh);
  const lastRow = sh.getLastRow();
  if (lastRow < 2) return [];
  const values = sh.getRange(2, 1, lastRow - 1, hm.list.length).getDisplayValues();
  return values.map(function(row, idx) {
    const obj = { _rowNumber: idx + 2 };
    hm.list.forEach(function(h, i) {
      obj[h] = row[i] == null ? '' : String(row[i]).trim();
    });
    return obj;
  });
}

function appendObject_(sheetName, obj) {
  const sh = sheet_(sheetName);
  const hm = headers_(sh);
  const row = hm.list.map(function(h) {
    return obj[h] == null ? '' : obj[h];
  });
  sh.appendRow(row);
}

function updateRow_(sheetName, rowNumber, updates) {
  const sh = sheet_(sheetName);
  const hm = headers_(sh).map;
  Object.keys(updates).forEach(function(key) {
    if (hm[key]) sh.getRange(rowNumber, hm[key]).setValue(updates[key] == null ? '' : updates[key]);
  });
}

function norm_(v) {
  return String(v == null ? '' : v).trim().toLowerCase();
}

function normDoc_(v) {
  return String(v == null ? '' : v).replace(/\D/g, '');
}

function upper_(v) {
  return String(v == null ? '' : v).trim().toUpperCase();
}

function normTime_(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s) return '';
  s = s.replace(/\s+/g, '');
  const m = s.match(/^(\d{1,2}):(\d{2})/);
  if (!m) return s;
  return String(m[1]).padStart(2, '0') + ':' + m[2];
}

function normFecha_(v) {
  let s = String(v == null ? '' : v).trim();
  if (!s) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return m[3] + '-' + String(m[2]).padStart(2, '0') + '-' + String(m[1]).padStart(2, '0');
  return s;
}

function now_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');
}

function reservaId_() {
  return 'SIRPC-' + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyyMMdd-HHmmss') + '-' + Math.floor(Math.random() * 9000 + 1000);
}

function isActiveCita_(estado) {
  return SIRPC.ESTADOS_CITA_ACTIVOS.indexOf(upper_(estado)) >= 0;
}

function buscarPlanes_(payload) {
  const qRaw = String(payload.query || '').trim();
  if (!qRaw) throw new Error('Debe ingresar documento o correo institucional.');

  const q = norm_(qRaw);
  const qDoc = normDoc_(qRaw);
  const planes = rows_(SIRPC.SHEETS.PLANES).filter(function(p) {
    if (upper_(p.EstadoPlan) === 'PENDIENTE_DOCENTE') return false;
    const doc = normDoc_(p['Documento Profesor']);
    const correo = norm_(p['Correo-E']);
    const nombre = norm_(p['Nombre_Completo']);
    return (qDoc && doc === qDoc) || correo === q || nombre.indexOf(q) >= 0;
  });

  const revisiones = rows_(SIRPC.SHEETS.REVISIONES);
  const citas = rows_(SIRPC.SHEETS.CITAS);

  const planesConEstado = planes.map(function(p) {
    const revs = SIRPC.TIPOS_REVISION.map(function(tipo) {
      return estadoRevisionPlan_(p.IDPlan, tipo, revisiones, citas);
    });
    p.revisiones = revs;
    return p;
  });

  let docente = null;
  if (planesConEstado.length > 0) {
    docente = {
      documento: planesConEstado[0]['Documento Profesor'],
      nombre: planesConEstado[0]['Nombre_Completo'],
      correo: planesConEstado[0]['Correo-E']
    };
  }

  return { ok: true, docente: docente, planes: planesConEstado };
}

function estadoRevisionPlan_(idPlan, tipo, revisiones, citas) {
  const rev = revisiones.find(function(r) { return r.IDPlan === idPlan && r.TipoRevision === tipo; }) || {};
  const citaActiva = citas.find(function(c) {
    return c.IDPlan === idPlan && c.TipoRevision === tipo && isActiveCita_(c.EstadoCita);
  });

  const base = {
    IDPlan: idPlan,
    TipoRevision: tipo,
    RevisorAsignado: rev.RevisorAsignado || SIRPC.REVISORES[tipo] || '',
    EstadoRevision: rev.EstadoRevision || 'PENDIENTE',
    NumeroReservaActivo: rev.NumeroReservaActivo || '',
    FechaCita: rev.FechaCita || '',
    HoraCita: rev.HoraCita || '',
    Jornada: rev.Jornada || '',
    citaActiva: null
  };

  if (citaActiva) {
    base.EstadoRevision = citaActiva.EstadoRevision || 'CITA_RESERVADA';
    base.NumeroReservaActivo = citaActiva.NumeroReserva;
    base.FechaCita = normFecha_(citaActiva.FechaCita);
    base.HoraCita = normTime_(citaActiva.HoraCita);
    base.Jornada = citaActiva.Jornada;
    base.citaActiva = citaActiva.NumeroReserva;
  }

  return base;
}

function getDisponibilidad_(payload) {
  const fecha = normFecha_(payload.fecha);
  const jornada = String(payload.jornada || '').toLowerCase().indexOf('tarde') >= 0 ? 'Tarde' : 'Mañana';
  const tipo = String(payload.tipoRevision || '').trim();

  if (!fecha || !tipo) throw new Error('Fecha y tipo de revisión son obligatorios.');

  const citas = rows_(SIRPC.SHEETS.CITAS);
  const ocupados = {};

  citas.forEach(function(c) {
    if (!isActiveCita_(c.EstadoCita)) return;
    if (normFecha_(c.FechaCita) !== fecha) return;
    if (String(c.TipoRevision).trim() !== tipo) return;
    if (String(c.Jornada).trim() !== jornada) return;

    const hora = normTime_(c.HoraCita);
    ocupados[hora] = (ocupados[hora] || 0) + 1;
  });

  return { ok: true, ocupados: ocupados, maxCupos: SIRPC.MAX_CUPOS };
}

function reservarCita_(payload) {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(10000)) {
    throw new Error('El sistema está procesando otra reserva. Intente nuevamente.');
  }

  try {
    const idPlan = String(payload.IDPlan || '').trim();
    const tipo = String(payload.TipoRevision || '').trim();
    const fecha = normFecha_(payload.FechaCita);
    const hora = normTime_(payload.HoraCita);
    const jornada = String(payload.Jornada || '').toLowerCase().indexOf('tarde') >= 0 ? 'Tarde' : 'Mañana';

    if (!idPlan || !tipo || !fecha || !hora) {
      throw new Error('Faltan datos obligatorios para reservar la cita.');
    }

    const plan = rows_(SIRPC.SHEETS.PLANES).find(function(p) {
      return p.IDPlan === idPlan && upper_(p.EstadoPlan) === 'ACTIVO';
    });
    if (!plan) throw new Error('El plan de curso no existe o no está activo.');

    const revisiones = rows_(SIRPC.SHEETS.REVISIONES);
    const rev = revisiones.find(function(r) { return r.IDPlan === idPlan && r.TipoRevision === tipo; });
    if (rev && upper_(rev.EstadoRevision) === 'VISADO') {
      throw new Error('Esta revisión ya está VISADA. No se puede agendar nuevamente.');
    }

    const citas = rows_(SIRPC.SHEETS.CITAS);

    const yaTiene = citas.find(function(c) {
      return c.IDPlan === idPlan && c.TipoRevision === tipo && isActiveCita_(c.EstadoCita);
    });
    if (yaTiene) {
      throw new Error('Este plan ya tiene una cita activa para la revisión ' + tipo + '. Debe cancelar antes de volver a reservar.');
    }

    const ocupados = citas.filter(function(c) {
      return isActiveCita_(c.EstadoCita)
        && normFecha_(c.FechaCita) === fecha
        && normTime_(c.HoraCita) === hora
        && String(c.Jornada).trim() === jornada
        && String(c.TipoRevision).trim() === tipo;
    }).length;

    if (ocupados >= SIRPC.MAX_CUPOS) {
      throw new Error('El horario seleccionado ya no tiene cupos disponibles.');
    }

    const numero = reservaId_();
    const obj = {
      NumeroReserva: numero,
      FechaRegistro: now_(),
      IDPlan: idPlan,
      TipoRevision: tipo,
      RevisorAsignado: payload.RevisorAsignado || SIRPC.REVISORES[tipo] || '',
      'Documento Profesor': payload['Documento Profesor'] || plan['Documento Profesor'],
      'Nombre_Completo': payload['Nombre_Completo'] || plan['Nombre_Completo'],
      'Correo-E': payload['Correo-E'] || plan['Correo-E'],
      'ID Curso': payload['ID Curso'] || plan['ID Curso'],
      'Descripción': payload['Descripción'] || plan['Descripción'],
      'Nº Clase': payload['Nº Clase'] || plan['Nº Clase'],
      FechaCita: fecha,
      HoraCita: hora,
      Jornada: jornada,
      EstadoCita: 'RESERVADA',
      EstadoRevision: 'CITA_RESERVADA',
      FechaCancelacion: '',
      MotivoCancelacion: '',
      FechaVisado: '',
      ObservacionesRevisor: '',
      UsuarioRegistro: 'Docente'
    };
    appendObject_(SIRPC.SHEETS.CITAS, obj);

    upsertRevision_(idPlan, tipo, {
      EstadoRevision: 'CITA_RESERVADA',
      NumeroReservaActivo: numero,
      FechaCita: fecha,
      HoraCita: hora,
      Jornada: jornada,
      ActualizadoEn: now_()
    }, plan);

    return { ok: true, numeroReserva: numero, message: 'Cita registrada correctamente.' };
  } finally {
    lock.releaseLock();
  }
}

function cancelarCita_(payload) {
  const idPlan = String(payload.IDPlan || '').trim();
  const tipo = String(payload.TipoRevision || '').trim();
  const doc = normDoc_(payload['Documento Profesor'] || payload.documento || '');
  const motivo = String(payload.MotivoCancelacion || '').trim();

  if (!idPlan || !tipo || !doc) throw new Error('Faltan datos para cancelar la cita.');

  const citas = rows_(SIRPC.SHEETS.CITAS);
  const cita = citas.find(function(c) {
    return c.IDPlan === idPlan && c.TipoRevision === tipo && normDoc_(c['Documento Profesor']) === doc && isActiveCita_(c.EstadoCita);
  });
  if (!cita) throw new Error('No se encontró cita activa para cancelar.');

  updateRow_(SIRPC.SHEETS.CITAS, cita._rowNumber, {
    EstadoCita: 'CANCELADA',
    EstadoRevision: 'CANCELADA',
    FechaCancelacion: now_(),
    MotivoCancelacion: motivo
  });

  const plan = rows_(SIRPC.SHEETS.PLANES).find(function(p) { return p.IDPlan === idPlan; });
  upsertRevision_(idPlan, tipo, {
    EstadoRevision: 'CANCELADA',
    NumeroReservaActivo: '',
    FechaCita: '',
    HoraCita: '',
    Jornada: '',
    ActualizadoEn: now_()
  }, plan || {});

  return { ok: true, message: 'Cita cancelada correctamente. El cupo vuelve a quedar disponible.' };
}

function listarCitas_(payload) {
  let data = rows_(SIRPC.SHEETS.CITAS).map(function(c) {
    c.FechaCita = normFecha_(c.FechaCita);
    c.HoraCita = normTime_(c.HoraCita);
    return c;
  });

  if (payload && payload.TipoRevision) {
    data = data.filter(function(c) { return c.TipoRevision === payload.TipoRevision; });
  }

  return { ok: true, citas: data };
}

function actualizarRevision_(payload) {
  const numero = String(payload.NumeroReserva || '').trim();
  const estado = upper_(payload.EstadoRevision || '');
  const obs = String(payload.ObservacionesRevisor || '').trim();
  const usuario = String(payload.UsuarioRegistro || 'Revisor').trim();

  if (!numero || !estado) throw new Error('Número de reserva y estado son obligatorios.');
  if (['VISADO', 'CON_OBSERVACIONES', 'NO_ASISTIO'].indexOf(estado) < 0) {
    throw new Error('Estado de revisión no permitido: ' + estado);
  }

  const citas = rows_(SIRPC.SHEETS.CITAS);
  const cita = citas.find(function(c) { return c.NumeroReserva === numero; });
  if (!cita) throw new Error('No se encontró la reserva: ' + numero);

  let nuevoEstadoCita = 'ATENDIDA';
  if (estado === 'NO_ASISTIO') nuevoEstadoCita = 'NO_ASISTIO';

  updateRow_(SIRPC.SHEETS.CITAS, cita._rowNumber, {
    EstadoCita: nuevoEstadoCita,
    EstadoRevision: estado,
    FechaVisado: now_(),
    ObservacionesRevisor: obs,
    UsuarioRegistro: usuario
  });

  const plan = rows_(SIRPC.SHEETS.PLANES).find(function(p) { return p.IDPlan === cita.IDPlan; });
  upsertRevision_(cita.IDPlan, cita.TipoRevision, {
    EstadoRevision: estado,
    NumeroReservaActivo: '',
    FechaVisado: now_(),
    ObservacionesRevisor: obs,
    ActualizadoEn: now_()
  }, plan || {});

  actualizarEstadoGeneralPlan_(cita.IDPlan);

  return { ok: true, message: 'Revisión actualizada correctamente.' };
}

function upsertRevision_(idPlan, tipo, updates, plan) {
  const revisiones = rows_(SIRPC.SHEETS.REVISIONES);
  const rev = revisiones.find(function(r) { return r.IDPlan === idPlan && r.TipoRevision === tipo; });

  if (rev) {
    updateRow_(SIRPC.SHEETS.REVISIONES, rev._rowNumber, updates);
    return;
  }

  const obj = {
    IDRevision: idPlan + '-' + tipo,
    IDPlan: idPlan,
    TipoRevision: tipo,
    RevisorAsignado: SIRPC.REVISORES[tipo] || '',
    'Documento Profesor': plan['Documento Profesor'] || '',
    'Nombre_Completo': plan['Nombre_Completo'] || '',
    'Correo-E': plan['Correo-E'] || '',
    'ID Curso': plan['ID Curso'] || '',
    'Descripción': plan['Descripción'] || '',
    'Nº Clase': plan['Nº Clase'] || '',
    EstadoRevision: updates.EstadoRevision || 'PENDIENTE',
    NumeroReservaActivo: updates.NumeroReservaActivo || '',
    FechaCita: updates.FechaCita || '',
    HoraCita: updates.HoraCita || '',
    Jornada: updates.Jornada || '',
    FechaVisado: updates.FechaVisado || '',
    ObservacionesRevisor: updates.ObservacionesRevisor || '',
    ActualizadoEn: updates.ActualizadoEn || now_()
  };
  appendObject_(SIRPC.SHEETS.REVISIONES, obj);
}

function actualizarEstadoGeneralPlan_(idPlan) {
  const revs = rows_(SIRPC.SHEETS.REVISIONES).filter(function(r) { return r.IDPlan === idPlan; });
  const required = SIRPC.TIPOS_REVISION.every(function(tipo) {
    return revs.some(function(r) { return r.TipoRevision === tipo && upper_(r.EstadoRevision) === 'VISADO'; });
  });

  if (!required) return;

  const planes = rows_(SIRPC.SHEETS.PLANES);
  const plan = planes.find(function(p) { return p.IDPlan === idPlan; });
  if (plan) {
    updateRow_(SIRPC.SHEETS.PLANES, plan._rowNumber, { EstadoPlan: 'COMPLETAMENTE_VISADO' });
  }
}
