/* ==========================================================================
   SIRPC · Frontend
   Usa JSONP para evitar bloqueos CORS entre GitHub Pages y Google Apps Script.
   ========================================================================== */

(function(){
  "use strict";

  const CFG = window.SIRPC_CONFIG || {};
  const API_URL = (CFG.API_URL || "").trim();
  const MAX_CUPOS = Number(CFG.MAX_CUPOS_HORARIO || 4);
  const REVISORES = CFG.REVISORES || {
    SIB: "Marisorelis Carrillo Cantillo",
    APA: "Emilio Alfonso Lara",
    Rizoma: "Adriana Milena Jimenez Camacho"
  };
  const HORARIOS = CFG.HORARIOS || { manana: [], tarde: [] };
  const FECHAS = CFG.FECHAS_DISPONIBLES || [];

  let planesActuales = [];
  let agendaActual = null;
  let citasActuales = [];
  let revisionActual = [];

  const $ = (id) => document.getElementById(id);

  function htmlEscape(str){
    return String(str ?? "").replace(/[&<>"']/g, (m) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
    }[m]));
  }

  function normalize(str){
    return String(str ?? "").trim().toLowerCase();
  }

  function formatDate(yyyyMMdd){
    if(!yyyyMMdd) return "";
    const [y,m,d] = String(yyyyMMdd).split("-").map(Number);
    if(!y || !m || !d) return yyyyMMdd;
    const fecha = new Date(y, m-1, d);
    return fecha.toLocaleDateString("es-CO", { weekday:"short", year:"numeric", month:"short", day:"2-digit" });
  }

  function showMsg(text, type="info"){
    const box = $("msg");
    if(!box) return;
    box.className = `msg ${type}`;
    box.innerHTML = text;
  }

  function clearMsg(){
    const box = $("msg");
    if(!box) return;
    box.className = "hidden";
    box.innerHTML = "";
  }

  function validateConfig(){
    if(!API_URL || API_URL.includes("PEGUE_AQUI") || !API_URL.includes("/exec")){
      showMsg("Falta configurar la URL /exec de Google Apps Script en <b>config.js</b>.", "error");
      return false;
    }
    return true;
  }

  function apiCall(action, payload = {}){
    if(!validateConfig()) return Promise.reject(new Error("API_URL no configurada"));

    return new Promise((resolve, reject) => {
      const cbName = "sirpc_cb_" + Date.now() + "_" + Math.random().toString(36).slice(2);
      const script = document.createElement("script");
      const timer = setTimeout(() => {
        cleanup();
        reject(new Error("Tiempo de espera agotado consultando Google Apps Script."));
      }, 30000);

      function cleanup(){
        clearTimeout(timer);
        try { delete window[cbName]; } catch(e) { window[cbName] = undefined; }
        if(script.parentNode) script.parentNode.removeChild(script);
      }

      window[cbName] = function(response){
        cleanup();
        if(response && response.ok){
          resolve(response);
        }else{
          reject(new Error((response && response.message) || "Respuesta no válida del backend."));
        }
      };

      const url = API_URL
        + "?action=" + encodeURIComponent(action)
        + "&payload=" + encodeURIComponent(JSON.stringify(payload || {}))
        + "&callback=" + encodeURIComponent(cbName)
        + "&_=" + Date.now();

      script.onerror = function(){
        cleanup();
        reject(new Error("No se pudo conectar con Google Apps Script. Revise la URL /exec y permisos de implementación."));
      };
      script.src = url;
      document.body.appendChild(script);
    });
  }

  function badgeEstado(estado){
    const e = normalize(estado || "PENDIENTE");
    let cls = "pendiente";
    if(e.includes("reserv")) cls = "reservada";
    if(e.includes("visado")) cls = "visado";
    if(e.includes("observ")) cls = "obs";
    if(e.includes("cancel")) cls = "cancelada";
    if(e.includes("asist")) cls = "no";
    return `<span class="badge ${cls}">${htmlEscape(estado || "PENDIENTE")}</span>`;
  }

  function init(){
    const page = document.body.dataset.page;
    if(!validateConfig()) return;

    if(page === "docente") initDocente();
    if(page === "citas") initCitas();
    if(page === "revision") initRevision();
  }

  // -----------------------------------------------------------------------
  // Página docente
  // -----------------------------------------------------------------------
  function initDocente(){
    $("btnCargarPlanes").addEventListener("click", cargarPlanes);
    $("txtConsulta").addEventListener("keydown", (e) => {
      if(e.key === "Enter") cargarPlanes();
    });
  }

  async function cargarPlanes(){
    clearMsg();
    const query = $("txtConsulta").value.trim();
    if(!query){
      showMsg("Ingrese documento o correo institucional.", "warn");
      return;
    }
    $("btnCargarPlanes").disabled = true;
    $("btnCargarPlanes").textContent = "Cargando...";
    $("planesContainer").innerHTML = "";
    $("agendaBox").classList.add("hidden");

    try{
      const res = await apiCall("buscarPlanes", { query });
      planesActuales = res.planes || [];
      renderResumenDocente(res);
      renderPlanes();
      if(planesActuales.length === 0){
        showMsg("No se encontraron planes activos para el documento/correo ingresado.", "warn");
      }else{
        showMsg(`Se encontraron <b>${planesActuales.length}</b> planes de curso asignados.`, "ok");
      }
    }catch(err){
      showMsg(err.message, "error");
    }finally{
      $("btnCargarPlanes").disabled = false;
      $("btnCargarPlanes").textContent = "Cargar planes asignados";
    }
  }

  function renderResumenDocente(res){
    const box = $("resumenDocente");
    if(!box) return;
    if(!res.docente){
      box.classList.add("hidden");
      return;
    }
    box.classList.remove("hidden");
    box.innerHTML = `
      <h2>👤 Docente</h2>
      <div class="grid">
        <div><b>Nombre:</b><br>${htmlEscape(res.docente.nombre || "")}</div>
        <div><b>Documento:</b><br>${htmlEscape(res.docente.documento || "")}</div>
        <div><b>Correo:</b><br>${htmlEscape(res.docente.correo || "")}</div>
        <div><b>Planes activos:</b><br>${htmlEscape(res.planes?.length || 0)}</div>
      </div>
    `;
  }

  function renderPlanes(){
    const cont = $("planesContainer");
    cont.innerHTML = "";

    planesActuales.forEach((plan, idx) => {
      const revisiones = plan.revisiones || [];
      const revHtml = revisiones.map((rev) => {
        const estado = rev.EstadoRevision || "PENDIENTE";
        const puedeAgendar = !["VISADO", "CITA_RESERVADA"].includes(String(estado).toUpperCase()) && !rev.citaActiva;
        const puedeCancelar = !!rev.citaActiva;

        return `
          <div class="rev-card">
            <h4>${htmlEscape(rev.TipoRevision)}</h4>
            <div>${badgeEstado(estado)}</div>
            <div class="revisor">${htmlEscape(rev.RevisorAsignado || REVISORES[rev.TipoRevision] || "")}</div>
            ${rev.FechaCita ? `<div class="revisor"><b>Cita:</b> ${htmlEscape(formatDate(rev.FechaCita))} · ${htmlEscape(rev.HoraCita)} · ${htmlEscape(rev.Jornada)}</div>` : ""}
            ${puedeAgendar ? `<button class="btn-green btn-small" data-action="agendar" data-plan="${idx}" data-tipo="${htmlEscape(rev.TipoRevision)}">Agendar</button>` : ""}
            ${puedeCancelar ? `<button class="btn-danger btn-small" data-action="cancelar" data-plan="${idx}" data-tipo="${htmlEscape(rev.TipoRevision)}">Cancelar cita</button>` : ""}
            ${estado === "VISADO" ? `<div class="revisor">Revisión cerrada con check.</div>` : ""}
          </div>
        `;
      }).join("");

      const div = document.createElement("div");
      div.className = "plan";
      div.innerHTML = `
        <div class="plan-title">${htmlEscape(plan["Descripción"] || "Plan de curso")}</div>
        <div class="plan-meta">
          <b>IDPlan:</b> ${htmlEscape(plan.IDPlan)}<br>
          <b>ID Curso:</b> ${htmlEscape(plan["ID Curso"])} ·
          <b>Nº Clase:</b> ${htmlEscape(plan["Nº Clase"])} ·
          <b>Org Acad:</b> ${htmlEscape(plan["Org Acad"])}<br>
          <b>Estudiantes:</b> ${htmlEscape(plan["Total de Estudiantes Inscritos"])} ·
          <b>Modo:</b> ${htmlEscape(plan["Modo Enseñanza"])} ·
          <b>Asignación:</b> ${htmlEscape(plan["Asignación Profesor"])}
        </div>
        <div class="rev-grid">${revHtml}</div>
      `;
      cont.appendChild(div);
    });

    cont.querySelectorAll("button[data-action='agendar']").forEach(btn => {
      btn.addEventListener("click", () => abrirAgenda(Number(btn.dataset.plan), btn.dataset.tipo));
    });
    cont.querySelectorAll("button[data-action='cancelar']").forEach(btn => {
      btn.addEventListener("click", () => cancelarCita(Number(btn.dataset.plan), btn.dataset.tipo));
    });
  }

  function abrirAgenda(planIndex, tipoRevision){
    const plan = planesActuales[planIndex];
    agendaActual = { plan, tipoRevision, fecha: FECHAS[0] || "", jornada: "manana", hora: "" };

    const box = $("agendaBox");
    box.classList.remove("hidden");
    box.innerHTML = `
      <h2>🗓️ Agendar revisión ${htmlEscape(tipoRevision)}</h2>
      <p class="help">
        Plan: <b>${htmlEscape(plan["Descripción"])}</b><br>
        Revisor: <b>${htmlEscape(REVISORES[tipoRevision] || "")}</b>
      </p>
      <h3>1. Seleccione fecha</h3>
      <div class="date-grid" id="fechaGrid">
        ${FECHAS.map(f => `<div class="choice ${f===agendaActual.fecha?'sel':''}" data-fecha="${htmlEscape(f)}">${htmlEscape(formatDate(f))}</div>`).join("")}
      </div>
      <h3>2. Seleccione jornada</h3>
      <div class="journey-grid">
        <div class="choice sel" data-jornada="manana">🌞 Mañana<br></div>
        <div class="choice" data-jornada="tarde">🌇 Tarde<br></div>
      </div>
      <h3>3. Horarios disponibles</h3>
      <div id="slotsMsg" class="msg info">Cargando disponibilidad...</div>
      <div class="slots" id="slotsGrid"></div>
      <div class="row">
        <button id="btnConfirmarAgenda" class="btn-green" disabled>Confirmar cita</button>
        <button id="btnCerrarAgenda" class="btn-outline">Cerrar</button>
      </div>
    `;

    box.scrollIntoView({ behavior:"smooth", block:"start" });

    box.querySelectorAll("[data-fecha]").forEach(el => {
      el.addEventListener("click", () => {
        agendaActual.fecha = el.dataset.fecha;
        agendaActual.hora = "";
        box.querySelectorAll("[data-fecha]").forEach(x => x.classList.remove("sel"));
        el.classList.add("sel");
        cargarDisponibilidad();
      });
    });
    box.querySelectorAll("[data-jornada]").forEach(el => {
      el.addEventListener("click", () => {
        agendaActual.jornada = el.dataset.jornada;
        agendaActual.hora = "";
        box.querySelectorAll("[data-jornada]").forEach(x => x.classList.remove("sel"));
        el.classList.add("sel");
        cargarDisponibilidad();
      });
    });
    $("btnCerrarAgenda").addEventListener("click", () => box.classList.add("hidden"));
    $("btnConfirmarAgenda").addEventListener("click", confirmarAgenda);

    cargarDisponibilidad();
  }

  async function cargarDisponibilidad(){
    const slotsGrid = $("slotsGrid");
    const slotsMsg = $("slotsMsg");
    const btn = $("btnConfirmarAgenda");
    if(!slotsGrid || !agendaActual) return;
    slotsGrid.innerHTML = "";
    btn.disabled = true;

    if(!agendaActual.fecha){
      slotsMsg.className = "msg warn";
      slotsMsg.textContent = "No hay fechas configuradas en config.js.";
      return;
    }

    slotsMsg.className = "msg info";
    slotsMsg.textContent = "Consultando cupos ocupados...";

    try{
      const res = await apiCall("getDisponibilidad", {
        fecha: agendaActual.fecha,
        jornada: agendaActual.jornada,
        tipoRevision: agendaActual.tipoRevision
      });
      const ocupados = res.ocupados || {};
      const lista = HORARIOS[agendaActual.jornada] || [];

      slotsGrid.innerHTML = lista.map(h => {
        const usados = Number(ocupados[h] || 0);
        const quedan = Math.max(0, MAX_CUPOS - usados);
        const full = quedan <= 0;
        return `
          <div class="slot ${full ? 'full' : ''}" data-hora="${htmlEscape(h)}">
            ${htmlEscape(h)}
            <small>${full ? "Sin cupos" : `Quedan ${quedan}/${MAX_CUPOS}`}</small>
          </div>
        `;
      }).join("");

      slotsGrid.querySelectorAll(".slot:not(.full)").forEach(el => {
        el.addEventListener("click", () => {
          agendaActual.hora = el.dataset.hora;
          slotsGrid.querySelectorAll(".slot").forEach(x => x.classList.remove("sel"));
          el.classList.add("sel");
          btn.disabled = false;
        });
      });

      slotsMsg.className = "msg ok";
      slotsMsg.textContent = `Cada horario admite máximo ${MAX_CUPOS} reservas para ${agendaActual.tipoRevision}. Los horarios llenos no se deben seleccionar.`;
    }catch(err){
      slotsMsg.className = "msg error";
      slotsMsg.textContent = err.message;
    }
  }

  async function confirmarAgenda(){
    if(!agendaActual || !agendaActual.hora){
      showMsg("Seleccione un horario.", "warn");
      return;
    }
    const btn = $("btnConfirmarAgenda");
    btn.disabled = true;
    btn.textContent = "Guardando...";

    try{
      const p = agendaActual.plan;
      const payload = {
        IDPlan: p.IDPlan,
        TipoRevision: agendaActual.tipoRevision,
        RevisorAsignado: REVISORES[agendaActual.tipoRevision],
        FechaCita: agendaActual.fecha,
        HoraCita: agendaActual.hora,
        Jornada: agendaActual.jornada === "manana" ? "Mañana" : "Tarde",
        "Documento Profesor": p["Documento Profesor"],
        "Nombre_Completo": p["Nombre_Completo"],
        "Correo-E": p["Correo-E"],
        "ID Curso": p["ID Curso"],
        "Descripción": p["Descripción"],
        "Nº Clase": p["Nº Clase"]
      };
      const res = await apiCall("reservarCita", payload);
      showMsg(`Cita registrada correctamente. Número de reserva: <b>${htmlEscape(res.numeroReserva)}</b>`, "ok");
      $("agendaBox").classList.add("hidden");
      await cargarPlanes();
    }catch(err){
      showMsg(err.message, "error");
      btn.disabled = false;
      btn.textContent = "Confirmar cita";
    }
  }

  async function cancelarCita(planIndex, tipoRevision){
    const plan = planesActuales[planIndex];
    const motivo = prompt("Motivo de cancelación (opcional):") || "";
    try{
      const res = await apiCall("cancelarCita", {
        IDPlan: plan.IDPlan,
        TipoRevision: tipoRevision,
        "Documento Profesor": plan["Documento Profesor"],
        MotivoCancelacion: motivo
      });
      showMsg(res.message || "Cita cancelada. El cupo vuelve a quedar disponible.", "ok");
      await cargarPlanes();
    }catch(err){
      showMsg(err.message, "error");
    }
  }

  // -----------------------------------------------------------------------
  // Página citas
  // -----------------------------------------------------------------------
  function initCitas(){
    $("btnRecargarCitas").addEventListener("click", cargarCitas);
    $("btnExportarCitas").addEventListener("click", exportarCitasCSV);
    ["filtroTexto","filtroTipo","filtroEstado"].forEach(id => {
      $(id).addEventListener("input", renderCitas);
      $(id).addEventListener("change", renderCitas);
    });
    cargarCitas();
  }

  async function cargarCitas(){
    clearMsg();
    try{
      const res = await apiCall("listarCitas", {});
      citasActuales = res.citas || [];
      renderCitas();
      showMsg(`Citas cargadas: <b>${citasActuales.length}</b>.`, "ok");
    }catch(err){
      showMsg(err.message, "error");
    }
  }

  function filtrarCitasBase(){
    const texto = normalize($("filtroTexto")?.value || "");
    const tipo = $("filtroTipo")?.value || "";
    const estado = $("filtroEstado")?.value || "";
    return citasActuales.filter(c => {
      const blob = normalize(Object.values(c).join(" "));
      return (!texto || blob.includes(texto))
        && (!tipo || c.TipoRevision === tipo)
        && (!estado || c.EstadoCita === estado);
    });
  }

  function renderCitas(){
    const data = filtrarCitasBase();
    const tabla = $("tablaCitas");
    if(!tabla) return;

    const total = data.length;
    const reservadas = data.filter(c => c.EstadoCita === "RESERVADA").length;
    const canceladas = data.filter(c => c.EstadoCita === "CANCELADA").length;
    const visadas = data.filter(c => c.EstadoRevision === "VISADO").length;
    $("kpisCitas").innerHTML = `
      <div class="kpi"><strong>${total}</strong><span>Registros filtrados</span></div>
      <div class="kpi"><strong>${reservadas}</strong><span>Reservadas</span></div>
      <div class="kpi"><strong>${canceladas}</strong><span>Canceladas</span></div>
      <div class="kpi"><strong>${visadas}</strong><span>Visadas</span></div>
    `;

    tabla.innerHTML = `
      <thead>
        <tr>
          <th>Reserva</th><th>Fecha cita</th><th>Hora</th><th>Revisión</th><th>Docente</th>
          <th>Curso</th><th>Clase</th><th>Estado cita</th><th>Estado revisión</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(c => `
          <tr>
            <td>${htmlEscape(c.NumeroReserva)}</td>
            <td>${htmlEscape(formatDate(c.FechaCita))}</td>
            <td>${htmlEscape(c.HoraCita)}<br><small>${htmlEscape(c.Jornada)}</small></td>
            <td>${htmlEscape(c.TipoRevision)}<br><small>${htmlEscape(c.RevisorAsignado)}</small></td>
            <td>${htmlEscape(c["Nombre_Completo"])}<br><small>${htmlEscape(c["Documento Profesor"])} · ${htmlEscape(c["Correo-E"])}</small></td>
            <td>${htmlEscape(c["Descripción"])}<br><small>ID ${htmlEscape(c["ID Curso"])}</small></td>
            <td>${htmlEscape(c["Nº Clase"])}</td>
            <td>${badgeEstado(c.EstadoCita)}</td>
            <td>${badgeEstado(c.EstadoRevision)}</td>
          </tr>
        `).join("")}
      </tbody>
    `;
  }

  function exportarCitasCSV(){
    const data = filtrarCitasBase();
    if(data.length === 0){
      showMsg("No hay datos para exportar.", "warn");
      return;
    }
    const headers = Object.keys(data[0]);
    const csv = [
      headers.join(";"),
      ...data.map(row => headers.map(h => `"${String(row[h] ?? "").replace(/"/g,'""')}"`).join(";"))
    ].join("\n");
    descargarArchivo("citas_sirpc.csv", csv, "text/csv;charset=utf-8");
  }

  // -----------------------------------------------------------------------
  // Página revisión
  // -----------------------------------------------------------------------
  function initRevision(){
    $("btnCargarRevision").addEventListener("click", cargarRevision);
    $("revTipo").addEventListener("change", cargarRevision);
    $("revBuscar").addEventListener("input", renderRevision);
    cargarRevision();
  }

  async function cargarRevision(){
    clearMsg();
    try{
      const tipo = $("revTipo").value;
      const res = await apiCall("listarCitas", { TipoRevision: tipo });
      revisionActual = (res.citas || []).filter(c => c.TipoRevision === tipo && c.EstadoCita !== "CANCELADA");
      renderRevision();
      showMsg(`Citas cargadas para ${tipo}: <b>${revisionActual.length}</b>.`, "ok");
    }catch(err){
      showMsg(err.message, "error");
    }
  }

  function renderRevision(){
    const texto = normalize($("revBuscar")?.value || "");
    const data = revisionActual.filter(c => !texto || normalize(Object.values(c).join(" ")).includes(texto));
    const tabla = $("tablaRevision");

    const pendientes = data.filter(c => c.EstadoRevision !== "VISADO").length;
    const visadas = data.filter(c => c.EstadoRevision === "VISADO").length;
    $("kpisRevision").innerHTML = `
      <div class="kpi"><strong>${data.length}</strong><span>Citas filtradas</span></div>
      <div class="kpi"><strong>${pendientes}</strong><span>Pendientes</span></div>
      <div class="kpi"><strong>${visadas}</strong><span>Visadas</span></div>
    `;

    tabla.innerHTML = `
      <thead>
        <tr>
          <th>Fecha/Hora</th><th>Docente</th><th>Plan de curso</th><th>Estado</th><th>Acciones</th>
        </tr>
      </thead>
      <tbody>
        ${data.map(c => `
          <tr>
            <td>${htmlEscape(formatDate(c.FechaCita))}<br><b>${htmlEscape(c.HoraCita)}</b> · ${htmlEscape(c.Jornada)}<br><small>${htmlEscape(c.NumeroReserva)}</small></td>
            <td>${htmlEscape(c["Nombre_Completo"])}<br><small>${htmlEscape(c["Documento Profesor"])} · ${htmlEscape(c["Correo-E"])}</small></td>
            <td>${htmlEscape(c["Descripción"])}<br><small>IDPlan: ${htmlEscape(c.IDPlan)} · Clase ${htmlEscape(c["Nº Clase"])}</small></td>
            <td>${badgeEstado(c.EstadoRevision)}<br><small>${htmlEscape(c.ObservacionesRevisor || "")}</small></td>
            <td>
              <button class="btn-green btn-small" data-reserva="${htmlEscape(c.NumeroReserva)}" data-estado="VISADO">Visado ✓</button>
              <button class="btn-outline btn-small" data-reserva="${htmlEscape(c.NumeroReserva)}" data-estado="CON_OBSERVACIONES">Con observaciones</button>
              <button class="btn-danger btn-small" data-reserva="${htmlEscape(c.NumeroReserva)}" data-estado="NO_ASISTIO">No asistió</button>
            </td>
          </tr>
        `).join("")}
      </tbody>
    `;

    tabla.querySelectorAll("button[data-reserva]").forEach(btn => {
      btn.addEventListener("click", () => actualizarRevision(btn.dataset.reserva, btn.dataset.estado));
    });
  }

  async function actualizarRevision(numeroReserva, estado){
    const obs = prompt("Observaciones del revisor (opcional):") || "";
    try{
      const res = await apiCall("actualizarRevision", {
        NumeroReserva: numeroReserva,
        EstadoRevision: estado,
        ObservacionesRevisor: obs,
        UsuarioRegistro: "Revisor"
      });
      showMsg(res.message || "Revisión actualizada.", "ok");
      await cargarRevision();
    }catch(err){
      showMsg(err.message, "error");
    }
  }

  function descargarArchivo(nombre, contenido, mime){
    const blob = new Blob([contenido], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = nombre;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      URL.revokeObjectURL(url);
      a.remove();
    }, 0);
  }

  document.addEventListener("DOMContentLoaded", init);
})();
