export interface HostingRoute {
  readonly src?: string;
  readonly dest?: string;
  readonly handle?: string;
  readonly methods?: readonly string[];
  readonly status?: number;
  readonly headers?: Readonly<Record<string, string>>;
  readonly continue?: boolean;
}

const LIVE_APIS = ["search", "grade", "compare"];
const LOCAL_APIS = ["checkpoint", "code", "precomputed"];
const INTERNAL_ROUTES = new Set([
  "^/_server-islands/([^/]+?)/?$",
  "^/_image/?$",
  "^/_actions(?:/(.*?))?/?$",
  "^/404/?$",
  "^/.*$",
]);

function apiPattern(name: string): string {
  return `^/api/${name}\\.json$`;
}

/** Astro's default function catch-all makes even bot probes invoke Node. Replace it at build time. */
export function staticHostingRoutes(routes: readonly HostingRoute[]): HostingRoute[] {
  const known = new Set([
    ...INTERNAL_ROUTES,
    ...LIVE_APIS.map(apiPattern),
    ...LOCAL_APIS.map(apiPattern),
  ]);
  const replaced = new Set([...known, "^/_render(?:/.*)?$"]);
  for (const route of routes) {
    if (route.dest === "_render" && !known.has(route.src ?? "")) {
      throw new Error(`Unexpected server route: ${route.src}. Pages must stay static.`);
    }
  }
  return [
    // A generated function can otherwise also be reached at its own name via the filesystem.
    { src: "^/_render(?:/.*)?$", dest: "/404.html", status: 404 },
    ...routes.filter((route) => route.dest !== "_render" && !replaced.has(route.src ?? "")),
    ...LIVE_APIS.flatMap((name) => [
      { src: apiPattern(name), dest: "_render", methods: ["POST"] },
      {
        src: apiPattern(name),
        dest: "/api/method-not-allowed.json",
        status: 405,
        headers: { allow: "POST", "cache-control": "no-store" },
      },
    ]),
    { src: "^/.*$", dest: "/404.html", status: 404 },
  ];
}
