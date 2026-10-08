-- Auto-clasificación por palabras clave y seguimiento de SLA

-- AlterTable
ALTER TABLE "Categoria" ADD COLUMN     "palabrasClave" STRING;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "equipoId" UUID;
ALTER TABLE "Ticket" ADD COLUMN     "supervisorId" UUID;

-- CreateTable
CREATE TABLE "SlaAviso" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "tipo" STRING NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SlaAviso_pkey" PRIMARY KEY ("id")
);

-- CockroachDB crea tablas nuevas con schema_locked = true; hay que
-- desbloquearla para poder crear los índices de debajo.
ALTER TABLE "SlaAviso" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "SlaAviso_ticketId_tipo_key" ON "SlaAviso"("ticketId", "tipo");

-- CreateIndex
CREATE INDEX "SlaAviso_ticketId_idx" ON "SlaAviso"("ticketId");

-- CreateIndex
CREATE INDEX "Ticket_equipoId_idx" ON "Ticket"("equipoId");

-- CreateIndex
CREATE INDEX "Ticket_supervisorId_idx" ON "Ticket"("supervisorId");

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "Equipo"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Ticket" ADD CONSTRAINT "Ticket_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SlaAviso" ADD CONSTRAINT "SlaAviso_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;