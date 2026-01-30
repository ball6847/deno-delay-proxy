type LogData = Record<string, unknown>;

type LogLevel = "debug" | "info" | "warn" | "error";

function createLogEntry(level: LogLevel, data: LogData): string {
    return JSON.stringify({
        timestamp: new Date().toISOString(),
        level,
        ...data,
    });
}

function log(level: LogLevel, data: LogData): void {
    console.log(createLogEntry(level, data));
}

function logRequest(req: Request, targetUrl: URL): void {
    log("info", {
        event: "request",
        method: req.method,
        url: req.url,
        targetUrl: targetUrl.toString(),
        userAgent: req.headers.get("user-agent") || "unknown",
    });
}


function logResponse(targetUrl: URL, status: number, durationMs: number, killed: boolean): void {
    log("info", {
        event: "response",
        targetUrl: targetUrl.toString(),
        status,
        durationMs,
        killed,
    });
}

export const logger = {
    log,
    request: logRequest,
    response: logResponse,
};
