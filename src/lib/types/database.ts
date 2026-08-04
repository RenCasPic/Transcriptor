// Tipos de la base de datos Supabase.
// Reflejan las migraciones en supabase/migrations. Si se regeneran automáticamente
// con `supabase gen types typescript`, este archivo puede ser reemplazado sin romper
// el resto de la aplicación porque solo se consume a través de los alias de dominio
// definidos en `src/lib/types/domain.ts`.
//
// El campo `Relationships: []` en cada tabla y las claves `Views`/`Functions`/`Enums`/
// `CompositeTypes` (aunque vacías) son requeridos por el tipo `GenericSchema` de
// @supabase/postgrest-js: sin ellos, TypeScript no puede resolver `Database['public']`
// como un `GenericSchema` válido y todas las filas colapsan a `never`.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type WorkspaceRole = 'owner' | 'admin' | 'editor' | 'viewer';

export type ProjectStatus = 'draft' | 'processing' | 'review' | 'ready' | 'published' | 'failed';

export type ContentType =
  | 'tutorial'
  | 'guide'
  | 'list'
  | 'interview'
  | 'summary'
  | 'case_study'
  | 'opinion'
  | 'qa';

export type ArticleTone =
  | 'professional'
  | 'educational'
  | 'conversational'
  | 'persuasive'
  | 'technical'
  | 'friendly';

export type MediaSourceType = 'manual' | 'txt' | 'srt' | 'vtt' | 'audio' | 'video' | 'youtube';

export type TranscriptStatus = 'pending' | 'processing' | 'ready' | 'failed';

export type DocumentStatus = 'draft' | 'in_review' | 'approved';

export type WarningType =
  | 'unsupported_claim'
  | 'number_verification'
  | 'name_verification'
  | 'date_verification'
  | 'possible_hallucination'
  | 'missing_source';

export type WarningStatus = 'open' | 'reviewed' | 'resolved' | 'dismissed';

export type GenerationJobType =
  | 'generate_article'
  | 'rewrite_section'
  | 'generate_seo'
  | 'transcribe';

export type GenerationJobStatus = 'queued' | 'processing' | 'completed' | 'failed';

export type IntegrationProvider = 'wordpress' | 'webflow' | 'ghost' | 'youtube';

export type IntegrationStatus = 'disconnected' | 'connected' | 'error';

export interface Database {
  __InternalSupabase: {
    PostgrestVersion: '12';
  };
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          full_name?: string | null;
          avatar_url?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>;
        Relationships: [];
      };
      workspaces: {
        Row: {
          id: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          owner_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspaces']['Insert']>;
        Relationships: [];
      };
      workspace_members: {
        Row: {
          id: string;
          workspace_id: string;
          user_id: string;
          role: WorkspaceRole;
          created_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          user_id: string;
          role?: WorkspaceRole;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['workspace_members']['Insert']>;
        Relationships: [];
      };
      projects: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          name: string;
          provisional_title: string | null;
          content_type: ContentType;
          audience: string | null;
          tone: ArticleTone;
          language: string;
          primary_keyword: string | null;
          objective: string | null;
          call_to_action: string | null;
          status: ProjectStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by: string;
          name: string;
          provisional_title?: string | null;
          content_type: ContentType;
          audience?: string | null;
          tone?: ArticleTone;
          language?: string;
          primary_keyword?: string | null;
          objective?: string | null;
          call_to_action?: string | null;
          status?: ProjectStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['projects']['Insert']>;
        Relationships: [];
      };
      media_sources: {
        Row: {
          id: string;
          project_id: string;
          source_type: MediaSourceType;
          original_filename: string | null;
          storage_path: string | null;
          source_url: string | null;
          duration_seconds: number | null;
          metadata: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_type: MediaSourceType;
          original_filename?: string | null;
          storage_path?: string | null;
          source_url?: string | null;
          duration_seconds?: number | null;
          metadata?: Json;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['media_sources']['Insert']>;
        Relationships: [];
      };
      transcripts: {
        Row: {
          id: string;
          project_id: string;
          source_id: string | null;
          language: string;
          full_text: string;
          status: TranscriptStatus;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          source_id?: string | null;
          language?: string;
          full_text: string;
          status?: TranscriptStatus;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transcripts']['Insert']>;
        Relationships: [];
      };
      transcript_segments: {
        Row: {
          id: string;
          transcript_id: string;
          segment_index: number;
          speaker: string | null;
          start_seconds: number | null;
          end_seconds: number | null;
          text: string;
          confidence: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          transcript_id: string;
          segment_index: number;
          speaker?: string | null;
          start_seconds?: number | null;
          end_seconds?: number | null;
          text: string;
          confidence?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['transcript_segments']['Insert']>;
        Relationships: [];
      };
      content_documents: {
        Row: {
          id: string;
          project_id: string;
          title: string;
          excerpt: string | null;
          content_json: Json;
          content_html: string;
          content_markdown: string;
          status: DocumentStatus;
          word_count: number;
          reading_time_minutes: number;
          version: number;
          is_public: boolean;
          published_at: string | null;
          cover_image_url: string | null;
          cover_image_alt: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          title: string;
          excerpt?: string | null;
          content_json?: Json;
          content_html?: string;
          content_markdown?: string;
          status?: DocumentStatus;
          word_count?: number;
          reading_time_minutes?: number;
          version?: number;
          is_public?: boolean;
          published_at?: string | null;
          cover_image_url?: string | null;
          cover_image_alt?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['content_documents']['Insert']>;
        Relationships: [];
      };
      document_versions: {
        Row: {
          id: string;
          document_id: string;
          created_by: string | null;
          version_number: number;
          title: string;
          content_json: Json;
          content_html: string;
          reason: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          created_by?: string | null;
          version_number: number;
          title: string;
          content_json?: Json;
          content_html?: string;
          reason: string;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['document_versions']['Insert']>;
        Relationships: [];
      };
      content_source_links: {
        Row: {
          id: string;
          document_id: string;
          block_id: string;
          transcript_segment_id: string;
          relevance_score: number | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          block_id: string;
          transcript_segment_id: string;
          relevance_score?: number | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['content_source_links']['Insert']>;
        Relationships: [];
      };
      content_warnings: {
        Row: {
          id: string;
          document_id: string;
          block_id: string | null;
          warning_type: WarningType;
          message: string;
          status: WarningStatus;
          metadata: Json;
          created_at: string;
          resolved_at: string | null;
          resolved_by: string | null;
        };
        Insert: {
          id?: string;
          document_id: string;
          block_id?: string | null;
          warning_type: WarningType;
          message: string;
          status?: WarningStatus;
          metadata?: Json;
          created_at?: string;
          resolved_at?: string | null;
          resolved_by?: string | null;
        };
        Update: Partial<Database['public']['Tables']['content_warnings']['Insert']>;
        Relationships: [];
      };
      seo_metadata: {
        Row: {
          id: string;
          document_id: string;
          seo_title: string | null;
          slug: string | null;
          meta_description: string | null;
          primary_keyword: string | null;
          secondary_keywords: string[];
          structured_data: Json;
          updated_at: string;
        };
        Insert: {
          id?: string;
          document_id: string;
          seo_title?: string | null;
          slug?: string | null;
          meta_description?: string | null;
          primary_keyword?: string | null;
          secondary_keywords?: string[];
          structured_data?: Json;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['seo_metadata']['Insert']>;
        Relationships: [];
      };
      generation_jobs: {
        Row: {
          id: string;
          project_id: string;
          job_type: GenerationJobType;
          status: GenerationJobStatus;
          progress: number;
          input: Json;
          output: Json | null;
          error_message: string | null;
          started_at: string | null;
          completed_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          job_type: GenerationJobType;
          status?: GenerationJobStatus;
          progress?: number;
          input?: Json;
          output?: Json | null;
          error_message?: string | null;
          started_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
        };
        Update: Partial<Database['public']['Tables']['generation_jobs']['Insert']>;
        Relationships: [];
      };
      integrations: {
        Row: {
          id: string;
          workspace_id: string;
          provider: IntegrationProvider;
          status: IntegrationStatus;
          encrypted_credentials: string | null;
          metadata: Json;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          provider: IntegrationProvider;
          status?: IntegrationStatus;
          encrypted_credentials?: string | null;
          metadata?: Json;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['integrations']['Insert']>;
        Relationships: [];
      };
      project_templates: {
        Row: {
          id: string;
          workspace_id: string;
          created_by: string;
          name: string;
          content_type: ContentType;
          audience: string | null;
          tone: ArticleTone;
          language: string;
          primary_keyword: string | null;
          objective: string | null;
          call_to_action: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          workspace_id: string;
          created_by: string;
          name: string;
          content_type: ContentType;
          audience?: string | null;
          tone?: ArticleTone;
          language?: string;
          primary_keyword?: string | null;
          objective?: string | null;
          call_to_action?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: Partial<Database['public']['Tables']['project_templates']['Insert']>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
