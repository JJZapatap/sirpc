SIRPC - Sistema de Información para la Revisión de Planes de Curso
Versión V2 Integral

CAMBIO PRINCIPAL DE ESTA VERSIÓN
Una sola reserva por plan de curso cubre simultáneamente las tres revisiones:
- SIB: Marisorelis Carrillo Cantillo
- APA: Emilio Alfonso Lara
- Rizoma: Adriana Milena Jimenez Camacho

El docente ya no reserva por separado SIB, APA y Rizoma. Selecciona una única fecha y hora, y en ese mismo espacio los tres revisores pueden registrar su resultado.

ARCHIVOS PARA GITHUB
Suba estos archivos al repositorio sirpc:
- index.html
- citas.html
- revision.html
- config.js
- app.js
- styles.css
- assets/logo-ucc.svg

ARCHIVO PARA GOOGLE APPS SCRIPT
En el Google Sheets oficial, abra:
Extensiones > Apps Script
Borre todo el contenido de Código.gs y pegue completo el archivo:
- Codigo.gs

Después:
1. Guarde.
2. Ejecute una vez la función setupSirpc.
3. Autorice permisos.
4. Implemente como Aplicación web.
5. Ejecutar como: Yo.
6. Acceso: Cualquier usuario.
7. Copie la URL terminada en /exec.
8. Pegue esa URL en config.js.

CONFIG.JS
Debe quedar así:
window.SIRPC_CONFIG = {
  API_URL: "https://script.google.com/macros/s/XXXXXXXXXXXX/exec"
};

HOJAS ESPERADAS EN GOOGLE SHEETS
- PlanesCurso
- Revisiones
- Citas
- Revisores
- Horarios
- Configuracion

LÓGICA DE CUPO
Cada horario permite 3 reservas por hora.
Cuando una cita se reserva, baja el cupo disponible:
3/3 -> 2/3 -> 1/3 -> no se muestra si llega a 0.
Si el docente cancela, el cupo se libera.

LÓGICA DE REVISIÓN
Al reservar un plan, se crean/actualizan tres registros en la hoja Revisiones:
- IDPlan + SIB
- IDPlan + APA
- IDPlan + Rizoma

Todos quedan asociados al mismo NumeroReserva.
En revision.html cada revisor filtra por su tipo y registra:
- VISADO
- CON OBSERVACIONES
- NO ASISTIÓ

Cuando los tres quedan VISADO, el plan queda COMPLETAMENTE VISADO.
