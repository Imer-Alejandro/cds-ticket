"use client"

import { useState, useEffect, useCallback } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  TicketIcon,
  AlertCircle,
  CheckCircle2,
  Clock,
  TrendingUp,
  Users,
  RefreshCw,
  ChevronDown,
  BarChart3,
  PieChart,
  Activity,
  Building2,
  Mail,
  Globe,
  Award,
  FileDown,
} from "lucide-react"
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart as RePieChart, Pie, Cell, Legend,
  BarChart, Bar,
  LineChart, Line,
} from "recharts"
import * as XLSX from "xlsx"

const ESTADOS_COLORS: Record<string, string> = {
  NUEVO: "#3b82f6",
  ASIGNADO: "#8b5cf6",
  EN_PROGRESO: "#f59e0b",
  RESUELTO: "#10b981",
  CERRADO: "#6b7280",
}

const PRIORIDAD_COLORS: Record<string, string> = {
  CRITICA: "#ef4444",
  ALTA: "#f97316",
  MEDIA: "#eab308",
  BAJA: "#22c55e",
}

const DIAS_OPCIONES = [
  { label: "7 días", value: 7 },
  { label: "30 días", value: 30 },
  { label: "90 días", value: 90 },
  { label: "1 año", value: 365 },
  { label: "Todo", value: 0 },
]

interface DashboardData {
  total: number
  abiertos: number
  resueltos: number
  cerrados: number
  enRango: number
  ticketsPorEstado: { nombre: string; cantidad: number }[]
  ticketsPorPrioridad: { nombre: string; cantidad: number }[]
  ticketsPorCategoria: { nombre: string; cantidad: number }[]
  ticketsPorDia: { fecha: string; creados: number; resueltos: number; cerrados: number }[]
  ticketsPorDepartamento: { nombre: string; cantidad: number }[]
  ticketsPorFuente: { nombre: string; cantidad: number }[]
  sla: { cumplidos: number; total: number; porcentaje: number }
  topAgentes: { agenteId: string; nombre: string; apellido: string; total: number }[]
  tiempoResolucionPromedio: number | null
  fechaDesde: string
  fechaHasta: string
}

function useDashboard(days: number, desde?: string, hasta?: string) {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const p = new URLSearchParams()
      if (days > 0) p.set("days", String(days))
      if (desde) p.set("desde", desde)
      if (hasta) p.set("hasta", hasta)
      const qs = p.toString()
      const res = await fetch(`/api/dashboard${qs ? `?${qs}` : ""}`)
      if (!res.ok) throw new Error("Error al cargar datos")
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Error desconocido")
    } finally {
      setLoading(false)
    }
  }, [days, desde, hasta])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  return { data, loading, error, refetch: fetchData }
}

function MetricCard({
  title,
  value,
  subtitle,
  icon: Icon,
  color,
  trend,
}: {
  title: string
  value: string
  subtitle?: string
  icon: React.ElementType
  color: string
  trend?: { value: string; up: boolean }
}) {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm hover:shadow-md transition-all">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className={`p-2.5 rounded-xl ${color}`}>
            <Icon className="h-5 w-5 text-white" />
          </div>
          {trend && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
              trend.up
                ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
            }`}>
              {trend.up ? "↑" : "↓"} {trend.value}
            </span>
          )}
        </div>
        <div className="mt-4">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{title}</p>
          <p className="text-2xl font-bold mt-1 text-foreground">{value}</p>
          {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
        </div>
      </CardContent>
    </Card>
  )
}

function ChartCard({
  title,
  icon: Icon,
  children,
  className,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  className?: string
}) {
  return (
    <Card className={`rounded-2xl border-border/50 shadow-sm ${className || ""}`}>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {children}
      </CardContent>
    </Card>
  )
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-background border border-border rounded-xl shadow-lg p-3 text-xs">
      <p className="font-medium text-foreground mb-1">{label}</p>
      {payload.map((entry: any, i: number) => (
        <p key={i} style={{ color: entry.color }}>
          {entry.name}: <span className="font-semibold">{entry.value}</span>
        </p>
      ))}
    </div>
  )
}

function DonutChart({
  data,
  colors,
}: {
  data: { nombre: string; cantidad: number }[]
  colors: Record<string, string>
}) {
  const total = data.reduce((a, b) => a + b.cantidad, 0)
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={220}>
        <RePieChart>
          <Pie
            data={data}
            dataKey="cantidad"
            nameKey="nombre"
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={2}
            strokeWidth={0}
          >
            {data.map((entry) => (
              <Cell key={entry.nombre} fill={colors[entry.nombre] || "#94a3b8"} />
            ))}
          </Pie>
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value: string) => (
              <span className="text-xs text-muted-foreground">{value}</span>
            )}
          />
        </RePieChart>
      </ResponsiveContainer>
      <div className="text-center -mt-2">
        <p className="text-2xl font-bold text-foreground">{total}</p>
        <p className="text-xs text-muted-foreground">Total</p>
      </div>
    </div>
  )
}

function toLocalDateString(date: Date) {
  return date.toISOString().slice(0, 10)
}

function parseDaysToRange(days: number): { desde: string; hasta: string } {
  const hasta = new Date()
  const desde = days === 0 ? new Date("2020-01-01") : new Date(hasta.getTime() - days * 24 * 60 * 60 * 1000)
  return { desde: toLocalDateString(desde), hasta: toLocalDateString(hasta) }
}

function exportToExcel(d: DashboardData) {
  const wb = XLSX.utils.book_new()

  // Sheet 1: Resumen
  const resumen = [
    ["Métrica", "Valor"],
    ["Total Tickets", d.total],
    ["Abiertos", d.abiertos],
    ["Resueltos", d.resueltos],
    ["Cerrados", d.cerrados],
    ["En período", d.enRango],
    ["Tiempo promedio resolución (h)", d.tiempoResolucionPromedio ?? "—"],
    ["SLA cumplidos", d.sla.cumplidos],
    ["SLA total", d.sla.total],
    ["SLA %", `${d.sla.porcentaje}%`],
    ["Desde", d.fechaDesde.slice(0, 10)],
    ["Hasta", d.fechaHasta.slice(0, 10)],
  ]
  const ws1 = XLSX.utils.aoa_to_sheet(resumen)
  XLSX.utils.book_append_sheet(wb, ws1, "Resumen")

  // Sheet 2: Por Estado
  if (d.ticketsPorEstado.length) {
    const estadoData = [["Estado", "Cantidad"], ...d.ticketsPorEstado.map((e) => [e.nombre, e.cantidad])]
    const ws2 = XLSX.utils.aoa_to_sheet(estadoData)
    XLSX.utils.book_append_sheet(wb, ws2, "Por Estado")
  }

  // Sheet 3: Por Prioridad
  if (d.ticketsPorPrioridad.length) {
    const prioData = [["Prioridad", "Cantidad"], ...d.ticketsPorPrioridad.map((p) => [p.nombre, p.cantidad])]
    const ws3 = XLSX.utils.aoa_to_sheet(prioData)
    XLSX.utils.book_append_sheet(wb, ws3, "Por Prioridad")
  }

  // Sheet 4: Por Categoría
  if (d.ticketsPorCategoria.length) {
    const catData = [["Categoría", "Cantidad"], ...d.ticketsPorCategoria.map((c) => [c.nombre, c.cantidad])]
    const ws4 = XLSX.utils.aoa_to_sheet(catData)
    XLSX.utils.book_append_sheet(wb, ws4, "Por Categoría")
  }

  // Sheet 5: Tendencia Diaria
  if (d.ticketsPorDia.length) {
    const diaData = [
      ["Fecha", "Creados", "Resueltos", "Cerrados"],
      ...d.ticketsPorDia.map((r) => [r.fecha, r.creados, r.resueltos, r.cerrados]),
    ]
    const ws5 = XLSX.utils.aoa_to_sheet(diaData)
    XLSX.utils.book_append_sheet(wb, ws5, "Tendencia Diaria")
  }

  // Sheet 6: Por Departamento
  if (d.ticketsPorDepartamento.length) {
    const deptData = [["Departamento", "Cantidad"], ...d.ticketsPorDepartamento.map((dpt) => [dpt.nombre, dpt.cantidad])]
    const ws6 = XLSX.utils.aoa_to_sheet(deptData)
    XLSX.utils.book_append_sheet(wb, ws6, "Por Departamento")
  }

  // Sheet 7: Fuente
  if (d.ticketsPorFuente.length) {
    const fuenteData = [["Fuente", "Cantidad"], ...d.ticketsPorFuente.map((f) => [f.nombre, f.cantidad])]
    const ws7 = XLSX.utils.aoa_to_sheet(fuenteData)
    XLSX.utils.book_append_sheet(wb, ws7, "Fuente")
  }

  // Sheet 8: Top Agentes
  if (d.topAgentes.length) {
    const agentesData = [
      ["Agente", "Tickets Cerrados"],
      ...d.topAgentes.map((a) => [`${a.nombre} ${a.apellido}`, a.total]),
    ]
    const ws8 = XLSX.utils.aoa_to_sheet(agentesData)
    XLSX.utils.book_append_sheet(wb, ws8, "Top Agentes")
  }

  XLSX.writeFile(wb, `dashboard_${new Date().toISOString().slice(0, 10)}.xlsx`)
}

export default function DashboardPage() {
  const [days, setDays] = useState(30)
  const [customDesde, setCustomDesde] = useState("")
  const [customHasta, setCustomHasta] = useState("")
  const [showCustom, setShowCustom] = useState(false)
  const [autoRefresh, setAutoRefresh] = useState(false)
  const { data, loading, error, refetch } = useDashboard(showCustom ? 0 : days, showCustom ? customDesde : undefined, showCustom ? customHasta : undefined)

  useEffect(() => {
    if (!autoRefresh) return
    const interval = setInterval(refetch, 30000)
    return () => clearInterval(interval)
  }, [autoRefresh, refetch])

  if (loading && !data) {
    return (
      <div className="p-8 max-w-7xl mx-auto space-y-6 animate-pulse">
        <div className="h-8 w-64 bg-muted rounded-lg" />
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-28 bg-muted rounded-2xl" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-72 bg-muted rounded-2xl" />
          <div className="h-72 bg-muted rounded-2xl" />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="h-64 bg-muted rounded-2xl" />
          <div className="h-64 bg-muted rounded-2xl" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8 max-w-7xl mx-auto flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium text-foreground">Error al cargar dashboard</p>
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button onClick={refetch} variant="outline">Reintentar</Button>
      </div>
    )
  }

  if (!data) return null

  const totalAbiertos = data.ticketsPorEstado
    .filter((e) => !["CERRADO", "RESUELTO"].includes(e.nombre))
    .reduce((a, b) => a + b.cantidad, 0)

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.fechaDesde.slice(0, 10)} — {data.fechaHasta.slice(0, 10)}
            {data.total > data.enRango && ` (${data.total - data.enRango} fuera del rango)`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {/* Preset quick filters */}
          <div className="flex bg-muted/50 rounded-xl p-0.5 border border-border/50">
            {DIAS_OPCIONES.map((opt) => (
              <button
                key={opt.value}
                onClick={() => { setDays(opt.value); setShowCustom(false) }}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${
                  !showCustom && days === opt.value
                    ? "bg-background text-foreground shadow-sm border border-border"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Custom date range toggle */}
          <Button
            variant={showCustom ? "default" : "outline"}
            size="sm"
            className="rounded-xl"
            onClick={() => setShowCustom(!showCustom)}
          >
            <BarChart3 className="h-4 w-4 mr-1" />
            Personalizado
          </Button>

          {/* Custom date inputs */}
          {showCustom && (
            <div className="flex items-center gap-2 bg-muted/30 rounded-xl px-3 py-1.5 border border-border/50">
              <input
                type="date"
                value={customDesde}
                onChange={(e) => setCustomDesde(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs w-32"
              />
              <span className="text-xs text-muted-foreground">→</span>
              <input
                type="date"
                value={customHasta}
                onChange={(e) => setCustomHasta(e.target.value)}
                className="bg-background border border-border rounded-lg px-2 py-1 text-xs w-32"
              />
            </div>
          )}

          <div className="w-px h-6 bg-border/50 mx-1" />

          <Button
            variant="outline"
            size="sm"
            className={`rounded-xl ${autoRefresh ? "bg-primary/10 text-primary border-primary/30" : "border-border"}`}
            onClick={() => setAutoRefresh(!autoRefresh)}
          >
            <Activity className={`h-4 w-4 mr-1 ${autoRefresh ? "animate-pulse" : ""}`} />
            Auto
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl border-border" onClick={refetch} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button variant="outline" size="sm" className="rounded-xl border-border" onClick={() => exportToExcel(data)}>
            <FileDown className="h-4 w-4 mr-1" />
            Exportar
          </Button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <MetricCard
          title="Total Tickets"
          value={data.total.toLocaleString()}
          subtitle={`${data.enRango} en período`}
          icon={TicketIcon}
          color="bg-blue-500"
        />
        <MetricCard
          title="Abiertos"
          value={totalAbiertos.toLocaleString()}
          subtitle={`${data.ticketsPorEstado.find((e) => e.nombre === "NUEVO")?.cantidad || 0} nuevos`}
          icon={AlertCircle}
          color="bg-amber-500"
          trend={{ value: `${Math.round(totalAbiertos / Math.max(data.total, 1) * 100)}%`, up: totalAbiertos > 0 }}
        />
        <MetricCard
          title="Resueltos"
          value={data.resueltos.toLocaleString()}
          icon={CheckCircle2}
          color="bg-emerald-500"
          trend={{ value: `${Math.round(data.resueltos / Math.max(data.total, 1) * 100)}%`, up: true }}
        />
        <MetricCard
          title="Cerrados"
          value={data.cerrados.toLocaleString()}
          icon={CheckCircle2}
          color="bg-slate-500"
        />
        <MetricCard
          title="SLA Cumplido"
          value={`${data.sla.porcentaje}%`}
          subtitle={`${data.sla.cumplidos}/${data.sla.total}`}
          icon={Clock}
          color="bg-purple-500"
          trend={{ value: `${data.sla.porcentaje}%`, up: data.sla.porcentaje >= 90 }}
        />
        <MetricCard
          title="Tiempo Promedio"
          value={data.tiempoResolucionPromedio ? `${data.tiempoResolucionPromedio}h` : "—"}
          subtitle="Resolución"
          icon={TrendingUp}
          color="bg-rose-500"
        />
      </div>

      {/* Charts Row 1 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Tickets Over Time */}
        <ChartCard title="Tickets en el Tiempo" icon={Activity} className="lg:col-span-2">
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={data.ticketsPorDia}>
              <defs>
                <linearGradient id="creados" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="resueltos" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis
                dataKey="fecha"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickFormatter={(v: string) => {
                  const d = new Date(v)
                  return `${d.getDate()}/${d.getMonth() + 1}`
                }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="creados" stroke="#3b82f6" fill="url(#creados)" strokeWidth={2} name="Creados" />
              <Area type="monotone" dataKey="resueltos" stroke="#10b981" fill="url(#resueltos)" strokeWidth={2} name="Resueltos" />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* Status Distribution */}
        <ChartCard title="Distribución por Estado" icon={PieChart}>
          <DonutChart data={data.ticketsPorEstado} colors={ESTADOS_COLORS} />
        </ChartCard>
      </div>

      {/* Charts Row 2 */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* By Category */}
        <ChartCard title="Tickets por Categoría" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data.ticketsPorCategoria
                .sort((a, b) => b.cantidad - a.cantidad)
                .slice(0, 10)}
              layout="vertical"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="nombre"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cantidad" fill="#3b82f6" radius={[0, 4, 4, 0]} name="Tickets" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* By Priority */}
        <ChartCard title="Tickets por Prioridad" icon={BarChart3}>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart
              data={data.ticketsPorPrioridad.sort((a, b) => {
                const order = ["CRITICA", "ALTA", "MEDIA", "BAJA"]
                return order.indexOf(a.nombre) - order.indexOf(b.nombre)
              })}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="nombre" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cantidad" name="Tickets" radius={[4, 4, 0, 0]}>
                {data.ticketsPorPrioridad.map((entry) => (
                  <Cell key={entry.nombre} fill={PRIORIDAD_COLORS[entry.nombre] || "#94a3b8"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* Charts Row 3 */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* By Department */}
        <ChartCard title="Tickets por Departamento" icon={Building2}>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart
              data={data.ticketsPorDepartamento.slice(0, 8)}
              layout="vertical"
              margin={{ left: 100 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
              <YAxis
                type="category"
                dataKey="nombre"
                tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={90}
              />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="cantidad" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Tickets" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        {/* By Source */}
        <ChartCard title="Fuente de Tickets" icon={Globe}>
          <div className="flex items-center justify-center h-[250px]">
            <div className="flex gap-8">
              {data.ticketsPorFuente.map((f) => (
                <div key={f.nombre} className="flex flex-col items-center gap-2">
                  <div className={`p-4 rounded-2xl ${f.nombre === "WEB" ? "bg-blue-50 dark:bg-blue-900/20" : "bg-orange-50 dark:bg-orange-900/20"}`}>
                    {f.nombre === "WEB" ? (
                      <Globe className={`h-8 w-8 ${f.nombre === "WEB" ? "text-blue-500" : "text-orange-500"}`} />
                    ) : (
                      <Mail className="h-8 w-8 text-orange-500" />
                    )}
                  </div>
                  <p className="text-2xl font-bold text-foreground">{f.cantidad}</p>
                  <p className="text-xs font-medium text-muted-foreground">{f.nombre}</p>
                  <p className="text-xs text-muted-foreground">
                    {Math.round(f.cantidad / Math.max(data.ticketsPorFuente.reduce((a, b) => a + b.cantidad, 0), 1) * 100)}%
                  </p>
                </div>
              ))}
            </div>
          </div>
        </ChartCard>

        {/* Top Agents */}
        <ChartCard title="Top Agentes" icon={Award}>
          <div className="space-y-3">
            {data.topAgentes.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">Sin tickets cerrados en el período</p>
            )}
            {data.topAgentes.slice(0, 6).map((agente, i) => (
              <div key={agente.agenteId} className="flex items-center gap-3">
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                  i === 0 ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" :
                  i === 1 ? "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-400" :
                  i === 2 ? "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" :
                  "bg-muted text-muted-foreground"
                }`}>
                  {i + 1}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{agente.nombre} {agente.apellido}</p>
                  <div className="w-full h-1.5 bg-muted rounded-full mt-1 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all"
                      style={{ width: `${Math.min(agente.total / Math.max(data.topAgentes[0]?.total, 1) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <span className="text-sm font-semibold text-foreground">{agente.total}</span>
              </div>
            ))}
          </div>
        </ChartCard>
      </div>

      {/* SLA Widget */}
      <Card className="rounded-2xl border-border/50 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-6">
              <Clock className="h-10 w-10 text-purple-500" />
              <div>
                <h3 className="text-lg font-bold text-foreground">Cumplimiento de SLA</h3>
                <p className="text-sm text-muted-foreground">
                  {data.sla.total} tickets con SLA asignado en el período
                </p>
              </div>
            </div>
            <div className="flex items-center gap-8">
              <div className="text-center">
                <div className="relative inline-flex items-center justify-center">
                  <svg className="w-20 h-20 -rotate-90">
                    <circle cx="40" cy="40" r="34" fill="none" stroke="hsl(var(--muted))" strokeWidth="6" />
                    <circle
                      cx="40"
                      cy="40"
                      r="34"
                      fill="none"
                      stroke={data.sla.porcentaje >= 90 ? "#10b981" : data.sla.porcentaje >= 70 ? "#f59e0b" : "#ef4444"}
                      strokeWidth="6"
                      strokeDasharray={`${2 * Math.PI * 34}`}
                      strokeDashoffset={`${2 * Math.PI * 34 * (1 - data.sla.porcentaje / 100)}`}
                      strokeLinecap="round"
                    />
                  </svg>
                  <span className="absolute text-xl font-bold text-foreground">{data.sla.porcentaje}%</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">Cumplido</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-emerald-500">{data.sla.cumplidos}</p>
                <p className="text-xs text-muted-foreground">Cumplidos</p>
              </div>
              <div className="text-center">
                <p className="text-2xl font-bold text-muted-foreground">{data.sla.total - data.sla.cumplidos}</p>
                <p className="text-xs text-muted-foreground">Incumplidos</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
