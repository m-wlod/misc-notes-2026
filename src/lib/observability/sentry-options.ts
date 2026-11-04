/**
 * Sentry settings shared by the server, edge and browser (Phase 22a). Errors only (no
 * tracing, no session replay), no personal data: Sentry never gets IPs, cookies or
 * e-mails, and URLs lose their query string (sign-in codes, unsubscribe tokens, newsletter
 * tokens live there). Pure, so it is unit-tested without the SDK.
 */
type Url = { url?: string | undefined };
type ScrubEvent = {
  request?: (Url & { query_string?: unknown; cookies?: unknown; headers?: unknown }) | undefined;
  user?: { id?: string | number | undefined; [k: string]: unknown } | undefined;
  breadcrumbs?: { data?: Url & Record<string, unknown> }[] | undefined;
};

export const stripQuery = (url: string | undefined) => (url ? url.split(/[?#]/)[0] : url);

export function scrubEvent<E extends ScrubEvent>(event: E): E {
  if (event.request) {
    event.request.url = stripQuery(event.request.url);
    delete event.request.query_string;
    delete event.request.cookies;
    delete event.request.headers;
  }
  // The user id only (set on sign-in), never an e-mail, name or IP.
  if (event.user) event.user = event.user.id === undefined ? {} : { id: event.user.id };
  for (const b of event.breadcrumbs ?? []) {
    if (b.data && typeof b.data.url === "string") b.data.url = stripQuery(b.data.url);
  }
  return event;
}

export function sentryOptions(env: {
  dsn: string;
  environment?: string | undefined;
  release?: string | undefined;
}) {
  return {
    dsn: env.dsn,
    environment: env.environment ?? "development",
    release: env.release,
    sendDefaultPii: false,
    tracesSampleRate: 0,
    beforeSend: <E extends ScrubEvent>(event: E) => scrubEvent(event),
  };
}
