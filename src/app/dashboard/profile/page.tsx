"use client"

import { useAuthStore } from "@/store/useAuthStore"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { 
  UserCircle, 
  ShieldCheck, 
  Bell, 
  MonitorSmartphone, 
  LogOut,
  Camera,
  MapPin
} from "lucide-react"

export default function ProfilePage() {
  const { user } = useAuthStore()

  return (
    <div className="space-y-6 p-8 max-w-5xl mx-auto">
      {/* Header Profile Section */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-border/50">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="h-24 w-24 rounded-2xl bg-secondary flex items-center justify-center text-4xl font-bold text-muted-foreground shadow-sm overflow-hidden">
              {user?.nombre?.charAt(0) || "U"}
            </div>
            <button className="absolute -bottom-2 -right-2 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-md hover:bg-primary/90 transition-colors">
              <Camera className="h-4 w-4" />
            </button>
          </div>
          
          <div>
            <h2 className="text-3xl font-bold tracking-tight text-foreground">{user?.nombre || "Usuario"} {user?.apellido || ""}</h2>
            <p className="text-muted-foreground font-medium mt-1">{user?.rolNombre || "Usuario del Sistema"} • IT Department</p>
            <div className="flex items-center gap-4 mt-3">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2.5 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/20 dark:text-green-400">
                <span className="h-1.5 w-1.5 rounded-full bg-green-500"></span>
                Online
              </span>
              <span className="flex items-center gap-1 text-xs text-muted-foreground font-medium">
                <MapPin className="h-3.5 w-3.5" />
                Local Office
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Button variant="outline" className="rounded-full bg-card hover:bg-muted/50 border-border h-10 px-6 font-medium">
            Cancel
          </Button>
          <Button className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-md shadow-primary/20 transition-all font-medium h-10 px-6">
            Save Changes
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-8 pt-4">
        {/* Left Menu */}
        <div className="flex flex-col space-y-1">
          <Button variant="ghost" className="justify-start gap-3 bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary rounded-xl h-11 px-4 font-medium">
            <UserCircle className="h-5 w-5" />
            General Info
          </Button>
          <Button variant="ghost" className="justify-start gap-3 text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-xl h-11 px-4 font-medium">
            <ShieldCheck className="h-5 w-5" />
            Security & Auth
          </Button>
          <Button variant="ghost" className="justify-start gap-3 text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-xl h-11 px-4 font-medium">
            <Bell className="h-5 w-5" />
            Notifications
          </Button>
          <Button variant="ghost" className="justify-start gap-3 text-muted-foreground hover:bg-muted/80 hover:text-foreground rounded-xl h-11 px-4 font-medium">
            <MonitorSmartphone className="h-5 w-5" />
            Active Sessions
          </Button>
          
          <div className="pt-8 pb-2">
            <div className="h-px w-full bg-border/50 mb-4"></div>
            <Button variant="ghost" className="justify-start gap-3 text-destructive hover:bg-destructive/10 hover:text-destructive rounded-xl h-11 px-4 font-medium w-full">
              <LogOut className="h-5 w-5" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Right Content */}
        <div className="bg-card rounded-2xl border border-border/50 shadow-sm p-8">
          <h3 className="text-xl font-bold text-foreground mb-6">Personal Information</h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">First Name</label>
              <Input 
                defaultValue={user?.nombre || ""} 
                className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 font-medium" 
              />
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Last Name</label>
              <Input 
                defaultValue={user?.apellido || ""} 
                className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 font-medium" 
              />
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Email Address</label>
              <div className="relative">
                <Input 
                  defaultValue={user?.correo || ""} 
                  className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 pl-10 font-medium" 
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="16" x="2" y="4" rx="2"/><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/></svg>
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Phone Number</label>
              <div className="relative">
                <Input 
                  defaultValue="+1 (555) 000-0000" 
                  className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 pl-10 font-medium text-muted-foreground" 
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
                </div>
              </div>
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Department</label>
              <Input 
                defaultValue="Infrastructure" 
                className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 font-medium" 
                readOnly
              />
            </div>
            
            <div className="space-y-2.5">
              <label className="text-xs font-bold tracking-wider text-muted-foreground uppercase">Timezone</label>
              <div className="relative">
                <Input 
                  defaultValue="(GMT-05:00) Eastern Time" 
                  className="bg-secondary/30 border-transparent focus-visible:bg-transparent rounded-xl h-11 pl-10 font-medium text-muted-foreground" 
                  readOnly
                />
                <div className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/><path d="M2 12h20"/></svg>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
