"use client"

import { useEffect, useState } from "react"
import { ShieldAlert, Plus, Trash2, ShieldCheck, ShieldX } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter
} from "@/components/ui/dialog"
import { useSSE } from "@/hooks/use-sse"

interface PolicyRule {
  id: string
  type: string
  toolPattern: string
  namespacePattern: string | null
  action: string
  config: any
  enabled: boolean
  priority: number
}

export default function PoliciesPage() {
  const [rules, setRules] = useState<PolicyRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // SSE for live policy updates
  const { events } = useSSE<{type: string, data: any}>("http://localhost:3001/stream/policies")

  const [formData, setFormData] = useState({
    type: "TOOL_BLOCK",
    toolPattern: "*",
    action: "BLOCK",
    priority: 100
  })

  useEffect(() => {
    fetchPolicies()
  }, [])

  // Refetch when SSE says policies changed
  useEffect(() => {
    const lastEvent = events[events.length - 1]
    if (lastEvent?.type === "policy_changed") {
      fetchPolicies()
    }
  }, [events])

  const fetchPolicies = async () => {
    try {
      const res = await fetch("http://localhost:3001/api/policies")
      const data = await res.json()
      setRules(data)
    } catch (err) {
      console.error(err)
    } finally {
      setIsLoading(false)
    }
  }

  const handleToggle = async (id: string, enabled: boolean) => {
    try {
      await fetch(`http://localhost:3001/api/policies/${id}/toggle`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled })
      })
      // Optimistic update
      setRules(rules.map(r => r.id === id ? { ...r, enabled } : r))
    } catch (err) {
      console.error(err)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await fetch(`http://localhost:3001/api/policies/${id}`, {
        method: "DELETE"
      })
      setRules(rules.filter(r => r.id !== id))
    } catch (err) {
      console.error(err)
    }
  }

  const handleCreate = async () => {
    try {
      await fetch("http://localhost:3001/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          config: {} // Simplified for the UI
        })
      })
      setIsDialogOpen(false)
      fetchPolicies()
    } catch (err) {
      console.error(err)
    }
  }

  const getRuleIcon = (action: string) => {
    if (action === "ALLOW") return <ShieldCheck className="h-5 w-5 text-green-500" />
    if (action === "BLOCK") return <ShieldX className="h-5 w-5 text-red-500" />
    return <ShieldAlert className="h-5 w-5 text-orange-500" />
  }

  return (
    <div className="flex-1 p-8 pt-6 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Policy Manager</h2>
          <p className="text-muted-foreground mt-1">
            Configure guardrails and permissions for the AI agent in real-time.
          </p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              New Policy Rule
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Policy Rule</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label>Rule Type</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.type}
                  onChange={(e) => setFormData({...formData, type: e.target.value})}
                >
                  <option value="TOOL_BLOCK">Tool Block</option>
                  <option value="REQUIRE_APPROVAL">Require Approval</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Tool Pattern (e.g. *, delete_secret)</Label>
                <Input 
                  value={formData.toolPattern}
                  onChange={(e) => setFormData({...formData, toolPattern: e.target.value})}
                />
              </div>
              <div className="grid gap-2">
                <Label>Action</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.action}
                  onChange={(e) => setFormData({...formData, action: e.target.value})}
                >
                  <option value="BLOCK">Block</option>
                  <option value="REQUIRE_APPROVAL">Require Approval</option>
                  <option value="ALLOW">Allow</option>
                </select>
              </div>
              <div className="grid gap-2">
                <Label>Priority (Lower = Higher precedence)</Label>
                <Input 
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({...formData, priority: parseInt(e.target.value)})}
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleCreate}>Save Rule</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {isLoading ? (
          <div className="col-span-full text-center text-muted-foreground py-12">Loading policies...</div>
        ) : rules.length === 0 ? (
          <div className="col-span-full text-center text-muted-foreground py-12 border rounded-xl border-dashed">
            No policies configured. The agent has default ALLOW access.
          </div>
        ) : (
          rules.map((rule) => (
            <Card key={rule.id} className={`transition-opacity ${!rule.enabled && 'opacity-60'}`}>
              <CardHeader className="pb-3 flex flex-row justify-between items-start">
                <div className="space-y-1">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getRuleIcon(rule.action)}
                    {rule.type}
                  </CardTitle>
                  <CardDescription className="font-mono text-xs">
                    Priority: {rule.priority}
                  </CardDescription>
                </div>
                <Switch 
                  checked={rule.enabled} 
                  onCheckedChange={(c) => handleToggle(rule.id, c)}
                />
              </CardHeader>
              <CardContent>
                <div className="space-y-3 text-sm">
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Tool Pattern</span>
                    <span className="font-mono bg-muted px-2 py-1 rounded w-fit mt-1">{rule.toolPattern}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Action</span>
                    <span className="font-semibold mt-1">{rule.action}</span>
                  </div>
                  
                  <div className="pt-4 flex justify-end">
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleDelete(rule.id)}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </Button>
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
