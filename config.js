/* ==========================================================================
   SIRPC · Configuración general
   IMPORTANTE:
   1) Pegue aquí la URL /exec de Google Apps Script.
   2) Edite aquí las fechas y horarios disponibles.
   3) Cada vez que cambie este archivo, actualice también el parámetro ?v=
      en los HTML o presione Ctrl+F5 en el navegador.
   ========================================================================== */

window.SIRPC_CONFIG = {
  API_URL: "https://script.google.com/macros/s/AKfycbz9fGHEmnLopk7nF_66Bju08bZ9Uh3ALK-vJyS8E-g59qhUxAoUJTltNUiU0Y1_8uIt/exec",

  VERSION: "20260723-HR01",

  MAX_CUPOS_HORARIO: 4,

  // Edite estas fechas según la jornada real de revisión.
  // Formato obligatorio: AAAA-MM-DD.
  FECHAS_DISPONIBLES: [
    "2026-07-27",
    "2026-07-28",
    "2026-07-29",
    "2026-07-30",
    "2026-07-31"
  ],

  HORARIOS: {
    manana: ["08:00", "09:00", "10:00", "11:00"],
    tarde: ["14:00", "15:00", "16:00"] 
  },

  REVISORES: {
    SIB: "Marisorelis Carrillo Cantillo",
    APA: "Emilio Alfonso Lara",
    Campus: "Adriana Milena Jimenez Camacho"
  }
};
