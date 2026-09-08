export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      activity_logs: {
        Row: {
          action: string
          actor_profile_id: string | null
          case_id: string | null
          client_id: string | null
          created_at: string
          details: Json | null
          entity_id: string | null
          entity_type: string | null
          id: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          details?: Json | null
          entity_id?: string | null
          entity_type?: string | null
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "activity_logs_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "activity_logs_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_vector_stores: {
        Row: {
          created_at: string
          domain: string
          id: string
          openai_vector_store_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          openai_vector_store_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          openai_vector_store_id?: string
          updated_at?: string
        }
        Relationships: []
      }
      alerts: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          alert_at: string
          alert_type: Database["public"]["Enums"]["alert_type"]
          case_id: string | null
          client_id: string
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          invoice_id: string | null
          is_system: boolean
          status: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_at: string
          alert_type?: Database["public"]["Enums"]["alert_type"]
          case_id?: string | null
          client_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_system?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          title: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          alert_at?: string
          alert_type?: Database["public"]["Enums"]["alert_type"]
          case_id?: string | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          invoice_id?: string | null
          is_system?: boolean
          status?: Database["public"]["Enums"]["alert_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "alerts_acknowledged_by_fkey"
            columns: ["acknowledged_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "alerts_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      case_correspondence: {
        Row: {
          annexure_manifest: Json | null
          approved_at: string | null
          approved_by: string | null
          body: string
          case_id: string
          client_id: string
          correspondence_type: string
          created_at: string
          created_by: string | null
          deadline: string | null
          generated_by_ai: boolean
          id: string
          missing_information: string[] | null
          model_used: string | null
          purpose: string | null
          recipient: string | null
          reviewed_by: string | null
          sars_reference: string | null
          sent_at: string | null
          source_snapshot: Json | null
          status: Database["public"]["Enums"]["correspondence_status"]
          subject: string | null
          supersedes_id: string | null
          tax_period: string | null
          tax_type: string | null
          tone: string | null
          updated_at: string
          version: number
          warnings: string[] | null
        }
        Insert: {
          annexure_manifest?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          body: string
          case_id: string
          client_id: string
          correspondence_type: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          generated_by_ai?: boolean
          id?: string
          missing_information?: string[] | null
          model_used?: string | null
          purpose?: string | null
          recipient?: string | null
          reviewed_by?: string | null
          sars_reference?: string | null
          sent_at?: string | null
          source_snapshot?: Json | null
          status?: Database["public"]["Enums"]["correspondence_status"]
          subject?: string | null
          supersedes_id?: string | null
          tax_period?: string | null
          tax_type?: string | null
          tone?: string | null
          updated_at?: string
          version?: number
          warnings?: string[] | null
        }
        Update: {
          annexure_manifest?: Json | null
          approved_at?: string | null
          approved_by?: string | null
          body?: string
          case_id?: string
          client_id?: string
          correspondence_type?: string
          created_at?: string
          created_by?: string | null
          deadline?: string | null
          generated_by_ai?: boolean
          id?: string
          missing_information?: string[] | null
          model_used?: string | null
          purpose?: string | null
          recipient?: string | null
          reviewed_by?: string | null
          sars_reference?: string | null
          sent_at?: string | null
          source_snapshot?: Json | null
          status?: Database["public"]["Enums"]["correspondence_status"]
          subject?: string | null
          supersedes_id?: string | null
          tax_period?: string | null
          tax_type?: string | null
          tone?: string | null
          updated_at?: string
          version?: number
          warnings?: string[] | null
        }
        Relationships: [
          {
            foreignKeyName: "case_correspondence_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correspondence_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correspondence_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "case_correspondence_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correspondence_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correspondence_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_correspondence_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "case_correspondence"
            referencedColumns: ["id"]
          },
        ]
      }
      case_status_history: {
        Row: {
          case_id: string
          changed_at: string
          changed_by: string | null
          id: string
          new_status: Database["public"]["Enums"]["case_status"]
          note: string | null
          old_status: Database["public"]["Enums"]["case_status"] | null
        }
        Insert: {
          case_id: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status: Database["public"]["Enums"]["case_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["case_status"] | null
        }
        Update: {
          case_id?: string
          changed_at?: string
          changed_by?: string | null
          id?: string
          new_status?: Database["public"]["Enums"]["case_status"]
          note?: string | null
          old_status?: Database["public"]["Enums"]["case_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "case_status_history_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "case_status_history_changed_by_fkey"
            columns: ["changed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      cases: {
        Row: {
          archive_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_consultant_id: string | null
          case_number: string
          case_title: string
          case_type: Database["public"]["Enums"]["case_type"]
          client_id: string
          closed_at: string | null
          created_at: string
          created_by: string | null
          description: string | null
          due_date: string | null
          id: string
          is_archived: boolean
          last_activity_at: string
          openai_vector_store_id: string | null
          opened_at: string
          priority: number
          sars_case_reference: string | null
          status: Database["public"]["Enums"]["case_status"]
          updated_at: string
        }
        Insert: {
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_consultant_id?: string | null
          case_number: string
          case_title: string
          case_type: Database["public"]["Enums"]["case_type"]
          client_id: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          last_activity_at?: string
          openai_vector_store_id?: string | null
          opened_at?: string
          priority?: number
          sars_case_reference?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Update: {
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_consultant_id?: string | null
          case_number?: string
          case_title?: string
          case_type?: Database["public"]["Enums"]["case_type"]
          client_id?: string
          closed_at?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          is_archived?: boolean
          last_activity_at?: string
          openai_vector_store_id?: string | null
          opened_at?: string
          priority?: number
          sars_case_reference?: string | null
          status?: Database["public"]["Enums"]["case_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cases_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "cases_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      clients: {
        Row: {
          address_line_1: string | null
          address_line_2: string | null
          archive_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_consultant_id: string | null
          city: string | null
          client_code: string | null
          client_type: string
          company_name: string | null
          company_registration_number: string | null
          country: string | null
          created_at: string
          created_by: string | null
          first_name: string | null
          id: string
          id_number: string | null
          is_archived: boolean
          last_name: string | null
          notes: string | null
          postal_code: string | null
          profile_id: string
          province: string | null
          returns_filed: boolean
          sars_outstanding_debt: number
          sars_reference_number: string | null
          tax_number: string | null
          updated_at: string
          vat_number: string | null
        }
        Insert: {
          address_line_1?: string | null
          address_line_2?: string | null
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_consultant_id?: string | null
          city?: string | null
          client_code?: string | null
          client_type?: string
          company_name?: string | null
          company_registration_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          first_name?: string | null
          id?: string
          id_number?: string | null
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          postal_code?: string | null
          profile_id: string
          province?: string | null
          returns_filed?: boolean
          sars_outstanding_debt?: number
          sars_reference_number?: string | null
          tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Update: {
          address_line_1?: string | null
          address_line_2?: string | null
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_consultant_id?: string | null
          city?: string | null
          client_code?: string | null
          client_type?: string
          company_name?: string | null
          company_registration_number?: string | null
          country?: string | null
          created_at?: string
          created_by?: string | null
          first_name?: string | null
          id?: string
          id_number?: string | null
          is_archived?: boolean
          last_name?: string | null
          notes?: string | null
          postal_code?: string | null
          profile_id?: string
          province?: string | null
          returns_filed?: boolean
          sars_outstanding_debt?: number
          sars_reference_number?: string | null
          tax_number?: string | null
          updated_at?: string
          vat_number?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "clients_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_assigned_consultant_id_fkey"
            columns: ["assigned_consultant_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          case_id: string | null
          client_id: string | null
          created_at: string
          created_by: string | null
          id: string
          is_closed: boolean
          last_message_at: string
          practitioner_profile_id: string | null
          subject: string | null
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          last_message_at?: string
          practitioner_profile_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          client_id?: string | null
          created_at?: string
          created_by?: string | null
          id?: string
          is_closed?: boolean
          last_message_at?: string
          practitioner_profile_id?: string | null
          subject?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "conversations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      correspondence_templates: {
        Row: {
          approved: boolean
          body_structure: string | null
          case_type: string | null
          correspondence_type: string
          created_at: string
          created_by: string | null
          id: string
          name: string
          purpose: string | null
          status: Database["public"]["Enums"]["correspondence_template_status"]
          tax_type: string | null
          updated_at: string
          updated_by: string | null
          version: number
        }
        Insert: {
          approved?: boolean
          body_structure?: string | null
          case_type?: string | null
          correspondence_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          purpose?: string | null
          status?: Database["public"]["Enums"]["correspondence_template_status"]
          tax_type?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Update: {
          approved?: boolean
          body_structure?: string | null
          case_type?: string | null
          correspondence_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          purpose?: string | null
          status?: Database["public"]["Enums"]["correspondence_template_status"]
          tax_type?: string | null
          updated_at?: string
          updated_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "correspondence_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "correspondence_templates_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          case_id: string | null
          client_id: string
          created_at: string
          description: string | null
          due_date: string | null
          fulfilled_at: string | null
          id: string
          is_fulfilled: boolean
          is_required: boolean
          requested_by: string | null
          required_document_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          case_id?: string | null
          client_id: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          fulfilled_at?: string | null
          id?: string
          is_fulfilled?: boolean
          is_required?: boolean
          requested_by?: string | null
          required_document_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          case_id?: string | null
          client_id?: string
          created_at?: string
          description?: string | null
          due_date?: string | null
          fulfilled_at?: string | null
          id?: string
          is_fulfilled?: boolean
          is_required?: boolean
          requested_by?: string | null
          required_document_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          ai_index_error: string | null
          ai_index_status: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at: string | null
          assessment_reference: string | null
          case_id: string | null
          category: string | null
          checksum_sha256: string | null
          client_id: string | null
          created_at: string
          document_date: string | null
          document_request_id: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          notes: string | null
          openai_file_id: string | null
          recipient_profile_id: string | null
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          sars_reference: string | null
          sender_profile_id: string | null
          status: Database["public"]["Enums"]["document_status"]
          tags: string[] | null
          tax_period: string | null
          tax_type: string | null
          title: string
          updated_at: string
          uploaded_at: string
          uploaded_by: string
          visibility: string
        }
        Insert: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          assessment_reference?: string | null
          case_id?: string | null
          category?: string | null
          checksum_sha256?: string | null
          client_id?: string | null
          created_at?: string
          document_date?: string | null
          document_request_id?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          openai_file_id?: string | null
          recipient_profile_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sars_reference?: string | null
          sender_profile_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tags?: string[] | null
          tax_period?: string | null
          tax_type?: string | null
          title: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by: string
          visibility?: string
        }
        Update: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          assessment_reference?: string | null
          case_id?: string | null
          category?: string | null
          checksum_sha256?: string | null
          client_id?: string | null
          created_at?: string
          document_date?: string | null
          document_request_id?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          notes?: string | null
          openai_file_id?: string | null
          recipient_profile_id?: string | null
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          sars_reference?: string | null
          sender_profile_id?: string | null
          status?: Database["public"]["Enums"]["document_status"]
          tags?: string[] | null
          tax_period?: string | null
          tax_type?: string | null
          title?: string
          updated_at?: string
          uploaded_at?: string
          uploaded_by?: string
          visibility?: string
        }
        Relationships: [
          {
            foreignKeyName: "documents_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "documents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_document_request_id_fkey"
            columns: ["document_request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "documents_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_notification_logs: {
        Row: {
          contact_email: string | null
          created_at: string
          id: string
          metadata: Json | null
          notification_type: string
          profile_id: string | null
          recipient_email: string
        }
        Insert: {
          contact_email?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type: string
          profile_id?: string | null
          recipient_email: string
        }
        Update: {
          contact_email?: string | null
          created_at?: string
          id?: string
          metadata?: Json | null
          notification_type?: string
          profile_id?: string | null
          recipient_email?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_notification_logs_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_attachments: {
        Row: {
          attachment_type: string
          created_at: string
          document_id: string
          id: string
          invoice_id: string
        }
        Insert: {
          attachment_type?: string
          created_at?: string
          document_id: string
          id?: string
          invoice_id: string
        }
        Update: {
          attachment_type?: string
          created_at?: string
          document_id?: string
          id?: string
          invoice_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_attachments_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoice_attachments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_items: {
        Row: {
          created_at: string
          id: string
          invoice_id: string
          line_total: number | null
          quantity: number
          service_item: string
          unit_price: number
        }
        Insert: {
          created_at?: string
          id?: string
          invoice_id: string
          line_total?: number | null
          quantity?: number
          service_item: string
          unit_price?: number
        }
        Update: {
          created_at?: string
          id?: string
          invoice_id?: string
          line_total?: number | null
          quantity?: number
          service_item?: string
          unit_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "invoice_items_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
        ]
      }
      invoices: {
        Row: {
          amount_paid: number
          balance_due: number | null
          cancelled_at: string | null
          case_id: string | null
          client_address: string | null
          client_email: string | null
          client_id: string
          client_name: string | null
          client_phone: string | null
          client_vat_number: string | null
          created_at: string
          created_by: string | null
          currency: string
          description: string | null
          discount_amount: number
          due_date: string | null
          id: string
          invoice_number: string
          issue_date: string
          notes_to_client: string | null
          overdue_at: string | null
          paid_at: string | null
          payment_reference: string | null
          pdf_url: string | null
          practice_name: string | null
          practitioner_address: string | null
          practitioner_bank_details: string | null
          practitioner_email: string | null
          practitioner_logo_path: string | null
          practitioner_name: string | null
          practitioner_number: string | null
          practitioner_phone: string | null
          practitioner_vat_number: string | null
          proof_of_payment_document_id: string | null
          sent_at: string | null
          status: Database["public"]["Enums"]["invoice_status"]
          subtotal: number
          tax_amount: number
          terms_and_conditions: string | null
          title: string | null
          total_amount: number
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          amount_paid?: number
          balance_due?: number | null
          cancelled_at?: string | null
          case_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_id: string
          client_name?: string | null
          client_phone?: string | null
          client_vat_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number: string
          issue_date?: string
          notes_to_client?: string | null
          overdue_at?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          practice_name?: string | null
          practitioner_address?: string | null
          practitioner_bank_details?: string | null
          practitioner_email?: string | null
          practitioner_logo_path?: string | null
          practitioner_name?: string | null
          practitioner_number?: string | null
          practitioner_phone?: string | null
          practitioner_vat_number?: string | null
          proof_of_payment_document_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          terms_and_conditions?: string | null
          title?: string | null
          total_amount?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          amount_paid?: number
          balance_due?: number | null
          cancelled_at?: string | null
          case_id?: string | null
          client_address?: string | null
          client_email?: string | null
          client_id?: string
          client_name?: string | null
          client_phone?: string | null
          client_vat_number?: string | null
          created_at?: string
          created_by?: string | null
          currency?: string
          description?: string | null
          discount_amount?: number
          due_date?: string | null
          id?: string
          invoice_number?: string
          issue_date?: string
          notes_to_client?: string | null
          overdue_at?: string | null
          paid_at?: string | null
          payment_reference?: string | null
          pdf_url?: string | null
          practice_name?: string | null
          practitioner_address?: string | null
          practitioner_bank_details?: string | null
          practitioner_email?: string | null
          practitioner_logo_path?: string | null
          practitioner_name?: string | null
          practitioner_number?: string | null
          practitioner_phone?: string | null
          practitioner_vat_number?: string | null
          proof_of_payment_document_id?: string | null
          sent_at?: string | null
          status?: Database["public"]["Enums"]["invoice_status"]
          subtotal?: number
          tax_amount?: number
          terms_and_conditions?: string | null
          title?: string | null
          total_amount?: number
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "invoices_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "invoices_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "invoices_proof_of_payment_document_id_fkey"
            columns: ["proof_of_payment_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          attachment_document_id: string | null
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          message_text: string
          read_at: string | null
          sender_profile_id: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Insert: {
          attachment_document_id?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_text: string
          read_at?: string | null
          sender_profile_id?: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
        }
        Update: {
          attachment_document_id?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          message_text?: string
          read_at?: string | null
          sender_profile_id?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
        }
        Relationships: [
          {
            foreignKeyName: "messages_attachment_document_id_fkey"
            columns: ["attachment_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_profile_id_fkey"
            columns: ["sender_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_profile_id: string | null
          body: string | null
          category: string
          created_at: string
          entity_id: string | null
          entity_type: string | null
          id: string
          is_read: boolean
          link: string | null
          metadata: Json | null
          read_at: string | null
          recipient_profile_id: string
          section: string
          title: string
          updated_at: string
        }
        Insert: {
          actor_profile_id?: string | null
          body?: string | null
          category: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_profile_id: string
          section?: string
          title: string
          updated_at?: string
        }
        Update: {
          actor_profile_id?: string | null
          body?: string | null
          category?: string
          created_at?: string
          entity_id?: string | null
          entity_type?: string | null
          id?: string
          is_read?: boolean
          link?: string | null
          metadata?: Json | null
          read_at?: string | null
          recipient_profile_id?: string
          section?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_recipient_profile_id_fkey"
            columns: ["recipient_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      past_case_documents: {
        Row: {
          ai_index_error: string | null
          ai_index_status: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at: string | null
          category: string | null
          checksum_sha256: string | null
          created_at: string
          created_by: string | null
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          openai_file_id: string | null
          past_case_id: string
        }
        Insert: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          category?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          openai_file_id?: string | null
          past_case_id: string
        }
        Update: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          category?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          openai_file_id?: string | null
          past_case_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "past_case_documents_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "past_case_documents_past_case_id_fkey"
            columns: ["past_case_id"]
            isOneToOne: false
            referencedRelation: "past_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      past_cases: {
        Row: {
          anonymisation_status: Database["public"]["Enums"]["past_case_anonymisation_status"]
          approved_for_ai_use: boolean
          case_type: string | null
          closed_date: string | null
          created_at: string
          created_by: string | null
          facts_summary: string | null
          id: string
          issue: string | null
          key_arguments: string | null
          lessons_learned: string | null
          outcome: string | null
          precedent_value: string | null
          sars_stage: string | null
          success_status: string | null
          summary: string | null
          supporting_documents_summary: string | null
          tags: string[] | null
          tax_type: string | null
          title: string
          updated_at: string
        }
        Insert: {
          anonymisation_status?: Database["public"]["Enums"]["past_case_anonymisation_status"]
          approved_for_ai_use?: boolean
          case_type?: string | null
          closed_date?: string | null
          created_at?: string
          created_by?: string | null
          facts_summary?: string | null
          id?: string
          issue?: string | null
          key_arguments?: string | null
          lessons_learned?: string | null
          outcome?: string | null
          precedent_value?: string | null
          sars_stage?: string | null
          success_status?: string | null
          summary?: string | null
          supporting_documents_summary?: string | null
          tags?: string[] | null
          tax_type?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          anonymisation_status?: Database["public"]["Enums"]["past_case_anonymisation_status"]
          approved_for_ai_use?: boolean
          case_type?: string | null
          closed_date?: string | null
          created_at?: string
          created_by?: string | null
          facts_summary?: string | null
          id?: string
          issue?: string | null
          key_arguments?: string | null
          lessons_learned?: string | null
          outcome?: string | null
          precedent_value?: string | null
          sars_stage?: string | null
          success_status?: string | null
          summary?: string | null
          supporting_documents_summary?: string | null
          tags?: string[] | null
          tax_type?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "past_cases_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      payments: {
        Row: {
          amount: number
          client_id: string
          created_at: string
          id: string
          invoice_id: string
          method: string | null
          notes: string | null
          payment_date: string | null
          proof_document_id: string | null
          recorded_by: string | null
          reference: string | null
          status: Database["public"]["Enums"]["payment_status"]
          updated_at: string
        }
        Insert: {
          amount: number
          client_id: string
          created_at?: string
          id?: string
          invoice_id: string
          method?: string | null
          notes?: string | null
          payment_date?: string | null
          proof_document_id?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Update: {
          amount?: number
          client_id?: string
          created_at?: string
          id?: string
          invoice_id?: string
          method?: string | null
          notes?: string | null
          payment_date?: string | null
          proof_document_id?: string | null
          recorded_by?: string | null
          reference?: string | null
          status?: Database["public"]["Enums"]["payment_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "payments_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_invoice_id_fkey"
            columns: ["invoice_id"]
            isOneToOne: false
            referencedRelation: "invoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_proof_document_id_fkey"
            columns: ["proof_document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_recorded_by_fkey"
            columns: ["recorded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_change_requests: {
        Row: {
          admin_response: string | null
          case_id: string | null
          client_profile_id: string
          created_at: string
          current_practitioner_profile_id: string
          id: string
          practitioner_responded_at: string | null
          practitioner_response: string | null
          reason: string | null
          requested_by: string
          reviewed_at: string | null
          reviewed_by: string | null
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          admin_response?: string | null
          case_id?: string | null
          client_profile_id: string
          created_at?: string
          current_practitioner_profile_id: string
          id?: string
          practitioner_responded_at?: string | null
          practitioner_response?: string | null
          reason?: string | null
          requested_by: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          admin_response?: string | null
          case_id?: string | null
          client_profile_id?: string
          created_at?: string
          current_practitioner_profile_id?: string
          id?: string
          practitioner_responded_at?: string | null
          practitioner_response?: string | null
          reason?: string | null
          requested_by?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_change_requests_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_change_requests_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_change_requests_current_practitioner_profile__fkey"
            columns: ["current_practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_change_requests_requested_by_fkey"
            columns: ["requested_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_change_requests_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_change_requests_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_credit_accounts: {
        Row: {
          balance: number
          created_at: string
          monthly_credits_expires_at: string | null
          monthly_credits_remaining: number
          profile_id: string
          purchased_credits_balance: number
          storage_addon_limit_mb: number
          storage_base_limit_mb: number
          storage_override_limit_mb: number
          storage_used_bytes: number
          storage_warning_sent_at: string | null
          total_bonus_credits: number
          total_purchased_credits: number
          total_used_credits: number
          tracked_client_count: number
          updated_at: string
        }
        Insert: {
          balance?: number
          created_at?: string
          monthly_credits_expires_at?: string | null
          monthly_credits_remaining?: number
          profile_id: string
          purchased_credits_balance?: number
          storage_addon_limit_mb?: number
          storage_base_limit_mb?: number
          storage_override_limit_mb?: number
          storage_used_bytes?: number
          storage_warning_sent_at?: string | null
          total_bonus_credits?: number
          total_purchased_credits?: number
          total_used_credits?: number
          tracked_client_count?: number
          updated_at?: string
        }
        Update: {
          balance?: number
          created_at?: string
          monthly_credits_expires_at?: string | null
          monthly_credits_remaining?: number
          profile_id?: string
          purchased_credits_balance?: number
          storage_addon_limit_mb?: number
          storage_base_limit_mb?: number
          storage_override_limit_mb?: number
          storage_used_bytes?: number
          storage_warning_sent_at?: string | null
          total_bonus_credits?: number
          total_purchased_credits?: number
          total_used_credits?: number
          tracked_client_count?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_credit_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_credit_purchases: {
        Row: {
          amount_zar: number
          completed_at: string | null
          created_at: string
          credits: number
          currency: string
          id: string
          metadata: Json | null
          package_code: string
          package_name: string
          payment_provider: string
          payment_status: string
          practitioner_profile_id: string
          provider_payment_id: string | null
          updated_at: string
        }
        Insert: {
          amount_zar: number
          completed_at?: string | null
          created_at?: string
          credits: number
          currency?: string
          id?: string
          metadata?: Json | null
          package_code: string
          package_name: string
          payment_provider?: string
          payment_status?: string
          practitioner_profile_id: string
          provider_payment_id?: string | null
          updated_at?: string
        }
        Update: {
          amount_zar?: number
          completed_at?: string | null
          created_at?: string
          credits?: number
          currency?: string
          id?: string
          metadata?: Json | null
          package_code?: string
          package_name?: string
          payment_provider?: string
          payment_status?: string
          practitioner_profile_id?: string
          provider_payment_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_credit_purchases_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_credit_transactions: {
        Row: {
          balance_after: number
          created_at: string
          credit_bucket: string
          credit_type: string | null
          credits_delta: number
          description: string | null
          expiry_date: string | null
          id: string
          issued_by: string | null
          metadata: Json | null
          monthly_credits_used: number
          practitioner_profile_id: string
          purchase_id: string | null
          purchased_credits_used: number
          reason: string | null
          response_id: string | null
          service_request_id: string | null
          subscription_id: string | null
          transaction_type: string
        }
        Insert: {
          balance_after: number
          created_at?: string
          credit_bucket?: string
          credit_type?: string | null
          credits_delta: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          metadata?: Json | null
          monthly_credits_used?: number
          practitioner_profile_id: string
          purchase_id?: string | null
          purchased_credits_used?: number
          reason?: string | null
          response_id?: string | null
          service_request_id?: string | null
          subscription_id?: string | null
          transaction_type: string
        }
        Update: {
          balance_after?: number
          created_at?: string
          credit_bucket?: string
          credit_type?: string | null
          credits_delta?: number
          description?: string | null
          expiry_date?: string | null
          id?: string
          issued_by?: string | null
          metadata?: Json | null
          monthly_credits_used?: number
          practitioner_profile_id?: string
          purchase_id?: string | null
          purchased_credits_used?: number
          reason?: string | null
          response_id?: string | null
          service_request_id?: string | null
          subscription_id?: string | null
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_credit_transactions_issued_by_fkey"
            columns: ["issued_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_credit_transactions_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_credit_transactions_purchase_id_fkey"
            columns: ["purchase_id"]
            isOneToOne: false
            referencedRelation: "practitioner_credit_purchases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_credit_transactions_response_id_fkey"
            columns: ["response_id"]
            isOneToOne: false
            referencedRelation: "service_request_responses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_credit_transactions_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_credit_transactions_subscription_id_fkey"
            columns: ["subscription_id"]
            isOneToOne: false
            referencedRelation: "practitioner_subscriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_profiles: {
        Row: {
          availability_status: Database["public"]["Enums"]["practitioner_availability_status"]
          bank_account_holder_name: string | null
          bank_account_number: string | null
          bank_account_type: string | null
          bank_branch_code: string | null
          bank_branch_name: string | null
          bank_confirmation_document_path: string | null
          bank_name: string | null
          banking_verification_status: string
          banking_verified_at: string | null
          banking_verified_by: string | null
          business_name: string | null
          business_type: string
          certificate_document_path: string | null
          city: string | null
          created_at: string
          id_document_path: string | null
          id_number: string | null
          internal_notes: string | null
          invoice_logo_path: string | null
          is_vat_registered: boolean
          is_verified: boolean
          languages_spoken: string[]
          lead_access_enabled: boolean
          lead_access_status: string
          lead_notifications_enabled: boolean
          professional_body: string | null
          professional_title: string | null
          profile_id: string
          profile_summary: string | null
          proof_of_address_path: string | null
          province: string | null
          registration_number: string | null
          services_offered: string[]
          show_registration_number: boolean
          tax_practitioner_number: string | null
          updated_at: string
          vat_number: string | null
          verification_status: string
          verification_submitted_at: string | null
          years_of_experience: number
        }
        Insert: {
          availability_status?: Database["public"]["Enums"]["practitioner_availability_status"]
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch_code?: string | null
          bank_branch_name?: string | null
          bank_confirmation_document_path?: string | null
          bank_name?: string | null
          banking_verification_status?: string
          banking_verified_at?: string | null
          banking_verified_by?: string | null
          business_name?: string | null
          business_type?: string
          certificate_document_path?: string | null
          city?: string | null
          created_at?: string
          id_document_path?: string | null
          id_number?: string | null
          internal_notes?: string | null
          invoice_logo_path?: string | null
          is_vat_registered?: boolean
          is_verified?: boolean
          languages_spoken?: string[]
          lead_access_enabled?: boolean
          lead_access_status?: string
          lead_notifications_enabled?: boolean
          professional_body?: string | null
          professional_title?: string | null
          profile_id: string
          profile_summary?: string | null
          proof_of_address_path?: string | null
          province?: string | null
          registration_number?: string | null
          services_offered?: string[]
          show_registration_number?: boolean
          tax_practitioner_number?: string | null
          updated_at?: string
          vat_number?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_of_experience?: number
        }
        Update: {
          availability_status?: Database["public"]["Enums"]["practitioner_availability_status"]
          bank_account_holder_name?: string | null
          bank_account_number?: string | null
          bank_account_type?: string | null
          bank_branch_code?: string | null
          bank_branch_name?: string | null
          bank_confirmation_document_path?: string | null
          bank_name?: string | null
          banking_verification_status?: string
          banking_verified_at?: string | null
          banking_verified_by?: string | null
          business_name?: string | null
          business_type?: string
          certificate_document_path?: string | null
          city?: string | null
          created_at?: string
          id_document_path?: string | null
          id_number?: string | null
          internal_notes?: string | null
          invoice_logo_path?: string | null
          is_vat_registered?: boolean
          is_verified?: boolean
          languages_spoken?: string[]
          lead_access_enabled?: boolean
          lead_access_status?: string
          lead_notifications_enabled?: boolean
          professional_body?: string | null
          professional_title?: string | null
          profile_id?: string
          profile_summary?: string | null
          proof_of_address_path?: string | null
          province?: string | null
          registration_number?: string | null
          services_offered?: string[]
          show_registration_number?: boolean
          tax_practitioner_number?: string | null
          updated_at?: string
          vat_number?: string | null
          verification_status?: string
          verification_submitted_at?: string | null
          years_of_experience?: number
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_profiles_banking_verified_by_fkey"
            columns: ["banking_verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_profiles_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_reports: {
        Row: {
          client_profile_id: string | null
          created_at: string
          details: string | null
          id: string
          practitioner_profile_id: string | null
          reason: string
          service_request_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          client_profile_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          practitioner_profile_id?: string | null
          reason: string
          service_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          client_profile_id?: string | null
          created_at?: string
          details?: string | null
          id?: string
          practitioner_profile_id?: string | null
          reason?: string
          service_request_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_reports_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_reports_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_reports_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_reviews: {
        Row: {
          case_id: string
          client_id: string
          created_at: string
          id: string
          practitioner_profile_id: string
          rating: number
          review_text: string | null
          updated_at: string
        }
        Insert: {
          case_id: string
          client_id: string
          created_at?: string
          id?: string
          practitioner_profile_id: string
          rating: number
          review_text?: string | null
          updated_at?: string
        }
        Update: {
          case_id?: string
          client_id?: string
          created_at?: string
          id?: string
          practitioner_profile_id?: string
          rating?: number
          review_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_reviews_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: true
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "client_dashboard_summary"
            referencedColumns: ["client_id"]
          },
          {
            foreignKeyName: "practitioner_reviews_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "practitioner_reviews_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_storage_addon_purchases: {
        Row: {
          addon_code: string
          addon_name: string
          amount_zar: number
          completed_at: string | null
          created_at: string
          currency: string
          id: string
          metadata: Json | null
          payment_provider: string
          payment_status: string
          practitioner_profile_id: string
          provider_payment_id: string | null
          storage_mb: number
          updated_at: string
        }
        Insert: {
          addon_code: string
          addon_name: string
          amount_zar: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          payment_provider?: string
          payment_status?: string
          practitioner_profile_id: string
          provider_payment_id?: string | null
          storage_mb: number
          updated_at?: string
        }
        Update: {
          addon_code?: string
          addon_name?: string
          amount_zar?: number
          completed_at?: string | null
          created_at?: string
          currency?: string
          id?: string
          metadata?: Json | null
          payment_provider?: string
          payment_status?: string
          practitioner_profile_id?: string
          provider_payment_id?: string | null
          storage_mb?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_storage_addon_purchas_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_subscription_plans: {
        Row: {
          code: string
          created_at: string
          credits_per_month: number
          includes_featured_profile: boolean
          includes_highlighted_profile: boolean
          includes_priority_listing: boolean
          includes_standard_listing: boolean
          includes_upgrade_support: boolean
          includes_verified_badge: boolean
          listing_priority_level: number
          name: string
          price_zar: number
          storage_limit_mb: number
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          credits_per_month: number
          includes_featured_profile?: boolean
          includes_highlighted_profile?: boolean
          includes_priority_listing?: boolean
          includes_standard_listing?: boolean
          includes_upgrade_support?: boolean
          includes_verified_badge?: boolean
          listing_priority_level?: number
          name: string
          price_zar: number
          storage_limit_mb?: number
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          credits_per_month?: number
          includes_featured_profile?: boolean
          includes_highlighted_profile?: boolean
          includes_priority_listing?: boolean
          includes_standard_listing?: boolean
          includes_upgrade_support?: boolean
          includes_verified_badge?: boolean
          listing_priority_level?: number
          name?: string
          price_zar?: number
          storage_limit_mb?: number
          updated_at?: string
        }
        Relationships: []
      }
      practitioner_subscriptions: {
        Row: {
          cancelled_at: string | null
          created_at: string
          current_period_end: string
          current_period_start: string
          id: string
          last_credited_at: string | null
          metadata: Json | null
          next_renewal_at: string
          payment_provider: string
          plan_code: string
          practitioner_profile_id: string
          provider_subscription_id: string | null
          started_at: string
          status: string
          updated_at: string
        }
        Insert: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_credited_at?: string | null
          metadata?: Json | null
          next_renewal_at?: string
          payment_provider?: string
          plan_code: string
          practitioner_profile_id: string
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Update: {
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string
          current_period_start?: string
          id?: string
          last_credited_at?: string | null
          metadata?: Json | null
          next_renewal_at?: string
          payment_provider?: string
          plan_code?: string
          practitioner_profile_id?: string
          provider_subscription_id?: string | null
          started_at?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "practitioner_subscription_plans"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "practitioner_subscriptions_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_verification_documents: {
        Row: {
          admin_notes: string | null
          created_at: string
          display_name: string
          document_type: Database["public"]["Enums"]["practitioner_document_type"]
          file_path: string
          file_size: number | null
          id: string
          is_required: boolean
          mime_type: string | null
          practitioner_profile_id: string
          rejection_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          status: Database["public"]["Enums"]["practitioner_document_status"]
          updated_at: string
          uploaded_at: string
        }
        Insert: {
          admin_notes?: string | null
          created_at?: string
          display_name: string
          document_type: Database["public"]["Enums"]["practitioner_document_type"]
          file_path: string
          file_size?: number | null
          id?: string
          is_required?: boolean
          mime_type?: string | null
          practitioner_profile_id: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["practitioner_document_status"]
          updated_at?: string
          uploaded_at?: string
        }
        Update: {
          admin_notes?: string | null
          created_at?: string
          display_name?: string
          document_type?: Database["public"]["Enums"]["practitioner_document_type"]
          file_path?: string
          file_size?: number | null
          id?: string
          is_required?: boolean
          mime_type?: string | null
          practitioner_profile_id?: string
          rejection_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          status?: Database["public"]["Enums"]["practitioner_document_status"]
          updated_at?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_verification_document_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "practitioner_profiles"
            referencedColumns: ["profile_id"]
          },
          {
            foreignKeyName: "practitioner_verification_documents_reviewed_by_fkey"
            columns: ["reviewed_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          is_active: boolean
          phone: string | null
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          created_at: string
          endpoint: string
          id: string
          last_seen_at: string
          profile_id: string
          subscription: Json
          updated_at: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          endpoint: string
          id?: string
          last_seen_at?: string
          profile_id: string
          subscription: Json
          updated_at?: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          endpoint?: string
          id?: string
          last_seen_at?: string
          profile_id?: string
          subscription?: Json
          updated_at?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_access_requests: {
        Row: {
          created_at: string
          credit_cost: number
          credit_deducted: boolean
          id: string
          practitioner_profile_id: string
          requested_at: string
          responded_at: string | null
          service_request_id: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          credit_cost?: number
          credit_deducted?: boolean
          id?: string
          practitioner_profile_id: string
          requested_at?: string
          responded_at?: string | null
          service_request_id: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          credit_cost?: number
          credit_deducted?: boolean
          id?: string
          practitioner_profile_id?: string
          requested_at?: string
          responded_at?: string | null
          service_request_id?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_access_requests_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_access_requests_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_assignment_history: {
        Row: {
          assigned_by: string | null
          assignment_type: Database["public"]["Enums"]["service_request_assignment_type"]
          created_at: string
          id: string
          note: string | null
          practitioner_profile_id: string | null
          previous_practitioner_id: string | null
          service_request_id: string
        }
        Insert: {
          assigned_by?: string | null
          assignment_type: Database["public"]["Enums"]["service_request_assignment_type"]
          created_at?: string
          id?: string
          note?: string | null
          practitioner_profile_id?: string | null
          previous_practitioner_id?: string | null
          service_request_id: string
        }
        Update: {
          assigned_by?: string | null
          assignment_type?: Database["public"]["Enums"]["service_request_assignment_type"]
          created_at?: string
          id?: string
          note?: string | null
          practitioner_profile_id?: string | null
          previous_practitioner_id?: string | null
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_assignment_histor_previous_practitioner_id_fkey"
            columns: ["previous_practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_assignment_history_assigned_by_fkey"
            columns: ["assigned_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_assignment_history_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_assignment_history_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_documents: {
        Row: {
          created_at: string
          file_name: string
          file_path: string
          file_size: number | null
          id: string
          mime_type: string | null
          service_request_id: string
          title: string
          uploaded_at: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_path: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          service_request_id: string
          title: string
          uploaded_at?: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_path?: string
          file_size?: number | null
          id?: string
          mime_type?: string | null
          service_request_id?: string
          title?: string
          uploaded_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_documents_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_lifecycle_history: {
        Row: {
          created_at: string
          event_type: string
          id: string
          lifecycle_stage:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          metadata: Json | null
          note: string | null
          service_request_id: string
        }
        Insert: {
          created_at?: string
          event_type: string
          id?: string
          lifecycle_stage?:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          metadata?: Json | null
          note?: string | null
          service_request_id: string
        }
        Update: {
          created_at?: string
          event_type?: string
          id?: string
          lifecycle_stage?:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          metadata?: Json | null
          note?: string | null
          service_request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_lifecycle_history_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_request_lifecycle_settings: {
        Row: {
          business_stage_hours: number
          open_marketplace_hours: number
          pending_client_confirmation_hours: number
          professional_stage_hours: number
          reactivation_alert_threshold: number
          reminder_hours: number
          settings_key: string
          updated_at: string
        }
        Insert: {
          business_stage_hours?: number
          open_marketplace_hours?: number
          pending_client_confirmation_hours?: number
          professional_stage_hours?: number
          reactivation_alert_threshold?: number
          reminder_hours?: number
          settings_key?: string
          updated_at?: string
        }
        Update: {
          business_stage_hours?: number
          open_marketplace_hours?: number
          pending_client_confirmation_hours?: number
          professional_stage_hours?: number
          reactivation_alert_threshold?: number
          reminder_hours?: number
          settings_key?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_request_responses: {
        Row: {
          created_at: string
          declined_at: string | null
          id: string
          introduction_message: string
          practitioner_profile_id: string
          response_status: Database["public"]["Enums"]["service_request_response_status"]
          selected_at: string | null
          service_pitch: string | null
          service_request_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          declined_at?: string | null
          id?: string
          introduction_message: string
          practitioner_profile_id: string
          response_status?: Database["public"]["Enums"]["service_request_response_status"]
          selected_at?: string | null
          service_pitch?: string | null
          service_request_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          declined_at?: string | null
          id?: string
          introduction_message?: string
          practitioner_profile_id?: string
          response_status?: Database["public"]["Enums"]["service_request_response_status"]
          selected_at?: string | null
          service_pitch?: string | null
          service_request_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "service_request_responses_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_request_responses_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      service_requests: {
        Row: {
          archive_notes: string | null
          archive_reason: string | null
          archived_at: string | null
          archived_by: string | null
          assigned_at: string | null
          assigned_practitioner_id: string | null
          city: string | null
          client_confirmation_answered_at: string | null
          client_confirmation_due_at: string | null
          client_confirmation_origin_stage:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          client_confirmation_requested_at: string | null
          client_profile_id: string | null
          client_type: Database["public"]["Enums"]["service_request_client_type"]
          closed_at: string | null
          company_name: string | null
          company_registration_number: string | null
          contact_preference: string | null
          converted_case_id: string | null
          created_at: string
          description: string
          email: string
          expired_at: string | null
          full_name: string
          has_adr: boolean
          has_debt_flag: boolean
          has_legal_complexity: boolean
          has_multiple_tax_types: boolean
          has_payroll_dispute: boolean
          has_sars_audit: boolean
          has_vat_investigation: boolean
          id: string
          id_number: string | null
          identity_document_type:
            | Database["public"]["Enums"]["service_request_identity_document_type"]
            | null
          intake_payload: Json
          is_archived: boolean
          lead_tier: Database["public"]["Enums"]["lead_access_tier"] | null
          lifecycle_last_client_activity_at: string | null
          lifecycle_reactivation_count: number
          lifecycle_stage: Database["public"]["Enums"]["service_request_lifecycle_stage"]
          lifecycle_stage_expires_at: string | null
          lifecycle_stage_started_at: string | null
          marketing_consent: boolean
          missing_documents_flag: boolean
          missing_returns_flag: boolean
          phone: string
          priority_level: Database["public"]["Enums"]["service_request_priority"]
          province: string | null
          responded_at: string | null
          returns_filed: boolean
          risk_indicator: Database["public"]["Enums"]["service_request_risk_indicator"]
          sars_debt_amount: number
          selected_response_id: string | null
          service_categories:
            | Database["public"]["Enums"]["service_request_category"][]
            | null
          service_category: Database["public"]["Enums"]["service_request_category"]
          service_needed: Database["public"]["Enums"]["service_request_service_needed"]
          service_needed_list:
            | Database["public"]["Enums"]["service_request_service_needed"][]
            | null
          status: Database["public"]["Enums"]["service_request_status"]
          submitted_with_account: boolean
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_at?: string | null
          assigned_practitioner_id?: string | null
          city?: string | null
          client_confirmation_answered_at?: string | null
          client_confirmation_due_at?: string | null
          client_confirmation_origin_stage?:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          client_confirmation_requested_at?: string | null
          client_profile_id?: string | null
          client_type: Database["public"]["Enums"]["service_request_client_type"]
          closed_at?: string | null
          company_name?: string | null
          company_registration_number?: string | null
          contact_preference?: string | null
          converted_case_id?: string | null
          created_at?: string
          description: string
          email: string
          expired_at?: string | null
          full_name: string
          has_adr?: boolean
          has_debt_flag?: boolean
          has_legal_complexity?: boolean
          has_multiple_tax_types?: boolean
          has_payroll_dispute?: boolean
          has_sars_audit?: boolean
          has_vat_investigation?: boolean
          id?: string
          id_number?: string | null
          identity_document_type?:
            | Database["public"]["Enums"]["service_request_identity_document_type"]
            | null
          intake_payload?: Json
          is_archived?: boolean
          lead_tier?: Database["public"]["Enums"]["lead_access_tier"] | null
          lifecycle_last_client_activity_at?: string | null
          lifecycle_reactivation_count?: number
          lifecycle_stage?: Database["public"]["Enums"]["service_request_lifecycle_stage"]
          lifecycle_stage_expires_at?: string | null
          lifecycle_stage_started_at?: string | null
          marketing_consent?: boolean
          missing_documents_flag?: boolean
          missing_returns_flag?: boolean
          phone: string
          priority_level?: Database["public"]["Enums"]["service_request_priority"]
          province?: string | null
          responded_at?: string | null
          returns_filed?: boolean
          risk_indicator?: Database["public"]["Enums"]["service_request_risk_indicator"]
          sars_debt_amount?: number
          selected_response_id?: string | null
          service_categories?:
            | Database["public"]["Enums"]["service_request_category"][]
            | null
          service_category: Database["public"]["Enums"]["service_request_category"]
          service_needed: Database["public"]["Enums"]["service_request_service_needed"]
          service_needed_list?:
            | Database["public"]["Enums"]["service_request_service_needed"][]
            | null
          status?: Database["public"]["Enums"]["service_request_status"]
          submitted_with_account?: boolean
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          archive_notes?: string | null
          archive_reason?: string | null
          archived_at?: string | null
          archived_by?: string | null
          assigned_at?: string | null
          assigned_practitioner_id?: string | null
          city?: string | null
          client_confirmation_answered_at?: string | null
          client_confirmation_due_at?: string | null
          client_confirmation_origin_stage?:
            | Database["public"]["Enums"]["service_request_lifecycle_stage"]
            | null
          client_confirmation_requested_at?: string | null
          client_profile_id?: string | null
          client_type?: Database["public"]["Enums"]["service_request_client_type"]
          closed_at?: string | null
          company_name?: string | null
          company_registration_number?: string | null
          contact_preference?: string | null
          converted_case_id?: string | null
          created_at?: string
          description?: string
          email?: string
          expired_at?: string | null
          full_name?: string
          has_adr?: boolean
          has_debt_flag?: boolean
          has_legal_complexity?: boolean
          has_multiple_tax_types?: boolean
          has_payroll_dispute?: boolean
          has_sars_audit?: boolean
          has_vat_investigation?: boolean
          id?: string
          id_number?: string | null
          identity_document_type?:
            | Database["public"]["Enums"]["service_request_identity_document_type"]
            | null
          intake_payload?: Json
          is_archived?: boolean
          lead_tier?: Database["public"]["Enums"]["lead_access_tier"] | null
          lifecycle_last_client_activity_at?: string | null
          lifecycle_reactivation_count?: number
          lifecycle_stage?: Database["public"]["Enums"]["service_request_lifecycle_stage"]
          lifecycle_stage_expires_at?: string | null
          lifecycle_stage_started_at?: string | null
          marketing_consent?: boolean
          missing_documents_flag?: boolean
          missing_returns_flag?: boolean
          phone?: string
          priority_level?: Database["public"]["Enums"]["service_request_priority"]
          province?: string | null
          responded_at?: string | null
          returns_filed?: boolean
          risk_indicator?: Database["public"]["Enums"]["service_request_risk_indicator"]
          sars_debt_amount?: number
          selected_response_id?: string | null
          service_categories?:
            | Database["public"]["Enums"]["service_request_category"][]
            | null
          service_category?: Database["public"]["Enums"]["service_request_category"]
          service_needed?: Database["public"]["Enums"]["service_request_service_needed"]
          service_needed_list?:
            | Database["public"]["Enums"]["service_request_service_needed"][]
            | null
          status?: Database["public"]["Enums"]["service_request_status"]
          submitted_with_account?: boolean
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "service_requests_archived_by_fkey"
            columns: ["archived_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_assigned_practitioner_id_fkey"
            columns: ["assigned_practitioner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_client_profile_id_fkey"
            columns: ["client_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_converted_case_id_fkey"
            columns: ["converted_case_id"]
            isOneToOne: false
            referencedRelation: "cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "service_requests_selected_response_id_fkey"
            columns: ["selected_response_id"]
            isOneToOne: false
            referencedRelation: "service_request_responses"
            referencedColumns: ["id"]
          },
        ]
      }
      social_accounts: {
        Row: {
          connected_at: string
          connected_by: string | null
          created_at: string
          display_name: string
          id: string
          is_active: boolean
          last_health_check_at: string | null
          last_health_check_message: string | null
          last_health_check_status: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          provider_account_id: string
          updated_at: string
        }
        Insert: {
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_name: string
          id?: string
          is_active?: boolean
          last_health_check_at?: string | null
          last_health_check_message?: string | null
          last_health_check_status?: string | null
          platform: Database["public"]["Enums"]["social_platform"]
          provider_account_id: string
          updated_at?: string
        }
        Update: {
          connected_at?: string
          connected_by?: string | null
          created_at?: string
          display_name?: string
          id?: string
          is_active?: boolean
          last_health_check_at?: string | null
          last_health_check_message?: string | null
          last_health_check_status?: string | null
          platform?: Database["public"]["Enums"]["social_platform"]
          provider_account_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_accounts_connected_by_fkey"
            columns: ["connected_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaign_excluded_dates: {
        Row: {
          campaign_id: string
          created_at: string
          excluded_date: string
          id: string
          reason: string | null
        }
        Insert: {
          campaign_id: string
          created_at?: string
          excluded_date: string
          id?: string
          reason?: string | null
        }
        Update: {
          campaign_id?: string
          created_at?: string
          excluded_date?: string
          id?: string
          reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_campaign_excluded_dates_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaign_items: {
        Row: {
          campaign_id: string
          caption_override: string | null
          created_at: string
          hashtags_override: string[] | null
          id: string
          media_asset_id: string
          position: number
          updated_at: string
        }
        Insert: {
          campaign_id: string
          caption_override?: string | null
          created_at?: string
          hashtags_override?: string[] | null
          id?: string
          media_asset_id: string
          position: number
          updated_at?: string
        }
        Update: {
          campaign_id?: string
          caption_override?: string | null
          created_at?: string
          hashtags_override?: string[] | null
          id?: string
          media_asset_id?: string
          position?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaign_items_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_campaign_items_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      social_campaigns: {
        Row: {
          activated_at: string | null
          approved_at: string | null
          approved_by: string | null
          completed_at: string | null
          created_at: string
          created_by: string | null
          default_caption_template: string | null
          default_hashtags: string[]
          description: string | null
          id: string
          interval_days: number
          name: string
          paused_at: string | null
          start_at: string
          status: Database["public"]["Enums"]["social_campaign_status"]
          target_platforms: Database["public"]["Enums"]["social_platform"][]
          timezone: string
          updated_at: string
        }
        Insert: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          default_caption_template?: string | null
          default_hashtags?: string[]
          description?: string | null
          id?: string
          interval_days?: number
          name: string
          paused_at?: string | null
          start_at: string
          status?: Database["public"]["Enums"]["social_campaign_status"]
          target_platforms?: Database["public"]["Enums"]["social_platform"][]
          timezone?: string
          updated_at?: string
        }
        Update: {
          activated_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          default_caption_template?: string | null
          default_hashtags?: string[]
          description?: string | null
          id?: string
          interval_days?: number
          name?: string
          paused_at?: string | null
          start_at?: string
          status?: Database["public"]["Enums"]["social_campaign_status"]
          target_platforms?: Database["public"]["Enums"]["social_platform"][]
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_campaigns_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_campaigns_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_media_assets: {
        Row: {
          aspect_ratio: number
          checksum_sha256: string
          created_at: string
          created_by: string | null
          default_caption: string | null
          file_size_bytes: number
          height_px: number
          id: string
          mime_type: string
          status: Database["public"]["Enums"]["social_asset_status"]
          storage_path: string
          title: string
          updated_at: string
          width_px: number
        }
        Insert: {
          aspect_ratio: number
          checksum_sha256: string
          created_at?: string
          created_by?: string | null
          default_caption?: string | null
          file_size_bytes: number
          height_px: number
          id?: string
          mime_type: string
          status?: Database["public"]["Enums"]["social_asset_status"]
          storage_path: string
          title: string
          updated_at?: string
          width_px: number
        }
        Update: {
          aspect_ratio?: number
          checksum_sha256?: string
          created_at?: string
          created_by?: string | null
          default_caption?: string | null
          file_size_bytes?: number
          height_px?: number
          id?: string
          mime_type?: string
          status?: Database["public"]["Enums"]["social_asset_status"]
          storage_path?: string
          title?: string
          updated_at?: string
          width_px?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_media_assets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      social_platform_variants: {
        Row: {
          aspect_ratio: number
          created_at: string
          file_size_bytes: number
          height_px: number
          id: string
          media_asset_id: string
          mime_type: string
          platform: Database["public"]["Enums"]["social_platform"]
          storage_path: string
          transformation_metadata: Json
          width_px: number
        }
        Insert: {
          aspect_ratio: number
          created_at?: string
          file_size_bytes: number
          height_px: number
          id?: string
          media_asset_id: string
          mime_type: string
          platform: Database["public"]["Enums"]["social_platform"]
          storage_path: string
          transformation_metadata?: Json
          width_px: number
        }
        Update: {
          aspect_ratio?: number
          created_at?: string
          file_size_bytes?: number
          height_px?: number
          id?: string
          media_asset_id?: string
          mime_type?: string
          platform?: Database["public"]["Enums"]["social_platform"]
          storage_path?: string
          transformation_metadata?: Json
          width_px?: number
        }
        Relationships: [
          {
            foreignKeyName: "social_platform_variants_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      social_publish_attempts: {
        Row: {
          attempt_number: number
          created_at: string
          error_code: string | null
          error_message: string | null
          finished_at: string
          id: string
          provider_response: Json | null
          scheduled_post_id: string
          started_at: string
          status: Database["public"]["Enums"]["social_publish_attempt_status"]
        }
        Insert: {
          attempt_number: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at: string
          id?: string
          provider_response?: Json | null
          scheduled_post_id: string
          started_at: string
          status: Database["public"]["Enums"]["social_publish_attempt_status"]
        }
        Update: {
          attempt_number?: number
          created_at?: string
          error_code?: string | null
          error_message?: string | null
          finished_at?: string
          id?: string
          provider_response?: Json | null
          scheduled_post_id?: string
          started_at?: string
          status?: Database["public"]["Enums"]["social_publish_attempt_status"]
        }
        Relationships: [
          {
            foreignKeyName: "social_publish_attempts_scheduled_post_id_fkey"
            columns: ["scheduled_post_id"]
            isOneToOne: false
            referencedRelation: "social_scheduled_posts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_scheduled_posts: {
        Row: {
          attempt_count: number
          campaign_id: string
          campaign_item_id: string | null
          caption: string
          claimed_at: string | null
          claimed_by: string | null
          created_at: string
          failure_code: string | null
          failure_message: string | null
          hashtags: string[]
          id: string
          idempotency_key: string
          last_attempt_at: string | null
          media_asset_id: string
          next_retry_at: string | null
          platform_variant_id: string | null
          provider_permalink: string | null
          provider_post_id: string | null
          published_at: string | null
          scheduled_at: string
          social_account_id: string
          status: Database["public"]["Enums"]["social_post_status"]
          target_platform: Database["public"]["Enums"]["social_platform"]
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          campaign_id: string
          campaign_item_id?: string | null
          caption: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key: string
          last_attempt_at?: string | null
          media_asset_id: string
          next_retry_at?: string | null
          platform_variant_id?: string | null
          provider_permalink?: string | null
          provider_post_id?: string | null
          published_at?: string | null
          scheduled_at: string
          social_account_id: string
          status?: Database["public"]["Enums"]["social_post_status"]
          target_platform: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          campaign_id?: string
          campaign_item_id?: string | null
          caption?: string
          claimed_at?: string | null
          claimed_by?: string | null
          created_at?: string
          failure_code?: string | null
          failure_message?: string | null
          hashtags?: string[]
          id?: string
          idempotency_key?: string
          last_attempt_at?: string | null
          media_asset_id?: string
          next_retry_at?: string | null
          platform_variant_id?: string | null
          provider_permalink?: string | null
          provider_post_id?: string | null
          published_at?: string | null
          scheduled_at?: string
          social_account_id?: string
          status?: Database["public"]["Enums"]["social_post_status"]
          target_platform?: Database["public"]["Enums"]["social_platform"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "social_scheduled_posts_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "social_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_scheduled_posts_campaign_item_id_fkey"
            columns: ["campaign_item_id"]
            isOneToOne: false
            referencedRelation: "social_campaign_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_scheduled_posts_media_asset_id_fkey"
            columns: ["media_asset_id"]
            isOneToOne: false
            referencedRelation: "social_media_assets"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_scheduled_posts_platform_variant_id_fkey"
            columns: ["platform_variant_id"]
            isOneToOne: false
            referencedRelation: "social_platform_variants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "social_scheduled_posts_social_account_id_fkey"
            columns: ["social_account_id"]
            isOneToOne: false
            referencedRelation: "social_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      social_scheduler_settings: {
        Row: {
          auto_publish_enabled: boolean
          created_at: string
          id: string
          timezone: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          auto_publish_enabled?: boolean
          created_at?: string
          id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          auto_publish_enabled?: boolean
          created_at?: string
          id?: string
          timezone?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "social_scheduler_settings_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_permissions: {
        Row: {
          assigned_clients_only: boolean
          can_approve_sars_correspondence: boolean
          can_generate_sars_correspondence: boolean
          can_manage_cases: boolean
          can_manage_clients: boolean
          can_manage_invoices: boolean
          can_reply_messages: boolean
          can_review_documents: boolean
          can_use_tax_coach_ai: boolean
          can_view_cases: boolean
          can_view_client_workspace: boolean
          can_view_clients: boolean
          can_view_documents: boolean
          can_view_invoices: boolean
          can_view_messages: boolean
          can_view_overview: boolean
          created_at: string
          profile_id: string
          updated_at: string
        }
        Insert: {
          assigned_clients_only?: boolean
          can_approve_sars_correspondence?: boolean
          can_generate_sars_correspondence?: boolean
          can_manage_cases?: boolean
          can_manage_clients?: boolean
          can_manage_invoices?: boolean
          can_reply_messages?: boolean
          can_review_documents?: boolean
          can_use_tax_coach_ai?: boolean
          can_view_cases?: boolean
          can_view_client_workspace?: boolean
          can_view_clients?: boolean
          can_view_documents?: boolean
          can_view_invoices?: boolean
          can_view_messages?: boolean
          can_view_overview?: boolean
          created_at?: string
          profile_id: string
          updated_at?: string
        }
        Update: {
          assigned_clients_only?: boolean
          can_approve_sars_correspondence?: boolean
          can_generate_sars_correspondence?: boolean
          can_manage_cases?: boolean
          can_manage_clients?: boolean
          can_manage_invoices?: boolean
          can_reply_messages?: boolean
          can_review_documents?: boolean
          can_use_tax_coach_ai?: boolean
          can_view_cases?: boolean
          can_view_client_workspace?: boolean
          can_view_clients?: boolean
          can_view_documents?: boolean
          can_view_invoices?: boolean
          can_view_messages?: boolean
          can_view_overview?: boolean
          created_at?: string
          profile_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_permissions_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      system_activity_log: {
        Row: {
          action: string
          actor_profile_id: string | null
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at: string
          id: string
          metadata: Json | null
          target_id: string | null
          target_type: string
        }
        Insert: {
          action: string
          actor_profile_id?: string | null
          actor_role: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type: string
        }
        Update: {
          action?: string
          actor_profile_id?: string | null
          actor_role?: Database["public"]["Enums"]["app_role"]
          created_at?: string
          id?: string
          metadata?: Json | null
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "system_activity_log_actor_profile_id_fkey"
            columns: ["actor_profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tax_knowledge_library: {
        Row: {
          ai_index_error: string | null
          ai_index_status: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at: string | null
          approved_for_ai_use: boolean
          category: string | null
          checksum_sha256: string | null
          created_at: string
          created_by: string | null
          effective_from: string | null
          effective_to: string | null
          file_name: string | null
          file_path: string | null
          file_size: number | null
          id: string
          issuing_authority: string | null
          jurisdiction: string
          legislation: string | null
          mime_type: string | null
          openai_file_id: string | null
          publication_date: string | null
          section_reference: string | null
          source: string | null
          source_url: string | null
          status: Database["public"]["Enums"]["knowledge_status"]
          summary: string | null
          tags: string[] | null
          tax_type: string | null
          title: string
          updated_at: string
          version: string | null
        }
        Insert: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          approved_for_ai_use?: boolean
          category?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issuing_authority?: string | null
          jurisdiction?: string
          legislation?: string | null
          mime_type?: string | null
          openai_file_id?: string | null
          publication_date?: string | null
          section_reference?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          summary?: string | null
          tags?: string[] | null
          tax_type?: string | null
          title: string
          updated_at?: string
          version?: string | null
        }
        Update: {
          ai_index_error?: string | null
          ai_index_status?: Database["public"]["Enums"]["ai_index_status"]
          ai_indexed_at?: string | null
          approved_for_ai_use?: boolean
          category?: string | null
          checksum_sha256?: string | null
          created_at?: string
          created_by?: string | null
          effective_from?: string | null
          effective_to?: string | null
          file_name?: string | null
          file_path?: string | null
          file_size?: number | null
          id?: string
          issuing_authority?: string | null
          jurisdiction?: string
          legislation?: string | null
          mime_type?: string | null
          openai_file_id?: string | null
          publication_date?: string | null
          section_reference?: string | null
          source?: string | null
          source_url?: string | null
          status?: Database["public"]["Enums"]["knowledge_status"]
          summary?: string | null
          tags?: string[] | null
          tax_type?: string | null
          title?: string
          updated_at?: string
          version?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "tax_knowledge_library_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_alerts: {
        Row: {
          alert_type: string
          assigned_staff_id: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          is_resolved: boolean
          message_id: string | null
          resolved_at: string | null
          resolved_by: string | null
          severity: string
          title: string
        }
        Insert: {
          alert_type: string
          assigned_staff_id?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title: string
        }
        Update: {
          alert_type?: string
          assigned_staff_id?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          is_resolved?: boolean
          message_id?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_alerts_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_alerts_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversation_reads: {
        Row: {
          conversation_id: string
          last_read_at: string
          staff_id: string
        }
        Insert: {
          conversation_id: string
          last_read_at?: string
          staff_id: string
        }
        Update: {
          conversation_id?: string
          last_read_at?: string
          staff_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_conversations: {
        Row: {
          ai_enabled: boolean
          ai_summary: string | null
          assigned_at: string | null
          assigned_by: string | null
          assigned_staff_id: string | null
          assigned_staff_name: string | null
          created_at: string
          display_name: string | null
          first_staff_reply_at: string | null
          human_handoff_requested_at: string | null
          id: string
          inbox_status: string
          intake_missing_fields: string[]
          intake_payload: Json
          intake_ready: boolean
          intake_updated_at: string | null
          last_inbound_at: string | null
          last_outbound_at: string | null
          last_staff_reply_at: string | null
          linked_client_at: string | null
          linked_client_by: string | null
          linked_client_id: string | null
          linked_client_profile_id: string | null
          phone_number: string
          priority_level: string
          referral_ad_id: string | null
          referral_campaign_id: string | null
          referral_headline: string | null
          referral_source: string | null
          resolved_at: string | null
          resolved_by: string | null
          service_request_id: string | null
          source: string
          status: string
          submission_state: string
          updated_at: string
          wa_id: string
        }
        Insert: {
          ai_enabled?: boolean
          ai_summary?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_staff_id?: string | null
          assigned_staff_name?: string | null
          created_at?: string
          display_name?: string | null
          first_staff_reply_at?: string | null
          human_handoff_requested_at?: string | null
          id?: string
          inbox_status?: string
          intake_missing_fields?: string[]
          intake_payload?: Json
          intake_ready?: boolean
          intake_updated_at?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          last_staff_reply_at?: string | null
          linked_client_at?: string | null
          linked_client_by?: string | null
          linked_client_id?: string | null
          linked_client_profile_id?: string | null
          phone_number: string
          priority_level?: string
          referral_ad_id?: string | null
          referral_campaign_id?: string | null
          referral_headline?: string | null
          referral_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          service_request_id?: string | null
          source?: string
          status?: string
          submission_state?: string
          updated_at?: string
          wa_id: string
        }
        Update: {
          ai_enabled?: boolean
          ai_summary?: string | null
          assigned_at?: string | null
          assigned_by?: string | null
          assigned_staff_id?: string | null
          assigned_staff_name?: string | null
          created_at?: string
          display_name?: string | null
          first_staff_reply_at?: string | null
          human_handoff_requested_at?: string | null
          id?: string
          inbox_status?: string
          intake_missing_fields?: string[]
          intake_payload?: Json
          intake_ready?: boolean
          intake_updated_at?: string | null
          last_inbound_at?: string | null
          last_outbound_at?: string | null
          last_staff_reply_at?: string | null
          linked_client_at?: string | null
          linked_client_by?: string | null
          linked_client_id?: string | null
          linked_client_profile_id?: string | null
          phone_number?: string
          priority_level?: string
          referral_ad_id?: string | null
          referral_campaign_id?: string | null
          referral_headline?: string | null
          referral_source?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          service_request_id?: string | null
          source?: string
          status?: string
          submission_state?: string
          updated_at?: string
          wa_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_conversations_service_request_id_fkey"
            columns: ["service_request_id"]
            isOneToOne: false
            referencedRelation: "service_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_deletion_audit: {
        Row: {
          actor_id: string
          actor_name: string
          attachment_count: number
          conversation_id: string
          created_at: string
          id: string
          message_count: number
          preserved_service_request_id: string | null
        }
        Insert: {
          actor_id: string
          actor_name: string
          attachment_count?: number
          conversation_id: string
          created_at?: string
          id?: string
          message_count?: number
          preserved_service_request_id?: string | null
        }
        Update: {
          actor_id?: string
          actor_name?: string
          attachment_count?: number
          conversation_id?: string
          created_at?: string
          id?: string
          message_count?: number
          preserved_service_request_id?: string | null
        }
        Relationships: []
      }
      whatsapp_internal_notes: {
        Row: {
          author_id: string
          author_name: string
          body: string
          conversation_id: string
          created_at: string
          id: string
          mentioned_staff_ids: string[]
        }
        Insert: {
          author_id: string
          author_name: string
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          mentioned_staff_ids?: string[]
        }
        Update: {
          author_id?: string
          author_name?: string
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          mentioned_staff_ids?: string[]
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_internal_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_messages: {
        Row: {
          content: string | null
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string
          id: string
          media_filename: string | null
          media_id: string | null
          media_mime_type: string | null
          media_sha256: string | null
          media_size_bytes: number | null
          media_storage_path: string | null
          message_type: string
          meta_message_id: string | null
          sender_type: string
          staff_sender_id: string | null
          staff_sender_name: string | null
        }
        Insert: {
          content?: string | null
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction: string
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          media_size_bytes?: number | null
          media_storage_path?: string | null
          message_type?: string
          meta_message_id?: string | null
          sender_type: string
          staff_sender_id?: string | null
          staff_sender_name?: string | null
        }
        Update: {
          content?: string | null
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string
          id?: string
          media_filename?: string | null
          media_id?: string | null
          media_mime_type?: string | null
          media_sha256?: string | null
          media_size_bytes?: number | null
          media_storage_path?: string | null
          message_type?: string
          meta_message_id?: string | null
          sender_type?: string
          staff_sender_id?: string | null
          staff_sender_name?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_staff_actions: {
        Row: {
          action: string
          actor_id: string
          actor_name: string
          conversation_id: string
          created_at: string
          details: Json
          id: string
        }
        Insert: {
          action: string
          actor_id: string
          actor_name: string
          conversation_id: string
          created_at?: string
          details?: Json
          id?: string
        }
        Update: {
          action?: string
          actor_id?: string
          actor_name?: string
          conversation_id?: string
          created_at?: string
          details?: Json
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_staff_actions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      admin_dashboard_summary: {
        Row: {
          pending_reviews: number | null
          reminders_due: number | null
          total_clients: number | null
          unpaid_invoices: number | null
          unread_messages: number | null
        }
        Relationships: []
      }
      client_dashboard_summary: {
        Row: {
          active_alerts: number | null
          active_cases: number | null
          client_id: string | null
          outstanding_document_requests: number | null
          profile_id: string | null
          unread_messages: number | null
        }
        Insert: {
          active_alerts?: never
          active_cases?: never
          client_id?: string | null
          outstanding_document_requests?: never
          profile_id?: string | null
          unread_messages?: never
        }
        Update: {
          active_alerts?: never
          active_cases?: never
          client_id?: string | null
          outstanding_document_requests?: never
          profile_id?: string | null
          unread_messages?: never
        }
        Relationships: [
          {
            foreignKeyName: "clients_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_credit_summary: {
        Row: {
          admin_deduction_count: number | null
          admin_grant_count: number | null
          available_credits: number | null
          balance: number | null
          last_admin_grant_at: string | null
          profile_id: string | null
          total_bonus_credits: number | null
          total_purchased_credits: number | null
          total_used_credits: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_credit_accounts_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      practitioner_document_summary: {
        Row: {
          approved_optional_docs: number | null
          approved_required_docs: number | null
          last_updated: string | null
          pending_required_docs: number | null
          practitioner_profile_id: string | null
          rejected_required_docs: number | null
          total_optional_docs: number | null
          total_pending_docs: number | null
          total_rejected_docs: number | null
          total_required_docs: number | null
        }
        Relationships: [
          {
            foreignKeyName: "practitioner_verification_document_practitioner_profile_id_fkey"
            columns: ["practitioner_profile_id"]
            isOneToOne: false
            referencedRelation: "practitioner_profiles"
            referencedColumns: ["profile_id"]
          },
        ]
      }
    }
    Functions: {
      accept_service_request_response: {
        Args: { p_response_id: string }
        Returns: string
      }
      activate_practitioner_subscription: {
        Args: {
          p_payment_provider?: string
          p_plan_code: string
          p_profile_id: string
          p_provider_subscription_id?: string
        }
        Returns: string
      }
      admin_apply_service_request_lifecycle_settings: {
        Args: never
        Returns: number
      }
      admin_deduct_credits: {
        Args: {
          p_credits: number
          p_issued_by_id?: string
          p_practitioner_profile_id: string
          p_reason: string
        }
        Returns: number
      }
      admin_grant_credits: {
        Args: {
          p_credit_type?: string
          p_credits: number
          p_expiry_date?: string
          p_issued_by_id?: string
          p_practitioner_profile_id: string
          p_reason: string
        }
        Returns: number
      }
      admin_move_service_request_to_open_marketplace: {
        Args: { p_request_id: string }
        Returns: string
      }
      admin_reset_service_request_lifecycle_timer: {
        Args: { p_request_id: string }
        Returns: string
      }
      admin_return_service_request_to_marketplace: {
        Args: { p_request_id: string }
        Returns: string
      }
      admin_revive_service_request:
        | { Args: { p_request_id: string }; Returns: string }
        | {
            Args: {
              p_request_id: string
              p_restart_stage?: Database["public"]["Enums"]["service_request_lifecycle_stage"]
            }
            Returns: string
          }
      admin_update_practitioner_storage_limits: {
        Args: {
          p_practitioner_profile_id: string
          p_reason?: string
          p_storage_addon_delta_mb?: number
          p_storage_override_limit_mb?: number
        }
        Returns: number
      }
      admin_update_practitioner_subscription_plan: {
        Args: {
          p_credits_per_month: number
          p_includes_featured_profile?: boolean
          p_includes_highlighted_profile?: boolean
          p_includes_priority_listing?: boolean
          p_includes_standard_listing?: boolean
          p_includes_upgrade_support?: boolean
          p_includes_verified_badge?: boolean
          p_listing_priority_level: number
          p_name: string
          p_plan_code: string
          p_price_zar: number
          p_storage_limit_mb: number
        }
        Returns: boolean
      }
      assign_service_request: {
        Args: {
          p_assignment_type?: Database["public"]["Enums"]["service_request_assignment_type"]
          p_note?: string
          p_practitioner_id: string
          p_request_id: string
        }
        Returns: string
      }
      auto_assign_service_request: {
        Args: { p_request_id: string }
        Returns: string
      }
      can_access_document: {
        Args: {
          p_case_id: string
          p_client_id: string
          p_recipient_profile_id: string
          p_uploaded_by: string
          p_visibility: string
        }
        Returns: boolean
      }
      can_access_document_file: {
        Args: { p_file_path: string }
        Returns: boolean
      }
      can_practitioner_view_service_request: {
        Args: { p_profile_id: string; p_request_id: string }
        Returns: boolean
      }
      cancel_practitioner_subscription: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      classify_service_request_lead_tier: {
        Args: {
          p_has_adr: boolean
          p_has_legal_complexity: boolean
          p_has_multiple_tax_types: boolean
          p_has_payroll_dispute: boolean
          p_has_sars_audit: boolean
          p_has_vat_investigation: boolean
          p_sars_debt_amount: number
          p_service_needed: Database["public"]["Enums"]["service_request_service_needed"]
          p_service_needed_list: Database["public"]["Enums"]["service_request_service_needed"][]
        }
        Returns: Database["public"]["Enums"]["lead_access_tier"]
      }
      complete_practitioner_credit_purchase: {
        Args: {
          p_metadata?: Json
          p_payment_status?: string
          p_provider_payment_id?: string
          p_purchase_id: string
        }
        Returns: number
      }
      complete_practitioner_storage_addon_purchase: {
        Args: {
          p_metadata?: Json
          p_payment_status?: string
          p_provider_payment_id?: string
          p_purchase_id: string
        }
        Returns: number
      }
      consume_practitioner_credit_wallet: {
        Args: { p_credits: number; p_profile_id: string }
        Returns: {
          balance: number
          monthly_used: number
          purchased_used: number
        }[]
      }
      convert_service_request_to_case: {
        Args: { p_request_id: string }
        Returns: string
      }
      create_notification: {
        Args: {
          p_actor_profile_id: string
          p_body?: string
          p_category: string
          p_entity_id?: string
          p_entity_type?: string
          p_link?: string
          p_metadata?: Json
          p_recipient_profile_id: string
          p_section: string
          p_title: string
        }
        Returns: string
      }
      create_notifications: {
        Args: {
          p_actor_profile_id: string
          p_body?: string
          p_category: string
          p_entity_id?: string
          p_entity_type?: string
          p_link?: string
          p_metadata?: Json
          p_recipient_profile_ids: string[]
          p_section: string
          p_title: string
        }
        Returns: number
      }
      ensure_practitioner_credit_account: {
        Args: { p_grant_signup_bonus?: boolean; p_profile_id: string }
        Returns: number
      }
      ensure_practitioner_storage_capacity: {
        Args: { p_additional_bytes: number; p_profile_id: string }
        Returns: boolean
      }
      expire_practitioner_monthly_credits: {
        Args: { p_profile_id: string }
        Returns: number
      }
      find_client_profile_id_by_email: {
        Args: { p_email: string }
        Returns: string
      }
      get_initial_service_request_lifecycle_stage: {
        Args: { p_lead_tier: Database["public"]["Enums"]["lead_access_tier"] }
        Returns: Database["public"]["Enums"]["service_request_lifecycle_stage"]
      }
      get_marketplace_practitioner_profile_ids: {
        Args: { p_min_tier?: Database["public"]["Enums"]["lead_access_tier"] }
        Returns: string[]
      }
      get_my_role: {
        Args: never
        Returns: Database["public"]["Enums"]["app_role"]
      }
      get_practitioner_lead_access_tier: {
        Args: { p_profile_id: string }
        Returns: Database["public"]["Enums"]["lead_access_tier"]
      }
      get_practitioner_storage_limit_mb: {
        Args: { p_profile_id: string }
        Returns: number
      }
      get_service_request_base_credit_cost: {
        Args: {
          p_service_needed: Database["public"]["Enums"]["service_request_service_needed"]
        }
        Returns: number
      }
      get_service_request_credit_cost: {
        Args: {
          p_service_needed: Database["public"]["Enums"]["service_request_service_needed"]
        }
        Returns: number
      }
      get_service_request_credit_cost_for_services: {
        Args: {
          p_services: Database["public"]["Enums"]["service_request_service_needed"][]
        }
        Returns: number
      }
      get_service_request_lifecycle_stage_duration: {
        Args: {
          p_stage: Database["public"]["Enums"]["service_request_lifecycle_stage"]
        }
        Returns: string
      }
      get_service_request_marketplace_required_tier: {
        Args: {
          p_stage: Database["public"]["Enums"]["service_request_lifecycle_stage"]
        }
        Returns: Database["public"]["Enums"]["lead_access_tier"]
      }
      get_service_request_max_responses: {
        Args: { p_request_id: string }
        Returns: number
      }
      get_service_request_min_access_tier: {
        Args: {
          p_services: Database["public"]["Enums"]["service_request_service_needed"][]
        }
        Returns: Database["public"]["Enums"]["lead_access_tier"]
      }
      grant_practitioner_monthly_credits: {
        Args: { p_credits: number; p_expires_at: string; p_profile_id: string }
        Returns: number
      }
      grant_practitioner_purchased_credits: {
        Args: { p_credits: number; p_profile_id: string }
        Returns: number
      }
      has_role: {
        Args: { user_id: string; user_role: string }
        Returns: boolean
      }
      is_admin_or_consultant: { Args: never; Returns: boolean }
      lead_access_tier_rank: {
        Args: { p_tier: Database["public"]["Enums"]["lead_access_tier"] }
        Returns: number
      }
      log_service_request_lifecycle_event: {
        Args: {
          p_event_type: string
          p_metadata?: Json
          p_note?: string
          p_request_id: string
          p_stage: Database["public"]["Enums"]["service_request_lifecycle_stage"]
        }
        Returns: string
      }
      map_service_request_to_case_type: {
        Args: {
          p_service_needed: Database["public"]["Enums"]["service_request_service_needed"]
        }
        Returns: Database["public"]["Enums"]["case_type"]
      }
      maybe_notify_service_request_reactivation_review: {
        Args: {
          p_lifecycle_stage?: Database["public"]["Enums"]["service_request_lifecycle_stage"]
          p_reactivation_count: number
          p_request_id: string
        }
        Returns: undefined
      }
      maybe_send_service_request_confirmation_reminder: {
        Args: { p_request_id: string }
        Returns: undefined
      }
      practitioner_can_access_leads: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      practitioner_has_active_subscription: {
        Args: { p_profile_id: string }
        Returns: boolean
      }
      practitioner_has_all_required_documents_approved: {
        Args: { practitioner_id: string }
        Returns: boolean
      }
      process_practitioner_subscription_renewal: {
        Args: { p_subscription_id: string }
        Returns: boolean
      }
      process_practitioner_subscription_renewals: {
        Args: never
        Returns: number
      }
      process_service_request_lifecycle: {
        Args: { p_request_id: string }
        Returns: Database["public"]["Enums"]["service_request_lifecycle_stage"]
      }
      process_service_request_lifecycles: { Args: never; Returns: number }
      refresh_practitioner_credit_balance: {
        Args: { p_profile_id: string }
        Returns: number
      }
      refresh_practitioner_usage_metrics: {
        Args: { p_profile_id: string }
        Returns: {
          storage_limit_bytes: number
          storage_used_bytes: number
          tracked_client_count: number
        }[]
      }
      refresh_system_alerts: { Args: never; Returns: undefined }
      request_practitioner_change: {
        Args: { p_reason?: string; p_request_id: string }
        Returns: boolean
      }
      respond_service_request_confirmation: {
        Args: { p_request_id: string; p_requires_assistance: boolean }
        Returns: string
      }
      respond_to_service_request_access: {
        Args: { p_access_request_id: string; p_action: string }
        Returns: string
      }
      review_practitioner_change_request: {
        Args: {
          p_admin_response?: string
          p_change_request_id: string
          p_decision: string
        }
        Returns: boolean
      }
      staff_profile_ids: {
        Args: { p_roles?: Database["public"]["Enums"]["app_role"][] }
        Returns: string[]
      }
      submit_practitioner_change_response: {
        Args: { p_change_request_id: string; p_response: string }
        Returns: boolean
      }
      unlock_service_request_access: {
        Args: { p_request_id: string }
        Returns: string
      }
    }
    Enums: {
      ai_index_status:
        | "not_applicable"
        | "pending"
        | "processing"
        | "indexed"
        | "failed"
        | "outdated"
        | "removed"
      alert_status: "active" | "acknowledged" | "resolved" | "dismissed"
      alert_type:
        | "sars_due_date"
        | "missing_document"
        | "payment_deadline"
        | "general_deadline"
        | "provisional_tax_date"
        | "follow_up_required"
        | "other"
      app_role: "admin" | "consultant" | "client"
      case_status:
        | "new"
        | "under_review"
        | "in_progress"
        | "awaiting_client_documents"
        | "awaiting_sars_response"
        | "resolved"
        | "closed"
      case_type:
        | "individual_tax_return"
        | "corporate_tax_return"
        | "vat_registration"
        | "provisional_tax"
        | "tax_clearance_certificate"
        | "sars_dispute_objection"
        | "other"
      correspondence_status:
        | "draft"
        | "under_review"
        | "approved"
        | "sent"
        | "superseded"
        | "archived"
      correspondence_template_status: "draft" | "active" | "archived"
      document_status:
        | "uploaded"
        | "pending_review"
        | "approved"
        | "rejected"
        | "requested"
      invoice_status:
        | "draft"
        | "issued"
        | "partially_paid"
        | "paid"
        | "overdue"
        | "cancelled"
      knowledge_status: "current" | "superseded" | "draft" | "archived"
      lead_access_tier: "basic" | "professional" | "business"
      message_sender_type: "admin" | "consultant" | "client" | "system"
      past_case_anonymisation_status:
        | "not_reviewed"
        | "anonymised"
        | "partially_anonymised"
        | "contains_confidential_information"
      payment_status: "pending" | "paid" | "failed" | "cancelled"
      practitioner_availability_status:
        | "available"
        | "limited"
        | "not_available"
      practitioner_document_status: "pending_review" | "approved" | "rejected"
      practitioner_document_type:
        | "id_copy"
        | "tax_registration_certificate"
        | "proof_of_address"
        | "bank_confirmation_letter"
        | "professional_body_membership"
        | "company_registration"
        | "vat_number_proof"
        | "profile_photo"
        | "cv_professional_summary"
        | "other"
      service_request_assignment_type:
        | "manual"
        | "automatic"
        | "client_selected"
        | "reassigned"
      service_request_category:
        | "individual_tax"
        | "business_tax"
        | "accounting"
        | "business_support"
        | "trust_services"
        | "npo_organisation_services"
      service_request_client_type:
        | "individual"
        | "company"
        | "trust"
        | "npo_organisation"
      service_request_identity_document_type: "id_number" | "passport_number"
      service_request_lifecycle_stage:
        | "business_exclusive"
        | "professional_access"
        | "open_marketplace"
        | "pending_client_confirmation"
        | "expired"
      service_request_priority: "low" | "medium" | "high" | "urgent"
      service_request_response_status:
        | "submitted"
        | "selected"
        | "declined"
        | "withdrawn"
      service_request_risk_indicator: "low" | "medium" | "high"
      service_request_service_needed:
        | "tax_return"
        | "sars_debt_assistance"
        | "vat_registration"
        | "company_tax"
        | "paye_issues"
        | "objection_dispute"
        | "bookkeeping"
        | "other"
        | "individual_personal_income_tax_returns"
        | "individual_sars_debt_assistance"
        | "individual_tax_compliance_issues"
        | "individual_tax_clearance_certificates"
        | "individual_objections_and_disputes"
        | "individual_late_return_submissions"
        | "individual_tax_number_registration"
        | "individual_tax_status_corrections"
        | "business_company_income_tax"
        | "business_vat_registration"
        | "business_vat_returns"
        | "business_paye_registration"
        | "business_paye_compliance"
        | "business_sars_debt_arrangements"
        | "business_tax_clearance_certificates"
        | "business_sars_audits_support"
        | "accounting_bookkeeping"
        | "accounting_financial_statements"
        | "accounting_management_accounts"
        | "accounting_payroll_services"
        | "accounting_monthly_accounting_services"
        | "accounting_annual_financial_reporting"
        | "support_company_registration"
        | "support_business_compliance"
        | "support_cipc_services"
        | "support_business_advisory"
        | "support_financial_compliance"
        | "individual_tax_compliance_status_assistance"
        | "business_tax_compliance_support"
        | "accounting_cash_flow_management"
        | "accounting_budget_planning"
        | "support_annual_returns_filing"
        | "trust_tax_returns"
        | "trust_compliance"
        | "trust_sars_assistance"
        | "trust_tax_clearance"
        | "trust_financial_statements"
        | "trust_advisory_support"
        | "npo_registration_assistance"
        | "npo_tax_exemption_assistance"
        | "npo_annual_compliance_filing"
        | "npo_payroll_accounting"
        | "npo_sars_compliance"
        | "npo_financial_reporting"
        | "npo_governance_advisory"
        | "individual_voluntary_disclosure_programme"
        | "individual_sars_verification_refund_assistance"
        | "individual_tax_directives"
        | "individual_estate_pension_tax_matters"
        | "individual_other"
        | "business_vat_paye_corrections"
        | "business_tax_debt_compromise"
        | "business_vat_objections_disputes"
        | "business_tax_other"
        | "trust_representative_assistance"
        | "trust_sars_disputes_objections"
        | "trust_other"
        | "npo_pbo_applications_assistance"
        | "npo_donor_tax_section18a_assistance"
        | "npo_audit_compliance_support"
        | "npo_organisation_other"
        | "accounting_independent_reviews"
        | "accounting_other"
        | "support_beneficial_ownership_filings"
        | "support_director_shareholder_changes"
        | "support_bee_assistance"
        | "business_support_other"
      service_request_status:
        | "new"
        | "viewed"
        | "responded"
        | "assigned"
        | "closed"
        | "in_progress"
        | "waiting_response"
        | "dead_lead"
        | "converted_to_client"
        | "pending_client_confirmation"
        | "expired"
      social_asset_status: "active" | "archived"
      social_campaign_status:
        | "draft"
        | "approved"
        | "active"
        | "paused"
        | "completed"
        | "archived"
      social_platform: "facebook" | "instagram" | "linkedin"
      social_post_status:
        | "draft"
        | "scheduled"
        | "publishing"
        | "published"
        | "failed"
        | "cancelled"
        | "skipped"
      social_publish_attempt_status:
        | "success"
        | "temporary_failure"
        | "permanent_failure"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      ai_index_status: [
        "not_applicable",
        "pending",
        "processing",
        "indexed",
        "failed",
        "outdated",
        "removed",
      ],
      alert_status: ["active", "acknowledged", "resolved", "dismissed"],
      alert_type: [
        "sars_due_date",
        "missing_document",
        "payment_deadline",
        "general_deadline",
        "provisional_tax_date",
        "follow_up_required",
        "other",
      ],
      app_role: ["admin", "consultant", "client"],
      case_status: [
        "new",
        "under_review",
        "in_progress",
        "awaiting_client_documents",
        "awaiting_sars_response",
        "resolved",
        "closed",
      ],
      case_type: [
        "individual_tax_return",
        "corporate_tax_return",
        "vat_registration",
        "provisional_tax",
        "tax_clearance_certificate",
        "sars_dispute_objection",
        "other",
      ],
      correspondence_status: [
        "draft",
        "under_review",
        "approved",
        "sent",
        "superseded",
        "archived",
      ],
      correspondence_template_status: ["draft", "active", "archived"],
      document_status: [
        "uploaded",
        "pending_review",
        "approved",
        "rejected",
        "requested",
      ],
      invoice_status: [
        "draft",
        "issued",
        "partially_paid",
        "paid",
        "overdue",
        "cancelled",
      ],
      knowledge_status: ["current", "superseded", "draft", "archived"],
      lead_access_tier: ["basic", "professional", "business"],
      message_sender_type: ["admin", "consultant", "client", "system"],
      past_case_anonymisation_status: [
        "not_reviewed",
        "anonymised",
        "partially_anonymised",
        "contains_confidential_information",
      ],
      payment_status: ["pending", "paid", "failed", "cancelled"],
      practitioner_availability_status: [
        "available",
        "limited",
        "not_available",
      ],
      practitioner_document_status: ["pending_review", "approved", "rejected"],
      practitioner_document_type: [
        "id_copy",
        "tax_registration_certificate",
        "proof_of_address",
        "bank_confirmation_letter",
        "professional_body_membership",
        "company_registration",
        "vat_number_proof",
        "profile_photo",
        "cv_professional_summary",
        "other",
      ],
      service_request_assignment_type: [
        "manual",
        "automatic",
        "client_selected",
        "reassigned",
      ],
      service_request_category: [
        "individual_tax",
        "business_tax",
        "accounting",
        "business_support",
        "trust_services",
        "npo_organisation_services",
      ],
      service_request_client_type: [
        "individual",
        "company",
        "trust",
        "npo_organisation",
      ],
      service_request_identity_document_type: ["id_number", "passport_number"],
      service_request_lifecycle_stage: [
        "business_exclusive",
        "professional_access",
        "open_marketplace",
        "pending_client_confirmation",
        "expired",
      ],
      service_request_priority: ["low", "medium", "high", "urgent"],
      service_request_response_status: [
        "submitted",
        "selected",
        "declined",
        "withdrawn",
      ],
      service_request_risk_indicator: ["low", "medium", "high"],
      service_request_service_needed: [
        "tax_return",
        "sars_debt_assistance",
        "vat_registration",
        "company_tax",
        "paye_issues",
        "objection_dispute",
        "bookkeeping",
        "other",
        "individual_personal_income_tax_returns",
        "individual_sars_debt_assistance",
        "individual_tax_compliance_issues",
        "individual_tax_clearance_certificates",
        "individual_objections_and_disputes",
        "individual_late_return_submissions",
        "individual_tax_number_registration",
        "individual_tax_status_corrections",
        "business_company_income_tax",
        "business_vat_registration",
        "business_vat_returns",
        "business_paye_registration",
        "business_paye_compliance",
        "business_sars_debt_arrangements",
        "business_tax_clearance_certificates",
        "business_sars_audits_support",
        "accounting_bookkeeping",
        "accounting_financial_statements",
        "accounting_management_accounts",
        "accounting_payroll_services",
        "accounting_monthly_accounting_services",
        "accounting_annual_financial_reporting",
        "support_company_registration",
        "support_business_compliance",
        "support_cipc_services",
        "support_business_advisory",
        "support_financial_compliance",
        "individual_tax_compliance_status_assistance",
        "business_tax_compliance_support",
        "accounting_cash_flow_management",
        "accounting_budget_planning",
        "support_annual_returns_filing",
        "trust_tax_returns",
        "trust_compliance",
        "trust_sars_assistance",
        "trust_tax_clearance",
        "trust_financial_statements",
        "trust_advisory_support",
        "npo_registration_assistance",
        "npo_tax_exemption_assistance",
        "npo_annual_compliance_filing",
        "npo_payroll_accounting",
        "npo_sars_compliance",
        "npo_financial_reporting",
        "npo_governance_advisory",
        "individual_voluntary_disclosure_programme",
        "individual_sars_verification_refund_assistance",
        "individual_tax_directives",
        "individual_estate_pension_tax_matters",
        "individual_other",
        "business_vat_paye_corrections",
        "business_tax_debt_compromise",
        "business_vat_objections_disputes",
        "business_tax_other",
        "trust_representative_assistance",
        "trust_sars_disputes_objections",
        "trust_other",
        "npo_pbo_applications_assistance",
        "npo_donor_tax_section18a_assistance",
        "npo_audit_compliance_support",
        "npo_organisation_other",
        "accounting_independent_reviews",
        "accounting_other",
        "support_beneficial_ownership_filings",
        "support_director_shareholder_changes",
        "support_bee_assistance",
        "business_support_other",
      ],
      service_request_status: [
        "new",
        "viewed",
        "responded",
        "assigned",
        "closed",
        "in_progress",
        "waiting_response",
        "dead_lead",
        "converted_to_client",
        "pending_client_confirmation",
        "expired",
      ],
      social_asset_status: ["active", "archived"],
      social_campaign_status: [
        "draft",
        "approved",
        "active",
        "paused",
        "completed",
        "archived",
      ],
      social_platform: ["facebook", "instagram", "linkedin"],
      social_post_status: [
        "draft",
        "scheduled",
        "publishing",
        "published",
        "failed",
        "cancelled",
        "skipped",
      ],
      social_publish_attempt_status: [
        "success",
        "temporary_failure",
        "permanent_failure",
      ],
    },
  },
} as const
