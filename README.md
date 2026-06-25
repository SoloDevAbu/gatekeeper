# Gatekeeper

Gatekeeper is a secure environment for AI agents. It is a monorepo built with Turborepo, designed to enforce policy-based access control over tools executed via the Model Context Protocol (MCP).

## Architecture

The project is structured into apps and packages:

### Apps

- **`web`**: A Next.js frontend application (using Tailwind CSS and shadcn/ui). It serves as the dashboard where users interact with AI agents, view policies, and manage approval requests.
- **`agent-service`**: A Fastify Node.js backend. It connects to the Gemini LLM, manages MCP clients, and acts as the central brain. Most importantly, it intercepts tool execution intents and evaluates them against the policy engine before allowing them to run.
- **`vault-mcp`**: A custom Model Context Protocol (MCP) server that manages secrets. It exposes tools like `get_secret`, `set_secret`, and `delete_secret` to the agent.

### Packages

- **`policy-engine`**: A core library used by the `agent-service` to evaluate tool execution intents against guardrail rules (e.g., whether to allow, block, or require human approval).
- **`db`**: A shared Drizzle ORM package connected to Neon Serverless PostgreSQL, defining schemas for policies, logs, approvals, and vault secrets.
- **`types`**: Shared TypeScript definitions.

## Working Flow

1.  **User Input**: A user submits a prompt via the `web` dashboard (e.g., "Delete the stripe_key in prod").
2.  **LLM Intent**: The `agent-service` sends the prompt and available tools to the LLM. The LLM responds with an intent to use a tool (e.g., `delete_secret(namespace="prod")`).
3.  **Policy Evaluation**: Before execution, `agent-service` intercepts the intent and queries the `policy-engine`. The engine checks the `db` for matching rules.
4.  **Decision**:
    - **ALLOW**: The `agent-service` immediately executes the tool on `vault-mcp`.
    - **BLOCK**: Execution is denied, and the LLM is informed.
    - **REQUIRE_APPROVAL**: The `agent-service` pauses, logs a pending request in the `db`, and waits. The `web` dashboard alerts the user. Once the user approves, execution resumes.
5.  **Execution & Response**: `vault-mcp` performs the action on the database. The result is passed back to the LLM, which then provides a final response to the user.

## Getting Started

### Prerequisites

- Node.js >= 20
- pnpm >= 10

### Setup

1. Clone the repository.
2. Run `pnpm install` at the root.
3. Configure your `.env` file with necessary variables (`DATABASE_URL`, `AGENT_URL`, etc.).
4. Run `pnpm db:generate` and `pnpm db:push` to set up the database schema.
5. Run `pnpm dev` to start all services concurrently.
