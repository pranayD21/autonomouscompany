import type {ReactNode} from "react";
export function RealtimeProvider({children}:{children:ReactNode}){return <>{children}</>;}
export function useLiveQuery(){return {data:(window as any).__CASES__,status:"live",error:null,utils:{awaitTxId:async()=>{}}};}
