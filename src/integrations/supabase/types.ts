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
      audit_log: {
        Row: {
          action: string
          changes: Json
          created_at: string
          entity_id: string
          entity_type: string
          id: string
          user_id: string | null
        }
        Insert: {
          action: string
          changes?: Json
          created_at?: string
          entity_id: string
          entity_type: string
          id?: string
          user_id?: string | null
        }
        Update: {
          action?: string
          changes?: Json
          created_at?: string
          entity_id?: string
          entity_type?: string
          id?: string
          user_id?: string | null
        }
        Relationships: []
      }
      auth_rate_limits: {
        Row: {
          attempt_count: number
          email: string
          first_attempt_at: string
          locked_until: string | null
          updated_at: string
        }
        Insert: {
          attempt_count?: number
          email: string
          first_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Update: {
          attempt_count?: number
          email?: string
          first_attempt_at?: string
          locked_until?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      class_schedules: {
        Row: {
          course_offering_id: string
          created_at: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id: string
          room: string
          start_time: string
          updated_at: string
        }
        Insert: {
          course_offering_id: string
          created_at?: string
          day_of_week: Database["public"]["Enums"]["day_of_week"]
          end_time: string
          id?: string
          room: string
          start_time: string
          updated_at?: string
        }
        Update: {
          course_offering_id?: string
          created_at?: string
          day_of_week?: Database["public"]["Enums"]["day_of_week"]
          end_time?: string
          id?: string
          room?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "class_schedules_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      course_materials: {
        Row: {
          course_id: string
          course_offering_id: string | null
          created_at: string
          deleted_at: string | null
          description: string | null
          file_size_bytes: number
          id: string
          mime_type: string
          storage_bucket: string
          storage_path: string
          title: string
          updated_at: string
          uploaded_by_user_id: string | null
        }
        Insert: {
          course_id: string
          course_offering_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_size_bytes: number
          id?: string
          mime_type: string
          storage_bucket?: string
          storage_path: string
          title: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Update: {
          course_id?: string
          course_offering_id?: string | null
          created_at?: string
          deleted_at?: string | null
          description?: string | null
          file_size_bytes?: number
          id?: string
          mime_type?: string
          storage_bucket?: string
          storage_path?: string
          title?: string
          updated_at?: string
          uploaded_by_user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "course_materials_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_materials_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      course_offerings: {
        Row: {
          capacity: number
          course_id: string
          created_at: string
          id: string
          instructor_user_id: string | null
          section: string
          semester_id: string
          updated_at: string
        }
        Insert: {
          capacity: number
          course_id: string
          created_at?: string
          id?: string
          instructor_user_id?: string | null
          section?: string
          semester_id: string
          updated_at?: string
        }
        Update: {
          capacity?: number
          course_id?: string
          created_at?: string
          id?: string
          instructor_user_id?: string | null
          section?: string
          semester_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_offerings_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "course_offerings_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          code: string
          course_type: Database["public"]["Enums"]["course_type"]
          created_at: string
          credits: number
          deleted_at: string | null
          department_id: string
          id: string
          prerequisite_course_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          code: string
          course_type: Database["public"]["Enums"]["course_type"]
          created_at?: string
          credits: number
          deleted_at?: string | null
          department_id: string
          id?: string
          prerequisite_course_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          code?: string
          course_type?: Database["public"]["Enums"]["course_type"]
          created_at?: string
          credits?: number
          deleted_at?: string | null
          department_id?: string
          id?: string
          prerequisite_course_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "courses_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "courses_prerequisite_course_id_fkey"
            columns: ["prerequisite_course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          code: string
          created_at: string
          head_user_id: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          code: string
          created_at?: string
          head_user_id?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          code?: string
          created_at?: string
          head_user_id?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      enrollments: {
        Row: {
          course_offering_id: string
          created_at: string
          enrolled_at: string
          id: string
          status: Database["public"]["Enums"]["enrollment_status"]
          student_user_id: string
          updated_at: string
        }
        Insert: {
          course_offering_id: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_user_id: string
          updated_at?: string
        }
        Update: {
          course_offering_id?: string
          created_at?: string
          enrolled_at?: string
          id?: string
          status?: Database["public"]["Enums"]["enrollment_status"]
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["user_id"]
          },
        ]
      }
      grade_scale: {
        Row: {
          created_at: string
          grade_point: number | null
          is_fail: boolean
          letter: string
          max_percent: number | null
          min_percent: number | null
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          grade_point?: number | null
          is_fail?: boolean
          letter: string
          max_percent?: number | null
          min_percent?: number | null
          sort_order: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          grade_point?: number | null
          is_fail?: boolean
          letter?: string
          max_percent?: number | null
          min_percent?: number | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
      grades: {
        Row: {
          created_at: string
          enrollment_id: string
          is_fail: boolean
          is_incomplete: boolean
          letter_grade: string
          published_at: string | null
          published_by_user_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          is_fail?: boolean
          is_incomplete?: boolean
          letter_grade: string
          published_at?: string | null
          published_by_user_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          is_fail?: boolean
          is_incomplete?: boolean
          letter_grade?: string
          published_at?: string | null
          published_by_user_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "grades_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: true
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "grades_letter_grade_fkey"
            columns: ["letter_grade"]
            isOneToOne: false
            referencedRelation: "grade_scale"
            referencedColumns: ["letter"]
          },
        ]
      }
      lab_projects: {
        Row: {
          course_offering_id: string
          created_at: string
          description: string | null
          due_at: string
          id: string
          max_score: number
          title: string
          updated_at: string
        }
        Insert: {
          course_offering_id: string
          created_at?: string
          description?: string | null
          due_at: string
          id?: string
          max_score: number
          title: string
          updated_at?: string
        }
        Update: {
          course_offering_id?: string
          created_at?: string
          description?: string | null
          due_at?: string
          id?: string
          max_score?: number
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_projects_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_submissions: {
        Row: {
          created_at: string
          file_size_bytes: number
          id: string
          lab_project_id: string
          mime_type: string
          score: number | null
          storage_bucket: string
          storage_path: string
          student_user_id: string
          submitted_at: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          file_size_bytes: number
          id?: string
          lab_project_id: string
          mime_type: string
          score?: number | null
          storage_bucket?: string
          storage_path: string
          student_user_id: string
          submitted_at?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          file_size_bytes?: number
          id?: string
          lab_project_id?: string
          mime_type?: string
          score?: number | null
          storage_bucket?: string
          storage_path?: string
          student_user_id?: string
          submitted_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lab_submissions_lab_project_id_fkey"
            columns: ["lab_project_id"]
            isOneToOne: false
            referencedRelation: "lab_projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_submissions_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["user_id"]
          },
        ]
      }
      mfa_totp_secrets: {
        Row: {
          backup_codes: string[]
          created_at: string
          enabled: boolean
          secret: string
          updated_at: string
          user_id: string
          verified_at: string | null
        }
        Insert: {
          backup_codes?: string[]
          created_at?: string
          enabled?: boolean
          secret: string
          updated_at?: string
          user_id: string
          verified_at?: string | null
        }
        Update: {
          backup_codes?: string[]
          created_at?: string
          enabled?: boolean
          secret?: string
          updated_at?: string
          user_id?: string
          verified_at?: string | null
        }
        Relationships: []
      }
      notices: {
        Row: {
          body: string
          created_at: string
          deleted_at: string | null
          id: string
          is_pinned: boolean
          published_at: string
          published_by_user_id: string | null
          target_department_id: string | null
          target_semester_id: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string
          published_by_user_id?: string | null
          target_department_id?: string | null
          target_semester_id?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string
          created_at?: string
          deleted_at?: string | null
          id?: string
          is_pinned?: boolean
          published_at?: string
          published_by_user_id?: string | null
          target_department_id?: string | null
          target_semester_id?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "notices_target_department_id_fkey"
            columns: ["target_department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notices_target_semester_id_fkey"
            columns: ["target_semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string
          created_at: string
          id: string
          is_read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          is_read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      password_reset_tokens: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          token_hash: string
          used_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          token_hash: string
          used_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          token_hash?: string
          used_at?: string | null
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_due: number
          amount_paid: number
          created_at: string
          due_date: string
          id: string
          semester_id: string
          status: Database["public"]["Enums"]["payment_status"]
          student_user_id: string
          transaction_ref: string | null
          updated_at: string
        }
        Insert: {
          amount_due: number
          amount_paid?: number
          created_at?: string
          due_date: string
          id?: string
          semester_id: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_user_id: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Update: {
          amount_due?: number
          amount_paid?: number
          created_at?: string
          due_date?: string
          id?: string
          semester_id?: string
          status?: Database["public"]["Enums"]["payment_status"]
          student_user_id?: string
          transaction_ref?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payments_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["user_id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          full_name: string | null
          id: string
          is_active: boolean
          photo_url: string | null
          student_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id: string
          is_active?: boolean
          photo_url?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          full_name?: string | null
          id?: string
          is_active?: boolean
          photo_url?: string | null
          student_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      programs: {
        Row: {
          created_at: string
          department_id: string
          id: string
          name: string
          total_credits_required: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          department_id: string
          id?: string
          name: string
          total_credits_required: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          department_id?: string
          id?: string
          name?: string
          total_credits_required?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "programs_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          course_offering_id: string
          created_at: string
          decided_at: string | null
          decided_by_user_id: string | null
          id: string
          requested_at: string
          status: Database["public"]["Enums"]["registration_status"]
          student_user_id: string
          updated_at: string
        }
        Insert: {
          course_offering_id: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_user_id: string
          updated_at?: string
        }
        Update: {
          course_offering_id?: string
          created_at?: string
          decided_at?: string | null
          decided_by_user_id?: string | null
          id?: string
          requested_at?: string
          status?: Database["public"]["Enums"]["registration_status"]
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "registrations_course_offering_id_fkey"
            columns: ["course_offering_id"]
            isOneToOne: false
            referencedRelation: "course_offerings"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["user_id"]
          },
        ]
      }
      semester_results: {
        Row: {
          blocked_reason: string | null
          calculated_at: string
          created_at: string
          id: string
          semester_id: string
          sgpa: number | null
          status: Database["public"]["Enums"]["semester_result_status"]
          student_user_id: string
          updated_at: string
        }
        Insert: {
          blocked_reason?: string | null
          calculated_at?: string
          created_at?: string
          id?: string
          semester_id: string
          sgpa?: number | null
          status?: Database["public"]["Enums"]["semester_result_status"]
          student_user_id: string
          updated_at?: string
        }
        Update: {
          blocked_reason?: string | null
          calculated_at?: string
          created_at?: string
          id?: string
          semester_id?: string
          sgpa?: number | null
          status?: Database["public"]["Enums"]["semester_result_status"]
          student_user_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "semester_results_semester_id_fkey"
            columns: ["semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "semester_results_student_user_id_fkey"
            columns: ["student_user_id"]
            isOneToOne: false
            referencedRelation: "students"
            referencedColumns: ["user_id"]
          },
        ]
      }
      semesters: {
        Row: {
          created_at: string
          id: string
          is_current: boolean
          name: string
          registration_closes_at: string | null
          registration_opens_at: string | null
          term: Database["public"]["Enums"]["semester_term"]
          updated_at: string
          year: number
        }
        Insert: {
          created_at?: string
          id?: string
          is_current?: boolean
          name: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          term: Database["public"]["Enums"]["semester_term"]
          updated_at?: string
          year: number
        }
        Update: {
          created_at?: string
          id?: string
          is_current?: boolean
          name?: string
          registration_closes_at?: string | null
          registration_opens_at?: string | null
          term?: Database["public"]["Enums"]["semester_term"]
          updated_at?: string
          year?: number
        }
        Relationships: []
      }
      students: {
        Row: {
          admission_semester_id: string
          created_at: string
          current_semester_id: string | null
          deleted_at: string | null
          department_id: string
          full_name: string
          photo_url: string | null
          program_id: string
          status: Database["public"]["Enums"]["student_status"]
          student_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admission_semester_id: string
          created_at?: string
          current_semester_id?: string | null
          deleted_at?: string | null
          department_id: string
          full_name: string
          photo_url?: string | null
          program_id: string
          status?: Database["public"]["Enums"]["student_status"]
          student_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admission_semester_id?: string
          created_at?: string
          current_semester_id?: string | null
          deleted_at?: string | null
          department_id?: string
          full_name?: string
          photo_url?: string | null
          program_id?: string
          status?: Database["public"]["Enums"]["student_status"]
          student_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "students_admission_semester_id_fkey"
            columns: ["admission_semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_current_semester_id_fkey"
            columns: ["current_semester_id"]
            isOneToOne: false
            referencedRelation: "semesters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_department_id_fkey"
            columns: ["department_id"]
            isOneToOne: false
            referencedRelation: "departments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "students_program_id_fkey"
            columns: ["program_id"]
            isOneToOne: false
            referencedRelation: "programs"
            referencedColumns: ["id"]
          },
        ]
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
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_department_head_of: {
        Args: { _department_code: string; _user_id: string }
        Returns: boolean
      }
      owns_enrollment: {
        Args: { _enrollment_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "department_head" | "admin" | "registrar"
      course_type: "THEORY" | "SESSIONAL"
      day_of_week: "SUN" | "MON" | "TUE" | "WED" | "THU" | "FRI" | "SAT"
      enrollment_status: "ENROLLED" | "DROPPED" | "COMPLETED" | "RETAKE"
      payment_status: "PAID" | "PARTIAL" | "OVERDUE"
      registration_status: "PENDING" | "APPROVED" | "REJECTED"
      semester_result_status: "GENERATED" | "BLOCKED"
      semester_term: "SPRING" | "SUMMER" | "FALL"
      student_status:
        | "ACTIVE"
        | "PROBATION"
        | "GRADUATED"
        | "SUSPENDED"
        | "DISMISSED"
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
      app_role: ["student", "department_head", "admin", "registrar"],
      course_type: ["THEORY", "SESSIONAL"],
      day_of_week: ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"],
      enrollment_status: ["ENROLLED", "DROPPED", "COMPLETED", "RETAKE"],
      payment_status: ["PAID", "PARTIAL", "OVERDUE"],
      registration_status: ["PENDING", "APPROVED", "REJECTED"],
      semester_result_status: ["GENERATED", "BLOCKED"],
      semester_term: ["SPRING", "SUMMER", "FALL"],
      student_status: [
        "ACTIVE",
        "PROBATION",
        "GRADUATED",
        "SUSPENDED",
        "DISMISSED",
      ],
    },
  },
} as const
