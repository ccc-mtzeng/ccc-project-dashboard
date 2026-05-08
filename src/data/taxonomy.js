export const TAG_TAXONOMY = {
  manufacturing: {
    label: "Manufacturing",
    color: "#7F77DD",
    bg: "#EEEDFE",
    darkBg: "#26215C",
    darkColor: "#CECBF6",
    subtags: [
      "work_orders",
      "wip_routing",
      "mrp",
      "outsourced_mfg",
      "demand_planning",
      "field_service",
    ],
  },
  order_to_cash: {
    label: "Order to cash",
    color: "#378ADD",
    bg: "#E6F1FB",
    darkBg: "#042C53",
    darkColor: "#B5D4F4",
    subtags: [
      "ordering_process",
      "shipping_integrations",
      "ar_automations",
      "rma",
      "warranties",
      "commissions",
      "suitebilling",
      "customer_contact_mgmt",
    ],
  },
  procure_to_pay: {
    label: "Procure to pay",
    color: "#1D9E75",
    bg: "#E1F5EE",
    darkBg: "#04342C",
    darkColor: "#9FE1CB",
    subtags: [
      "procurement_process",
      "three_way_match",
      "landed_cost",
      "edi",
      "ap_automations",
    ],
  },
  inventory_mgmt: {
    label: "Inventory mgmt",
    color: "#BA7517",
    bg: "#FAEEDA",
    darkBg: "#412402",
    darkColor: "#FAC775",
    subtags: [
      "cycle_counting",
      "inventory_data_load",
      "lot_bin_serial",
      "inv_best_practices",
      "supply_allocation",
      "ala",
    ],
  },
  record_to_report: {
    label: "Record to report",
    color: "#D85A30",
    bg: "#FAECE7",
    darkBg: "#4A1B0C",
    darkColor: "#F5C4B3",
    subtags: [
      "basic_accounting",
      "intercompany",
      "currency_reval",
      "arm",
      "fam",
      "segmentation",
      "coa_best_practices",
      "costing",
    ],
  },
  lead_to_quote: {
    label: "Lead to quote",
    color: "#D4537E",
    bg: "#FBEAF0",
    darkBg: "#4B1528",
    darkColor: "#F4C0D1",
    subtags: ["lead_management", "online_intake_forms"],
  },
  crm: {
    label: "CRM",
    color: "#639922",
    bg: "#EAF3DE",
    darkBg: "#173404",
    darkColor: "#C0DD97",
    subtags: ["case_rules", "campaign_mgmt", "email_dkim"],
  },
  quality_mgmt: {
    label: "Quality mgmt",
    color: "#E24B4A",
    bg: "#FCEBEB",
    darkBg: "#501313",
    darkColor: "#F7C1C1",
    subtags: ["incoming_inspection", "ncr_dmr", "in_process_inspection"],
  },
  projects: {
    label: "Projects",
    color: "#888780",
    bg: "#F1EFE8",
    darkBg: "#2C2C2A",
    darkColor: "#D3D1C7",
    subtags: ["general_projects", "project_billing"],
  },
  workflows: {
    label: "Workflows",
    color: "#185FA5",
    bg: "#E6F1FB",
    darkBg: "#042C53",
    darkColor: "#85B7EB",
    subtags: [
      "approval_workflows",
      "sublist_mod_workflows",
      "advanced_workflows",
    ],
  },
  users_and_roles: {
    label: "Users & roles",
    color: "#534AB7",
    bg: "#EEEDFE",
    darkBg: "#26215C",
    darkColor: "#AFA9EC",
    subtags: ["role_audit", "dashboard_setup"],
  },
};

export function getTagInfo(tag) {
  const [cat, sub] = tag.split(":");
  const taxonomy = TAG_TAXONOMY[cat];
  if (!taxonomy) return { label: tag, color: "#888780", bg: "#F1EFE8" };
  const label = sub
    ? `${taxonomy.label} · ${sub.replace(/_/g, " ")}`
    : taxonomy.label;
  return { label, color: taxonomy.color, bg: taxonomy.bg };
}
