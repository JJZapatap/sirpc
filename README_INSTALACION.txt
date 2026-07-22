SIRPC - Sistema de Información para la Revisión de Planes de Curso
Repositorio sugerido: sirpc

CONTENIDO DEL PAQUETE
---------------------
index.html       Página del docente para consultar planes y agendar revisiones.
citas.html       Página administrativa para consultar citas registradas.
revision.html    Página de revisores para marcar VISADO, CON OBSERVACIONES o NO ASISTIÓ.
config.js        Archivo donde se pega la URL /exec de Google Apps Script.
app.js           Funciones compartidas de conexión y utilidades.
styles.css       Estilos visuales del sistema.
Codigo.gs        Backend para pegar en Google Apps Script.
assets/logo-ucc.svg  Logo provisional SIRPC/UCC. Puede reemplazarse por el logo oficial.

REQUISITO PREVIO
----------------
Debe existir el Google Sheets oficial basado en la plantilla V2:
Citas Verificación Planes de Curso 2026

Debe tener estas hojas:
PlanesCurso
Revisiones
Citas
Revisores
Horarios
Configuracion
Duplicados

La hoja Horarios ya debe tener las fechas del 23 de julio al 06 de agosto de 2026,
con jornadas de mañana y tarde, y 3 cupos por horario.

PASO 1 - PEGAR EL BACKEND EN GOOGLE APPS SCRIPT
------------------------------------------------
1. Abra el Google Sheets oficial.
2. Vaya a Extensiones > Apps Script.
3. Borre el contenido de Código.gs.
4. Pegue todo el contenido del archivo Codigo.gs de este paquete.
5. Guarde.
6. Ejecute manualmente la función setupSirpc una vez para validar/crear encabezados.
7. Autorice los permisos solicitados.

PASO 2 - IMPLEMENTAR COMO APLICACIÓN WEB
----------------------------------------
1. En Apps Script, haga clic en Implementar > Nueva implementación.
2. Tipo: Aplicación web.
3. Ejecutar como: Yo.
4. Quién tiene acceso: Cualquier usuario.
5. Implementar.
6. Copie la URL que termina en /exec.

PASO 3 - CONFIGURAR GITHUB
--------------------------
1. Abra config.js.
2. Reemplace:
   PEGUE_AQUI_LA_URL_DE_APPS_SCRIPT
   por la URL /exec copiada desde Apps Script.
3. Guarde.

PASO 4 - SUBIR AL REPOSITORIO sirpc
-----------------------------------
Suba estos archivos al repositorio GitHub llamado sirpc:
index.html
citas.html
revision.html
config.js
app.js
styles.css
assets/logo-ucc.svg

También puede subir Codigo.gs y este README como respaldo, aunque Codigo.gs se usa realmente en Apps Script.

PASO 5 - ACTIVAR GITHUB PAGES
-----------------------------
1. En GitHub abra el repositorio sirpc.
2. Settings > Pages.
3. Source: Deploy from a branch.
4. Branch: main / root.
5. Guardar.

La página quedará normalmente en:
https://TU_USUARIO.github.io/sirpc/

PRUEBA RÁPIDA
-------------
1. Abra index.html desde GitHub Pages.
2. Ingrese documento o correo de un docente que exista en PlanesCurso.
3. El sistema debe cargar sus planes.
4. Agende SIB, APA o Rizoma.
5. Verifique que se registre en la hoja Citas.
6. Verifique que el cupo del horario baje de 3/3 a 2/3.
7. Abra citas.html y revise el registro.
8. Abra revision.html y marque VISADO o CON OBSERVACIONES.

REGLAS IMPLEMENTADAS
--------------------
- Cada plan debe pasar por tres revisiones: SIB, APA y Rizoma.
- No se permite duplicar una cita activa para el mismo IDPlan y el mismo TipoRevision.
- Cada horario tiene 3 cupos.
- Si un horario llega a 0 cupos, ya no se muestra al docente.
- Si se cancela una cita, el cupo vuelve a quedar disponible.
- Si una revisión queda VISADA, ya no permite volver a agendar esa misma revisión.
- Si queda CON OBSERVACIONES o NO ASISTIÓ, se puede volver a agendar porque no quedó visada.

NOTA DE SEGURIDAD
-----------------
Este paquete mantiene la misma filosofía del proyecto anterior: GitHub Pages como interfaz pública y Google Sheets como base de datos.
Las páginas citas.html y revision.html no tienen autenticación fuerte. Si se requiere control de acceso real,
se puede agregar una clave simple desde Configuracion o migrar a una implementación con autenticación institucional.
