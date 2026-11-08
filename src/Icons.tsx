import type {SVGProps} from "react";

type IconProps = SVGProps<SVGSVGElement> & {size?: number};

export function ArrowUpRight({size = 20, ...props}: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M6 18 18 6M6 6h12v12"/></svg>;
}

export function ArrowDown({size = 20, ...props}: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="M12 4v16m-6-6 6 6 6-6"/></svg>;
}

export function Asterisk({size = 27, ...props}: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" {...props}><path d="M12 3v18M4.2 7.5l15.6 9M4.2 16.5l15.6-9"/></svg>;
}

export function ShieldCheck({size = 20, ...props}: IconProps) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" {...props}><path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/></svg>;
}
