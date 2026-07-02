// Shared TypeScript types — the contract the UI codes against (PRD §4.4).
// These mirror the database tables in supabase/migrations/.

export type Condition = 'new' | 'like_new' | 'good' | 'fair' | 'used';
export type Category = 'furniture' | 'apparel' | 'electronics' | 'books' | 'other';
export type ListingStatus = 'active' | 'sold' | 'deleted';

export interface Profile {
  uid: string;
  full_name: string;
  email: string;
  class_year: number | null;
  major: string | null;
  campus_region: string | null;
  campus: string;
  avatar_url: string | null;
  rating: number;
  rating_count: number;
}

export interface ListingImage {
  id: string;
  listing_id: string;
  image_url: string;
  position: number;
}

export interface Listing {
  id: string;
  offering_uid: string;
  title: string;
  description: string;
  price_cents: number; // format with lib/format.ts → "$45"
  condition: Condition;
  category: Category;
  region_id: string | null;
  campus: string;
  thumbnail_url: string | null;
  status: ListingStatus;
  created_at: string;
  updated_at: string;
  listing_images?: ListingImage[];
  seller?: Profile; // joined where needed
}

export interface Conversation {
  id: string;
  listing_id: string | null;
  listing_title: string | null;
  listing_thumbnail_url: string | null;
  other_participant_uid: string;
  other_participant_name: string;
  other_participant_avatar_url: string | null;
  last_message: string | null;
  last_message_at: string | null;
  unread_count: number;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_uid: string;
  content: string;
  read_at: string | null;
  created_at: string;
}
