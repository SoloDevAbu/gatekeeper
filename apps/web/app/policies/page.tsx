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

/**
 * Maps rule type to the action value stored in DB.
 * The policy engine dispatches evaluators solely based on `rule.type` —
 * the `action` field in the DB is derived from this mapping and must stay in sync.
 */
const TYPE_TO_ACTION: Record<string, string> = {
  TOOL_BLOCK: "BLOCK",
  REQUIRE_APPROVAL: "REQUIRE_APPROVAL",
}

export default function PoliciesPage() {
  const [rules, setRules] = useState<PolicyRule[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDialogOpen, setIsDialogOpen] = useState(false)
  
  // SSE for live policy updates
  const { events } = useSSE<{type: string, data: any}>("http://localhost:3001/stream/policies")

  const [formData, setFormData] = useState({
    type: "TOOL_BLOCK",
    toolPattern: "",
    namespacePattern: "",
    priority: 100,
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
    // action is always derived from type — the engine only looks at rule.type
    const action = TYPE_TO_ACTION[formData.type] ?? "BLOCK"

    try {
      await fetch("http://localhost:3001/api/policies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: formData.type,
          toolPattern: formData.toolPattern.trim() || "*",
          // Only send namespacePattern if the user filled it in
          namespacePattern: formData.namespacePattern.trim() || null,
          action,
          config: {},
          priority: formData.priority,
        })
      })
      setIsDialogOpen(false)
      // Reset form
      setFormData({ type: "TOOL_BLOCK", toolPattern: "", namespacePattern: "", priority: 100 })
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

  const getActionLabel = (rule: PolicyRule) => {
    if (rule.type === "TOOL_BLOCK") return { label: "BLOCK", color: "text-red-500 dark:text-red-400" }
    if (rule.type === "REQUIRE_APPROVAL") return { label: "REQUIRE APPROVAL", color: "text-orange-500 dark:text-orange-400" }
    return { label: rule.action, color: "text-muted-foreground" }
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

              {/* Rule Type — this is the ONLY field that controls the engine's behaviour */}
              <div className="grid gap-2">
                <Label>Rule Type</Label>
                <select 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                >
                  <option value="TOOL_BLOCK">Tool Block — permanently deny the tool call</option>
                  <option value="REQUIRE_APPROVAL">Require Approval — pause and ask a human</option>
                </select>
                {/* Show the derived action so the user always knows what will happen */}
                <p className="text-xs text-muted-foreground">
                  This rule will enforce:{" "}
                  <span className="font-semibold font-mono">
                    {TYPE_TO_ACTION[formData.type] ?? "BLOCK"}
                  </span>
                </p>
              </div>

              {/* Tool Pattern */}
              <div className="grid gap-2">
                <Label>Tool Pattern</Label>
                <Input
                  placeholder="e.g.  delete_secret  |  get_*  |  *"
                  value={formData.toolPattern}
                  onChange={(e) => setFormData({ ...formData, toolPattern: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Supports wildcards: <span className="font-mono">*</span> (all),{" "}
                  <span className="font-mono">delete_*</span> (prefix),{" "}
                  <span className="font-mono">*_secret</span> (suffix)
                </p>
              </div>

              {/* Namespace Pattern — optional, scopes rule to a specific namespace */}
              <div className="grid gap-2">
                <Label>
                  Namespace Pattern{" "}
                  <span className="text-muted-foreground font-normal">(optional)</span>
                </Label>
                <Input
                  placeholder="e.g.  prod  |  leave blank for all namespaces"
                  value={formData.namespacePattern}
                  onChange={(e) => setFormData({ ...formData, namespacePattern: e.target.value })}
                />
                <p className="text-xs text-muted-foreground">
                  Restricts this rule to tool calls targeting a specific namespace (e.g.{" "}
                  <span className="font-mono">prod</span>). Leave blank to match all.
                </p>
              </div>

              {/* Priority */}
              <div className="grid gap-2">
                <Label>
                  Priority{" "}
                  <span className="text-muted-foreground font-normal">(lower number = higher precedence)</span>
                </Label>
                <Input
                  type="number"
                  value={formData.priority}
                  onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 100 })}
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
          rules.map((rule) => {
            const { label, color } = getActionLabel(rule)
            return (
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

                    {rule.namespacePattern && (
                      <div className="flex flex-col">
                        <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Namespace</span>
                        <span className="font-mono bg-muted px-2 py-1 rounded w-fit mt-1">{rule.namespacePattern}</span>
                      </div>
                    )}

                    <div className="flex flex-col">
                      <span className="text-muted-foreground text-xs uppercase tracking-wider font-semibold">Enforces</span>
                      <span className={`font-semibold mt-1 ${color}`}>{label}</span>
                    </div>

                    <div className="pt-4 flex justify-end">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10"
                        onClick={() => handleDelete(rule.id)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )
          })
        )}
      </div>
    </div>
  )
}
