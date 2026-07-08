export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type AppRole = 'admin' | 'user' | 'moderator'
type CallStatus = 'requested' | 'active' | 'ended' | 'declined'
type CallSignalType = 'offer' | 'answer' | 'ice'

export type Database = {
  __InternalSupabase: {
    PostgrestVersion: '14.1'
  }
  public: {
    Tables: {
      blocked_users: {
        Row: { id: string; user_id: string; blocked_user_id: string; reason: string | null; created_at: string }
        Insert: { id?: string; user_id: string; blocked_user_id: string; reason?: string | null; created_at?: string }
        Update: { id?: string; user_id?: string; blocked_user_id?: string; reason?: string | null; created_at?: string }
        Relationships: []
      }
      categories: {
        Row: { id: string; name: string; icon: string | null; created_at: string }
        Insert: { id?: string; name: string; icon?: string | null; created_at?: string }
        Update: { id?: string; name?: string; icon?: string | null; created_at?: string }
        Relationships: []
      }
      subcategories: {
        Row: { id: string; category_id: string; name: string; icon: string | null; created_at: string }
        Insert: { id?: string; category_id: string; name: string; icon?: string | null; created_at?: string }
        Update: { id?: string; category_id?: string; name?: string; icon?: string | null; created_at?: string }
        Relationships: [{ foreignKeyName: 'subcategories_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] }]
      }
      profiles: {
        Row: { id: string; username: string | null; full_name: string | null; avatar_url: string | null; bio: string | null; location: string | null; phone: string | null; verified: boolean | null; verified_at: string | null; created_at: string; updated_at: string }
        Insert: { id: string; username?: string | null; full_name?: string | null; avatar_url?: string | null; bio?: string | null; location?: string | null; phone?: string | null; verified?: boolean | null; verified_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; username?: string | null; full_name?: string | null; avatar_url?: string | null; bio?: string | null; location?: string | null; phone?: string | null; verified?: boolean | null; verified_at?: string | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      products: {
        Row: { id: string; user_id: string; title: string; description: string | null; price: number; images: string[] | null; location: string | null; latitude: number | null; longitude: number | null; condition: string | null; status: string | null; category_id: string | null; subcategory_id: string | null; views: number | null; boosted_until: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; title: string; description?: string | null; price: number; images?: string[] | null; location?: string | null; latitude?: number | null; longitude?: number | null; condition?: string | null; status?: string | null; category_id?: string | null; subcategory_id?: string | null; views?: number | null; boosted_until?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; title?: string; description?: string | null; price?: number; images?: string[] | null; location?: string | null; latitude?: number | null; longitude?: number | null; condition?: string | null; status?: string | null; category_id?: string | null; subcategory_id?: string | null; views?: number | null; boosted_until?: string | null; created_at?: string; updated_at?: string }
        Relationships: [
          { foreignKeyName: 'products_category_id_fkey'; columns: ['category_id']; isOneToOne: false; referencedRelation: 'categories'; referencedColumns: ['id'] },
          { foreignKeyName: 'products_subcategory_id_fkey'; columns: ['subcategory_id']; isOneToOne: false; referencedRelation: 'subcategories'; referencedColumns: ['id'] }
        ]
      }
      conversations: {
        Row: { id: string; product_id: string; buyer_id: string; seller_id: string; created_at: string; updated_at: string }
        Insert: { id?: string; product_id: string; buyer_id: string; seller_id: string; created_at?: string; updated_at?: string }
        Update: { id?: string; product_id?: string; buyer_id?: string; seller_id?: string; created_at?: string; updated_at?: string }
        Relationships: [{ foreignKeyName: 'conversations_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }]
      }
      messages: {
        Row: { id: string; conversation_id: string; sender_id: string; content: string; read: boolean | null; created_at: string }
        Insert: { id?: string; conversation_id: string; sender_id: string; content: string; read?: boolean | null; created_at?: string }
        Update: { id?: string; conversation_id?: string; sender_id?: string; content?: string; read?: boolean | null; created_at?: string }
        Relationships: [{ foreignKeyName: 'messages_conversation_id_fkey'; columns: ['conversation_id']; isOneToOne: false; referencedRelation: 'conversations'; referencedColumns: ['id'] }]
      }
      call_sessions: {
        Row: { id: string; conversation_id: string; product_id: string | null; caller_id: string; callee_id: string; status: CallStatus; created_at: string; updated_at: string; ended_at: string | null }
        Insert: { id?: string; conversation_id: string; product_id?: string | null; caller_id: string; callee_id: string; status?: CallStatus; created_at?: string; updated_at?: string; ended_at?: string | null }
        Update: { id?: string; conversation_id?: string; product_id?: string | null; caller_id?: string; callee_id?: string; status?: CallStatus; created_at?: string; updated_at?: string; ended_at?: string | null }
        Relationships: [
          { foreignKeyName: 'call_sessions_conversation_id_fkey'; columns: ['conversation_id']; isOneToOne: false; referencedRelation: 'conversations'; referencedColumns: ['id'] },
          { foreignKeyName: 'call_sessions_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }
        ]
      }
      call_signals: {
        Row: { id: string; call_id: string; sender_id: string; type: CallSignalType; payload: Json; created_at: string }
        Insert: { id?: string; call_id: string; sender_id: string; type: CallSignalType; payload: Json; created_at?: string }
        Update: { id?: string; call_id?: string; sender_id?: string; type?: CallSignalType; payload?: Json; created_at?: string }
        Relationships: [{ foreignKeyName: 'call_signals_call_id_fkey'; columns: ['call_id']; isOneToOne: false; referencedRelation: 'call_sessions'; referencedColumns: ['id'] }]
      }
      transactions: {
        Row: { id: string; product_id: string; buyer_id: string; seller_id: string; amount: number; status: string; payment_provider: string | null; payment_status: string | null; stripe_payment_intent_id: string | null; paid_at: string | null; shipping_provider: string | null; shipping_status: string | null; sendcloud_parcel_id: string | null; sendcloud_tracking_number: string | null; sendcloud_tracking_url: string | null; shipping_address: Json | null; completed_at: string | null; created_at: string; updated_at: string | null }
        Insert: { id?: string; product_id: string; buyer_id: string; seller_id: string; amount: number; status?: string; payment_provider?: string | null; payment_status?: string | null; stripe_payment_intent_id?: string | null; paid_at?: string | null; shipping_provider?: string | null; shipping_status?: string | null; sendcloud_parcel_id?: string | null; sendcloud_tracking_number?: string | null; sendcloud_tracking_url?: string | null; shipping_address?: Json | null; completed_at?: string | null; created_at?: string; updated_at?: string | null }
        Update: { id?: string; product_id?: string; buyer_id?: string; seller_id?: string; amount?: number; status?: string; payment_provider?: string | null; payment_status?: string | null; stripe_payment_intent_id?: string | null; paid_at?: string | null; shipping_provider?: string | null; shipping_status?: string | null; sendcloud_parcel_id?: string | null; sendcloud_tracking_number?: string | null; sendcloud_tracking_url?: string | null; shipping_address?: Json | null; completed_at?: string | null; created_at?: string; updated_at?: string | null }
        Relationships: [{ foreignKeyName: 'transactions_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }]
      }
      offers: {
        Row: { id: string; product_id: string | null; conversation_id: string; buyer_id: string; seller_id: string | null; amount: number; message: string | null; status: string; created_at: string; updated_at: string | null }
        Insert: { id?: string; product_id?: string | null; conversation_id: string; buyer_id: string; seller_id?: string | null; amount: number; message?: string | null; status?: string; created_at?: string; updated_at?: string | null }
        Update: { id?: string; product_id?: string | null; conversation_id?: string; buyer_id?: string; seller_id?: string | null; amount?: number; message?: string | null; status?: string; created_at?: string; updated_at?: string | null }
        Relationships: []
      }
      product_boosts: {
        Row: { id: string; product_id: string; user_id: string; plan: string; amount_cents: number; currency: string; stripe_payment_intent_id: string | null; status: string; starts_at: string | null; ends_at: string | null; created_at: string; updated_at: string }
        Insert: { id?: string; product_id: string; user_id: string; plan: string; amount_cents: number; currency?: string; stripe_payment_intent_id?: string | null; status?: string; starts_at?: string | null; ends_at?: string | null; created_at?: string; updated_at?: string }
        Update: { id?: string; product_id?: string; user_id?: string; plan?: string; amount_cents?: number; currency?: string; stripe_payment_intent_id?: string | null; status?: string; starts_at?: string | null; ends_at?: string }
        Relationships: [{ foreignKeyName: 'product_boosts_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }]
      }
      disputes: {
        Row: { id: string; transaction_id: string | null; product_id: string | null; buyer_id: string; seller_id: string; opened_by: string; reason: string; details: string | null; status: string; resolution: string | null; created_at: string; updated_at: string; closed_at: string | null }
        Insert: { id?: string; transaction_id?: string | null; product_id?: string | null; buyer_id: string; seller_id: string; opened_by: string; reason: string; details?: string | null; status?: string; resolution?: string | null; created_at?: string; updated_at?: string; closed_at?: string | null }
        Update: { id?: string; transaction_id?: string | null; product_id?: string | null; buyer_id?: string; seller_id?: string; opened_by?: string; reason?: string; details?: string | null; status?: string; resolution?: string | null; created_at?: string; updated_at?: string; closed_at?: string | null }
        Relationships: []
      }
      favorites: {
        Row: { id: string; user_id: string; product_id: string; created_at: string }
        Insert: { id?: string; user_id: string; product_id: string; created_at?: string }
        Update: { id?: string; user_id?: string; product_id?: string; created_at?: string }
        Relationships: [{ foreignKeyName: 'favorites_product_id_fkey'; columns: ['product_id']; isOneToOne: false; referencedRelation: 'products'; referencedColumns: ['id'] }]
      }
      reports: {
        Row: { id: string; reporter_id: string; reported_user_id: string | null; reported_product_id: string | null; reason: string; description: string | null; status: string; created_at: string }
        Insert: { id?: string; reporter_id: string; reported_user_id?: string | null; reported_product_id?: string | null; reason: string; description?: string | null; status?: string; created_at?: string }
        Update: { id?: string; reporter_id?: string; reported_user_id?: string | null; reported_product_id?: string | null; reason?: string; description?: string | null; status?: string; created_at?: string }
        Relationships: []
      }
      reviews: {
        Row: { id: string; reviewer_id: string; reviewed_id: string | null; seller_id: string | null; product_id: string | null; transaction_id: string | null; rating: number; comment: string | null; created_at: string }
        Insert: { id?: string; reviewer_id: string; reviewed_id: string; seller_id?: string | null; product_id?: string | null; transaction_id?: string | null; rating: number; comment?: string | null; created_at?: string }
        Update: { id?: string; reviewer_id?: string; reviewed_id?: string | null; seller_id?: string | null; product_id?: string | null; transaction_id?: string | null; rating?: number; comment?: string | null; created_at?: string }
        Relationships: [
          { foreignKeyName: 'reviews_reviewed_id_fkey'; columns: ['reviewed_id']; isOneToOne: false; referencedRelation: 'profiles'; referencedColumns: ['id'] }
        ]
      }
      notifications: {
        Row: { id: string; user_id: string; type: string; title: string; message: string; data: Json | null; read: boolean | null; created_at: string }
        Insert: { id?: string; user_id: string; type: string; title: string; message: string; data?: Json | null; read?: boolean | null; created_at?: string }
        Update: { id?: string; user_id?: string; type?: string; title?: string; message?: string; data?: Json | null; read?: boolean | null; created_at?: string }
        Relationships: []
      }
      saved_searches: {
        Row: { id: string; user_id: string; name: string; query: string | null; location: string | null; radius_km: number | null; category_id: string | null; subcategory_id: string | null; min_price: number | null; max_price: number | null; condition: string | null; alerts_enabled: boolean | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; name: string; query?: string | null; location?: string | null; radius_km?: number | null; category_id?: string | null; subcategory_id?: string | null; min_price?: number | null; max_price?: number | null; condition?: string | null; alerts_enabled?: boolean | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; name?: string; query?: string | null; location?: string | null; radius_km?: number | null; category_id?: string | null; subcategory_id?: string | null; min_price?: number | null; max_price?: number | null; condition?: string | null; alerts_enabled?: boolean | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      user_settings: {
        Row: { id: string; user_id: string; email_notifications: boolean | null; push_notifications: boolean | null; message_notifications: boolean | null; offer_notifications: boolean | null; saved_search_notifications: boolean | null; allow_messages_from: string | null; show_last_seen: boolean | null; show_online_status: boolean | null; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; email_notifications?: boolean | null; push_notifications?: boolean | null; message_notifications?: boolean | null; offer_notifications?: boolean | null; saved_search_notifications?: boolean | null; allow_messages_from?: string | null; show_last_seen?: boolean | null; show_online_status?: boolean | null; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; email_notifications?: boolean | null; push_notifications?: boolean | null; message_notifications?: boolean | null; offer_notifications?: boolean | null; saved_search_notifications?: boolean | null; allow_messages_from?: string | null; show_last_seen?: boolean | null; show_online_status?: boolean | null; created_at?: string; updated_at?: string }
        Relationships: []
      }
      push_subscriptions: {
        Row: { id: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at: string; updated_at: string }
        Insert: { id?: string; user_id: string; endpoint: string; p256dh: string; auth: string; created_at?: string; updated_at?: string }
        Update: { id?: string; user_id?: string; endpoint?: string; p256dh?: string; auth?: string; created_at?: string; updated_at?: string }
        Relationships: []
      }
      user_roles: {
        Row: { id: string; user_id: string; role: AppRole; created_at: string }
        Insert: { id?: string; user_id: string; role: AppRole; created_at?: string }
        Update: { id?: string; user_id?: string; role?: AppRole; created_at?: string }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean }
    }
    Enums: {
      app_role: AppRole
    }
    CompositeTypes: Record<string, never>
  }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, 'public'>]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'] & DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Views'])[TableName] extends { Row: infer R }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema['Tables'] & DefaultSchema['Views'])
    ? (DefaultSchema['Tables'] & DefaultSchema['Views'])[DefaultSchemaTableNameOrOptions] extends { Row: infer R }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends { Insert: infer I }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Insert: infer I }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables'] | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables']
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions['schema']]['Tables'][TableName] extends { Update: infer U }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema['Tables']
    ? DefaultSchema['Tables'][DefaultSchemaTableNameOrOptions] extends { Update: infer U }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums'] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums']
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions['schema']]['Enums'][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema['Enums']
    ? DatabaseWithoutInternals['public']['Enums'][DefaultSchemaEnumNameOrOptions]
    : never
