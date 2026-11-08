# Upload packet for the workplace-injury walkthrough

`artifacts/demo-case/` contains five one-page, selectable-text PDFs and a plain-text incident account for the Assurance walkthrough. `assurance-upload-pack.zip` contains the upload files; extract the ZIP before uploading the PDFs. No application configuration or credentials are needed.

## Files and consistent facts

| File | Purpose |
| --- | --- |
| `01-incident-account.pdf` | Alex Morgan's account of the November 3, 2026 chemical splash at Cedar Quay Pharmaceutical Research in San Francisco |
| `02-health-insurance-card.pdf` | Lumen Harbor Health personal health-plan member information, member ID LH-4829107 |
| `03-visit-summary.pdf` | November 3 urgent-care record and $1,260 submitted charges |
| `04-employer-acknowledgment.pdf` | Employer report CQ-INC-1103-17, with insurer/administrator and insurer claim number still missing |
| `05-health-plan-review-notice.pdf` | Health claim LH-C-261103-884 awaiting work-related injury information; no final coverage decision or determined member responsibility |
| `incident-account.txt` | The same account in a form that can be pasted into intake |

For a short walkthrough, paste the account and upload the health card and review notice. Add the incident, visit, and employer records to show additional evidence arriving. The packet deliberately leaves the employer's insurer/administrator, chemical safety data sheet, and applicable process unresolved so the agent has concrete investigative work to do. It does not conflate the employer report reference with an insurer claim number or treat a pending personal-health claim as a denial.

All people, organizations, identifiers, and events are invented. Each PDF has one small provenance footer, so a file remains identifiable when separated from the packet. There are no real insurer/provider logos, signatures, participant records, or deliverable contact addresses. Reserved `.invalid` endpoints are explicitly non-deliverable. Do not substitute a real insurer address or present these records as an actual injury. A consenting presentation endpoint can be configured separately if a live communication test is explicitly authorized.

## Generation and verification

`artifacts/demo-case/generate.py` is the reproducible source. Run with Python and the `reportlab` package:

```sh
python artifacts/demo-case/generate.py
```

The output uses US Letter pages, standard embedded PDF text, consistent 48-point margins, and restrained teal headings. Five PDFs were generated and all five passed a `pypdf` text-extraction check for the claimant and provenance, with exactly one page each. PyMuPDF rendered every page and the contact sheet was visually inspected: no clipping, overlap, or missing text was found. Rendered previews stay under ignored `test-results/artifact-preview/`. The health-insurance-card PDF also passed hosted direct extraction as part of the stopped, zero-outreach intake smoke fixture. The other four files were verified locally.
