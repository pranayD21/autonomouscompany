import type {SVGProps} from "react";

type IconProps = SVGProps<SVGSVGElement> & {size?: number};

const base = (size: number) => ({width: size, height: size, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round" as const, strokeLinejoin: "round" as const});

export function ArrowUpRight({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M6 18 18 6M6 6h12v12"/></svg>;
}

export function ArrowLeft({size = 18, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M20 12H4m6-6-6 6 6 6"/></svg>;
}

export function Logo({size = 27, ...props}: IconProps) {
  return <svg width={size} height={size * 53 / 104} viewBox="0 0 104 53" fill="currentColor" {...props}><path d="M48.4 0L61.2 0Q67.2 0 63.45 4.69L28.55 48.31Q24.8 53 18.8 53L6 53Q0 53 3.75 48.31L38.65 4.69Q42.4 0 48.4 0Z"/><path d="M71.25 12.94L99.55 48.31Q103.3 53 97.3 53L80.6 53Q74.6 53 70.86 48.31L56.94 30.89Q53.2 26.2 56.94 21.51L63.76 12.94Q67.5 8.25 71.25 12.94Z"/></svg>;
}

export function Home({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M4 11 12 4l8 7"/><path d="M6 9.5V20h12V9.5"/></svg>;
}

export function Plus({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M12 5v14M5 12h14"/></svg>;
}

export function Menu({size = 22, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M4 7h16M4 12h16M4 17h16"/></svg>;
}

export function Close({size = 22, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M6 6l12 12M18 6 6 18"/></svg>;
}

export function Upload({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M12 16V4m-5 5 5-5 5 5"/><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3"/></svg>;
}

export function FileIcon({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5Z"/><path d="M14 3v5h5"/></svg>;
}

export function LogOut({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 17l-5-5 5-5M5 12h11"/></svg>;
}

export function User({size = 20, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>;
}

export function Check({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} strokeWidth={2.4} {...props}><path d="m5 12.5 4.5 4.5L19 7.5"/></svg>;
}

export function Mail({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7.5 7.5 6 7.5-6"/></svg>;
}

export function Phone({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M6.6 3.8h2.6l1.4 4-1.9 1.3a11 11 0 0 0 6.2 6.2l1.3-1.9 4 1.4v2.6a2 2 0 0 1-2.2 2A16.5 16.5 0 0 1 4.6 6a2 2 0 0 1 2-2.2Z"/></svg>;
}

export function Inbox({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><path d="M3.5 13.5h5l1.5 2.5h4l1.5-2.5h5"/><path d="M5.8 5.5h12.4l2.3 8V18a1.5 1.5 0 0 1-1.5 1.5H5A1.5 1.5 0 0 1 3.5 18v-4.5Z"/></svg>;
}

export function Question({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="8.5"/><path d="M9.7 9.5a2.4 2.4 0 1 1 3.3 2.2c-.6.3-1 .8-1 1.5v.3"/><path d="M12 16.6h.01"/></svg>;
}

export function Clock({size = 14, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>;
}

export function Info({size = 16, ...props}: IconProps) {
  return <svg {...base(size)} {...props}><circle cx="12" cy="12" r="8.5"/><path d="M12 11v5"/><path d="M12 8h.01"/></svg>;
}

export function ArrowUp({size = 16, ...props}: IconProps) {
  return <svg {...base(size)} strokeWidth={2} {...props}><path d="M12 19V5m-6 6 6-6 6 6"/></svg>;
}
