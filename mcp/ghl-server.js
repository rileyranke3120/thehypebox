#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const GHL_KEY = process.env.GHL_DAVE_API_KEY;
const LOCATION_ID = process.env.GHL_DAVE_LOCATION_ID;
const AGENCY_KEY = process.env.GHL_AGENCY_KEY;
const CALENDAR_ID = process.env.GHL_DAVE_CALENDAR_ID;
const BASE = 'https://services.leadconnectorhq.com';

async function ghl(path, { method = 'GET', body, useAgency = false } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${useAgency ? AGENCY_KEY : GHL_KEY}`,
      'Content-Type': 'application/json',
      Version: '2021-07-28',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

const TOOLS = [
  {
    name: 'search_contacts',
    description: 'Search GHL contacts by name, email, or phone',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Name, email, or phone to search' },
        limit: { type: 'number', description: 'Max results (default 20)' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_contact',
    description: 'Get full details for a GHL contact by ID',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'create_contact',
    description: 'Create a new contact in GHL',
    inputSchema: {
      type: 'object',
      properties: {
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        address1: { type: 'string' },
        city: { type: 'string' },
        state: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        source: { type: 'string' },
      },
    },
  },
  {
    name: 'update_contact',
    description: 'Update fields on an existing GHL contact',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        email: { type: 'string' },
        phone: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
        custom_fields: { type: 'object', description: 'Key-value custom field pairs' },
      },
      required: ['contact_id'],
    },
  },
  {
    name: 'add_contact_tags',
    description: 'Add tags to a GHL contact',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        tags: { type: 'array', items: { type: 'string' } },
      },
      required: ['contact_id', 'tags'],
    },
  },
  {
    name: 'list_opportunities',
    description: 'List pipeline opportunities in GHL',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline_id: { type: 'string', description: 'Optional pipeline ID to filter by' },
        stage_id: { type: 'string', description: 'Optional stage ID to filter by' },
        status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned'] },
        limit: { type: 'number' },
      },
    },
  },
  {
    name: 'create_opportunity',
    description: 'Create a new opportunity in GHL pipeline',
    inputSchema: {
      type: 'object',
      properties: {
        pipeline_id: { type: 'string' },
        stage_id: { type: 'string' },
        contact_id: { type: 'string' },
        name: { type: 'string' },
        status: { type: 'string', enum: ['open', 'won', 'lost', 'abandoned'] },
        monetary_value: { type: 'number' },
      },
      required: ['pipeline_id', 'stage_id', 'contact_id', 'name'],
    },
  },
  {
    name: 'get_available_slots',
    description: "Check Dave's GHL calendar for available appointment slots",
    inputSchema: {
      type: 'object',
      properties: {
        start_date: { type: 'string', description: 'ISO date string, e.g. 2026-05-07' },
        end_date: { type: 'string', description: 'ISO date string, e.g. 2026-05-14' },
        timezone: { type: 'string', description: 'Timezone, e.g. America/New_York' },
      },
      required: ['start_date', 'end_date'],
    },
  },
  {
    name: 'book_appointment',
    description: 'Book an appointment in GHL calendar',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        start_time: { type: 'string', description: 'ISO datetime string' },
        end_time: { type: 'string', description: 'ISO datetime string' },
        title: { type: 'string' },
        timezone: { type: 'string', description: 'e.g. America/New_York' },
      },
      required: ['contact_id', 'start_time', 'end_time'],
    },
  },
  {
    name: 'list_appointments',
    description: 'List upcoming appointments in GHL calendar',
    inputSchema: {
      type: 'object',
      properties: {
        start_time: { type: 'string', description: 'ISO datetime' },
        end_time: { type: 'string', description: 'ISO datetime' },
      },
    },
  },
  {
    name: 'send_sms',
    description: 'Send an SMS to a contact via GHL',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        message: { type: 'string' },
      },
      required: ['contact_id', 'message'],
    },
  },
  {
    name: 'send_email',
    description: 'Send an email to a contact via GHL',
    inputSchema: {
      type: 'object',
      properties: {
        contact_id: { type: 'string' },
        subject: { type: 'string' },
        body: { type: 'string', description: 'HTML or plain text body' },
        from_name: { type: 'string' },
      },
      required: ['contact_id', 'subject', 'body'],
    },
  },
  {
    name: 'list_pipelines',
    description: 'List all pipelines in the GHL location',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'list_workflows',
    description: 'List all workflows in the GHL location',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'trigger_workflow',
    description: 'Add a contact to a GHL workflow to trigger automations',
    inputSchema: {
      type: 'object',
      properties: {
        workflow_id: { type: 'string' },
        contact_id: { type: 'string' },
      },
      required: ['workflow_id', 'contact_id'],
    },
  },
  {
    name: 'list_calendars',
    description: 'List all calendars in the GHL location',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_location_info',
    description: 'Get info about the GHL location (Dave / Ideal Concrete Coatings)',
    inputSchema: { type: 'object', properties: {} },
  },
];

async function handleTool(name, args) {
  switch (name) {
    case 'search_contacts': {
      const data = await ghl(
        `/contacts/search?locationId=${LOCATION_ID}&query=${encodeURIComponent(args.query)}&limit=${args.limit || 20}`
      );
      return data;
    }

    case 'get_contact': {
      return await ghl(`/contacts/${args.contact_id}`);
    }

    case 'create_contact': {
      const body = { locationId: LOCATION_ID };
      if (args.first_name) body.firstName = args.first_name;
      if (args.last_name) body.lastName = args.last_name;
      if (args.email) body.email = args.email;
      if (args.phone) body.phone = args.phone;
      if (args.address1) body.address1 = args.address1;
      if (args.city) body.city = args.city;
      if (args.state) body.state = args.state;
      if (args.tags) body.tags = args.tags;
      if (args.source) body.source = args.source;
      return await ghl('/contacts/', { method: 'POST', body });
    }

    case 'update_contact': {
      const { contact_id, custom_fields, ...fields } = args;
      const body = {};
      if (fields.first_name) body.firstName = fields.first_name;
      if (fields.last_name) body.lastName = fields.last_name;
      if (fields.email) body.email = fields.email;
      if (fields.phone) body.phone = fields.phone;
      if (fields.tags) body.tags = fields.tags;
      if (custom_fields) {
        body.customFields = Object.entries(custom_fields).map(([key, value]) => ({ key, field_value: value }));
      }
      return await ghl(`/contacts/${contact_id}`, { method: 'PUT', body });
    }

    case 'add_contact_tags': {
      return await ghl(`/contacts/${args.contact_id}/tags`, {
        method: 'POST',
        body: { tags: args.tags },
      });
    }

    case 'list_opportunities': {
      const params = new URLSearchParams({ location_id: LOCATION_ID });
      if (args.pipeline_id) params.set('pipeline_id', args.pipeline_id);
      if (args.stage_id) params.set('pipeline_stage_id', args.stage_id);
      if (args.status) params.set('status', args.status);
      if (args.limit) params.set('limit', args.limit);
      return await ghl(`/opportunities/search?${params}`);
    }

    case 'create_opportunity': {
      return await ghl('/opportunities/', {
        method: 'POST',
        body: {
          locationId: LOCATION_ID,
          pipelineId: args.pipeline_id,
          pipelineStageId: args.stage_id,
          contactId: args.contact_id,
          name: args.name,
          status: args.status || 'open',
          monetaryValue: args.monetary_value,
        },
      });
    }

    case 'get_available_slots': {
      const params = new URLSearchParams({
        calendarId: CALENDAR_ID,
        startDate: args.start_date,
        endDate: args.end_date,
        timezone: args.timezone || 'America/New_York',
      });
      return await ghl(`/calendars/slots?${params}`);
    }

    case 'book_appointment': {
      return await ghl('/calendars/events/appointments', {
        method: 'POST',
        body: {
          calendarId: CALENDAR_ID,
          locationId: LOCATION_ID,
          contactId: args.contact_id,
          startTime: args.start_time,
          endTime: args.end_time,
          title: args.title || 'Estimate Appointment',
          appointmentStatus: 'confirmed',
          timezone: args.timezone || 'America/New_York',
        },
      });
    }

    case 'list_appointments': {
      const params = new URLSearchParams({ calendarId: CALENDAR_ID });
      if (args.start_time) params.set('startTime', args.start_time);
      if (args.end_time) params.set('endTime', args.end_time);
      return await ghl(`/calendars/events/appointments?${params}`);
    }

    case 'send_sms': {
      const conv = await ghl('/conversations/search', {
        method: 'GET',
      });
      // Create or find conversation then send message
      return await ghl('/conversations/messages', {
        method: 'POST',
        body: {
          type: 'SMS',
          contactId: args.contact_id,
          locationId: LOCATION_ID,
          message: args.message,
        },
      });
    }

    case 'send_email': {
      return await ghl('/conversations/messages', {
        method: 'POST',
        body: {
          type: 'Email',
          contactId: args.contact_id,
          locationId: LOCATION_ID,
          subject: args.subject,
          html: args.body,
          emailFrom: args.from_name || 'The Hype Box',
        },
      });
    }

    case 'list_pipelines': {
      return await ghl(`/opportunities/pipelines?locationId=${LOCATION_ID}`);
    }

    case 'list_workflows': {
      return await ghl(`/workflows/?locationId=${LOCATION_ID}`);
    }

    case 'trigger_workflow': {
      return await ghl(`/workflows/${args.workflow_id}/subscribe`, {
        method: 'POST',
        body: { contactId: args.contact_id },
      });
    }

    case 'list_calendars': {
      return await ghl(`/calendars/?locationId=${LOCATION_ID}`);
    }

    case 'get_location_info': {
      return await ghl(`/locations/${LOCATION_ID}`);
    }

    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

const server = new Server(
  { name: 'ghl-mcp', version: '1.0.0' },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  try {
    const result = await handleTool(name, args || {});
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    return {
      content: [{ type: 'text', text: `Error: ${err.message}` }],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
