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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      bans: {
        Row: {
          banned_by: string | null
          created_at: string
          expires_at: string | null
          reason: string
          user_id: string
        }
        Insert: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          reason?: string
          user_id: string
        }
        Update: {
          banned_by?: string | null
          created_at?: string
          expires_at?: string | null
          reason?: string
          user_id?: string
        }
        Relationships: []
      }
      chat_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          nickname: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          nickname: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          nickname?: string
          user_id?: string
        }
        Relationships: []
      }
      game_saves: {
        Row: {
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      item_grants: {
        Row: {
          amount: number | null
          created_at: string
          id: string
          item_id: string
          source: string
          user_id: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id: string
          source?: string
          user_id: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          id?: string
          item_id?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      market_listings: {
        Row: {
          buyer_id: string | null
          car: Json
          created_at: string
          id: string
          price: number
          seller_id: string
          seller_nickname: string
          status: string
        }
        Insert: {
          buyer_id?: string | null
          car: Json
          created_at?: string
          id?: string
          price: number
          seller_id: string
          seller_nickname: string
          status?: string
        }
        Update: {
          buyer_id?: string | null
          car?: Json
          created_at?: string
          id?: string
          price?: number
          seller_id?: string
          seller_nickname?: string
          status?: string
        }
        Relationships: []
      }
      mutes: {
        Row: {
          created_at: string
          muted_by: string | null
          until: string
          user_id: string
        }
        Insert: {
          created_at?: string
          muted_by?: string | null
          until: string
          user_id: string
        }
        Update: {
          created_at?: string
          muted_by?: string | null
          until?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          id: string
          level: number
          net_worth: number
          nickname: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id: string
          level?: number
          net_worth?: number
          nickname?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          level?: number
          net_worth?: number
          nickname?: string
          updated_at?: string
        }
        Relationships: []
      }
      promo_codes: {
        Row: {
          amount: number | null
          code: string
          created_at: string
          item_id: string
          uses_left: number
        }
        Insert: {
          amount?: number | null
          code: string
          created_at?: string
          item_id: string
          uses_left?: number
        }
        Update: {
          amount?: number | null
          code?: string
          created_at?: string
          item_id?: string
          uses_left?: number
        }
        Relationships: []
      }
      promo_redemptions: {
        Row: {
          code: string
          created_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      admin_ban: {
        Args: { _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_ban_timed: {
        Args: { _hours: number; _reason: string; _user_id: string }
        Returns: undefined
      }
      admin_broadcast: { Args: { _text: string }; Returns: undefined }
      admin_clear_chat: { Args: never; Returns: number }
      admin_create_promo: {
        Args: {
          _amount: number
          _code: string
          _item_id: string
          _uses: number
        }
        Returns: undefined
      }
      admin_delete_message: {
        Args: { _message_id: string }
        Returns: undefined
      }
      admin_delete_promo: { Args: { _code: string }; Returns: undefined }
      admin_give_money: {
        Args: { _amount: number; _user_id: string }
        Returns: undefined
      }
      admin_give_money_all: { Args: { _amount: number }; Returns: number }
      admin_give_money_by_email: {
        Args: { _amount: number; _email: string }
        Returns: string
      }
      admin_grant: {
        Args: { _amount: number; _item_id: string; _user_id: string }
        Returns: undefined
      }
      admin_grant_item: {
        Args: { _item_id: string; _user_id: string }
        Returns: undefined
      }
      admin_list_players: {
        Args: { _search?: string }
        Returns: {
          ban_reason: string
          ban_until: string
          banned: boolean
          email: string
          id: string
          level: number
          muted_until: string
          net_worth: number
          nickname: string
        }[]
      }
      admin_list_promos: {
        Args: never
        Returns: {
          amount: number
          code: string
          item_id: string
          uses_left: number
        }[]
      }
      admin_mute: {
        Args: { _minutes: number; _user_id: string }
        Returns: undefined
      }
      admin_remove_listing: {
        Args: { _listing_id: string }
        Returns: undefined
      }
      admin_reset_player: { Args: { _user_id: string }; Returns: undefined }
      admin_server_stats: { Args: never; Returns: Json }
      admin_set_nickname: {
        Args: { _nickname: string; _user_id: string }
        Returns: undefined
      }
      admin_unban: { Args: { _user_id: string }; Returns: undefined }
      admin_unmute: { Args: { _user_id: string }; Returns: undefined }
      assert_admin: { Args: never; Returns: undefined }
      buy_listing: { Args: { _listing_id: string }; Returns: Json }
      collect_sales: { Args: never; Returns: number }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_banned: { Args: { _user_id: string }; Returns: boolean }
      is_muted: { Args: { _user_id: string }; Returns: boolean }
      redeem_promo: { Args: { _code: string }; Returns: string }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
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
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
