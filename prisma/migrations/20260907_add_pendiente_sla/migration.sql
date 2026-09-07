-- Aditiva y no destructiva: SLA del estado PENDIENTE (minutos propios) y su marca de inicio.
ALTER TABLE "Sla" ADD COLUMN     "minutosPendiente" INT4;
ALTER TABLE "Ticket" ADD COLUMN     "fechaPendiente" TIMESTAMP(3);