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

