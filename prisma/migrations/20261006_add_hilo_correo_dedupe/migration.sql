-- AlterTable
ALTER TABLE "Comentario" ADD COLUMN     "messageId" STRING;

-- AlterTable
ALTER TABLE "Ticket" ADD COLUMN     "messageId" STRING;
ALTER TABLE "Ticket" ADD COLUMN     "threadRefs" STRING;
ALTER TABLE "Ticket" ADD COLUMN     "ultimoMessageId" STRING;

-- CreateTable
CREATE TABLE "CorreoProcesado" (
    "id" UUID NOT NULL,
    "messageId" STRING NOT NULL,
    "ticketId" UUID,
    "codigo" STRING,
    "origen" STRING,
    "procesadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CorreoProcesado_pkey" PRIMARY KEY ("id")
);

-- CockroachDB crea tablas nuevas con schema_locked = true; hay que
-- desbloquearla para poder crear los índices de debajo (y poder hacer
-- futuros ALTER sobre esta tabla).
ALTER TABLE "CorreoProcesado" SET (schema_locked = false);

-- CreateIndex
CREATE UNIQUE INDEX "CorreoProcesado_messageId_key" ON "CorreoProcesado"("messageId");

-- CreateIndex
CREATE INDEX "CorreoProcesado_ticketId_idx" ON "CorreoProcesado"("ticketId");

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_messageId_key" ON "Ticket"("messageId");
