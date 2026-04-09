// ── Enums / unions ────────────────────────────────────────────
export type ProjectType   = 'sourcing' | 'development' | 'general'
export type ProjectStatus = 'planning' | 'active' | 'on-hold' | 'completed'
export type Priority      = 'high' | 'medium' | 'low'
export type PhaseStatus   = 'planned' | 'in-progress' | 'completed' | 'on-hold'
export type SourcingStatus = 'pending' | 'in-progress' | 'sampled' | 'approved' | 'sourced' | 'blocked'
export type NoteType      = 'note' | 'email' | 'call' | 'meeting' | 'action'
export type MemberRole    = 'owner' | 'member' | 'viewer'

// ── Core entities ─────────────────────────────────────────────
export interface Profile {
  id:         string
  name:       string | null
  email:      string | null
  avatar_url: string | null
  created_at: string
}

export interface Project {
  id:          string
  name:        string
  type:        ProjectType
  status:      ProjectStatus
  priority:    Priority
  description: string | null
  due_date:    string | null
  owner_id:    string
  created_at:  string
  // joined
  owner?:      Profile
  members?:    ProjectMember[]
}

export interface ProjectMember {
  project_id: string
  user_id:    string
  role:       MemberRole
  profile?:   Profile
}

// ── Product catalogue ─────────────────────────────────────────
export interface Product {
  id:           string
  generic_name: string
  strength:     string | null
  dosage_form:  string | null
  packing:      string | null
  category:     string | null
  notes:        string | null
  created_by:   string
  created_at:   string
}

export interface Manufacturer {
  id:            string
  name:          string
  country:       string | null
  contact_name:  string | null
  contact_email: string | null
  contact_phone: string | null
  notes:         string | null
  created_by:    string
  created_at:    string
}

export interface PriceQuote {
  id:               string
  product_id:       string
  manufacturer_id:  string
  price:            number
  currency:         string
  pack_size:        string | null
  moq:              string | null
  validity_date:    string | null
  quote_date:       string
  notes:            string | null
  source_upload_id: string | null
  created_by:       string
  created_at:       string
  // joined
  product?:         Product
  manufacturer?:    Manufacturer
}

export interface PriceUpload {
  id:              string
  manufacturer_id: string | null
  file_name:       string | null
  file_url:        string | null
  raw_content:     string | null
  parsed_data:     ParsedPriceList | null
  status:          'pending' | 'processing' | 'completed' | 'failed'
  uploaded_by:     string
  created_at:      string
  manufacturer?:   Manufacturer
}

// What Claude returns from the parse-price API
export interface ParsedPriceList {
  manufacturer_name: string
  currency:          string
  products: ParsedProduct[]
}

export interface ParsedProduct {
  generic_name: string
  strength:     string | null
  dosage_form:  string | null
  packing:      string | null
  price:        number
  currency:     string
  moq:          string | null
  pack_size:    string | null
  notes:        string | null
}

// ── Sourcing ──────────────────────────────────────────────────
export interface SourcingItem {
  id:          string
  project_id:  string
  product_id:  string
  status:      SourcingStatus
  notes:       string | null
  target_date: string | null
  created_at:  string
  // joined
  product?:    Product
  quotes?:     PriceQuote[]
}

// ── Development ───────────────────────────────────────────────
export interface DevPhase {
  id:          string
  project_id:  string
  name:        string
  status:      PhaseStatus
  start_date:  string | null
  end_date:    string | null
  description: string | null
  order_index: number
  created_at:  string
  // joined
  tasks?:      Task[]
}

// ── Tasks ─────────────────────────────────────────────────────
export interface Task {
  id:          string
  project_id:  string
  phase_id:    string | null
  name:        string
  done:        boolean
  priority:    Priority
  due_date:    string | null
  assigned_to: string | null
  notes:       string | null
  created_at:  string
  // joined
  assignee?:   Profile
}

// ── Notes ─────────────────────────────────────────────────────
export interface Note {
  id:         string
  project_id: string
  type:       NoteType
  title:      string
  content:    string | null
  date:       string
  created_by: string
  created_at: string
  creator?:   Profile
}

// ── Todos ─────────────────────────────────────────────────────
export interface Todo {
  id:         string
  user_id:    string
  name:       string
  done:       boolean
  priority:   Priority
  due_date:   string | null
  notes:      string | null
  created_at: string
}
