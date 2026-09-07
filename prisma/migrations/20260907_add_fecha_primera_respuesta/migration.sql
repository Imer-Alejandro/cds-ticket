-- Aditiva y no destructiva: registra la primera respuesta del agente (SLA de respuesta).
ALTER TABLE "Ticket" ADD COLUMN     "fechaPrimeraRespuesta" TIMESTAMP(3);