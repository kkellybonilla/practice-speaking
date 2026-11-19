// Hash routes work on GitHub Pages with no server config: #/practice/abc
import { useEffect, useState } from "react";

export type Route =
  | { name: "home" }
  | { name: "script"; id: string | "new" }
  | { name: "practice"; id: string }
  | { name: "done"; takeId: string }
  | { name: "coach" };

export function parseHash(hash: string): Route {
  const parts = hash.replace(/^#\/?/, "").split("/").filter(Boolean);
  const [page, arg] = parts;
  if (page === "script" && arg) return { name: "script", id: arg };
  if (page === "practice" && arg) return { name: "practice", id: arg };
  if (page === "done" && arg) return { name: "done", takeId: arg };
  if (page === "coach") return { name: "coach" };
  return { name: "home" };
}

export function href(route: Route): string {
  switch (route.name) {
    case "home":
      return "#/";
    case "script":
      return `#/script/${route.id}`;
    case "practice":
      return `#/practice/${route.id}`;
    case "done":
      return `#/done/${route.takeId}`;
    case "coach":
      return "#/coach";
  }
}

export function go(route: Route, replace = false): void {
  const target = href(route);
  if (replace) window.location.replace(target);
  else window.location.hash = target;
}

export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseHash(window.location.hash));
  useEffect(() => {
    const onChange = () => setRoute(parseHash(window.location.hash));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}
