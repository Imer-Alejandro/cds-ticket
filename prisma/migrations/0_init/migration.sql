-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "public"."Adjunto" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "comentarioId" UUID,
    "url" STRING NOT NULL,
    "tipo" STRING NOT NULL,
    "nombre" STRING NOT NULL,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "data" STRING,
    "tamaño" INT4,

    CONSTRAINT "Adjunto_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Automatizacion" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "descripcion" STRING,
    "condiciones" JSONB NOT NULL,
    "acciones" JSONB NOT NULL,
    "activa" BOOL NOT NULL DEFAULT true,
    "creadaPorId" UUID NOT NULL,

    CONSTRAINT "Automatizacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Categoria" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "descripcion" STRING,
    "colaDefaultId" UUID,

    CONSTRAINT "Categoria_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Cola" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "equipoId" UUID NOT NULL,

    CONSTRAINT "Cola_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Comentario" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "mensaje" STRING NOT NULL,
    "esInterno" BOOL NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Comentario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Configuracion" (
    "id" UUID NOT NULL,
    "clave" STRING NOT NULL,
    "valor" STRING NOT NULL,
    "grupo" STRING NOT NULL,

    CONSTRAINT "Configuracion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Departamento" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "descripcion" STRING,

    CONSTRAINT "Departamento_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EncuestaSatisfaccion" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "puntuacion" INT4 NOT NULL,
    "comentario" STRING,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EncuestaSatisfaccion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Equipo" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "supervisorId" UUID NOT NULL,

    CONSTRAINT "Equipo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."EquipoUsuario" (
    "equipoId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,

    CONSTRAINT "EquipoUsuario_pkey" PRIMARY KEY ("equipoId","usuarioId")
);

-- CreateTable
CREATE TABLE "public"."Etiqueta" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "color" STRING NOT NULL,

    CONSTRAINT "Etiqueta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LogTicket" (
    "id" UUID NOT NULL,
    "ticketId" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "accion" STRING NOT NULL,
    "valorAnterior" STRING,
    "valorNuevo" STRING,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LogTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Notificacion" (
    "id" UUID NOT NULL,
    "usuarioId" UUID NOT NULL,
    "tipo" STRING NOT NULL,
    "mensaje" STRING NOT NULL,
    "ticketId" UUID NOT NULL,
    "leido" BOOL NOT NULL DEFAULT false,
    "fecha" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notificacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PlantillaRespuesta" (
    "id" UUID NOT NULL,
    "titulo" STRING NOT NULL,
    "contenido" STRING NOT NULL,
    "creadaPorId" UUID NOT NULL,
    "esGlobal" BOOL NOT NULL DEFAULT false,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "categoriaId" UUID,

    CONSTRAINT "PlantillaRespuesta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Rol" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "permisos" JSONB,

    CONSTRAINT "Rol_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Sla" (
    "id" UUID NOT NULL,
    "categoriaId" UUID NOT NULL,
    "prioridad" STRING NOT NULL,
    "minutosRespuesta" INT4 NOT NULL,
    "minutosResolucion" INT4 NOT NULL,

    CONSTRAINT "Sla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Ticket" (
    "id" UUID NOT NULL,
    "codigo" STRING NOT NULL,
    "asunto" STRING NOT NULL,
    "descripcion" STRING NOT NULL,
    "estado" STRING NOT NULL,
    "nivelPrioridad" STRING NOT NULL,
    "solicitanteId" UUID NOT NULL,
    "agenteId" UUID,
    "categoriaId" UUID NOT NULL,
    "colaId" UUID,
    "slaId" UUID,
    "origen" STRING NOT NULL,
    "fechaCreacion" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fechaResolucion" TIMESTAMP(3),
    "fechaCierre" TIMESTAMP(3),

    CONSTRAINT "Ticket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."TicketEtiqueta" (
    "ticketId" UUID NOT NULL,
    "etiquetaId" UUID NOT NULL,

    CONSTRAINT "TicketEtiqueta_pkey" PRIMARY KEY ("ticketId","etiquetaId")
);

-- CreateTable
CREATE TABLE "public"."Usuario" (
    "id" UUID NOT NULL,
    "nombre" STRING NOT NULL,
    "apellido" STRING NOT NULL,
    "correo" STRING NOT NULL,
    "userName" STRING NOT NULL,
    "telefono" STRING,
    "departamentoId" UUID,
    "rolId" UUID NOT NULL,
    "fechaRegistro" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "password" STRING,
    "activo" BOOL NOT NULL DEFAULT true,

    CONSTRAINT "Usuario_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Configuracion_clave_key" ON "public"."Configuracion"("clave" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "EncuestaSatisfaccion_ticketId_key" ON "public"."EncuestaSatisfaccion"("ticketId" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Ticket_codigo_key" ON "public"."Ticket"("codigo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_correo_key" ON "public"."Usuario"("correo" ASC);

-- CreateIndex
CREATE UNIQUE INDEX "Usuario_userName_key" ON "public"."Usuario"("userName" ASC);

-- AddForeignKey
ALTER TABLE "public"."Adjunto" ADD CONSTRAINT "Adjunto_comentarioId_fkey" FOREIGN KEY ("comentarioId") REFERENCES "public"."Comentario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Adjunto" ADD CONSTRAINT "Adjunto_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Automatizacion" ADD CONSTRAINT "Automatizacion_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Categoria" ADD CONSTRAINT "Categoria_colaDefaultId_fkey" FOREIGN KEY ("colaDefaultId") REFERENCES "public"."Cola"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Cola" ADD CONSTRAINT "Cola_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "public"."Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Comentario" ADD CONSTRAINT "Comentario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EncuestaSatisfaccion" ADD CONSTRAINT "EncuestaSatisfaccion_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Equipo" ADD CONSTRAINT "Equipo_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EquipoUsuario" ADD CONSTRAINT "EquipoUsuario_equipoId_fkey" FOREIGN KEY ("equipoId") REFERENCES "public"."Equipo"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."EquipoUsuario" ADD CONSTRAINT "EquipoUsuario_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogTicket" ADD CONSTRAINT "LogTicket_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LogTicket" ADD CONSTRAINT "LogTicket_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notificacion" ADD CONSTRAINT "Notificacion_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Notificacion" ADD CONSTRAINT "Notificacion_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlantillaRespuesta" ADD CONSTRAINT "PlantillaRespuesta_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categoria"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PlantillaRespuesta" ADD CONSTRAINT "PlantillaRespuesta_creadaPorId_fkey" FOREIGN KEY ("creadaPorId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Sla" ADD CONSTRAINT "Sla_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_agenteId_fkey" FOREIGN KEY ("agenteId") REFERENCES "public"."Usuario"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_categoriaId_fkey" FOREIGN KEY ("categoriaId") REFERENCES "public"."Categoria"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_colaId_fkey" FOREIGN KEY ("colaId") REFERENCES "public"."Cola"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_slaId_fkey" FOREIGN KEY ("slaId") REFERENCES "public"."Sla"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Ticket" ADD CONSTRAINT "Ticket_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "public"."Usuario"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketEtiqueta" ADD CONSTRAINT "TicketEtiqueta_etiquetaId_fkey" FOREIGN KEY ("etiquetaId") REFERENCES "public"."Etiqueta"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."TicketEtiqueta" ADD CONSTRAINT "TicketEtiqueta_ticketId_fkey" FOREIGN KEY ("ticketId") REFERENCES "public"."Ticket"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_departamentoId_fkey" FOREIGN KEY ("departamentoId") REFERENCES "public"."Departamento"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Usuario" ADD CONSTRAINT "Usuario_rolId_fkey" FOREIGN KEY ("rolId") REFERENCES "public"."Rol"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
