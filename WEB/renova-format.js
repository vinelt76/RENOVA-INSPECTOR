/* RENOVA — formato de fecha compartido (dd/mm/aaaa) para los dashboards
   clásicos (script no-module). Versión defensiva: valida el número de
   segmentos antes de reordenar en vez de asumir el formato de entrada. */
window.RenovaFormat = {
  date: function (iso) {
    if (!iso) return "—";
    var p = String(iso).split("-");
    return p.length === 3 ? p[2] + "/" + p[1] + "/" + p[0] : String(iso);
  },
};
