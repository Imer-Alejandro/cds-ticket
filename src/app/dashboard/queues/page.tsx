"use client"

import { Plus, MoreHorizontal, Clock } from "lucide-react"
import { Button } from "@/components/ui/button"

const queues = [
  {
    id: "support-n1",
    name: "Support N1",
    count: 3,
    tickets: [
      { id: "T-802", title: "Printer in HR jammed", timeLeft: "5h left", priority: "low", assignee: "S", urgent: false },
      { id: "T-805", title: "New hire onboarding", timeLeft: "2d left", priority: "medium", assignee: "M", urgent: false },
      { id: "T-810", title: "Password reset request", timeLeft: "1h left", priority: "medium", assignee: "K", urgent: false },
    ]
  },
  {
    id: "infrastructure",
    name: "Infrastructure",
    count: 2,
    tickets: [
      { id: "T-799", title: "Server Room Temperature High", timeLeft: "15m left", priority: "critical", assignee: "S", urgent: true },
      { id: "T-815", title: "Switch SW-04 unresponsive", timeLeft: "1h left", priority: "high", assignee: "M", urgent: false },
    ]
  },
  {
    id: "development",
    name: "Development",
    count: 3,
    tickets: [
      { id: "T-654", title: "API Integration Bug", timeLeft: "4h left", priority: "high", assignee: "K", urgent: false },
      { id: "T-721", title: "Database optimization", timeLeft: "3d left", priority: "medium", assignee: "K", urgent: false },
      { id: "T-730", title: "Update legacy components", timeLeft: "1w left", priority: "low", assignee: "S", urgent: false },
    ]
  }
]

const getPriorityColor = (priority: string) => {
  switch(priority) {
    case 'critical': return 'bg-red-500'
    case 'high': return 'bg-orange-500'
    case 'medium': return 'bg-blue-500'
    case 'low': return 'bg-slate-400'
    default: return 'bg-slate-400'
  }
}

export default function QueuesPage() {
  return (
    <div className="space-y-6 p-8 max-w-[1600px] mx-auto h-[calc(100vh-72px)] flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-foreground">Work Queues</h2>
          <p className="text-muted-foreground mt-1">Monitor ticket distribution across departments</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="hidden sm:flex -space-x-2 mr-4">
            <div className="h-8 w-8 rounded-full bg-blue-100 border-2 border-background flex items-center justify-center text-xs font-bold text-blue-700">A</div>
            <div className="h-8 w-8 rounded-full bg-green-100 border-2 border-background flex items-center justify-center text-xs font-bold text-green-700">M</div>
            <div className="h-8 w-8 rounded-full bg-orange-100 border-2 border-background flex items-center justify-center text-xs font-bold text-orange-700">J</div>
            <div className="h-8 w-8 rounded-full bg-purple-100 border-2 border-background flex items-center justify-center text-xs font-bold text-purple-700">S</div>
            <div className="h-8 w-8 rounded-full bg-secondary border-2 border-background flex items-center justify-center text-xs font-bold text-muted-foreground">+5</div>
          </div>
          <Button variant="outline" className="rounded-full bg-card hover:bg-muted/50 border-border h-10 px-4">
            <Plus className="mr-2 h-4 w-4" />
            New Queue
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-x-auto overflow-y-hidden pb-4">
        <div className="flex gap-6 h-full items-start w-max">
          {queues.map((queue) => (
            <div key={queue.id} className="w-[350px] bg-secondary/30 rounded-2xl border border-border/50 flex flex-col max-h-full">
              <div className="p-4 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-foreground text-base">{queue.name}</h3>
                  <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-secondary text-xs font-medium text-secondary-foreground px-1.5">
                    {queue.count}
                  </span>
                </div>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-5 w-5" />
                </Button>
              </div>

              <div className="p-3 pt-0 flex-1 overflow-y-auto space-y-3 custom-scrollbar">
                {queue.tickets.map((ticket) => (
                  <div key={ticket.id} className="bg-card rounded-xl p-4 border border-border shadow-sm hover:shadow-md transition-all cursor-pointer group">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-xs font-bold text-primary">{ticket.id}</span>
                      <div className={`w-2 h-2 rounded-full ${getPriorityColor(ticket.priority)}`}></div>
                    </div>
                    
                    <h4 className="font-semibold text-foreground text-sm mb-4 line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                      {ticket.title}
                    </h4>
                    
                    <div className="flex items-center justify-between mt-auto">
                      <div className={`flex items-center gap-1.5 text-xs font-bold ${ticket.urgent ? 'text-red-500' : 'text-muted-foreground'}`}>
                        <Clock className="h-3.5 w-3.5" />
                        {ticket.timeLeft}
                      </div>
                      
                      <div className="h-7 w-7 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center text-xs font-bold">
                        {ticket.assignee}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
          
          <div className="w-[350px] shrink-0">
             <Button variant="outline" className="w-full h-[100px] border-dashed border-2 bg-transparent hover:bg-secondary/20 text-muted-foreground hover:text-foreground rounded-2xl flex flex-col items-center justify-center gap-2">
                <Plus className="h-5 w-5" />
                <span className="font-medium text-sm">Add New Queue</span>
             </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
