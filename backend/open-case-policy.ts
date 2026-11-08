import {z} from 'zod';
export const openCasePermission=z.object({version:z.literal(2),consent:z.string().trim().min(1)}).strict();
export type OpenCasePermission=z.infer<typeof openCasePermission>;
export const isOpenCasePermission=(policy:unknown):policy is OpenCasePermission=>openCasePermission.safeParse(policy).success;
export const caseIsOpen=(state:string)=>state==='active'||state==='waiting'||state==='human_required';
