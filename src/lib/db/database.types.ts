
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "graphql_public": {
          Tables: {
            [_ in never]: never
          }
          Views: {
            [_ in never]: never
          }
          Functions: {
            "graphql":
{ Args: { "extensions"?: Json,"operationName"?: string,"query"?: string,"variables"?: Json }; Returns: Json
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        },"public": {
          Tables: {
            "achievements": {
                  Row: {
                    "description_en": string,"description_pl": string,"id": string,"name_en": string,"name_pl": string,"sort": number
                  }
                  ComputedFields: never
                  Insert: {
                    "description_en": string,"description_pl": string,"id": string,"name_en": string,"name_pl": string,"sort"?: number
                  }
                  Update: {
                    "description_en"?: string,"description_pl"?: string,"id"?: string,"name_en"?: string,"name_pl"?: string,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"ai_grading_usage": {
                  Row: {
                    "cost_usd": number,"created_at": string,"exercise_id": string | null,"id": number,"model": string,"tokens_in": number,"tokens_out": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cost_usd": number,"created_at"?: string,"exercise_id"?: string | null,"id"?: never,"model": string,"tokens_in": number,"tokens_out": number,"user_id": string
                  }
                  Update: {
                    "cost_usd"?: number,"created_at"?: string,"exercise_id"?: string | null,"id"?: never,"model"?: string,"tokens_in"?: number,"tokens_out"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"announcements": {
                  Row: {
                    "body_en": string,"body_pl": string,"created_at": string,"created_by": string | null,"ends_at": string | null,"id": number,"starts_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body_en": string,"body_pl": string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: never,"starts_at"?: string
                  }
                  Update: {
                    "body_en"?: string,"body_pl"?: string,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string | null,"id"?: never,"starts_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"app_settings": {
                  Row: {
                    "key": string,"updated_at": string,"updated_by": string | null,"value": Json
                  }
                  ComputedFields: never
                  Insert: {
                    "key": string,"updated_at"?: string,"updated_by"?: string | null,"value": Json
                  }
                  Update: {
                    "key"?: string,"updated_at"?: string,"updated_by"?: string | null,"value"?: Json
                  }
                  Relationships: [
                    
                  ]
                },"audit_log": {
                  Row: {
                    "action": string,"actor_id": string | null,"created_at": string,"details": Json | null,"id": number,"target": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "action": string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"id"?: never,"target"?: string | null
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"created_at"?: string,"details"?: Json | null,"id"?: never,"target"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bans": {
                  Row: {
                    "banned_by": string | null,"created_at": string,"reason": string,"until": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "banned_by"?: string | null,"created_at"?: string,"reason": string,"until"?: string | null,"user_id": string
                  }
                  Update: {
                    "banned_by"?: string | null,"created_at"?: string,"reason"?: string,"until"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"bookmarks": {
                  Row: {
                    "created_at": string,"lesson_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"lesson_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"lesson_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"certificates": {
                  Row: {
                    "id": string,"issued_at": string,"score": number | null,"track_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "id"?: string,"issued_at"?: string,"score"?: number | null,"track_id": string,"user_id": string
                  }
                  Update: {
                    "id"?: string,"issued_at"?: string,"score"?: number | null,"track_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"challenge_submissions": {
                  Row: {
                    "body": string,"challenge_id": string,"created_at": string,"id": number,"status": Database["public"]['Enums']["moderation_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"challenge_id": string,"created_at"?: string,"id"?: never,"status"?: Database["public"]['Enums']["moderation_status"],"user_id": string
                  }
                  Update: {
                    "body"?: string,"challenge_id"?: string,"created_at"?: string,"id"?: never,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"comments": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"parent_id": number | null,"status": Database["public"]['Enums']["moderation_status"],"target_id": string,"target_type": string,"updated_at": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"parent_id"?: number | null,"status"?: Database["public"]['Enums']["moderation_status"],"target_id": string,"target_type": string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"parent_id"?: number | null,"status"?: Database["public"]['Enums']["moderation_status"],"target_id"?: string,"target_type"?: string,"updated_at"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "comments_parent_id_fkey"
      columns: ["parent_id"]
isOneToOne: false
      referencedRelation: "comments"
      referencedColumns: ["id"]
    }
                  ]
                },"content_error_reports": {
                  Row: {
                    "body": string,"content_id": string,"content_type": string,"created_at": string,"id": number,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["moderation_status"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"content_id": string,"content_type": string,"created_at"?: string,"id"?: never,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"content_id"?: string,"content_type"?: string,"created_at"?: string,"id"?: never,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"cron_runs": {
                  Row: {
                    "details": Json | null,"finished_at": string | null,"id": number,"job": string,"ok": boolean | null,"started_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "details"?: Json | null,"finished_at"?: string | null,"id"?: never,"job": string,"ok"?: boolean | null,"started_at"?: string
                  }
                  Update: {
                    "details"?: Json | null,"finished_at"?: string | null,"id"?: never,"job"?: string,"ok"?: boolean | null,"started_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"daily_problems": {
                  Row: {
                    "day": string,"exercise_id": string,"level": number
                  }
                  ComputedFields: never
                  Insert: {
                    "day": string,"exercise_id": string,"level": number
                  }
                  Update: {
                    "day"?: string,"exercise_id"?: string,"level"?: number
                  }
                  Relationships: [
                    
                  ]
                },"debunk_submissions": {
                  Row: {
                    "claim": string,"created_at": string,"id": number,"reviewed_by": string | null,"source_url": string | null,"status": Database["public"]['Enums']["moderation_status"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "claim": string,"created_at"?: string,"id"?: never,"reviewed_by"?: string | null,"source_url"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Update: {
                    "claim"?: string,"created_at"?: string,"id"?: never,"reviewed_by"?: string | null,"source_url"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"entitlements": {
                  Row: {
                    "created_at": string,"plan": Database["public"]['Enums']["plan"],"source": string,"user_id": string,"valid_until": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"plan": Database["public"]['Enums']["plan"],"source"?: string,"user_id": string,"valid_until"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"plan"?: Database["public"]['Enums']["plan"],"source"?: string,"user_id"?: string,"valid_until"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"exercise_attempts": {
                  Row: {
                    "answer": NonNullable<Json>,"client_attempt_id": string | null,"created_at": string,"exercise_id": string,"feedback": Json | null,"grader": Database["public"]['Enums']["grader"],"hints_used": number,"id": number,"score": number,"source": Database["public"]['Enums']["attempt_source"],"time_ms": number | null,"user_id": string,"variant_seed": number | null
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"client_attempt_id"?: string | null,"created_at"?: string,"exercise_id": string,"feedback"?: Json | null,"grader": Database["public"]['Enums']["grader"],"hints_used"?: number,"id"?: never,"score": number,"source"?: Database["public"]['Enums']["attempt_source"],"time_ms"?: number | null,"user_id": string,"variant_seed"?: number | null
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"client_attempt_id"?: string | null,"created_at"?: string,"exercise_id"?: string,"feedback"?: Json | null,"grader"?: Database["public"]['Enums']["grader"],"hints_used"?: number,"id"?: never,"score"?: number,"source"?: Database["public"]['Enums']["attempt_source"],"time_ms"?: number | null,"user_id"?: string,"variant_seed"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"exercise_stats": {
                  Row: {
                    "attempts": number,"exercise_id": string,"median_time_ms": number | null,"success_rate": number | null,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"exercise_id": string,"median_time_ms"?: number | null,"success_rate"?: number | null,"updated_at"?: string
                  }
                  Update: {
                    "attempts"?: number,"exercise_id"?: string,"median_time_ms"?: number | null,"success_rate"?: number | null,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"feature_flags": {
                  Row: {
                    "description": string | null,"enabled": boolean,"key": string,"rollout_percent": number,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "description"?: string | null,"enabled"?: boolean,"key": string,"rollout_percent"?: number,"updated_at"?: string
                  }
                  Update: {
                    "description"?: string | null,"enabled"?: boolean,"key"?: string,"rollout_percent"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"grading_disputes": {
                  Row: {
                    "attempt_id": number,"created_at": string,"id": number,"reason": string,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["moderation_status"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempt_id": number,"created_at"?: string,"id"?: never,"reason": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id": string
                  }
                  Update: {
                    "attempt_id"?: number,"created_at"?: string,"id"?: never,"reason"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "grading_disputes_attempt_id_fkey"
      columns: ["attempt_id"]
isOneToOne: false
      referencedRelation: "exercise_attempts"
      referencedColumns: ["id"]
    }
                  ]
                },"highlights": {
                  Row: {
                    "anchor": NonNullable<Json>,"created_at": string,"id": number,"lesson_id": string,"note": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "anchor": NonNullable<Json>,"created_at"?: string,"id"?: never,"lesson_id": string,"note"?: string | null,"user_id": string
                  }
                  Update: {
                    "anchor"?: NonNullable<Json>,"created_at"?: string,"id"?: never,"lesson_id"?: string,"note"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"interview_answers": {
                  Row: {
                    "answer": NonNullable<Json>,"created_at": string,"feedback": Json | null,"id": number,"question_id": string,"score": number | null,"session_id": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "answer": NonNullable<Json>,"created_at"?: string,"feedback"?: Json | null,"id"?: never,"question_id": string,"score"?: number | null,"session_id": string,"user_id": string
                  }
                  Update: {
                    "answer"?: NonNullable<Json>,"created_at"?: string,"feedback"?: Json | null,"id"?: never,"question_id"?: string,"score"?: number | null,"session_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "interview_answers_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "interview_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"interview_sessions": {
                  Row: {
                    "finished_at": string | null,"id": string,"kind": string,"level": number,"score": number | null,"started_at": string,"summary": Json | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "finished_at"?: string | null,"id"?: string,"kind": string,"level": number,"score"?: number | null,"started_at"?: string,"summary"?: Json | null,"user_id": string
                  }
                  Update: {
                    "finished_at"?: string | null,"id"?: string,"kind"?: string,"level"?: number,"score"?: number | null,"started_at"?: string,"summary"?: Json | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"league_memberships": {
                  Row: {
                    "final_rank": number | null,"group_no": number,"league_id": number,"user_id": string,"week_start": string,"weekly_xp": number
                  }
                  ComputedFields: never
                  Insert: {
                    "final_rank"?: number | null,"group_no"?: number,"league_id": number,"user_id": string,"week_start": string,"weekly_xp"?: number
                  }
                  Update: {
                    "final_rank"?: number | null,"group_no"?: number,"league_id"?: number,"user_id"?: string,"week_start"?: string,"weekly_xp"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "league_memberships_league_id_fkey"
      columns: ["league_id"]
isOneToOne: false
      referencedRelation: "leagues"
      referencedColumns: ["id"]
    }
                  ]
                },"leagues": {
                  Row: {
                    "id": number,"name_en": string,"name_pl": string,"slug": string,"tier": number
                  }
                  ComputedFields: never
                  Insert: {
                    "id": number,"name_en": string,"name_pl": string,"slug": string,"tier": number
                  }
                  Update: {
                    "id"?: number,"name_en"?: string,"name_pl"?: string,"slug"?: string,"tier"?: number
                  }
                  Relationships: [
                    
                  ]
                },"lesson_notes": {
                  Row: {
                    "body": string,"created_at": string,"id": number,"lesson_id": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"id"?: never,"lesson_id": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"id"?: never,"lesson_id"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"lesson_progress": {
                  Row: {
                    "completed_at": string | null,"last_position": Json | null,"lesson_id": string,"status": Database["public"]['Enums']["lesson_status"],"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "completed_at"?: string | null,"last_position"?: Json | null,"lesson_id": string,"status"?: Database["public"]['Enums']["lesson_status"],"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "completed_at"?: string | null,"last_position"?: Json | null,"lesson_id"?: string,"status"?: Database["public"]['Enums']["lesson_status"],"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"newsletter_subscribers": {
                  Row: {
                    "confirm_token": string,"confirmed_at": string | null,"created_at": string,"email": string,"id": number,"locale": string,"unsubscribed_at": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "confirm_token"?: string,"confirmed_at"?: string | null,"created_at"?: string,"email": string,"id"?: never,"locale"?: string,"unsubscribed_at"?: string | null
                  }
                  Update: {
                    "confirm_token"?: string,"confirmed_at"?: string | null,"created_at"?: string,"email"?: string,"id"?: never,"locale"?: string,"unsubscribed_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"notebooks": {
                  Row: {
                    "cells": NonNullable<Json>,"created_at": string,"id": string,"title": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "cells"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "cells"?: NonNullable<Json>,"created_at"?: string,"id"?: string,"title"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notification_prefs": {
                  Row: {
                    "email_league": boolean,"email_streak": boolean,"email_weekly": boolean,"push_enabled": boolean,"quiet_end": string | null,"quiet_start": string | null,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "email_league"?: boolean,"email_streak"?: boolean,"email_weekly"?: boolean,"push_enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "email_league"?: boolean,"email_streak"?: boolean,"email_weekly"?: boolean,"push_enabled"?: boolean,"quiet_end"?: string | null,"quiet_start"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"payload": NonNullable<Json>,"read_at": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind": string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"payload"?: NonNullable<Json>,"read_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"daily_goal_minutes": number,"display_name": string | null,"goal": string | null,"handle": string,"id": string,"is_public": boolean,"league_opt_out": boolean,"locale": string,"onboarded_at": string | null,"placement_level": number | null,"self_level": number | null,"timezone": string,"updated_at": string
                  }
                  ComputedFields: never
                  Insert: {
                    "avatar_url"?: string | null,"created_at"?: string,"daily_goal_minutes"?: number,"display_name"?: string | null,"goal"?: string | null,"handle": string,"id": string,"is_public"?: boolean,"league_opt_out"?: boolean,"locale"?: string,"onboarded_at"?: string | null,"placement_level"?: number | null,"self_level"?: number | null,"timezone"?: string,"updated_at"?: string
                  }
                  Update: {
                    "avatar_url"?: string | null,"created_at"?: string,"daily_goal_minutes"?: number,"display_name"?: string | null,"goal"?: string | null,"handle"?: string,"id"?: string,"is_public"?: boolean,"league_opt_out"?: boolean,"locale"?: string,"onboarded_at"?: string | null,"placement_level"?: number | null,"self_level"?: number | null,"timezone"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"push_subscriptions": {
                  Row: {
                    "auth": string,"created_at": string,"endpoint": string,"id": number,"p256dh": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "auth": string,"created_at"?: string,"endpoint": string,"id"?: never,"p256dh": string,"user_id": string
                  }
                  Update: {
                    "auth"?: string,"created_at"?: string,"endpoint"?: string,"id"?: never,"p256dh"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"reports": {
                  Row: {
                    "created_at": string,"id": number,"reason": string,"resolved_at": string | null,"resolved_by": string | null,"status": Database["public"]['Enums']["moderation_status"],"target_id": string,"target_type": string,"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"id"?: never,"reason": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"target_id": string,"target_type": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"reason"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: Database["public"]['Enums']["moderation_status"],"target_id"?: string,"target_type"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"review_cards": {
                  Row: {
                    "card_id": string,"difficulty": number,"due": string,"elapsed_days": number,"lapses": number,"last_review": string | null,"reps": number,"scheduled_days": number,"stability": number,"state": number,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "card_id": string,"difficulty"?: number,"due"?: string,"elapsed_days"?: number,"lapses"?: number,"last_review"?: string | null,"reps"?: number,"scheduled_days"?: number,"stability"?: number,"state"?: number,"user_id": string
                  }
                  Update: {
                    "card_id"?: string,"difficulty"?: number,"due"?: string,"elapsed_days"?: number,"lapses"?: number,"last_review"?: string | null,"reps"?: number,"scheduled_days"?: number,"stability"?: number,"state"?: number,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"shared_solutions": {
                  Row: {
                    "body": string,"created_at": string,"exercise_id": string,"format": string,"id": number,"mentor_pick": boolean,"status": Database["public"]['Enums']["moderation_status"],"user_id": string | null
                  }
                  ComputedFields: never
                  Insert: {
                    "body": string,"created_at"?: string,"exercise_id": string,"format": string,"id"?: never,"mentor_pick"?: boolean,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Update: {
                    "body"?: string,"created_at"?: string,"exercise_id"?: string,"format"?: string,"id"?: never,"mentor_pick"?: boolean,"status"?: Database["public"]['Enums']["moderation_status"],"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"streaks": {
                  Row: {
                    "current_days": number,"freezes": number,"last_active_date": string | null,"longest_days": number,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "current_days"?: number,"freezes"?: number,"last_active_date"?: string | null,"longest_days"?: number,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "current_days"?: number,"freezes"?: number,"last_active_date"?: string | null,"longest_days"?: number,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"topic_ratings": {
                  Row: {
                    "attempts": number,"rating": number,"topic": string,"updated_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "attempts"?: number,"rating"?: number,"topic": string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "attempts"?: number,"rating"?: number,"topic"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"user_achievements": {
                  Row: {
                    "achievement_id": string,"earned_at": string,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "achievement_id": string,"earned_at"?: string,"user_id": string
                  }
                  Update: {
                    "achievement_id"?: string,"earned_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "user_achievements_achievement_id_fkey"
      columns: ["achievement_id"]
isOneToOne: false
      referencedRelation: "achievements"
      referencedColumns: ["id"]
    }
                  ]
                },"user_roles": {
                  Row: {
                    "granted_at": string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "granted_at"?: string,"role": Database["public"]['Enums']["app_role"],"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"role"?: Database["public"]['Enums']["app_role"],"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"votes": {
                  Row: {
                    "created_at": string,"target_id": number,"target_type": string,"user_id": string,"value": number
                  }
                  ComputedFields: never
                  Insert: {
                    "created_at"?: string,"target_id": number,"target_type": string,"user_id": string,"value": number
                  }
                  Update: {
                    "created_at"?: string,"target_id"?: number,"target_type"?: string,"user_id"?: string,"value"?: number
                  }
                  Relationships: [
                    
                  ]
                },"xp_events": {
                  Row: {
                    "amount": number,"created_at": string,"id": number,"idempotency_key": string,"reason": string,"ref": string | null,"user_id": string
                  }
                  ComputedFields: never
                  Insert: {
                    "amount": number,"created_at"?: string,"id"?: never,"idempotency_key": string,"reason": string,"ref"?: string | null,"user_id": string
                  }
                  Update: {
                    "amount"?: number,"created_at"?: string,"id"?: never,"idempotency_key"?: string,"reason"?: string,"ref"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Views: {
            "public_profiles": {
                  Row: {
                    "avatar_url": string | null,"created_at": string,"display_name": string | null,"handle": string,"id": string,"placement_level": number | null
                  }
                  ComputedFields: never
                  Insert: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"placement_level"?: number | null
                         }
                        Update: {
                           "avatar_url"?: string | null,"created_at"?: string | null,"display_name"?: string | null,"handle"?: string | null,"id"?: string | null,"placement_level"?: number | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "admin_ai_costs":
{ Args: { "from_day": string,"to_day": string }; Returns: Json
                           },
"admin_exercise_analytics":
{ Args: { "ex": string }; Returns: Json
                           },
"admin_export_user":
{ Args: { "target": string }; Returns: Json
                           },
"admin_find_users":
{ Args: { "q": string }; Returns: {
              "banned": boolean,"created_at": string,"display_name": string,"email": string,"handle": string,"id": string,"last_sign_in_at": string,"roles": string
            }[]
                           },
"admin_metrics":
{ Args: { "from_day": string,"to_day": string }; Returns: {
              "active_users": number,"attempts": number,"day": string,"lessons_completed": number,"signups": number,"wau": number
            }[]
                           },
"admin_retention":
{ Args: { "weeks": number }; Returns: {
              "active": number,"cohort": string,"size": number,"week": number
            }[]
                           },
"discussion_unlocked":
{ Args: { "exercise_id": string }; Returns: boolean
                           },
"export_my_data":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"has_role":
{ Args: { "r": Database["public"]['Enums']["app_role"] }; Returns: boolean
                           },
"in_my_league_group":
{ Args: { "g": number,"l": number,"w": string }; Returns: boolean
                           },
"is_banned":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_staff":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"reputation":
{ Args: { "uid": string }; Returns: number
                           },
"verify_certificate":
{ Args: { "certificate_id": string }; Returns: {
              "display_name": string,"handle": string,"issued_at": string,"track_id": string
            }[]
                           },
"vote_totals":
{ Args: { "ids": (number)[],"target_type": string }; Returns: {
              "target_id": number,"total": number
            }[]
                           }
          }
          Enums: {
            "app_role": "admin"|"moderator"|"reviewer","attempt_source": "app"|"anonymous_import","grader": "auto"|"ai"|"self","lesson_status": "not_started"|"in_progress"|"completed"|"mastered","moderation_status": "pending"|"approved"|"rejected"|"hidden","plan": "free"|"pro"
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
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
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "graphql_public": {
          Enums: {
            
          }
        },"public": {
          Enums: {
            "app_role": ["admin", "moderator", "reviewer"],"attempt_source": ["app", "anonymous_import"],"grader": ["auto", "ai", "self"],"lesson_status": ["not_started", "in_progress", "completed", "mastered"],"moderation_status": ["pending", "approved", "rejected", "hidden"],"plan": ["free", "pro"]
          }
        }
} as const
