"""Generate the invented Assurance upload packet; requires reportlab."""
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import letter
BASE=Path(__file__).resolve().parent
styles=getSampleStyleSheet()
styles.add(ParagraphStyle(name='TitleA',fontName='Helvetica-Bold',fontSize=25,leading=30,textColor=colors.HexColor('#183d45'),spaceAfter=10))
styles.add(ParagraphStyle(name='SubA',fontSize=10,leading=15,textColor=colors.HexColor('#547077'),spaceAfter=21))
styles.add(ParagraphStyle(name='BodyA',fontSize=10.5,leading=16,spaceAfter=12,textColor=colors.HexColor('#21343a')))
styles.add(ParagraphStyle(name='HeadA',fontName='Helvetica-Bold',fontSize=12,leading=17,spaceBefore=13,spaceAfter=7,textColor=colors.HexColor('#183d45')))
def p(s): return Paragraph(s,styles['BodyA'])
def foot(c,d):
 c.setStrokeColor(colors.HexColor('#cedbdc'));c.line(48,47,564,47)
 c.setFont('Helvetica',7);c.setFillColor(colors.HexColor('#60767b'))
 c.drawString(48,33,'Assurance scenario fixture | All people, organizations, and records are invented. Not valid for submission.')
 c.drawRightString(564,20,str(d.page))
def make(name,title,sub,rows,sections):
 story=[Paragraph(title,styles['TitleA']),Paragraph(sub,styles['SubA'])]
 data=[[p('<b>'+k+'</b>'),p(v)] for k,v in rows]
 t=Table(data,colWidths=[144,372],hAlign='LEFT')
 t.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),colors.HexColor('#edf4f3')),('VALIGN',(0,0),(-1,-1),'TOP'),('LEFTPADDING',(0,0),(-1,-1),12),('RIGHTPADDING',(0,0),(-1,-1),12),('TOPPADDING',(0,0),(-1,-1),7),('BOTTOMPADDING',(0,0),(-1,-1),3)]))
 story.extend([t,Spacer(1,14)])
 for heading,body in sections:story.extend([Paragraph(heading,styles['HeadA']),p(body)])
 SimpleDocTemplate(str(BASE/name),pagesize=letter,rightMargin=48,leftMargin=48,topMargin=48,bottomMargin=64,title=title,author='Assurance scenario fixtures').build(story,onFirstPage=foot,onLaterPages=foot)
make('01-incident-account.pdf','Incident account','Employee account | Recorded November 6, 2026',[
 ('Employee','Alex Morgan'),('Employer','Cedar Quay Pharmaceutical Research'),('Work location','San Francisco, California'),('Incident','November 3, 2026, approximately 10:20 a.m.'),('Affected area','Left forearm')],[
 ('What happened','I was transferring a cleaning solution in the preparation room when liquid splashed between my glove and sleeve onto my left forearm. I rinsed the area at the safety station and told my supervisor, Jordan Lee, that morning. I do not know the product concentration; the employer has the container and safety data sheet.'),
 ('Care and paperwork','I went to Harbor Lantern Urgent Care on November 3. I gave the clinic my personal health-insurance card because I did not have the employer\'s claims administrator information. I later received a health-plan notice asking for work-related injury information. My employer acknowledged my incident report but has not supplied a claim number or administrator contact.'),
 ('What I need help with','Please identify the correct employer claim process, obtain the missing administrator and claim details, and clarify the health plan\'s pending review. I want to understand who is responsible for the November 3 charges. I have not paid the $1,260 shown on the notice, received a coverage decision, or signed a settlement.')])
make('02-health-insurance-card.pdf','Health coverage card','Lumen Harbor Health | Member reference',[
 ('Member','Alex Morgan'),('Member ID','LH-4829107'),('Group','CQ-2804'),('Plan','Lumen Harbor PPO'),('Coverage effective','January 1, 2026'),('Plan type','Personal health coverage through employer benefits')],[
 ('Using this information','This card identifies the personal health plan used at the November 3 clinic visit. It does not identify the employer\'s workplace-injury insurer or establish which payer is responsible for this incident.'),
 ('Contact reference','Member portal: https://members.lumenharbor.invalid<br/>Member services: members@lumenharbor.invalid<br/>These reserved .invalid addresses are non-deliverable fixture endpoints. No actual insurer contact is provided.'),
 ('Not supplied','The full benefit booklet, exclusions, coordination provisions, and applicable review instructions are not included in this packet. Obtain the actual documents before deciding coverage or a filing deadline.')])
make('03-visit-summary.pdf','Visit summary','Harbor Lantern Urgent Care | Visit record',[
 ('Patient','Alex Morgan'),('Visit reference','HL-2026-1103-042'),('Date of service','November 3, 2026'),('Reported event','Chemical splash at work, left forearm'),('Health member ID','LH-4829107')],[
 ('Recorded history','Patient reported a splash of cleaning solution while working at Cedar Quay Pharmaceutical Research and immediate rinsing at the workplace safety station. Product name and concentration were not available at the visit.'),
 ('Visit record','Localized redness and tenderness on the left forearm were documented. The recorded assessment was a superficial chemical skin injury. The visit record lists wound evaluation, cleansing, and a protective dressing. This fixture contains no treatment instructions or clinician signature.'),
 ('Billing reference','Total submitted charges: $1,260.00. The personal health plan was supplied at registration. No employer claim reference or workplace-injury payer was recorded. Payment allocation remains unresolved.'),
 ('Supporting information needed','Employer incident report, chemical safety data sheet, and claims administrator details have not been added to the visit record. This summary reports the visit record; it does not determine insurance coverage.')])
make('04-employer-acknowledgment.pdf','Incident report acknowledgment','Cedar Quay Pharmaceutical Research | People Operations',[
 ('Employee','Alex Morgan'),('Report reference','CQ-INC-1103-17'),('Incident date','November 3, 2026'),('Acknowledged','November 4, 2026'),('Reported supervisor','Jordan Lee')],[
 ('Report received','We recorded your report of a cleaning-solution splash to the left forearm in the San Francisco preparation room on November 3. We understand you attended Harbor Lantern Urgent Care that day.'),
 ('Outstanding information','Our records in this packet do not yet identify the workplace-injury insurer or claims administrator. No insurer claim number, completed claim form, or acceptance/denial notice is attached. The supervisor is locating the product information and safety data sheet.'),
 ('Reference for follow-up','People Operations: people@cedarquay.invalid. This is a reserved, non-deliverable fixture address. The incident report number above is an internal employer reference, not an insurer claim number.'),
 ('Status','Receipt of this report is an acknowledgment only. It is not a coverage decision, admission of liability, or confirmation that a claim has been filed with an insurer.')])
make('05-health-plan-review-notice.pdf','Claim review notice','Lumen Harbor Health | Information requested - not a final decision',[
 ('Member','Alex Morgan | LH-4829107'),('Health claim','LH-C-261103-884'),('Provider / service','Harbor Lantern Urgent Care | November 3, 2026'),('Notice date','November 6, 2026'),('Current status','Pending work-related injury information')],[
 ('Charges under review','Submitted charges: <b>$1,260.00</b><br/>Plan payment to date: <b>$0.00</b><br/>Final member responsibility: <b>Not determined</b><br/>This notice is not a bill. No amount is stated as currently payable by the member.'),
 ('Reason for the request','The visit information describes an injury at work. Please provide the employer\'s name, incident date, and any workplace-injury insurer or claims administrator details and claim reference available to you. Explain if those details have not yet been supplied.'),
 ('What remains unresolved','This notice does not approve or deny benefits and does not establish that the personal health plan or employer insurer must pay. Review is awaiting additional information. No appeal deadline is stated in this fixture; request the applicable process and any response deadline from a verified plan source.'),
 ('Response reference','Use health claim LH-C-261103-884 when matching future correspondence. Portal: https://members.lumenharbor.invalid. This reserved fixture endpoint cannot receive a submission.')])
(BASE/'incident-account.txt').write_text('''I am Alex Morgan. I work at Cedar Quay Pharmaceutical Research in San Francisco, California. On November 3, 2026, at about 10:20 a.m., cleaning solution splashed onto my left forearm while I was working. I rinsed it and told my supervisor, Jordan Lee. I went to Harbor Lantern Urgent Care that day and used my personal Lumen Harbor Health insurance card.\n\nMy health plan is holding claim LH-C-261103-884 for information about whether the injury happened at work. The charges are $1,260, but my final responsibility has not been determined. My employer acknowledged report CQ-INC-1103-17 without providing an insurer, claims administrator, or insurer claim number. I have not paid these charges or received a coverage decision.\n\nPlease organize the attached records, identify the missing employer claim information, and work out what needs to happen next. The chemical product details and safety data sheet are still with my employer.\n\nFixture provenance: this account and all attached records are invented for the Assurance presentation. The .invalid contacts are not deliverable. No real insurer, employer, or clinician should be contacted using this packet.\n''')
