"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Mail, Loader2, ChevronRight, CheckCircle2, AlertCircle } from "lucide-react"
import Link from "next/link"
import { apiFetch } from "@/lib/api"

export default function EmailSettingsPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [testResult, setTestResult] = useState<string | null>(null)
  const [testMessage, setTestMessage] = useState('')
  const [oauthConfigured, setOauthConfigured] = useState(false)
  const [oauthMailbox, setOauthMailbox] = useState('')
  const [form, setForm] = useState({
    authMode: 'password' as 'password' | 'oauth2',
    enabled: false,
    imapHost: '', imapPort: '993', imapSecure: true, imapUser: '', imapPass: '',
    imapFolder: 'INBOX',
    smtpHost: '', smtpPort: '587', smtpSecure: false, smtpUser: '', smtpPass: '',
    fromAddress: '', fromName: 'Help Desk IT',
    checkInterval: '60', defaultCategoriaId: '',
  })
  const [categories, setCategories] = useState<{ id: string; nombre: string }[]>([])

  useEffect(() => {
    Promise.all([
      apiFetch('/api/settings/email').then(r => r.json()),
      fetch('/api/categories').then(r => r.json()),
    ]).then(([cfg, cats]) => {
      setForm(prev => ({ ...prev, ...cfg }))
      setOauthConfigured(Boolean(cfg.oauthConfigured))
      setOauthMailbox(cfg.oauthMailbox || '')
      setCategories(cats || [])
      const params = new URLSearchParams(window.location.search)
      const oauth = params.get('oauth')
      if (oauth === 'connected') {
        setTestResult('ok')
        setTestMessage(`Microsoft 365 autorizó ${cfg.oauthMailbox || 'la cuenta'}.`)
      }
      if (oauth === 'error') {
        setTestResult('error')
        setTestMessage(params.get('message') || 'No se pudo conectar con Microsoft 365.')
      }
    }).finally(() => setLoading(false))
  }, [])

  const handleSave = async () => {
    setSaving(true); setTestResult(null); setTestMessage('')
    try {
      const res = await apiFetch('/api/settings/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (res.ok) setTestResult('ok')
      else setTestResult('error')
    } catch { setTestResult('error') }
    finally { setSaving(false) }
  }

  const handleOAuthConnect = async () => {
    setSaving(true); setTestResult(null); setTestMessage('')
    try {
      const res = await apiFetch('/api/settings/email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form),
      })
      if (!res.ok) throw new Error('No se pudo guardar la configuración OAuth2')
      window.location.href = '/api/settings/email/oauth/start'
    } catch {
      setTestResult('error')
      setTestMessage('No se pudo iniciar la conexión OAuth. Revisa la configuración del servidor.')
      setSaving(false)
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
    </div>
  )

  return (
    <div className="space-y-6 max-w-4xl">
      <nav className="flex items-center gap-2 text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">Dashboard</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/dashboard/settings" className="hover:text-foreground">Configuración</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-foreground font-medium">Correo Electrónico</span>
      </nav>

      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => router.push('/dashboard/settings')} className="rounded-full h-10 w-10">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Mail className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Correo Electrónico</h1>
          <p className="text-sm text-muted-foreground">Configuración IMAP/SMTP para recepción y envío de tickets por correo</p>
        </div>
      </div>

      {testResult === 'ok' && (
        <div className="flex items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          <CheckCircle2 className="h-5 w-5 shrink-0" /> {testMessage || 'Configuración guardada correctamente'}
        </div>
      )}
      {testResult === 'error' && (
        <div className="flex items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" /> {testMessage || 'Error al guardar la configuración'}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {/* IMAP */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Recepción (IMAP)</CardTitle>
            <p className="text-xs text-muted-foreground">El sistema revisará esta bandeja para crear tickets automáticamente</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.enabled} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="rounded" />
              <span>Activar recepción automática de correos</span>
            </label>
            <Field label="Autenticación">
              <select value={form.authMode} onChange={e => setForm({ ...form, authMode: e.target.value as 'password' | 'oauth2' })}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                <option value="password">Usuario y contraseña</option>
                <option value="oauth2">Microsoft 365 OAuth2</option>
              </select>
            </Field>
            {form.authMode === 'oauth2' && (
              <div className="space-y-3 rounded-xl border border-blue-200 bg-blue-50/50 p-3">
                <p className="text-xs text-muted-foreground">
                  OAuth: {oauthConfigured ? 'credenciales del servidor configuradas' : 'faltan variables MICROSOFT_* en el servidor'}.
                  {' '}La cuenta autorizada debe coincidir con Usuario IMAP.
                </p>
                {oauthMailbox && <p className="text-xs text-muted-foreground">Cuenta autorizada: {oauthMailbox}</p>}
                <Button type="button" variant="outline" onClick={() => { void handleOAuthConnect() }} disabled={saving || !oauthConfigured || !form.imapUser.trim()}>
                  Conectar con Microsoft 365
                </Button>
                <p className="text-xs text-muted-foreground">Registra como URI de redirección: /api/settings/email/oauth/callback</p>
              </div>
            )}
            <FieldInput label="Servidor IMAP" value={form.imapHost} onChange={e => setForm({ ...form, imapHost: e.target.value })} placeholder="mail.sudominio.com" />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Puerto" value={form.imapPort} onChange={e => setForm({ ...form, imapPort: e.target.value })} placeholder="993" />
              <label className="flex items-end gap-2 text-sm pb-2">
                <input type="checkbox" checked={form.imapSecure} onChange={e => setForm({ ...form, imapSecure: e.target.checked })} className="rounded" />
                <span>SSL/TLS</span>
              </label>
            </div>
            <FieldInput label="Usuario" value={form.imapUser} onChange={e => setForm({ ...form, imapUser: e.target.value })} placeholder="tickets@..." />
            {form.authMode === 'password' && <FieldInput label="Contraseña" type="password" value={form.imapPass} onChange={e => setForm({ ...form, imapPass: e.target.value })} placeholder="••••••••" />}
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Carpeta" value={form.imapFolder} onChange={e => setForm({ ...form, imapFolder: e.target.value })} placeholder="INBOX" />
              <FieldInput label="Intervalo (seg)" value={form.checkInterval} onChange={e => setForm({ ...form, checkInterval: e.target.value })} placeholder="60" />
            </div>
            <Field label="Categoría por defecto">
              <select value={form.defaultCategoriaId} onChange={e => setForm({ ...form, defaultCategoriaId: e.target.value })}
                className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm"
              >
                <option value="">Seleccionar categoría</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.nombre}</option>)}
              </select>
            </Field>
          </CardContent>
        </Card>

        {/* SMTP */}
        <Card className="rounded-2xl border-border/50 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-semibold">Envío (SMTP)</CardTitle>
            <p className="text-xs text-muted-foreground">Para notificaciones y respuestas automáticas a los solicitantes</p>
          </CardHeader>
          <CardContent className="space-y-4">
            <FieldInput label="Servidor SMTP" value={form.smtpHost} onChange={e => setForm({ ...form, smtpHost: e.target.value })} placeholder="mail.sudominio.com" />
            <div className="grid grid-cols-2 gap-3">
              <FieldInput label="Puerto" value={form.smtpPort} onChange={e => setForm({ ...form, smtpPort: e.target.value })} placeholder="587" />
              <label className="flex items-end gap-2 text-sm pb-2">
                <input type="checkbox" checked={form.smtpSecure} onChange={e => setForm({ ...form, smtpSecure: e.target.checked })} className="rounded" />
                  <span>SSL directo (465)</span>
              </label>
            </div>
              <p className="text-xs text-muted-foreground">Puerto 587: desactivado, usa STARTTLS. Puerto 465: activado.</p>
            <FieldInput label="Usuario" value={form.smtpUser} onChange={e => setForm({ ...form, smtpUser: e.target.value })} placeholder="tickets@..." />
            {form.authMode === 'password' && <FieldInput label="Contraseña" type="password" value={form.smtpPass} onChange={e => setForm({ ...form, smtpPass: e.target.value })} placeholder="••••••••" />}
            <FieldInput label="Dirección Desde" value={form.fromAddress} onChange={e => setForm({ ...form, fromAddress: e.target.value })} placeholder="tickets@..." />
            <FieldInput label="Nombre Desde" value={form.fromName} onChange={e => setForm({ ...form, fromName: e.target.value })} placeholder="Help Desk IT" />
          </CardContent>
        </Card>
      </div>

      <div className="flex justify-end gap-3">
        <Button variant="outline" onClick={() => router.push('/dashboard/settings')} className="rounded-xl">Cancelar</Button>
        <Button onClick={handleSave} disabled={saving} className="rounded-xl gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? 'Guardando...' : 'Guardar configuración'}
        </Button>
      </div>

      <ConfigurationGuide />
    </div>
  )
}

function FieldInput({ label, ...props }: { label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <input {...props} className="flex h-10 w-full rounded-xl border border-input bg-transparent px-3 text-sm placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring" />
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  )
}

// Guía de configuración
function ConfigurationGuide() {
  return (
    <Card className="rounded-2xl border-border/50 shadow-sm bg-blue-50/50 border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <span className="text-base">📧</span> Guía de Configuración
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <h4 className="font-medium mb-1">Para Gmail:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
            <li>IMAP Host: <code className="bg-white px-1 rounded">imap.gmail.com</code></li>
            <li>SMTP Host: <code className="bg-white px-1 rounded">smtp.gmail.com</code></li>
            <li>Usa contraseña de aplicación (no la de tu cuenta)</li>
          </ul>
        </div>
        <div>
          <h4 className="font-medium mb-1">Para Microsoft 365:</h4>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground text-xs">
            <li>Autenticación IMAP: Microsoft 365 OAuth2; el usuario y contraseña puede estar deshabilitado por Microsoft.</li>
            <li>IMAP: <code className="bg-white px-1 rounded">outlook.office365.com</code>, puerto 993, SSL/TLS activado.</li>
            <li>SMTP: <code className="bg-white px-1 rounded">smtp.office365.com</code>, puerto 587, SSL directo deshabilitado (STARTTLS).</li>
            <li>La aplicación de Entra ID necesita permisos delegados IMAP.AccessAsUser.All y SMTP.Send.</li>
          </ul>
        </div>
        <div className="pt-2 border-t border-blue-200">
          <p className="text-xs text-muted-foreground">
            <strong>Nota:</strong> Los correos se procesarán automáticamente cada X segundos (intervalo configurado) y se convertirán en tickets.
          </p>
        </div>
      </CardContent>
    </Card>
  )
}
