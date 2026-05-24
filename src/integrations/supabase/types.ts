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
      api_keys: {
        Row: {
          api_key: string
          blocked_until: string | null
          created_at: string
          created_by: string | null
          credits_total: number | null
          credits_used: number
          expires_at: string | null
          id: string
          is_active: boolean
          name: string
          notes: string | null
          public_slug: string
          save_history: boolean
          services: string[]
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key: string
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          credits_total?: number | null
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name: string
          notes?: string | null
          public_slug: string
          save_history?: boolean
          services?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key?: string
          blocked_until?: string | null
          created_at?: string
          created_by?: string | null
          credits_total?: number | null
          credits_used?: number
          expires_at?: string | null
          id?: string
          is_active?: boolean
          name?: string
          notes?: string | null
          public_slug?: string
          save_history?: boolean
          services?: string[]
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      api_request_logs: {
        Row: {
          api_key_id: string | null
          created_at: string
          error_msg: string | null
          id: string
          ip: string | null
          query_param: string | null
          service: string
          status: number
          user_agent: string | null
        }
        Insert: {
          api_key_id?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          ip?: string | null
          query_param?: string | null
          service: string
          status: number
          user_agent?: string | null
        }
        Update: {
          api_key_id?: string | null
          created_at?: string
          error_msg?: string | null
          id?: string
          ip?: string | null
          query_param?: string | null
          service?: string
          status?: number
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "api_request_logs_api_key_id_fkey"
            columns: ["api_key_id"]
            isOneToOne: false
            referencedRelation: "api_keys"
            referencedColumns: ["id"]
          },
        ]
      }
      ip_blocks: {
        Row: {
          blocked_until: string
          created_at: string
          id: string
          ip: string
          reason: string | null
        }
        Insert: {
          blocked_until: string
          created_at?: string
          id?: string
          ip: string
          reason?: string | null
        }
        Update: {
          blocked_until?: string
          created_at?: string
          id?: string
          ip?: string
          reason?: string | null
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          marked_by: string | null
          note: string | null
          paid_at: string
          period_end: string
          period_start: string
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          paid_at?: string
          period_end: string
          period_start: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          marked_by?: string | null
          note?: string | null
          paid_at?: string
          period_end?: string
          period_start?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          billing_cycle_days: number
          charge_amount: number
          created_at: string
          full_name: string | null
          is_suspended: boolean
          last_paid_at: string | null
          next_due_at: string
          notes: string | null
          suspended_reason: string | null
          updated_at: string
          user_id: string
          username: string
        }
        Insert: {
          billing_cycle_days?: number
          charge_amount?: number
          created_at?: string
          full_name?: string | null
          is_suspended?: boolean
          last_paid_at?: string | null
          next_due_at?: string
          notes?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id: string
          username: string
        }
        Update: {
          billing_cycle_days?: number
          charge_amount?: number
          created_at?: string
          full_name?: string | null
          is_suspended?: boolean
          last_paid_at?: string | null
          next_due_at?: string
          notes?: string | null
          suspended_reason?: string | null
          updated_at?: string
          user_id?: string
          username?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      find_email_by_username: { Args: { uname: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      suspend_overdue_users: { Args: never; Returns: number }
    }
    Enums: {
      app_role: "admin"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["admin"],
    },
  },
} as const
