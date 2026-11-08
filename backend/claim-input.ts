import {z} from "zod";
const optionalText=(max:number)=>z.string().trim().max(max).default("");
export const claimIntake=z.object({
  contact_name:optionalText(120),
  contact_email:z.union([z.email(),z.literal("")]).default(""),
  contact_phone:z.string().regex(/^(\+[1-9]\d{7,14})?$/).default(""),
  injury_description:optionalText(4000),
  incident_date:z.union([z.iso.date(),z.literal("")]).default(""),
  jurisdiction:optionalText(100),
  employer_name:optionalText(160),
  employer_contact:optionalText(254),
  insurer_name:optionalText(160),
  member_id:optionalText(100),
  claim_number:optionalText(100),
  claim_stage:z.enum(["unknown","not_started","submitted","pending","denied","accepted"]).default("unknown"),
  desired_outcome:optionalText(1000),
});
export const caseInput=z.object({
  title:z.string().trim().min(1).max(120),
  case_type:z.enum(["workplace_injury","health_insurance"]).default("health_insurance"),
  intake:claimIntake.prefault({}),
  bill_cents:z.number().int().min(0).max(100_000_000).nullable().default(null),
  eob_cents:z.number().int().min(0).max(100_000_000).nullable().default(null),
  notes:z.string().max(8000).default(""),
}).superRefine((c,ctx)=>{
  if(c.case_type==="workplace_injury") {
    if(!c.intake.injury_description)ctx.addIssue({code:"custom",path:["intake","injury_description"],message:"Describe the injury."});
  }
});
export type ClaimIntake=z.infer<typeof claimIntake>;
export type CaseInput=z.infer<typeof caseInput>;
export function potentialDifference(bill:number|null,eob:number|null) {
  return bill===null||eob===null?null:Math.max(0,bill-eob);
}
