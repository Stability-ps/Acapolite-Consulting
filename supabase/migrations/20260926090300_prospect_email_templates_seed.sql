-- Starter outreach templates. Positioning rule: describe what Acapolite
-- does; never state or imply that the recipient has a SARS problem or has
-- been identified as non-compliant. Only {{company_name}} (always known)
-- is used without a fallback; nothing guesses a contact person's name.
-- Admins can edit or deactivate these in Prospect Hub -> Email Templates.

insert into public.prospect_email_templates (name, category, subject, body_text, description)
select v.name, v.category, v.subject, v.body_text, v.description
from (values
  ('TCS / Tender Compliance', 'tax_compliance_status',
   'Tax Compliance Status support for {{company_name}}',
   E'Good day,\n\nAcapolite Consulting assists South African businesses that supply government and private-sector clients to obtain and maintain a valid SARS Tax Compliance Status (TCS) and PIN, which is required for tender submissions and supplier registration.\n\nIf {{company_name}} ever needs help resolving a TCS issue, preparing for a tender deadline or keeping its compliance status current, our team can assist.\n\nYou can reply to this email or visit https://acapoliteconsulting.co.za to request assistance.\n\nKind regards,\nAcapolite Consulting',
   'For government/tender suppliers. Explains TCS support without implying the business has a problem.'),
  ('Outstanding Returns', 'outstanding_returns',
   'Help with outstanding SARS returns',
   E'Good day,\n\nAcapolite Consulting helps businesses bring their SARS returns up to date - including income tax, VAT, PAYE and provisional tax submissions - and resolve any related penalties with SARS.\n\nIf {{company_name}} would like assistance with outstanding returns now or in future, our team is available to help.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'General offer to help file outstanding returns.'),
  ('VAT Compliance', 'vat',
   'VAT registration, returns and SARS queries',
   E'Good day,\n\nAcapolite Consulting assists businesses with VAT registration, VAT201 returns, VAT audits and SARS verification requests.\n\nIf {{company_name}} needs support with any VAT matter, our team can help.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'VAT services overview.'),
  ('PAYE Compliance', 'paye',
   'PAYE, EMP201 and EMP501 support',
   E'Good day,\n\nAcapolite Consulting helps employers with PAYE registration, monthly EMP201 submissions, EMP501 reconciliations and resolving PAYE queries with SARS.\n\nIf {{company_name}} would like support with payroll tax compliance, our team is available.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'PAYE/payroll tax services overview.'),
  ('SARS Debt Assistance', 'sars_debt',
   'Support with SARS debt and correspondence',
   E'Good day,\n\nAcapolite Consulting assists businesses that are dealing with SARS debt, final demands or SARS correspondence, and helps them understand their options.\n\nIf {{company_name}} ever needs help in this area, our team can review the position and advise on the appropriate process.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'SARS debt support offer.'),
  ('Payment Arrangement', 'payment_arrangement',
   'SARS payment arrangements (instalment agreements)',
   E'Good day,\n\nAcapolite Consulting helps businesses apply to SARS for deferred-payment (instalment) arrangements when a tax liability cannot be settled in full immediately.\n\nIf this is ever relevant to {{company_name}}, our team can prepare and submit the application and liaise with SARS on your behalf.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'Deferred payment arrangement services.'),
  ('Section 200 Debt Compromise', 'debt_compromise',
   'SARS debt compromise applications',
   E'Good day,\n\nAcapolite Consulting assists qualifying businesses with SARS compromise applications in terms of the Tax Administration Act, where settling a tax debt in full is not possible.\n\nIf {{company_name}} would like to understand whether this process could apply, our team can assess the position.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'Compromise of tax debt (TAA s200) offer.'),
  ('Accountant Referral Partnership', 'partnership',
   'Referral partnership for SARS dispute and compliance work',
   E'Good day,\n\nAcapolite Consulting works alongside accounting and bookkeeping practices on specialist SARS matters such as compliance status, debt arrangements, objections and correspondence.\n\nIf {{company_name}} would be open to a referral partnership for matters outside your day-to-day scope, we would welcome a short conversation.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'For accounting practices - partnership pitch.'),
  ('Tender Consultant Partnership', 'partnership',
   'Partnership: tax compliance support for tender clients',
   E'Good day,\n\nAcapolite Consulting supports tender consultants by helping their clients obtain and maintain a valid SARS Tax Compliance Status ahead of submission deadlines.\n\nIf {{company_name}} would find a reliable tax-compliance partner useful, we would welcome a short conversation.\n\nReply to this email or visit https://acapoliteconsulting.co.za.\n\nKind regards,\nAcapolite Consulting',
   'For tender consultants - partnership pitch.')
) as v(name, category, subject, body_text, description)
where not exists (select 1 from public.prospect_email_templates t where t.name = v.name);

update public.prospect_email_templates
set description = coalesce(description, 'General SARS compliance services overview.')
where name = 'SARS Compliance Review';
