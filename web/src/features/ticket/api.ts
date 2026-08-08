import { api } from '@/lib/api'
import type { Ticket, TicketListData } from './types'

export async function getMyTickets(params: {
  page?: number
  page_size?: number
  status?: string
}): Promise<{ success: boolean; message?: string; data?: TicketListData }> {
  const res = await api.get('/api/ticket/', { params })
  return res.data
}

export async function createTicket(data: {
  title: string
  content: string
  category: string
  priority?: string
}): Promise<{ success: boolean; message?: string; data?: Ticket }> {
  const res = await api.post('/api/ticket/', data)
  return res.data
}

export async function getTicket(
  id: number
): Promise<{ success: boolean; message?: string; data?: Ticket }> {
  const res = await api.get(`/api/ticket/${id}`)
  return res.data
}

export async function addTicketMessage(
  id: number,
  content: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/ticket/${id}/message`, { content })
  return res.data
}

export async function closeTicket(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/ticket/${id}/close`)
  return res.data
}

export async function reopenTicket(
  id: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/ticket/${id}/reopen`)
  return res.data
}

// Admin API
export async function getAllTickets(params: {
  page?: number
  page_size?: number
  status?: string
  category?: string
  keyword?: string
}): Promise<{ success: boolean; message?: string; data?: TicketListData }> {
  const res = await api.get('/api/ticket/admin/', { params })
  return res.data
}

export async function getTicketAdmin(
  id: number
): Promise<{ success: boolean; message?: string; data?: Ticket }> {
  const res = await api.get(`/api/ticket/admin/${id}`)
  return res.data
}

export async function addTicketMessageAdmin(
  id: number,
  content: string,
  isInternal: boolean = false
): Promise<{ success: boolean; message?: string }> {
  const res = await api.post(`/api/ticket/admin/${id}/message`, {
    content,
    is_internal: isInternal,
  })
  return res.data
}

export async function updateTicketStatus(
  id: number,
  status: string
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/ticket/admin/${id}/status`, { status })
  return res.data
}

export async function assignTicket(
  id: number,
  adminId: number
): Promise<{ success: boolean; message?: string }> {
  const res = await api.put(`/api/ticket/admin/${id}/assign`, { admin_id: adminId })
  return res.data
}
