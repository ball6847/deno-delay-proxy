# Deno Delay Proxy

A lightweight, configurable HTTP proxy server built with Deno 2.4+ featuring configurable request delays and kill-switch controls for testing and development purposes.

## Capabilities

### Core Features

- **Configurable Request Delay**: Add artificial latency to proxied requests for testing timeout handling, loading states, and race conditions
- **Kill-Switch Control**: Instantly enable/disable the proxy with custom HTTP responses, status codes, headers, and body content
- **Persistent State**: All configuration persists across restarts using Deno KV storage
- **Upstream Proxy Forwarding**: Seamlessly forward requests to any upstream HTTP server
- **Zero Dependencies at Runtime**: Built on Deno's native APIs with no external runtime dependencies

### Use Cases

- **Testing Timeout Behavior**: Simulate slow network conditions to test timeout handling
- **Development Environment**: Add delays to test loading states and skeleton screens
- **Load Testing Preparation**: Verify your application handles delayed responses gracefully
- **Service Interruption Testing**: Test how your application handles service outages using the kill-switch
- **Integration Testing**: Use custom responses to simulate various server conditions

## API Interface

### Management API

All management endpoints return JSON responses and accept JSON bodies.

#### GET /api/delay

Retrieves the current configured delay value in milliseconds.

**Response (200 OK)**:

```json
{
    "delay": 500
}
```

**Response (500 Internal Server Error)**:

```json
{
    "error": "Failed to load delay"
}
```

---

#### POST /api/delay

Updates the request delay value. All subsequent proxied requests will be delayed by the specified duration.

**Request Body**:

```json
{
    "delay": 500
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `delay` | number | No | Delay in milliseconds (minimum: 0) |

**Response (200 OK)**:

```json
{
    "success": true,
    "delay": 500
}
```

**Response (400 Bad Request)**:

```json
{
    "error": "Invalid request body",
    "details": [
        {
            "code": "too_small",
            "minimum": 0,
            "path": ["delay"],
            "message": "Number must be greater than or equal to 0"
        }
    ]
}
```

**Response (500 Internal Server Error)**:

```json
{
    "error": "Failed to load delay"
}
```

---

#### GET /api/kill-switch

Retrieves the current kill-switch configuration.

**Response (200 OK)**:

```json
{
    "enabled": false,
    "status": 503,
    "headers": {
        "content-type": "application/json"
    },
    "body": "blocked by kill-switch"
}
```

**Response (500 Internal Server Error)**:

```json
{
    "error": "Failed to load state"
}
```

---

#### POST /api/kill-switch

Updates the kill-switch configuration. When enabled, all proxy requests return the configured response instead of forwarding to the upstream server.

**Request Body**:

```json
{
    "enabled": true,
    "status": 503,
    "headers": {
        "X-Custom-Header": "custom-value"
    },
    "body": "Service temporarily unavailable"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `enabled` | boolean | No | Whether the kill-switch is active |
| `status` | number | No | HTTP status code to return (100-599) |
| `headers` | object | No | Custom response headers |
| `body` | string | No | Response body content |

**Response (200 OK)**:

```json
{
    "success": true,
    "state": {
        "enabled": true,
        "status": 503,
        "headers": {
            "X-Custom-Header": "custom-value"
        },
        "body": "Service temporarily unavailable"
    }
}
```

**Response (400 Bad Request)**:

```json
{
    "error": "Invalid request body",
    "details": [...]
}
```

**Response (500 Internal Server Error)**:

```json
{
    "error": "Failed to save state"
}
```

---

### Proxy Endpoint

#### /proxy/{path}

Forwards all requests with the `/proxy/` prefix to the upstream server. The `/proxy` prefix is stripped before forwarding.

**Example**: Request to `/proxy/api/users` is forwarded to `{UPSTREAM}/api/users`

**Behavior**:

1. Load current delay and kill-switch state from persistent storage
2. If kill-switch is disabled: wait for the configured delay duration
3. If kill-switch is enabled: return the configured response immediately
4. Forward request to upstream server
5. Return upstream response with status, headers, and body intact

**Response**: Returns the upstream server's response as-is

---

### Documentation Endpoints


#### GET /swagger-ui

Serves the Swagger UI for interactive API exploration and testing. Visit `http://localhost:8000/swagger/` in your browser to explore and try out all available API endpoints.

---

## Configuration

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `UPSTREAM` | Yes | - | Upstream server URL to proxy requests to |
| `PORT` | No | 8000 | Port number to listen on |

### Example Configuration

```bash
# Set upstream server
export UPSTREAM="http://localhost:3000"

# Optional: Change port
export PORT=8000
```

---

## Quick Start

### 1. Start the Proxy Server

```bash
deno run --allow-env --allow-read --allow-net --unstable-kv main.ts
```

Or using the npm task:

```bash
npm run dev
```

### 2. Configure Delay

Add a 500ms delay to all proxied requests:

```bash
curl -X POST http://localhost:8000/api/delay \
    -H "Content-Type: application/json" \
    -d '{"delay": 500}'
```

Verify the current delay:

```bash
curl http://localhost:8000/api/delay
```

### 3. Enable Kill-Switch (Optional)

Block all requests with a custom 503 response:

```bash
curl -X POST http://localhost:8000/api/kill-switch \
    -H "Content-Type: application/json" \
    -d '{
        "enabled": true,
        "status": 503,
        "headers": {"content-type": "text/plain"},
        "body": "Service temporarily unavailable"
    }'
```

Disable the kill-switch to resume normal proxying:

```bash
curl -X POST http://localhost:8000/api/kill-switch \
    -H "Content-Type: application/json" \
    -d '{"enabled": false}'
```

### 4. Test Proxy Forwarding

Forward a request through the proxy:

```bash
curl http://localhost:8000/proxy/api/users
```

The request is forwarded to `{UPSTREAM}/api/users` with the configured delay (if kill-switch is disabled).

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Deno Delay Proxy                          │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌──────────────┐                                           │
│  │   Request    │                                           │
│  └──────┬───────┘                                           │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │ Kill-Switch  │───▶│    Delay     │───▶│   Proxy      │  │
│  │   Handler    │    │   Handler    │    │   Handler    │  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         │                  │                  │              │
│         ▼                  ▼                  ▼              │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                    Deno KV                            │  │
│  │  ┌─────────────────┐    ┌─────────────────────────┐   │  │
│  │  │ Kill-Switch     │    │ Delay                   │   │  │
│  │  │ - enabled       │    │ - delayMs               │   │  │
│  │  │ - status        │    └─────────────────────────┘   │  │
│  │  │ - headers       │                                  │  │
│  │  │ - body          │                                  │  │
│  │  └─────────────────┘                                  │  │
│  └──────────────────────────────────────────────────────┘  │
│         │                                                   │
│         ▼                                                   │
│  ┌──────────────────────────────────────────────────────┐  │
│  │                   Upstream Server                      │  │
│  │                  (configured via UPSTREAM)             │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Patterns

- **Dependency Injection**: All handlers receive repositories via constructor for testability
- **Result Pattern**: Uses `typescript-result` for explicit error handling
- **Zod Validation**: Type-safe request validation at the boundary
- **Pure Handler Functions**: The `handleRequest` function is testable by passing Request objects

---

## Testing

### Run All Tests

```bash
deno test main_test.ts --allow-all --unstable-kv
```

Or using npm:

```bash
npm run test
```

### Test Coverage

The test suite includes:

- 404 handling for unknown routes
- Delay GET and POST endpoints
- Kill-switch GET and POST endpoints
- Proxy forwarding with configured delay
- Kill-switch interception behavior
- Request validation and error handling

---

## Development

### Code Quality

```bash
# Type check
deno check **/*.ts

# Format code
deno fmt

# Check formatting
deno fmt --check

# Lint
deno lint
```

### Project Structure

```
├── main.ts              # Entry point with request routing
├── deno.json            # Deno configuration
├── main_test.ts         # Integration tests
└── src/
    ├── handlers/        # HTTP request handlers
    │   ├── delay.ts
    │   ├── kill-switch.ts
    │   ├── proxy.ts
    │   └── swagger*.ts
    ├── repository/      # Deno KV persistence
    │   ├── delay.ts
    │   └── kill-switch.ts
    ├── dto/             # Request validation schemas (Zod)
    │   ├── delay.ts
    │   kill-switch.ts
    ├── types.ts         # Type definitions
    ├── logger.ts        # Logging utilities
    └── docs/
        └── swagger.json # OpenAPI 3.0 specification
```

---

## License

MIT
