/* SIRPC - Cliente GitHub Pages + Google Apps Script */
(function(){
  const cfg = window.SIRPC_CONFIG || {};
  const API_URL = cfg.API_URL || "";
  window.SIRPC = {
    api,
    notify,
    fmtDateLong,
    fmtShortDate,
    estadoPill,
    escapeHtml,
    downloadCsv,
    normalize,
    getApiUrl
  };

  function getApiUrl(){
    const url = String(API_URL || "").trim();
    if(!url || url.includes("https://script.google.com/macros/s/AKfycbzSS5YG1DznWUhVfzHTVkfvBvyhOyB78997eo2oXQNh2ztLyS_TmB45QJwxOeTiij7s/exec") || url.includes("https://script.google.com/macros/s/AKfycbzSS5YG1DznWUhVfzHTVkfvBvyhOyB78997eo2oXQNh2ztLyS_TmB45QJwxOeTiij7s/exec") || !url.endsWith("/exec")){
      throw new Error("Falta configurar la URL /exec de Google Apps Script en config.js");
    }
    return url;
  }

  function api(action, payload){
    return new Promise((resolve,reject)=>{
      let base;
      try{ base = getApiUrl(); }catch(e){ reject(e); return; }
      const cb = "sirpc_cb_" + Date.now() + "_" + Math.floor(Math.random()*100000);
      const timer = setTimeout(()=>{
        cleanup();
        reject(new Error("Tiempo de espera agotado consultando Apps Script"));
      }, 30000);
      function cleanup(){
        clearTimeout(timer);
        delete window[cb];
        if(script && script.parentNode) script.parentNode.removeChild(script);
      }
      window[cb] = function(resp){
        cleanup();
        if(resp && resp.ok === false){ reject(new Error(resp.message || "Error en el servidor")); }
        else resolve(resp);
      };
      const script = document.createElement("script");
      const sep = base.includes("?") ? "&" : "?";
      const data = encodeURIComponent(JSON.stringify(payload || {}));
      script.src = base + sep + "action=" + encodeURIComponent(action) + "&callback=" + encodeURIComponent(cb) + "&payload=" + data + "&_=" + Date.now();
      script.onerror = ()=>{ cleanup(); reject(new Error("No fue posible conectar con Apps Script")); };
      document.body.appendChild(script);
    });
  }

  function notify(target, type, msg){
    const el = typeof target === "string" ? document.querySelector(target) : target;
    if(!el) return;
    el.innerHTML = `<div class="notice ${type}">${escapeHtml(msg)}</div>`;
  }

  function normalize(v){ return String(v || "").trim().toLowerCase(); }

  function fmtShortDate(s){
    if(!s) return "";
    const p = String(s).split("-");
    if(p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`;
    return s;
  }

  function fmtDateLong(s){
    if(!s) return "";
    const p = String(s).split("-");
    if(p.length !== 3) return s;
    const d = new Date(Number(p[0]), Number(p[1])-1, Number(p[2]));
    return d.toLocaleDateString("es-CO", { weekday:"long", day:"numeric", month:"long", year:"numeric" });
  }

  function estadoPill(estado){
    const e = String(estado || "PENDIENTE").toUpperCase();
    if(["VISADO","REVISADO","APROBADO","COMPLETAMENTE VISADO"].includes(e)) return `<span class="pill ok">✓ ${escapeHtml(e)}</span>`;
    if(["CITA RESERVADA","RESERVADA","ACTIVA","CONFIRMADA","EN PROCESO"].includes(e)) return `<span class="pill info">● ${escapeHtml(e)}</span>`;
    if(["CON OBSERVACIONES","OBSERVACIONES","NO ASISTIÓ","NO ASISTIO"].includes(e)) return `<span class="pill warn">! ${escapeHtml(e)}</span>`;
    if(["CANCELADA","ANULADA"].includes(e)) return `<span class="pill err">× ${escapeHtml(e)}</span>`;
    return `<span class="pill gray">${escapeHtml(e)}</span>`;
  }

  function escapeHtml(v){
    return String(v ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;","\"":"&quot;"}[c]));
  }

  function downloadCsv(filename, rows){
    if(!rows || !rows.length) return;
    const headers = Object.keys(rows[0]);
    const csv = [headers.join(";")].concat(rows.map(r => headers.map(h => csvCell(r[h])).join(";"))).join("\n");
    const blob = new Blob(["\ufeff" + csv], {type:"text/csv;charset=utf-8"});
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); }, 200);
  }
  function csvCell(v){
    const s = String(v ?? "");
    return '"' + s.replace(/"/g,'""') + '"';
  }
})();
