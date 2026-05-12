#!/usr/bin/env node
const { Server } = require("@modelcontextprotocol/sdk/server/index.js");
const { StdioServerTransport } = require("@modelcontextprotocol/sdk/server/stdio.js");
const { CallToolRequestSchema, ListToolsRequestSchema } = require("@modelcontextprotocol/sdk/types.js");

const GHL_AGENCY_KEY  = process.env.GHL_AGENCY_KEY;
const GHL_API_KEY     = process.env.GHL_API_KEY;
const GHL_LOCATION_ID = process.env.GHL_LOCATION_ID;
const GHL_CALENDAR_ID = process.env.GHL_CALENDAR_ID;
const BASE_URL = "https://services.leadconnectorhq.com";

function headers(agency = false) {
  return {
    Authorization: `Bearer ${agency ? GHL_AGENCY_KEY : GHL_API_KEY}`,
    Version: "2021-07-28",
    "Content-Type": "application/json",
  };
}

async function ghl(path, options = {}, agency = false) {
  const { default: fetch } = await import("node-fetch");
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    headers: { ...headers(agency), ...options.headers },
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text }; }
}

const ok = (data) => ({ content: [{ type: "text", text: JSON.stringify(data, null, 2) }] });
const err = (msg) => ({ content: [{ type: "text", text: `Error: ${msg}` }], isError: true });

const server = new Server({ name: "ghl", version: "3.0.0" }, { capabilities: { tools: {} } });

// ─────────────────────────────────────────────────────────────────────────────
// Tool definitions
// ─────────────────────────────────────────────────────────────────────────────
const TOOLS = [
  // ── CONTACTS ──────────────────────────────────────────────────────────────
  { name: "search_contacts", description: "Search contacts by name, email, or phone.",
    inputSchema: { type: "object", properties: {
      query: { type: "string" }, locationId: { type: "string" }, limit: { type: "number" },
    }}},
  { name: "get_contact", description: "Get a single contact by ID.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},
  { name: "create_contact", description: "Create a new contact.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" },
      email: { type: "string" }, phone: { type: "string" }, address1: { type: "string" },
      city: { type: "string" }, state: { type: "string" }, postalCode: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      customFields: { type: "object", description: "key→value pairs" },
    }}},
  { name: "update_contact", description: "Update an existing contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" },
      email: { type: "string" }, phone: { type: "string" }, address1: { type: "string" },
      city: { type: "string" }, state: { type: "string" }, postalCode: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      customFields: { type: "object" },
    }}},
  { name: "upsert_contact", description: "Create or update a contact by email/phone (deduplication).",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" },
      email: { type: "string" }, phone: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
      customFields: { type: "object" },
    }}},
  { name: "delete_contact", description: "Permanently delete a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},
  { name: "get_contact_appointments", description: "Get all appointments for a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},
  { name: "update_contact_dnd", description: "Update do-not-disturb settings for a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
      dnd: { type: "boolean", description: "true = enable DND (stop all messages)" },
      dndSettings: { type: "object", description: "Per-channel DND: { SMS: {status:'active'}, Email: {status:'inactive'}, ... }" },
    }}},

  // ── TAGS ──────────────────────────────────────────────────────────────────
  { name: "add_contact_tags", description: "Add tags to a contact.",
    inputSchema: { type: "object", required: ["contact_id", "tags"], properties: {
      contact_id: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    }}},
  { name: "remove_contact_tags", description: "Remove tags from a contact.",
    inputSchema: { type: "object", required: ["contact_id", "tags"], properties: {
      contact_id: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    }}},

  // ── NOTES ─────────────────────────────────────────────────────────────────
  { name: "get_contact_notes", description: "Get all notes on a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},
  { name: "add_contact_note", description: "Add a note to a contact.",
    inputSchema: { type: "object", required: ["contact_id", "body"], properties: {
      contact_id: { type: "string" }, body: { type: "string" }, userId: { type: "string" },
    }}},
  { name: "update_contact_note", description: "Update an existing note on a contact.",
    inputSchema: { type: "object", required: ["contact_id", "note_id", "body"], properties: {
      contact_id: { type: "string" }, note_id: { type: "string" }, body: { type: "string" },
    }}},
  { name: "delete_contact_note", description: "Delete a note from a contact.",
    inputSchema: { type: "object", required: ["contact_id", "note_id"], properties: {
      contact_id: { type: "string" }, note_id: { type: "string" },
    }}},

  // ── TASKS ─────────────────────────────────────────────────────────────────
  { name: "get_contact_tasks", description: "Get all tasks for a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},
  { name: "create_contact_task", description: "Create a task for a contact.",
    inputSchema: { type: "object", required: ["contact_id", "title"], properties: {
      contact_id: { type: "string" }, title: { type: "string" }, body: { type: "string" },
      dueDate: { type: "string", description: "ISO datetime" }, assignedTo: { type: "string" },
    }}},
  { name: "update_contact_task", description: "Update a contact task.",
    inputSchema: { type: "object", required: ["contact_id", "task_id"], properties: {
      contact_id: { type: "string" }, task_id: { type: "string" }, title: { type: "string" },
      body: { type: "string" }, dueDate: { type: "string" }, completed: { type: "boolean" },
    }}},
  { name: "delete_contact_task", description: "Delete a task from a contact.",
    inputSchema: { type: "object", required: ["contact_id", "task_id"], properties: {
      contact_id: { type: "string" }, task_id: { type: "string" },
    }}},

  // ── WORKFLOWS & CAMPAIGNS ─────────────────────────────────────────────────
  { name: "list_workflows", description: "List all workflows for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "add_contact_to_workflow", description: "Enroll a contact into a workflow.",
    inputSchema: { type: "object", required: ["contact_id", "workflow_id"], properties: {
      contact_id: { type: "string" }, workflow_id: { type: "string" },
      event_start_time: { type: "string", description: "ISO datetime (optional)" },
    }}},
  { name: "remove_contact_from_workflow", description: "Remove a contact from a workflow.",
    inputSchema: { type: "object", required: ["contact_id", "workflow_id"], properties: {
      contact_id: { type: "string" }, workflow_id: { type: "string" },
    }}},
  { name: "list_campaigns", description: "List all campaigns for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, status: { type: "string", description: "active, inactive, draft" },
    }}},
  { name: "add_contact_to_campaign", description: "Add a contact to a drip campaign.",
    inputSchema: { type: "object", required: ["contact_id", "campaign_id"], properties: {
      contact_id: { type: "string" }, campaign_id: { type: "string" },
    }}},
  { name: "remove_contact_from_campaign", description: "Remove a contact from a specific campaign.",
    inputSchema: { type: "object", required: ["contact_id", "campaign_id"], properties: {
      contact_id: { type: "string" }, campaign_id: { type: "string" },
    }}},
  { name: "remove_contact_from_all_campaigns", description: "Remove a contact from ALL campaigns at once.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" },
    }}},

  // ── CONVERSATIONS & MESSAGING ─────────────────────────────────────────────
  { name: "get_conversations", description: "List recent conversations for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, contact_id: { type: "string" }, limit: { type: "number" },
    }}},
  { name: "get_conversation", description: "Get a single conversation by ID.",
    inputSchema: { type: "object", required: ["conversation_id"], properties: {
      conversation_id: { type: "string" },
    }}},
  { name: "create_conversation", description: "Create a new conversation for a contact.",
    inputSchema: { type: "object", required: ["contact_id"], properties: {
      contact_id: { type: "string" }, locationId: { type: "string" },
    }}},
  { name: "get_conversation_messages", description: "Get messages in a conversation.",
    inputSchema: { type: "object", required: ["conversation_id"], properties: {
      conversation_id: { type: "string" }, limit: { type: "number" },
    }}},
  { name: "send_sms", description: "Send an SMS to a contact.",
    inputSchema: { type: "object", required: ["contact_id", "message"], properties: {
      contact_id: { type: "string" }, message: { type: "string" }, locationId: { type: "string" },
    }}},
  { name: "send_email", description: "Send an email to a contact.",
    inputSchema: { type: "object", required: ["contact_id", "subject", "body"], properties: {
      contact_id: { type: "string" }, subject: { type: "string" },
      body: { type: "string", description: "HTML or plain text" }, locationId: { type: "string" },
    }}},

  // ── OPPORTUNITIES / PIPELINES ─────────────────────────────────────────────
  { name: "get_pipelines", description: "List all pipelines and stages for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "get_opportunities", description: "List/search pipeline opportunities.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      status: { type: "string", description: "open, won, lost, abandoned" },
      pipelineId: { type: "string" }, contact_id: { type: "string" },
    }}},
  { name: "get_opportunity", description: "Get a single opportunity by ID.",
    inputSchema: { type: "object", required: ["opportunity_id"], properties: {
      opportunity_id: { type: "string" },
    }}},
  { name: "create_opportunity", description: "Create a new pipeline opportunity.",
    inputSchema: { type: "object", required: ["pipelineId", "pipelineStageId", "contact_id", "name"], properties: {
      locationId: { type: "string" }, pipelineId: { type: "string" },
      pipelineStageId: { type: "string" }, contact_id: { type: "string" },
      name: { type: "string" }, monetaryValue: { type: "number" },
      status: { type: "string", description: "open, won, lost, abandoned" },
      assignedTo: { type: "string" },
    }}},
  { name: "update_opportunity", description: "Update an opportunity (stage, value, status, etc.).",
    inputSchema: { type: "object", required: ["opportunity_id"], properties: {
      opportunity_id: { type: "string" }, pipelineStageId: { type: "string" },
      status: { type: "string" }, monetaryValue: { type: "number" },
      name: { type: "string" }, assignedTo: { type: "string" },
    }}},
  { name: "update_opportunity_status", description: "Quickly update just the status of an opportunity.",
    inputSchema: { type: "object", required: ["opportunity_id", "status"], properties: {
      opportunity_id: { type: "string" },
      status: { type: "string", description: "open, won, lost, abandoned" },
    }}},
  { name: "delete_opportunity", description: "Delete an opportunity.",
    inputSchema: { type: "object", required: ["opportunity_id"], properties: {
      opportunity_id: { type: "string" },
    }}},

  // ── CALENDARS & APPOINTMENTS ──────────────────────────────────────────────
  { name: "list_calendars", description: "List all calendars for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "get_calendar_slots", description: "Get available appointment slots.",
    inputSchema: { type: "object", required: ["startDate", "endDate"], properties: {
      startDate: { type: "string", description: "YYYY-MM-DD" },
      endDate: { type: "string", description: "YYYY-MM-DD" },
      timezone: { type: "string" }, calendarId: { type: "string" },
    }}},
  { name: "get_appointments", description: "List appointments from a calendar.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, calendarId: { type: "string" },
      startTime: { type: "string", description: "ISO datetime" },
      endTime: { type: "string", description: "ISO datetime" },
    }}},
  { name: "create_appointment", description: "Book a new appointment.",
    inputSchema: { type: "object", required: ["calendarId", "contact_id", "startTime", "endTime"], properties: {
      calendarId: { type: "string" }, locationId: { type: "string" },
      contact_id: { type: "string" },
      startTime: { type: "string", description: "ISO datetime" },
      endTime: { type: "string", description: "ISO datetime" },
      title: { type: "string" }, notes: { type: "string" },
      timezone: { type: "string" }, appointmentStatus: { type: "string", description: "new, confirmed, cancelled, showed, noshow, invalid" },
    }}},
  { name: "update_appointment", description: "Update an existing appointment.",
    inputSchema: { type: "object", required: ["event_id"], properties: {
      event_id: { type: "string" }, calendarId: { type: "string" },
      startTime: { type: "string" }, endTime: { type: "string" },
      title: { type: "string" }, notes: { type: "string" },
      appointmentStatus: { type: "string" },
    }}},
  { name: "delete_appointment", description: "Delete/cancel an appointment.",
    inputSchema: { type: "object", required: ["event_id"], properties: {
      event_id: { type: "string" },
    }}},

  // ── USERS ─────────────────────────────────────────────────────────────────
  { name: "get_users", description: "List users for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "get_user", description: "Get a single user by ID.",
    inputSchema: { type: "object", required: ["user_id"], properties: {
      user_id: { type: "string" },
    }}},
  { name: "create_user", description: "Create a new user for a location.",
    inputSchema: { type: "object", required: ["locationId", "firstName", "lastName", "email", "password", "role"], properties: {
      locationId: { type: "string" }, companyId: { type: "string" },
      firstName: { type: "string" }, lastName: { type: "string" },
      email: { type: "string" }, password: { type: "string" },
      phone: { type: "string" },
      role: { type: "string", description: "admin, user" },
      type: { type: "string", description: "account, agency" },
      permissions: { type: "object" },
    }}},
  { name: "update_user", description: "Update an existing user.",
    inputSchema: { type: "object", required: ["user_id"], properties: {
      user_id: { type: "string" }, firstName: { type: "string" }, lastName: { type: "string" },
      email: { type: "string" }, phone: { type: "string" }, role: { type: "string" },
      permissions: { type: "object" },
    }}},
  { name: "delete_user", description: "Delete a user from a location.",
    inputSchema: { type: "object", required: ["user_id"], properties: {
      user_id: { type: "string" },
    }}},

  // ── SUB-ACCOUNTS (LOCATIONS) ──────────────────────────────────────────────
  { name: "list_locations", description: "List all sub-account locations. Requires agency key.",
    inputSchema: { type: "object", properties: {
      limit: { type: "number" }, skip: { type: "number" }, search: { type: "string" },
    }}},
  { name: "get_location", description: "Get details for a sub-account location.",
    inputSchema: { type: "object", required: ["locationId"], properties: {
      locationId: { type: "string" },
    }}},
  { name: "create_location", description: "Create a new sub-account. Requires agency key.",
    inputSchema: { type: "object", required: ["name"], properties: {
      name: { type: "string" }, email: { type: "string" }, phone: { type: "string" },
      address: { type: "string" }, city: { type: "string" }, state: { type: "string" },
      postalCode: { type: "string" }, country: { type: "string" },
      website: { type: "string" }, timezone: { type: "string" },
      firstName: { type: "string" }, lastName: { type: "string" },
      snapshotId: { type: "string", description: "Apply a snapshot on creation" },
    }}},
  { name: "update_location", description: "Update a sub-account location.",
    inputSchema: { type: "object", required: ["locationId"], properties: {
      locationId: { type: "string" }, name: { type: "string" }, email: { type: "string" },
      phone: { type: "string" }, address: { type: "string" }, city: { type: "string" },
      state: { type: "string" }, postalCode: { type: "string" }, website: { type: "string" },
      timezone: { type: "string" },
    }}},
  { name: "delete_location", description: "Delete a sub-account. IRREVERSIBLE — all data is lost.",
    inputSchema: { type: "object", required: ["locationId"], properties: {
      locationId: { type: "string" },
    }}},

  // ── LOCATION: CUSTOM FIELDS ───────────────────────────────────────────────
  { name: "get_location_custom_fields", description: "Get custom fields defined for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "create_location_custom_field", description: "Create a custom field for a location.",
    inputSchema: { type: "object", required: ["name", "dataType"], properties: {
      locationId: { type: "string" }, name: { type: "string" },
      dataType: { type: "string", description: "TEXT, LARGE_TEXT, NUMERICAL, PHONE, MONETORY, EMAIL, DATE, LIST, CHECKBOX, RADIO, TEXTBOX_LIST, FILE_UPLOAD, SIGNATURE" },
      placeholder: { type: "string" }, acceptedValues: { type: "array", items: { type: "string" }, description: "For LIST/RADIO/CHECKBOX types" },
      textBoxListOptions: { type: "array", items: { type: "object" } },
      model: { type: "string", description: "contact or opportunity" },
    }}},
  { name: "update_location_custom_field", description: "Update an existing custom field.",
    inputSchema: { type: "object", required: ["field_id", "name"], properties: {
      locationId: { type: "string" }, field_id: { type: "string" }, name: { type: "string" },
      placeholder: { type: "string" }, acceptedValues: { type: "array", items: { type: "string" } },
    }}},
  { name: "delete_location_custom_field", description: "Delete a custom field from a location.",
    inputSchema: { type: "object", required: ["field_id"], properties: {
      locationId: { type: "string" }, field_id: { type: "string" },
    }}},

  // ── LOCATION: CUSTOM VALUES ───────────────────────────────────────────────
  { name: "get_location_custom_values", description: "Get custom values (location-level variables) for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "create_location_custom_value", description: "Create a custom value for a location.",
    inputSchema: { type: "object", required: ["name", "value"], properties: {
      locationId: { type: "string" }, name: { type: "string" }, value: { type: "string" },
    }}},
  { name: "update_location_custom_value", description: "Update a custom value.",
    inputSchema: { type: "object", required: ["value_id"], properties: {
      locationId: { type: "string" }, value_id: { type: "string" },
      name: { type: "string" }, value: { type: "string" },
    }}},
  { name: "delete_location_custom_value", description: "Delete a custom value.",
    inputSchema: { type: "object", required: ["value_id"], properties: {
      locationId: { type: "string" }, value_id: { type: "string" },
    }}},

  // ── LOCATION: TAGS ────────────────────────────────────────────────────────
  { name: "get_location_tags", description: "Get all tags defined for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "create_location_tag", description: "Create a new tag for a location.",
    inputSchema: { type: "object", required: ["name"], properties: {
      locationId: { type: "string" }, name: { type: "string" },
    }}},
  { name: "update_location_tag", description: "Rename a tag in a location.",
    inputSchema: { type: "object", required: ["tag_id", "name"], properties: {
      locationId: { type: "string" }, tag_id: { type: "string" }, name: { type: "string" },
    }}},
  { name: "delete_location_tag", description: "Delete a tag from a location.",
    inputSchema: { type: "object", required: ["tag_id"], properties: {
      locationId: { type: "string" }, tag_id: { type: "string" },
    }}},

  // ── FORMS & SURVEYS ───────────────────────────────────────────────────────
  { name: "list_forms", description: "List all forms for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" }, skip: { type: "number" },
      type: { type: "string", description: "form or quiz" },
    }}},
  { name: "get_form_submissions", description: "Get submissions for a form.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, formId: { type: "string" },
      startAt: { type: "string", description: "ISO datetime" },
      endAt: { type: "string", description: "ISO datetime" },
      limit: { type: "number" }, page: { type: "number" },
    }}},
  { name: "list_surveys", description: "List all surveys for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" }, skip: { type: "number" },
    }}},
  { name: "get_survey_submissions", description: "Get submissions for a survey.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, surveyId: { type: "string" },
      startAt: { type: "string" }, endAt: { type: "string" },
      limit: { type: "number" }, page: { type: "number" },
    }}},

  // ── SNAPSHOTS ─────────────────────────────────────────────────────────────
  { name: "list_snapshots", description: "List all snapshots for the agency.",
    inputSchema: { type: "object", properties: {
      companyId: { type: "string" },
    }}},

  // ── BUSINESSES ────────────────────────────────────────────────────────────
  { name: "list_businesses", description: "List all businesses for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "get_business", description: "Get a single business by ID.",
    inputSchema: { type: "object", required: ["business_id"], properties: {
      business_id: { type: "string" },
    }}},
  { name: "create_business", description: "Create a new business under a location.",
    inputSchema: { type: "object", required: ["name"], properties: {
      locationId: { type: "string" }, name: { type: "string" }, phone: { type: "string" },
      email: { type: "string" }, website: { type: "string" }, address: { type: "string" },
      city: { type: "string" }, state: { type: "string" }, postalCode: { type: "string" },
      country: { type: "string" }, description: { type: "string" },
    }}},
  { name: "update_business", description: "Update an existing business.",
    inputSchema: { type: "object", required: ["business_id"], properties: {
      business_id: { type: "string" }, name: { type: "string" }, phone: { type: "string" },
      email: { type: "string" }, website: { type: "string" }, description: { type: "string" },
    }}},
  { name: "delete_business", description: "Delete a business.",
    inputSchema: { type: "object", required: ["business_id"], properties: {
      business_id: { type: "string" },
    }}},

  // ── INVOICES ──────────────────────────────────────────────────────────────
  { name: "list_invoices", description: "List invoices for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" }, offset: { type: "number" },
      status: { type: "string", description: "draft, sent, payment_processing, paid, void, overdue" },
      contactId: { type: "string" }, startDate: { type: "string" }, endDate: { type: "string" },
    }}},
  { name: "get_invoice", description: "Get a single invoice by ID.",
    inputSchema: { type: "object", required: ["invoice_id"], properties: {
      invoice_id: { type: "string" },
    }}},
  { name: "create_invoice", description: "Create a new invoice.",
    inputSchema: { type: "object", required: ["locationId", "contactId"], properties: {
      locationId: { type: "string" }, contactId: { type: "string" },
      name: { type: "string" }, dueDate: { type: "string", description: "YYYY-MM-DD" },
      currency: { type: "string", description: "USD, etc." },
      items: { type: "array", description: "Array of line items", items: {
        type: "object", properties: {
          name: { type: "string" }, description: { type: "string" },
          unitPrice: { type: "number" }, quantity: { type: "number" },
          taxes: { type: "array", items: { type: "object" } },
        },
      }},
      discount: { type: "object", description: "{ type: 'percentage'|'fixed', value: number }" },
      termsNotes: { type: "string" },
    }}},
  { name: "send_invoice", description: "Send an invoice to the contact via email.",
    inputSchema: { type: "object", required: ["invoice_id"], properties: {
      invoice_id: { type: "string" },
      action: { type: "string", description: "send_now or schedule" },
    }}},
  { name: "void_invoice", description: "Void an invoice (cannot be undone).",
    inputSchema: { type: "object", required: ["invoice_id"], properties: {
      invoice_id: { type: "string" },
    }}},
  { name: "record_invoice_payment", description: "Record a manual payment against an invoice.",
    inputSchema: { type: "object", required: ["invoice_id", "mode", "amount"], properties: {
      invoice_id: { type: "string" },
      mode: { type: "string", description: "cash, cheque, bank_transfer, other" },
      amount: { type: "number" },
      notes: { type: "string" },
    }}},
  { name: "delete_invoice", description: "Delete a draft invoice.",
    inputSchema: { type: "object", required: ["invoice_id"], properties: {
      invoice_id: { type: "string" },
    }}},

  // ── PAYMENTS ──────────────────────────────────────────────────────────────
  { name: "get_orders", description: "List payment orders for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      contactId: { type: "string" }, funnelId: { type: "string" },
      startAt: { type: "string" }, endAt: { type: "string" },
    }}},
  { name: "get_transactions", description: "List payment transactions for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      contactId: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" },
    }}},
  { name: "get_subscriptions", description: "List active subscriptions for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      contactId: { type: "string" }, startAt: { type: "string" }, endAt: { type: "string" },
    }}},

  // ── PRODUCTS ──────────────────────────────────────────────────────────────
  { name: "list_products", description: "List products for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      search: { type: "string" },
    }}},
  { name: "get_product", description: "Get a single product by ID.",
    inputSchema: { type: "object", required: ["product_id"], properties: {
      product_id: { type: "string" },
    }}},
  { name: "create_product", description: "Create a new product.",
    inputSchema: { type: "object", required: ["locationId", "name"], properties: {
      locationId: { type: "string" }, name: { type: "string" },
      description: { type: "string" }, productType: { type: "string", description: "DIGITAL, PHYSICAL, SERVICE" },
      image: { type: "string", description: "Image URL" },
      statementDescriptor: { type: "string" },
      variants: { type: "array", items: { type: "object" } },
      medias: { type: "array", items: { type: "object" } },
    }}},
  { name: "update_product", description: "Update an existing product.",
    inputSchema: { type: "object", required: ["product_id"], properties: {
      product_id: { type: "string" }, name: { type: "string" },
      description: { type: "string" }, image: { type: "string" },
    }}},
  { name: "delete_product", description: "Delete a product.",
    inputSchema: { type: "object", required: ["product_id"], properties: {
      product_id: { type: "string" },
    }}},

  // ── MEDIA ─────────────────────────────────────────────────────────────────
  { name: "list_media", description: "List media files in the media library.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      query: { type: "string" }, type: { type: "string", description: "image, video, audio, document" },
      sortBy: { type: "string" }, sortOrder: { type: "string", description: "asc or desc" },
    }}},
  { name: "delete_media", description: "Delete a media file.",
    inputSchema: { type: "object", required: ["media_id"], properties: {
      media_id: { type: "string" }, locationId: { type: "string" },
    }}},

  // ── TRIGGER LINKS ─────────────────────────────────────────────────────────
  { name: "list_trigger_links", description: "List trigger links for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
    }}},
  { name: "create_trigger_link", description: "Create a trigger link.",
    inputSchema: { type: "object", required: ["name", "redirectTo"], properties: {
      locationId: { type: "string" }, name: { type: "string" },
      redirectTo: { type: "string", description: "URL to redirect to" },
    }}},
  { name: "update_trigger_link", description: "Update a trigger link.",
    inputSchema: { type: "object", required: ["link_id"], properties: {
      link_id: { type: "string" }, name: { type: "string" }, redirectTo: { type: "string" },
    }}},
  { name: "delete_trigger_link", description: "Delete a trigger link.",
    inputSchema: { type: "object", required: ["link_id"], properties: {
      link_id: { type: "string" },
    }}},

  // ── SOCIAL MEDIA ──────────────────────────────────────────────────────────
  { name: "list_social_accounts", description: "List connected social media accounts for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" },
      userId: { type: "string" },
    }}},
  { name: "get_social_posts", description: "List social media posts for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" }, skip: { type: "number" },
      fromDt: { type: "string", description: "ISO datetime" }, toDt: { type: "string" },
    }}},
  { name: "create_social_post", description: "Create and optionally schedule a social media post.",
    inputSchema: { type: "object", required: ["locationId", "body", "postType"], properties: {
      locationId: { type: "string" },
      body: { type: "string", description: "Post text" },
      postType: { type: "string", description: "now or schedule" },
      scheduledAt: { type: "string", description: "ISO datetime (required if postType=schedule)" },
      accountIds: { type: "array", items: { type: "string" }, description: "Social account IDs to post to" },
      mediaUrls: { type: "array", items: { type: "string" } },
    }}},
  { name: "delete_social_post", description: "Delete a social media post.",
    inputSchema: { type: "object", required: ["post_id"], properties: {
      locationId: { type: "string" }, post_id: { type: "string" },
    }}},

  // ── FUNNELS ───────────────────────────────────────────────────────────────
  { name: "list_funnels", description: "List all funnels for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      search: { type: "string" }, type: { type: "string" },
    }}},
  { name: "list_funnel_pages", description: "List pages within a funnel.",
    inputSchema: { type: "object", required: ["funnel_id"], properties: {
      funnel_id: { type: "string" }, locationId: { type: "string" },
      limit: { type: "number" },
    }}},

  // ── BLOGS ─────────────────────────────────────────────────────────────────
  { name: "list_blog_posts", description: "List blog posts for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" }, offset: { type: "number" },
      search: { type: "string" }, status: { type: "string", description: "PUBLISHED, DRAFT" },
    }}},
  { name: "create_blog_post", description: "Create a new blog post.",
    inputSchema: { type: "object", required: ["locationId", "title"], properties: {
      locationId: { type: "string" }, title: { type: "string" },
      rawHTML: { type: "string", description: "Post body HTML" },
      description: { type: "string" },
      imageUrl: { type: "string" }, thumbnailUrl: { type: "string" },
      status: { type: "string", description: "PUBLISHED or DRAFT" },
      publishedAt: { type: "string", description: "ISO datetime" },
      tags: { type: "array", items: { type: "string" } },
      categories: { type: "array", items: { type: "string" } },
      author: { type: "string" },
      blogId: { type: "string" },
      urlSlug: { type: "string" },
    }}},
  { name: "update_blog_post", description: "Update an existing blog post.",
    inputSchema: { type: "object", required: ["post_id"], properties: {
      locationId: { type: "string" }, post_id: { type: "string" },
      title: { type: "string" }, rawHTML: { type: "string" }, description: { type: "string" },
      status: { type: "string" }, publishedAt: { type: "string" },
      tags: { type: "array", items: { type: "string" } },
    }}},

  // ── EMAIL TEMPLATES ───────────────────────────────────────────────────────
  { name: "list_email_templates", description: "List email/SMS templates for a location.",
    inputSchema: { type: "object", properties: {
      locationId: { type: "string" }, limit: { type: "number" },
      search: { type: "string" }, type: { type: "string", description: "email or sms" },
    }}},
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

// ─────────────────────────────────────────────────────────────────────────────
// Tool handlers
// ─────────────────────────────────────────────────────────────────────────────
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: a } = request.params;
  const loc = a.locationId || GHL_LOCATION_ID;
  const cal = a.calendarId || GHL_CALENDAR_ID;

  try {
    let r;

    switch (name) {
      // ── Contacts ────────────────────────────────────────────────────────
      case "search_contacts": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.query) p.set("query", a.query);
        r = await ghl(`/contacts/?${p}`);
        break;
      }
      case "get_contact":
        r = await ghl(`/contacts/${a.contact_id}`);
        break;
      case "create_contact": {
        const { customFields, locationId: _l, ...rest } = a;
        const body = { ...rest, locationId: loc };
        if (customFields) body.customFields = Object.entries(customFields).map(([key, field_value]) => ({ key, field_value }));
        r = await ghl("/contacts/", { method: "POST", body: JSON.stringify(body) });
        break;
      }
      case "update_contact": {
        const { contact_id, customFields, locationId: _l, ...rest } = a;
        const body = { ...rest };
        if (customFields) body.customFields = Object.entries(customFields).map(([key, field_value]) => ({ key, field_value }));
        r = await ghl(`/contacts/${contact_id}`, { method: "PUT", body: JSON.stringify(body) });
        break;
      }
      case "upsert_contact": {
        const { customFields, locationId: _l, ...rest } = a;
        const body = { ...rest, locationId: loc };
        if (customFields) body.customFields = Object.entries(customFields).map(([key, field_value]) => ({ key, field_value }));
        r = await ghl("/contacts/upsert", { method: "POST", body: JSON.stringify(body) });
        break;
      }
      case "delete_contact":
        r = await ghl(`/contacts/${a.contact_id}`, { method: "DELETE" });
        break;
      case "get_contact_appointments":
        r = await ghl(`/contacts/${a.contact_id}/appointments`);
        break;
      case "update_contact_dnd": {
        const body = {};
        if (typeof a.dnd === "boolean") body.dnd = a.dnd;
        if (a.dndSettings) body.dndSettings = a.dndSettings;
        r = await ghl(`/contacts/${a.contact_id}/dnd`, { method: "PUT", body: JSON.stringify(body) });
        break;
      }

      // ── Tags ────────────────────────────────────────────────────────────
      case "add_contact_tags":
        r = await ghl(`/contacts/${a.contact_id}/tags`, { method: "POST", body: JSON.stringify({ tags: a.tags }) });
        break;
      case "remove_contact_tags":
        r = await ghl(`/contacts/${a.contact_id}/tags`, { method: "DELETE", body: JSON.stringify({ tags: a.tags }) });
        break;

      // ── Notes ───────────────────────────────────────────────────────────
      case "get_contact_notes":
        r = await ghl(`/contacts/${a.contact_id}/notes`);
        break;
      case "add_contact_note": {
        const body = { body: a.body };
        if (a.userId) body.userId = a.userId;
        r = await ghl(`/contacts/${a.contact_id}/notes`, { method: "POST", body: JSON.stringify(body) });
        break;
      }
      case "update_contact_note":
        r = await ghl(`/contacts/${a.contact_id}/notes/${a.note_id}`, { method: "PUT", body: JSON.stringify({ body: a.body }) });
        break;
      case "delete_contact_note":
        r = await ghl(`/contacts/${a.contact_id}/notes/${a.note_id}`, { method: "DELETE" });
        break;

      // ── Tasks ───────────────────────────────────────────────────────────
      case "get_contact_tasks":
        r = await ghl(`/contacts/${a.contact_id}/tasks`);
        break;
      case "create_contact_task": {
        const body = { title: a.title };
        if (a.body) body.body = a.body;
        if (a.dueDate) body.dueDate = a.dueDate;
        if (a.assignedTo) body.assignedTo = a.assignedTo;
        r = await ghl(`/contacts/${a.contact_id}/tasks`, { method: "POST", body: JSON.stringify(body) });
        break;
      }
      case "update_contact_task": {
        const { contact_id, task_id, locationId: _l, ...rest } = a;
        r = await ghl(`/contacts/${contact_id}/tasks/${task_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_contact_task":
        r = await ghl(`/contacts/${a.contact_id}/tasks/${a.task_id}`, { method: "DELETE" });
        break;

      // ── Workflows & Campaigns ────────────────────────────────────────────
      case "list_workflows":
        r = await ghl(`/workflows/?locationId=${loc}`);
        break;
      case "add_contact_to_workflow": {
        const body = {};
        if (a.event_start_time) body.event_start_time = a.event_start_time;
        r = await ghl(`/contacts/${a.contact_id}/workflow/${a.workflow_id}`, { method: "POST", body: JSON.stringify(body) });
        break;
      }
      case "remove_contact_from_workflow":
        r = await ghl(`/contacts/${a.contact_id}/workflow/${a.workflow_id}`, { method: "DELETE" });
        break;
      case "list_campaigns": {
        const p = new URLSearchParams({ locationId: loc });
        if (a.status) p.set("status", a.status);
        r = await ghl(`/campaigns/?${p}`);
        break;
      }
      case "add_contact_to_campaign":
        r = await ghl(`/contacts/${a.contact_id}/campaigns/${a.campaign_id}`, { method: "POST" });
        break;
      case "remove_contact_from_campaign":
        r = await ghl(`/contacts/${a.contact_id}/campaigns/${a.campaign_id}`, { method: "DELETE" });
        break;
      case "remove_contact_from_all_campaigns":
        r = await ghl(`/contacts/${a.contact_id}/campaigns/removeAll`, { method: "DELETE" });
        break;

      // ── Conversations & Messaging ────────────────────────────────────────
      case "get_conversations": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.contact_id) p.set("contactId", a.contact_id);
        r = await ghl(`/conversations/search?${p}`);
        break;
      }
      case "get_conversation":
        r = await ghl(`/conversations/${a.conversation_id}`);
        break;
      case "create_conversation":
        r = await ghl("/conversations/", { method: "POST", body: JSON.stringify({ locationId: loc, contactId: a.contact_id }) });
        break;
      case "get_conversation_messages": {
        const p = new URLSearchParams({ limit: a.limit || 20 });
        r = await ghl(`/conversations/${a.conversation_id}/messages?${p}`);
        break;
      }
      case "send_sms":
        r = await ghl("/conversations/messages", { method: "POST", body: JSON.stringify({ type: "SMS", contactId: a.contact_id, locationId: loc, message: a.message }) });
        break;
      case "send_email":
        r = await ghl("/conversations/messages", { method: "POST", body: JSON.stringify({ type: "Email", contactId: a.contact_id, locationId: loc, subject: a.subject, html: a.body }) });
        break;

      // ── Opportunities & Pipelines ────────────────────────────────────────
      case "get_pipelines":
        r = await ghl(`/opportunities/pipelines?locationId=${loc}`);
        break;
      case "get_opportunities": {
        const p = new URLSearchParams({ location_id: loc, limit: a.limit || 20 });
        if (a.status) p.set("status", a.status);
        if (a.pipelineId) p.set("pipeline_id", a.pipelineId);
        if (a.contact_id) p.set("contact_id", a.contact_id);
        r = await ghl(`/opportunities/search?${p}`);
        break;
      }
      case "get_opportunity":
        r = await ghl(`/opportunities/${a.opportunity_id}`);
        break;
      case "create_opportunity":
        r = await ghl("/opportunities/", { method: "POST", body: JSON.stringify({ locationId: loc, pipelineId: a.pipelineId, pipelineStageId: a.pipelineStageId, contactId: a.contact_id, name: a.name, monetaryValue: a.monetaryValue, status: a.status || "open", assignedTo: a.assignedTo }) });
        break;
      case "update_opportunity": {
        const { opportunity_id, locationId: _l, ...rest } = a;
        r = await ghl(`/opportunities/${opportunity_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "update_opportunity_status":
        r = await ghl(`/opportunities/${a.opportunity_id}/status`, { method: "PATCH", body: JSON.stringify({ status: a.status }) });
        break;
      case "delete_opportunity":
        r = await ghl(`/opportunities/${a.opportunity_id}`, { method: "DELETE" });
        break;

      // ── Calendars & Appointments ─────────────────────────────────────────
      case "list_calendars":
        r = await ghl(`/calendars/?locationId=${loc}`);
        break;
      case "get_calendar_slots": {
        const p = new URLSearchParams({ calendarId: cal, startDate: a.startDate, endDate: a.endDate, timezone: a.timezone || "America/New_York" });
        r = await ghl(`/calendars/events/slots?${p}`);
        break;
      }
      case "get_appointments": {
        const p = new URLSearchParams({ locationId: loc, calendarId: cal });
        if (a.startTime) p.set("startTime", a.startTime);
        if (a.endTime) p.set("endTime", a.endTime);
        r = await ghl(`/calendars/events/appointments?${p}`);
        break;
      }
      case "create_appointment":
        r = await ghl("/calendars/events/appointments", { method: "POST", body: JSON.stringify({ calendarId: a.calendarId || cal, locationId: loc, contactId: a.contact_id, startTime: a.startTime, endTime: a.endTime, title: a.title, notes: a.notes, timezone: a.timezone, appointmentStatus: a.appointmentStatus }) });
        break;
      case "update_appointment": {
        const { event_id, locationId: _l, ...rest } = a;
        r = await ghl(`/calendars/events/appointments/${event_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_appointment":
        r = await ghl(`/calendars/events/appointments/${a.event_id}`, { method: "DELETE" });
        break;

      // ── Users ────────────────────────────────────────────────────────────
      case "get_users":
        r = await ghl(`/users/?locationId=${loc}`);
        break;
      case "get_user":
        r = await ghl(`/users/${a.user_id}`);
        break;
      case "create_user": {
        const { locationId: _l, user_id: _u, ...rest } = a;
        r = await ghl("/users/", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "update_user": {
        const { user_id, locationId: _l, ...rest } = a;
        r = await ghl(`/users/${user_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_user":
        r = await ghl(`/users/${a.user_id}`, { method: "DELETE" });
        break;

      // ── Sub-accounts (agency key) ─────────────────────────────────────────
      case "list_locations": {
        const p = new URLSearchParams({ limit: a.limit || 10 });
        if (a.skip) p.set("skip", a.skip);
        if (a.search) p.set("search", a.search);
        r = await ghl(`/locations/search?${p}`, {}, true);
        break;
      }
      case "get_location":
        r = await ghl(`/locations/${a.locationId}`, {}, true);
        break;
      case "create_location": {
        const { locationId: _l, ...rest } = a;
        r = await ghl("/locations/", { method: "POST", body: JSON.stringify({ country: "US", ...rest }) }, true);
        break;
      }
      case "update_location": {
        const { locationId, ...rest } = a;
        r = await ghl(`/locations/${locationId}`, { method: "PUT", body: JSON.stringify(rest) }, true);
        break;
      }
      case "delete_location":
        r = await ghl(`/locations/${a.locationId}`, { method: "DELETE" }, true);
        break;

      // ── Location: Custom Fields ──────────────────────────────────────────
      case "get_location_custom_fields":
        r = await ghl(`/locations/${loc}/customFields`);
        break;
      case "create_location_custom_field": {
        const { locationId: _l, field_id: _f, ...rest } = a;
        r = await ghl(`/locations/${loc}/customFields`, { method: "POST", body: JSON.stringify(rest) });
        break;
      }
      case "update_location_custom_field": {
        const { locationId: _l, field_id, ...rest } = a;
        r = await ghl(`/locations/${loc}/customFields/${field_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_location_custom_field":
        r = await ghl(`/locations/${loc}/customFields/${a.field_id}`, { method: "DELETE" });
        break;

      // ── Location: Custom Values ──────────────────────────────────────────
      case "get_location_custom_values":
        r = await ghl(`/locations/${loc}/customValues`);
        break;
      case "create_location_custom_value": {
        const { locationId: _l, value_id: _v, ...rest } = a;
        r = await ghl(`/locations/${loc}/customValues`, { method: "POST", body: JSON.stringify(rest) });
        break;
      }
      case "update_location_custom_value": {
        const { locationId: _l, value_id, ...rest } = a;
        r = await ghl(`/locations/${loc}/customValues/${value_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_location_custom_value":
        r = await ghl(`/locations/${loc}/customValues/${a.value_id}`, { method: "DELETE" });
        break;

      // ── Location: Tags ───────────────────────────────────────────────────
      case "get_location_tags":
        r = await ghl(`/locations/${loc}/tags`);
        break;
      case "create_location_tag": {
        const { locationId: _l, tag_id: _t, ...rest } = a;
        r = await ghl(`/locations/${loc}/tags`, { method: "POST", body: JSON.stringify(rest) });
        break;
      }
      case "update_location_tag": {
        const { locationId: _l, tag_id, ...rest } = a;
        r = await ghl(`/locations/${loc}/tags/${tag_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_location_tag":
        r = await ghl(`/locations/${loc}/tags/${a.tag_id}`, { method: "DELETE" });
        break;

      // ── Forms & Surveys ──────────────────────────────────────────────────
      case "list_forms": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, skip: a.skip || 0 });
        if (a.type) p.set("type", a.type);
        r = await ghl(`/forms/?${p}`);
        break;
      }
      case "get_form_submissions": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, page: a.page || 1 });
        if (a.formId) p.set("formId", a.formId);
        if (a.startAt) p.set("startAt", a.startAt);
        if (a.endAt) p.set("endAt", a.endAt);
        r = await ghl(`/forms/submissions?${p}`);
        break;
      }
      case "list_surveys": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, skip: a.skip || 0 });
        r = await ghl(`/surveys/?${p}`);
        break;
      }
      case "get_survey_submissions": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, page: a.page || 1 });
        if (a.surveyId) p.set("surveyId", a.surveyId);
        if (a.startAt) p.set("startAt", a.startAt);
        if (a.endAt) p.set("endAt", a.endAt);
        r = await ghl(`/surveys/submissions?${p}`);
        break;
      }

      // ── Snapshots ────────────────────────────────────────────────────────
      case "list_snapshots": {
        const p = new URLSearchParams({ companyId: a.companyId || "kBxNIbpRIN7ggoYAK7Fg" });
        r = await ghl(`/snapshots/?${p}`, {}, true);
        break;
      }

      // ── Businesses ───────────────────────────────────────────────────────
      case "list_businesses":
        r = await ghl(`/businesses/?locationId=${loc}`);
        break;
      case "get_business":
        r = await ghl(`/businesses/${a.business_id}`);
        break;
      case "create_business": {
        const { locationId: _l, business_id: _b, ...rest } = a;
        r = await ghl("/businesses/", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "update_business": {
        const { business_id, locationId: _l, ...rest } = a;
        r = await ghl(`/businesses/${business_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_business":
        r = await ghl(`/businesses/${a.business_id}`, { method: "DELETE" });
        break;

      // ── Invoices ─────────────────────────────────────────────────────────
      case "list_invoices": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, offset: a.offset || 0 });
        if (a.status) p.set("status", a.status);
        if (a.contactId) p.set("contactId", a.contactId);
        if (a.startDate) p.set("startDate", a.startDate);
        if (a.endDate) p.set("endDate", a.endDate);
        r = await ghl(`/invoices/?${p}`);
        break;
      }
      case "get_invoice":
        r = await ghl(`/invoices/${a.invoice_id}`);
        break;
      case "create_invoice": {
        const { invoice_id: _i, locationId: _l, ...rest } = a;
        r = await ghl("/invoices/", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "send_invoice":
        r = await ghl(`/invoices/${a.invoice_id}/send`, { method: "POST", body: JSON.stringify({ action: a.action || "send_now" }) });
        break;
      case "void_invoice":
        r = await ghl(`/invoices/${a.invoice_id}/void`, { method: "POST" });
        break;
      case "record_invoice_payment":
        r = await ghl(`/invoices/${a.invoice_id}/record-payment`, { method: "POST", body: JSON.stringify({ mode: a.mode, amount: a.amount, notes: a.notes }) });
        break;
      case "delete_invoice":
        r = await ghl(`/invoices/${a.invoice_id}`, { method: "DELETE" });
        break;

      // ── Payments ─────────────────────────────────────────────────────────
      case "get_orders": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.contactId) p.set("contactId", a.contactId);
        if (a.funnelId) p.set("funnelId", a.funnelId);
        if (a.startAt) p.set("startAt", a.startAt);
        if (a.endAt) p.set("endAt", a.endAt);
        r = await ghl(`/payments/orders?${p}`);
        break;
      }
      case "get_transactions": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.contactId) p.set("contactId", a.contactId);
        if (a.startAt) p.set("startAt", a.startAt);
        if (a.endAt) p.set("endAt", a.endAt);
        r = await ghl(`/payments/transactions?${p}`);
        break;
      }
      case "get_subscriptions": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.contactId) p.set("contactId", a.contactId);
        if (a.startAt) p.set("startAt", a.startAt);
        if (a.endAt) p.set("endAt", a.endAt);
        r = await ghl(`/payments/subscriptions?${p}`);
        break;
      }

      // ── Products ─────────────────────────────────────────────────────────
      case "list_products": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.search) p.set("search", a.search);
        r = await ghl(`/products/?${p}`);
        break;
      }
      case "get_product":
        r = await ghl(`/products/${a.product_id}`);
        break;
      case "create_product": {
        const { locationId: _l, product_id: _p, ...rest } = a;
        r = await ghl("/products/", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "update_product": {
        const { product_id, locationId: _l, ...rest } = a;
        r = await ghl(`/products/${product_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_product":
        r = await ghl(`/products/${a.product_id}`, { method: "DELETE" });
        break;

      // ── Media ────────────────────────────────────────────────────────────
      case "list_media": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.query) p.set("query", a.query);
        if (a.type) p.set("type", a.type);
        if (a.sortBy) p.set("sortBy", a.sortBy);
        if (a.sortOrder) p.set("sortOrder", a.sortOrder);
        r = await ghl(`/medias/?${p}`);
        break;
      }
      case "delete_media":
        r = await ghl(`/medias/${a.media_id}?locationId=${loc}`, { method: "DELETE" });
        break;

      // ── Trigger Links ────────────────────────────────────────────────────
      case "list_trigger_links":
        r = await ghl(`/links/?locationId=${loc}`);
        break;
      case "create_trigger_link": {
        const { locationId: _l, link_id: _i, ...rest } = a;
        r = await ghl("/links/", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "update_trigger_link": {
        const { link_id, locationId: _l, ...rest } = a;
        r = await ghl(`/links/${link_id}`, { method: "PUT", body: JSON.stringify(rest) });
        break;
      }
      case "delete_trigger_link":
        r = await ghl(`/links/${a.link_id}`, { method: "DELETE" });
        break;

      // ── Social Media ─────────────────────────────────────────────────────
      case "list_social_accounts": {
        const p = new URLSearchParams({ locationId: loc });
        if (a.userId) p.set("userId", a.userId);
        r = await ghl(`/social-media-posting/oauth/facebook/accounts?${p}`);
        break;
      }
      case "get_social_posts": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, skip: a.skip || 0 });
        if (a.fromDt) p.set("fromDt", a.fromDt);
        if (a.toDt) p.set("toDt", a.toDt);
        r = await ghl(`/social-media-posting/posts?${p}`);
        break;
      }
      case "create_social_post": {
        const { locationId: _l, post_id: _p, ...rest } = a;
        r = await ghl("/social-media-posting/posts", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "delete_social_post":
        r = await ghl(`/social-media-posting/posts/${a.post_id}`, { method: "DELETE" });
        break;

      // ── Funnels ──────────────────────────────────────────────────────────
      case "list_funnels": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.search) p.set("search", a.search);
        if (a.type) p.set("type", a.type);
        r = await ghl(`/funnels/funnel/list?${p}`);
        break;
      }
      case "list_funnel_pages": {
        const p = new URLSearchParams({ locationId: loc, funnelId: a.funnel_id, limit: a.limit || 20 });
        r = await ghl(`/funnels/page?${p}`);
        break;
      }

      // ── Blogs ────────────────────────────────────────────────────────────
      case "list_blog_posts": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20, offset: a.offset || 0 });
        if (a.search) p.set("search", a.search);
        if (a.status) p.set("status", a.status);
        r = await ghl(`/blogs/posts?${p}`);
        break;
      }
      case "create_blog_post": {
        const { locationId: _l, post_id: _p, ...rest } = a;
        r = await ghl("/blogs/posts", { method: "POST", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }
      case "update_blog_post": {
        const { post_id, locationId: _l, ...rest } = a;
        r = await ghl(`/blogs/posts/${post_id}`, { method: "PUT", body: JSON.stringify({ ...rest, locationId: loc }) });
        break;
      }

      // ── Email Templates ──────────────────────────────────────────────────
      case "list_email_templates": {
        const p = new URLSearchParams({ locationId: loc, limit: a.limit || 20 });
        if (a.search) p.set("search", a.search);
        if (a.type) p.set("type", a.type);
        r = await ghl(`/templates/?${p}`);
        break;
      }

      default:
        return err(`Unknown tool: ${name}`);
    }

    return ok(r);
  } catch (e) {
    return err(e.message);
  }
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch(console.error);
