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
    manana: [
      "08:00", "08:15", "08:30", "08:45",
      "09:00", "09:15", "09:30", "09:45",
      "10:00", "10:15", "10:30", "10:45",
      "11:00", "11:15", "11:30", "11:45"
    ],
    tarde: [
      "14:00", "14:15", "14:30", "14:45",
      "15:00", "15:15", "15:30", "15:45",
      "16:00", "16:15", "16:30", "16:45"
    ]
  },

  REVISORES: {
    SIB: "Marisorelis Carrillo Cantillo",
    APA: "Emilio Alfonso Lara",
    Rizoma: "Adriana Milena Jimenez Camacho"
  }
};
