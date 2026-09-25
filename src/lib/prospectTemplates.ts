// Re-exports the campaign template renderer used by the prospect-campaign-worker
// edge function, so the in-app preview renders exactly what will be sent.
export {
  TEMPLATE_VARIABLES,
  buildCampaignEmail,
  renderTemplate,
  templateVariables,
  unknownVariables,
  type TemplateValues,
} from "../../supabase/functions/_shared/prospectCampaign";
