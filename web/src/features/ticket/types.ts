export type TicketStatus = 'open' | 'in_progress' | 'waiting_for_user' | 'resolved' | 'closed'
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'
export type TicketCategory = 'technical' | 'billing' | 'account' | 'general' | 'feature_request'

export interface Ticket {
  id: number
  user_id: number
  title: string
  content: string
  category: TicketCategory
  status: TicketStatus
  priority: TicketPriority
  assigned_to: number | null
  closed_at: number | null
  created_at: number
  updated_at: number
  messages?: TicketMessage[]
  user_name?: string
}

export interface TicketMessage {
  id: number
  user_id: number
  content: string
  is_internal: boolean
  created_at: number
  user_name?: string
}

export interface TicketListData {
  tickets: Ticket[]
  total: number
  page: number
  size: number
}

export interface CreateTicketRequest {
  title: string
  content: string
  category: string
  priority?: string
}

export interface AddMessageRequest {
  content: string
}

export interface AddAdminMessageRequest {
  content: string
  is_internal?: boolean
}

export const TICKET_STATUS_OPTIONS: { value: TicketStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In Progress' },
  { value: 'waiting_for_user', label: 'Waiting for User' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'closed', label: 'Closed' },
]

export const TICKET_PRIORITY_OPTIONS: { value: TicketPriority; label: string; color: string }[] = [
  { value: 'low', label: 'Low', color: 'bg-gray-100 text-gray-700' },
  { value: 'medium', label: 'Medium', color: 'bg-blue-100 text-blue-700' },
  { value: 'high', label: 'High', color: 'bg-orange-100 text-orange-700' },
  { value: 'urgent', label: 'Urgent', color: 'bg-red-100 text-red-700' },
]

export const TICKET_CATEGORY_OPTIONS: { value: TicketCategory; label: string }[] = [
  { value: 'technical', label: 'Technical' },
  { value: 'billing', label: 'Billing' },
  { value: 'account', label: 'Account' },
  { value: 'general', label: 'General' },
  { value: 'feature_request', label: 'Feature Request' },
]
