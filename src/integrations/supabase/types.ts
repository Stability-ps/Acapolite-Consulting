export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          full_name: string | null;
          email: string | null;
          phone: string | null;
          avatar_url: string | null;
          is_active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          role?: Database["public"]["Enums"]["app_role"];
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          full_name?: string | null;
          email?: string | null;
          phone?: string | null;
          avatar_url?: string | null;
          is_active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      staff_permissions: {
        Row: {
          profile_id: string;
          assigned_clients_only: boolean;
          can_view_overview: boolean;
          can_view_clients: boolean;
          can_manage_clients: boolean;
          can_view_client_workspace: boolean;
          can_view_cases: boolean;
          can_manage_cases: boolean;
          can_view_documents: boolean;
          can_review_documents: boolean;
          can_view_invoices: boolean;
          can_manage_invoices: boolean;
          can_view_messages: boolean;
          can_reply_messages: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          assigned_clients_only?: boolean;
          can_view_overview?: boolean;
          can_view_clients?: boolean;
          can_manage_clients?: boolean;
          can_view_client_workspace?: boolean;
          can_view_cases?: boolean;
          can_manage_cases?: boolean;
          can_view_documents?: boolean;
          can_review_documents?: boolean;
          can_view_invoices?: boolean;
          can_manage_invoices?: boolean;
          can_view_messages?: boolean;
          can_reply_messages?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          assigned_clients_only?: boolean;
          can_view_overview?: boolean;
          can_view_clients?: boolean;
          can_manage_clients?: boolean;
          can_view_client_workspace?: boolean;
          can_view_cases?: boolean;
          can_manage_cases?: boolean;
          can_view_documents?: boolean;
          can_review_documents?: boolean;
          can_view_invoices?: boolean;
          can_manage_invoices?: boolean;
          can_view_messages?: boolean;
          can_reply_messages?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practitioner_profiles: {
        Row: {
          profile_id: string;
          business_name: string | null;
          registration_number: string | null;
          id_number: string | null;
          tax_practitioner_number: string | null;
          professional_body: string | null;
          city: string | null;
          province: string | null;
          verification_status: string;
          verification_submitted_at: string | null;
          id_document_path: string | null;
          certificate_document_path: string | null;
          proof_of_address_path: string | null;
          bank_confirmation_document_path: string | null;
          services_offered: string[];
          years_of_experience: number;
          availability_status: Database["public"]["Enums"]["practitioner_availability_status"];
          is_verified: boolean;
          internal_notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          business_name?: string | null;
          registration_number?: string | null;
          id_number?: string | null;
          tax_practitioner_number?: string | null;
          professional_body?: string | null;
          city?: string | null;
          province?: string | null;
          verification_status?: string;
          verification_submitted_at?: string | null;
          id_document_path?: string | null;
          certificate_document_path?: string | null;
          proof_of_address_path?: string | null;
          bank_confirmation_document_path?: string | null;
          services_offered?: string[];
          years_of_experience?: number;
          availability_status?: Database["public"]["Enums"]["practitioner_availability_status"];
          is_verified?: boolean;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          business_name?: string | null;
          registration_number?: string | null;
          id_number?: string | null;
          tax_practitioner_number?: string | null;
          professional_body?: string | null;
          city?: string | null;
          province?: string | null;
          verification_status?: string;
          verification_submitted_at?: string | null;
          id_document_path?: string | null;
          certificate_document_path?: string | null;
          proof_of_address_path?: string | null;
          bank_confirmation_document_path?: string | null;
          services_offered?: string[];
          years_of_experience?: number;
          availability_status?: Database["public"]["Enums"]["practitioner_availability_status"];
          is_verified?: boolean;
          internal_notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      push_subscriptions: {
        Row: {
          id: string;
          profile_id: string;
          endpoint: string;
          subscription: Json;
          user_agent: string | null;
          created_at: string;
          updated_at: string;
          last_seen_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          endpoint: string;
          subscription: Json;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          endpoint?: string;
          subscription?: Json;
          user_agent?: string | null;
          created_at?: string;
          updated_at?: string;
          last_seen_at?: string;
        };
        Relationships: [];
      };
      practitioner_reviews: {
        Row: {
          id: string;
          practitioner_profile_id: string;
          client_id: string;
          case_id: string;
          rating: number;
          review_text: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practitioner_profile_id: string;
          client_id: string;
          case_id: string;
          rating: number;
          review_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          practitioner_profile_id?: string;
          client_id?: string;
          case_id?: string;
          rating?: number;
          review_text?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practitioner_credit_accounts: {
        Row: {
          profile_id: string;
          balance: number;
          total_bonus_credits: number;
          total_purchased_credits: number;
          total_used_credits: number;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          profile_id: string;
          balance?: number;
          total_bonus_credits?: number;
          total_purchased_credits?: number;
          total_used_credits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          profile_id?: string;
          balance?: number;
          total_bonus_credits?: number;
          total_purchased_credits?: number;
          total_used_credits?: number;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practitioner_credit_purchases: {
        Row: {
          id: string;
          practitioner_profile_id: string;
          package_code: string;
          package_name: string;
          credits: number;
          amount_zar: number;
          currency: string;
          payment_provider: string;
          payment_status: string;
          provider_payment_id: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
          completed_at: string | null;
        };
        Insert: {
          id?: string;
          practitioner_profile_id: string;
          package_code: string;
          package_name: string;
          credits: number;
          amount_zar: number;
          currency?: string;
          payment_provider?: string;
          payment_status?: string;
          provider_payment_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Update: {
          id?: string;
          practitioner_profile_id?: string;
          package_code?: string;
          package_name?: string;
          credits?: number;
          amount_zar?: number;
          currency?: string;
          payment_provider?: string;
          payment_status?: string;
          provider_payment_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
          completed_at?: string | null;
        };
        Relationships: [];
      };
      practitioner_credit_transactions: {
        Row: {
          id: string;
          practitioner_profile_id: string;
          purchase_id: string | null;
          service_request_id: string | null;
          response_id: string | null;
          subscription_id: string | null;
          transaction_type: string;
          credits_delta: number;
          balance_after: number;
          description: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          practitioner_profile_id: string;
          purchase_id?: string | null;
          service_request_id?: string | null;
          response_id?: string | null;
          subscription_id?: string | null;
          transaction_type: string;
          credits_delta: number;
          balance_after: number;
          description?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          practitioner_profile_id?: string;
          purchase_id?: string | null;
          service_request_id?: string | null;
          response_id?: string | null;
          subscription_id?: string | null;
          transaction_type?: string;
          credits_delta?: number;
          balance_after?: number;
          description?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      practitioner_subscription_plans: {
        Row: {
          code: string;
          name: string;
          price_zar: number;
          credits_per_month: number;
          includes_verified_badge: boolean;
          includes_standard_listing: boolean;
          includes_priority_listing: boolean;
          includes_featured_profile: boolean;
          includes_highlighted_profile: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          code: string;
          name: string;
          price_zar: number;
          credits_per_month: number;
          includes_verified_badge?: boolean;
          includes_standard_listing?: boolean;
          includes_priority_listing?: boolean;
          includes_featured_profile?: boolean;
          includes_highlighted_profile?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          code?: string;
          name?: string;
          price_zar?: number;
          credits_per_month?: number;
          includes_verified_badge?: boolean;
          includes_standard_listing?: boolean;
          includes_priority_listing?: boolean;
          includes_featured_profile?: boolean;
          includes_highlighted_profile?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      practitioner_subscriptions: {
        Row: {
          id: string;
          practitioner_profile_id: string;
          plan_code: string;
          status: string;
          payment_provider: string;
          provider_subscription_id: string | null;
          started_at: string;
          current_period_start: string;
          current_period_end: string;
          next_renewal_at: string;
          last_credited_at: string | null;
          cancelled_at: string | null;
          metadata: Json | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          practitioner_profile_id: string;
          plan_code: string;
          status?: string;
          payment_provider?: string;
          provider_subscription_id?: string | null;
          started_at?: string;
          current_period_start?: string;
          current_period_end?: string;
          next_renewal_at?: string;
          last_credited_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          practitioner_profile_id?: string;
          plan_code?: string;
          status?: string;
          payment_provider?: string;
          provider_subscription_id?: string | null;
          started_at?: string;
          current_period_start?: string;
          current_period_end?: string;
          next_renewal_at?: string;
          last_credited_at?: string | null;
          cancelled_at?: string | null;
          metadata?: Json | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      clients: {
        Row: {
          id: string;
          profile_id: string;
          client_type: string;
          company_registration_number: string | null;
          first_name: string | null;
          last_name: string | null;
          company_name: string | null;
          tax_number: string | null;
          sars_reference_number: string | null;
          id_number: string | null;
          sars_outstanding_debt: number;
          returns_filed: boolean;
          client_code: string | null;
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          province: string | null;
          postal_code: string | null;
          country: string | null;
          notes: string | null;
          assigned_consultant_id: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          profile_id: string;
          client_type?: string;
          company_registration_number?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          tax_number?: string | null;
          sars_reference_number?: string | null;
          id_number?: string | null;
          sars_outstanding_debt?: number;
          returns_filed?: boolean;
          client_code?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          notes?: string | null;
          assigned_consultant_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          profile_id?: string;
          client_type?: string;
          company_registration_number?: string | null;
          first_name?: string | null;
          last_name?: string | null;
          company_name?: string | null;
          tax_number?: string | null;
          sars_reference_number?: string | null;
          id_number?: string | null;
          sars_outstanding_debt?: number;
          returns_filed?: boolean;
          client_code?: string | null;
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          province?: string | null;
          postal_code?: string | null;
          country?: string | null;
          notes?: string | null;
          assigned_consultant_id?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      cases: {
        Row: {
          id: string;
          client_id: string;
          assigned_consultant_id: string | null;
          case_title: string;
          case_type: Database["public"]["Enums"]["case_type"];
          status: Database["public"]["Enums"]["case_status"];
          description: string | null;
          sars_case_reference: string | null;
          priority: number;
          opened_at: string;
          due_date: string | null;
          closed_at: string | null;
          last_activity_at: string;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          assigned_consultant_id?: string | null;
          case_title: string;
          case_type: Database["public"]["Enums"]["case_type"];
          status?: Database["public"]["Enums"]["case_status"];
          description?: string | null;
          sars_case_reference?: string | null;
          priority?: number;
          opened_at?: string;
          due_date?: string | null;
          closed_at?: string | null;
          last_activity_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          assigned_consultant_id?: string | null;
          case_title?: string;
          case_type?: Database["public"]["Enums"]["case_type"];
          status?: Database["public"]["Enums"]["case_status"];
          description?: string | null;
          sars_case_reference?: string | null;
          priority?: number;
          opened_at?: string;
          due_date?: string | null;
          closed_at?: string | null;
          last_activity_at?: string;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      documents: {
        Row: {
          id: string;
          client_id: string;
          case_id: string | null;
          document_request_id: string | null;
          uploaded_by: string;
          title: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          category: string | null;
          status: Database["public"]["Enums"]["document_status"];
          rejection_reason: string | null;
          notes: string | null;
          uploaded_at: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          case_id?: string | null;
          document_request_id?: string | null;
          uploaded_by: string;
          title: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          category?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          rejection_reason?: string | null;
          notes?: string | null;
          uploaded_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          case_id?: string | null;
          document_request_id?: string | null;
          uploaded_by?: string;
          title?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          category?: string | null;
          status?: Database["public"]["Enums"]["document_status"];
          rejection_reason?: string | null;
          notes?: string | null;
          uploaded_at?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      conversations: {
        Row: {
          id: string;
          client_id: string | null;
          practitioner_profile_id: string | null;
          case_id: string | null;
          subject: string | null;
          created_by: string | null;
          is_closed: boolean;
          last_message_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id?: string | null;
          practitioner_profile_id?: string | null;
          case_id?: string | null;
          subject?: string | null;
          created_by?: string | null;
          is_closed?: boolean;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string | null;
          practitioner_profile_id?: string | null;
          case_id?: string | null;
          subject?: string | null;
          created_by?: string | null;
          is_closed?: boolean;
          last_message_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          sender_profile_id: string | null;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          message_text: string;
          is_read: boolean;
          read_at: string | null;
          attachment_document_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          sender_profile_id?: string | null;
          sender_type: Database["public"]["Enums"]["message_sender_type"];
          message_text: string;
          is_read?: boolean;
          read_at?: string | null;
          attachment_document_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          conversation_id?: string;
          sender_profile_id?: string | null;
          sender_type?: Database["public"]["Enums"]["message_sender_type"];
          message_text?: string;
          is_read?: boolean;
          read_at?: string | null;
          attachment_document_id?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      system_activity_log: {
        Row: {
          id: string;
          actor_profile_id: string | null;
          actor_role: Database["public"]["Enums"]["app_role"];
          action: string;
          target_type: string;
          target_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          actor_profile_id?: string | null;
          actor_role: Database["public"]["Enums"]["app_role"];
          action: string;
          target_type: string;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          actor_profile_id?: string | null;
          actor_role?: Database["public"]["Enums"]["app_role"];
          action?: string;
          target_type?: string;
          target_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Relationships: [];
      };
      invoices: {
        Row: {
          id: string;
          client_id: string;
          case_id: string | null;
          invoice_number: string;
          title: string | null;
          description: string | null;
          currency: string;
          subtotal: number;
          tax_amount: number;
          total_amount: number;
          amount_paid: number;
          balance_due: number;
          status: Database["public"]["Enums"]["invoice_status"];
          issue_date: string;
          due_date: string | null;
          pdf_url: string | null;
          payment_reference: string | null;
          proof_of_payment_document_id: string | null;
          practitioner_bank_details: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          case_id?: string | null;
          invoice_number: string;
          title?: string | null;
          description?: string | null;
          currency?: string;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          issue_date?: string;
          due_date?: string | null;
          pdf_url?: string | null;
          payment_reference?: string | null;
          proof_of_payment_document_id?: string | null;
          practitioner_bank_details?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          case_id?: string | null;
          invoice_number?: string;
          title?: string | null;
          description?: string | null;
          currency?: string;
          subtotal?: number;
          tax_amount?: number;
          total_amount?: number;
          amount_paid?: number;
          status?: Database["public"]["Enums"]["invoice_status"];
          issue_date?: string;
          due_date?: string | null;
          pdf_url?: string | null;
          payment_reference?: string | null;
          proof_of_payment_document_id?: string | null;
          practitioner_bank_details?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      alerts: {
        Row: {
          id: string;
          client_id: string;
          case_id: string | null;
          invoice_id: string | null;
          title: string;
          description: string | null;
          alert_type: Database["public"]["Enums"]["alert_type"];
          status: Database["public"]["Enums"]["alert_status"];
          alert_at: string;
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          client_id: string;
          case_id?: string | null;
          invoice_id?: string | null;
          title: string;
          description?: string | null;
          alert_type?: Database["public"]["Enums"]["alert_type"];
          status?: Database["public"]["Enums"]["alert_status"];
          alert_at: string;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          client_id?: string;
          case_id?: string | null;
          invoice_id?: string | null;
          title?: string;
          description?: string | null;
          alert_type?: Database["public"]["Enums"]["alert_type"];
          status?: Database["public"]["Enums"]["alert_status"];
          alert_at?: string;
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_requests: {
        Row: {
          id: string;
          full_name: string;
          email: string;
          phone: string;
          client_type: Database["public"]["Enums"]["service_request_client_type"];
          identity_document_type: Database["public"]["Enums"]["service_request_identity_document_type"] | null;
          id_number: string | null;
          company_registration_number: string | null;
          service_category: Database["public"]["Enums"]["service_request_category"];
          service_needed: Database["public"]["Enums"]["service_request_service_needed"];
          priority_level: Database["public"]["Enums"]["service_request_priority"];
          description: string;
          sars_debt_amount: number;
          returns_filed: boolean;
          status: Database["public"]["Enums"]["service_request_status"];
          has_debt_flag: boolean;
          missing_returns_flag: boolean;
          missing_documents_flag: boolean;
          risk_indicator: Database["public"]["Enums"]["service_request_risk_indicator"];
          viewed_at: string | null;
          responded_at: string | null;
          assigned_at: string | null;
          assigned_practitioner_id: string | null;
          selected_response_id: string | null;
          converted_case_id: string | null;
          closed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          email: string;
          phone: string;
          client_type: Database["public"]["Enums"]["service_request_client_type"];
          identity_document_type?: Database["public"]["Enums"]["service_request_identity_document_type"] | null;
          id_number?: string | null;
          company_registration_number?: string | null;
          service_category: Database["public"]["Enums"]["service_request_category"];
          service_needed: Database["public"]["Enums"]["service_request_service_needed"];
          priority_level?: Database["public"]["Enums"]["service_request_priority"];
          description: string;
          sars_debt_amount?: number;
          returns_filed?: boolean;
          status?: Database["public"]["Enums"]["service_request_status"];
          has_debt_flag?: boolean;
          missing_returns_flag?: boolean;
          missing_documents_flag?: boolean;
          risk_indicator?: Database["public"]["Enums"]["service_request_risk_indicator"];
          viewed_at?: string | null;
          responded_at?: string | null;
          assigned_at?: string | null;
          assigned_practitioner_id?: string | null;
          selected_response_id?: string | null;
          converted_case_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          email?: string;
          phone?: string;
          client_type?: Database["public"]["Enums"]["service_request_client_type"];
          identity_document_type?: Database["public"]["Enums"]["service_request_identity_document_type"] | null;
          id_number?: string | null;
          company_registration_number?: string | null;
          service_category?: Database["public"]["Enums"]["service_request_category"];
          service_needed?: Database["public"]["Enums"]["service_request_service_needed"];
          priority_level?: Database["public"]["Enums"]["service_request_priority"];
          description?: string;
          sars_debt_amount?: number;
          returns_filed?: boolean;
          status?: Database["public"]["Enums"]["service_request_status"];
          has_debt_flag?: boolean;
          missing_returns_flag?: boolean;
          missing_documents_flag?: boolean;
          risk_indicator?: Database["public"]["Enums"]["service_request_risk_indicator"];
          viewed_at?: string | null;
          responded_at?: string | null;
          assigned_at?: string | null;
          assigned_practitioner_id?: string | null;
          selected_response_id?: string | null;
          converted_case_id?: string | null;
          closed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      service_request_responses: {
        Row: {
          id: string;
          service_request_id: string;
          practitioner_profile_id: string;
          introduction_message: string;
          service_pitch: string | null;
          response_status: Database["public"]["Enums"]["service_request_response_status"];
          created_at: string;
          updated_at: string;
          selected_at: string | null;
          declined_at: string | null;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          practitioner_profile_id: string;
          introduction_message: string;
          service_pitch?: string | null;
          response_status?: Database["public"]["Enums"]["service_request_response_status"];
          created_at?: string;
          updated_at?: string;
          selected_at?: string | null;
          declined_at?: string | null;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          practitioner_profile_id?: string;
          introduction_message?: string;
          service_pitch?: string | null;
          response_status?: Database["public"]["Enums"]["service_request_response_status"];
          created_at?: string;
          updated_at?: string;
          selected_at?: string | null;
          declined_at?: string | null;
        };
        Relationships: [];
      };
      service_request_assignment_history: {
        Row: {
          id: string;
          service_request_id: string;
          practitioner_profile_id: string | null;
          previous_practitioner_id: string | null;
          assignment_type: Database["public"]["Enums"]["service_request_assignment_type"];
          note: string | null;
          assigned_by: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          practitioner_profile_id?: string | null;
          previous_practitioner_id?: string | null;
          assignment_type: Database["public"]["Enums"]["service_request_assignment_type"];
          note?: string | null;
          assigned_by?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          practitioner_profile_id?: string | null;
          previous_practitioner_id?: string | null;
          assignment_type?: Database["public"]["Enums"]["service_request_assignment_type"];
          note?: string | null;
          assigned_by?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      service_request_documents: {
        Row: {
          id: string;
          service_request_id: string;
          title: string;
          file_name: string;
          file_path: string;
          file_size: number | null;
          mime_type: string | null;
          uploaded_at: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          service_request_id: string;
          title: string;
          file_name: string;
          file_path: string;
          file_size?: number | null;
          mime_type?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          service_request_id?: string;
          title?: string;
          file_name?: string;
          file_path?: string;
          file_size?: number | null;
          mime_type?: string | null;
          uploaded_at?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      admin_dashboard_summary: {
        Row: {
          total_clients: number | null;
          pending_reviews: number | null;
          unpaid_invoices: number | null;
          unread_messages: number | null;
          reminders_due: number | null;
        };
      };
      client_dashboard_summary: {
        Row: {
          profile_id: string | null;
          client_id: string | null;
          active_cases: number | null;
          outstanding_document_requests: number | null;
          unread_messages: number | null;
          active_alerts: number | null;
        };
      };
    };
    Functions: {
      accept_service_request_response: {
        Args: {
          p_response_id: string;
        };
        Returns: string;
      };
      assign_service_request: {
        Args: {
          p_request_id: string;
          p_practitioner_id: string;
          p_assignment_type?: Database["public"]["Enums"]["service_request_assignment_type"];
          p_note?: string;
        };
        Returns: string;
      };
      auto_assign_service_request: {
        Args: {
          p_request_id: string;
        };
        Returns: string;
      };
      convert_service_request_to_case: {
        Args: {
          p_request_id: string;
        };
        Returns: string;
      };
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      is_admin_or_consultant: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      map_service_request_to_case_type: {
        Args: {
          p_service_needed: Database["public"]["Enums"]["service_request_service_needed"];
        };
        Returns: Database["public"]["Enums"]["case_type"];
      };
    };
    Enums: {
      app_role: "admin" | "consultant" | "client";
      case_type:
        | "individual_tax_return"
        | "corporate_tax_return"
        | "vat_registration"
        | "provisional_tax"
        | "tax_clearance_certificate"
        | "sars_dispute_objection"
        | "other";
      case_status:
        | "new"
        | "under_review"
        | "in_progress"
        | "awaiting_client_documents"
        | "awaiting_sars_response"
        | "resolved"
        | "closed";
      document_status: "uploaded" | "pending_review" | "approved" | "rejected" | "requested";
      message_sender_type: "admin" | "consultant" | "client" | "system";
      alert_type:
        | "sars_due_date"
        | "missing_document"
        | "payment_deadline"
        | "general_deadline"
        | "provisional_tax_date"
        | "follow_up_required"
        | "other";
      alert_status: "active" | "acknowledged" | "resolved" | "dismissed";
      invoice_status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "cancelled";
      payment_status: "pending" | "paid" | "failed" | "cancelled";
      service_request_status: "new" | "viewed" | "responded" | "assigned" | "closed";
      service_request_client_type: "individual" | "company";
      service_request_identity_document_type: "id_number" | "passport_number";
      service_request_category: "individual_tax" | "business_tax" | "accounting" | "business_support";
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
        | "support_financial_compliance";
      service_request_priority: "low" | "medium" | "high" | "urgent";
      service_request_risk_indicator: "low" | "medium" | "high";
      practitioner_availability_status: "available" | "limited" | "not_available";
      service_request_response_status: "submitted" | "selected" | "declined" | "withdrawn";
      service_request_assignment_type: "manual" | "automatic" | "client_selected" | "reassigned";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;
type DefaultSchema = DatabaseWithoutInternals["public"];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer Row;
    }
    ? Row
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer Row;
      }
      ? Row
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer Insert;
    }
    ? Insert
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Insert: infer Insert }
      ? Insert
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer Update;
    }
    ? Update
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends { Update: infer Update }
      ? Update
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "consultant", "client"],
      case_type: [
        "individual_tax_return",
        "corporate_tax_return",
        "vat_registration",
        "provisional_tax",
        "tax_clearance_certificate",
        "sars_dispute_objection",
        "other",
      ],
      case_status: [
        "new",
        "under_review",
        "in_progress",
        "awaiting_client_documents",
        "awaiting_sars_response",
        "resolved",
        "closed",
      ],
      document_status: ["uploaded", "pending_review", "approved", "rejected", "requested"],
      message_sender_type: ["admin", "consultant", "client", "system"],
      alert_type: [
        "sars_due_date",
        "missing_document",
        "payment_deadline",
        "general_deadline",
        "provisional_tax_date",
        "follow_up_required",
        "other",
      ],
      alert_status: ["active", "acknowledged", "resolved", "dismissed"],
      invoice_status: ["draft", "issued", "partially_paid", "paid", "overdue", "cancelled"],
      payment_status: ["pending", "paid", "failed", "cancelled"],
      service_request_status: ["new", "viewed", "responded", "assigned", "closed"],
      service_request_client_type: ["individual", "company"],
      service_request_identity_document_type: ["id_number", "passport_number"],
      service_request_category: ["individual_tax", "business_tax", "accounting", "business_support"],
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
      ],
      service_request_priority: ["low", "medium", "high", "urgent"],
      service_request_risk_indicator: ["low", "medium", "high"],
      practitioner_availability_status: ["available", "limited", "not_available"],
      service_request_response_status: ["submitted", "selected", "declined", "withdrawn"],
      service_request_assignment_type: ["manual", "automatic", "client_selected", "reassigned"],
    },
  },
} as const;
