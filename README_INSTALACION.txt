SIRPC V3 - Reserva integral + login de revisores
=================================================

CAMBIO PRINCIPAL DE ESTA VERSION
- La página index.html ya NO muestra accesos a Citas ni Revisores.
- El docente solo ve el formulario para consultar planes y agendar la cita integral.
- Cada cita integral sirve para SIB, APA y Rizoma en el mismo horario.
- Los revisores entran directamente por revision.html.
- Cada revisor hace login y solo carga sus revisiones asignadas.
- En la tabla del revisor se muestra también el estado de los otros revisores para el mismo plan: SIB, APA y Rizoma.

ARCHIVOS PARA GITHUB
Subir/reemplazar en el repositorio sirpc:
- index.html
- citas.html
- revision.html
- app.js
- styles.css
- config.js
- assets/logo-ucc.svg

IMPORTANTE SOBRE config.js
Si su config.js actual ya tiene la URL /exec funcionando, puede conservarlo.
Si reemplaza config.js, debe pegar nuevamente la URL de Apps Script que termina en /exec.

APPS SCRIPT
1. Abrir el Google Sheets oficial: Citas Verificación Planes de Curso 2026.
2. Ir a Extensiones > Apps Script.
3. Borrar todo Código.gs.
4. Pegar el contenido del archivo Codigo.gs de este paquete.
5. Guardar.
6. Ejecutar setupSirpc una vez y autorizar permisos.
7. Implementar > Administrar implementaciones > Editar > Nueva versión.
8. Mantener:
   - Ejecutar como: Yo
   - Quién tiene acceso: Cualquier usuario
9. Implementar.

HOJA REVISORES
Al ejecutar setupSirpc, se agregan columnas si no existen:
- Usuario
- Clave

Usuarios y claves iniciales:
- SIB     usuario: sib     clave: SIB2026
- APA     usuario: apa     clave: APA2026
- Rizoma  usuario: rizoma  clave: RIZOMA2026

Puede cambiar esas claves directamente en la hoja Revisores.
No borre las columnas TipoRevision, Revisor, Correo, Usuario, Clave, Estado.

URLS DEL SISTEMA
Docentes:
https://TU_USUARIO.github.io/sirpc/

Revisores:
https://TU_USUARIO.github.io/sirpc/revision.html

Administrativo opcional:
https://TU_USUARIO.github.io/sirpc/citas.html

PRUEBA RAPIDA
1. Entrar como docente al index.html.
2. Buscar un docente por documento o correo.
3. Agendar una cita integral.
4. Entrar a revision.html.
5. Iniciar sesión como SIB.
6. Confirmar que solo carguen revisiones SIB.
7. Registrar VISADO u observación.
8. Entrar como APA o Rizoma y verificar que ven su propia lista, pero también el estado de SIB, APA y Rizoma.
