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
          client_id: string;
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
          client_id: string;
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
          client_id?: string;
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
      get_my_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["app_role"];
      };
      is_admin_or_consultant: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
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
    },
  },
} as const;
