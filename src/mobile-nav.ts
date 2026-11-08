const PHONE_QUERY = "(max-width: 820px), (pointer: coarse)";
export const isPhoneNav = () => typeof window !== "undefined" && window.matchMedia(PHONE_QUERY).matches;
export const isRouteHash = (hash: string) => /^#(?:home|workspace|new|case\/[\w-]+)$/.test(hash);

export function goToHash(hash: string) {
  if (window.location.hash === hash) return;
  if (isPhoneNav() && isRouteHash(hash)) window.location.replace(hash);
  else window.location.hash = hash;
}

export function installPhoneHashNavigation() {
  const onClick = (event: MouseEvent) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || !isPhoneNav()) return;
    const link = event.composedPath().find((element): element is HTMLAnchorElement => element instanceof HTMLAnchorElement);
    if (!link || !link.hasAttribute("href") || link.hasAttribute("target") || link.hasAttribute("download")) return;
    const destination = new URL(link.href, window.location.href);
    if (destination.origin !== window.location.origin || destination.pathname !== window.location.pathname || destination.search !== window.location.search || !isRouteHash(destination.hash)) return;
    event.preventDefault();
    goToHash(destination.hash);
  };
  document.addEventListener("click", onClick);
  return () => document.removeEventListener("click", onClick);
}
