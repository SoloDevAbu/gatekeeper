"use client"

import { useEffect, useState } from "react"
import { Server, Activity, RefreshCw, CheckCircle2, XCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

interface ServerStatus {
  name: string
  status: "connected" | "disconnected" | "reconnecting"
  tools: string[]
  error?: string
}

export default function ServersPage() {
  const [servers, setServers] = useState<ServerStatus[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    fetchServers()
  }, [])

  const fetchServers = async () => {
    setIsLoading(true)
    try {
      const res = await fetch("http://localhost:3001/api/servers")
      const data = await res.json()
      // Fallback if API is not yet implemented or returns error
      setServers(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error(err)
      setServers([])
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex-1 p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">MCP Servers</h2>
          <p className="text-muted-foreground mt-1">
            Manage and monitor connected Model Context Protocol servers.
          </p>
        </div>
        
        <Button variant="outline" className="gap-2" onClick={fetchServers} disabled={isLoading}>
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh Status
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-2">
        {servers.length === 0 && !isLoading ? (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-xl border-dashed">
            No MCP servers found. Make sure the agent service is running.
          </div>
        ) : (
          servers.map((server) => (
            <Card key={server.name} className="overflow-hidden">
              <CardHeader className="pb-3 border-b bg-muted/20">
                <div className="flex justify-between items-center">
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Server className="h-5 w-5 text-primary" />
                    {server.name}
                  </CardTitle>
                  <div className="flex items-center gap-1.5">
                    {server.status === "connected" ? (
                      <CheckCircle2 className="h-4 w-4 text-green-500" />
                    ) : server.status === "reconnecting" ? (
                      <RefreshCw className="h-4 w-4 text-orange-500 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4 text-red-500" />
                    )}
                    <span className={`text-xs font-medium uppercase tracking-wider ${
                      server.status === "connected" ? "text-green-600 dark:text-green-400" : 
                      server.status === "reconnecting" ? "text-orange-600 dark:text-orange-400" : 
                      "text-red-600 dark:text-red-400"
                    }`}>
                      {server.status}
                    </span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="pt-4">
                <div className="space-y-4">
                  {server.error && (
                    <div className="bg-red-500/10 text-red-600 dark:text-red-400 p-3 rounded-md text-sm border border-red-500/20">
                      {server.error}
                    </div>
                  )}
                  
                  <div>
                    <h4 className="text-sm font-semibold mb-2 flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      Discovered Tools ({server.tools.length})
                    </h4>
                    <div className="flex flex-wrap gap-2 mt-2">
                      {server.tools.map(tool => (
                         <span key={tool} className="px-2.5 py-1 bg-secondary text-secondary-foreground rounded-md text-xs font-mono font-medium">
                           {tool}
                         </span>
                      ))}
                    </div>
                    {server.tools.length === 0 && (
                      <p className="text-xs text-muted-foreground italic">No tools discovered.</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
