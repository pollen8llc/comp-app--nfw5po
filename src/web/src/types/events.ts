import { Member } from './members';

/**
 * Supported event integration platforms
 */
export enum EventPlatform {
  LUMA = 'LUMA',
  EVENTBRITE = 'EVENTBRITE',
  PARTIFUL = 'PARTIFUL'
}

/**
 * Event metadata containing additional event properties
 * @property tags - Key-value pairs for event categorization
 * @property categories - List of event categories
 * @property capacity - Maximum number of participants
 * @property is_private - Privacy status of the event
 */
export interface EventMetadata {
  tags: Record<string, string>;
  categories: string[];
  capacity: number;
  is_private: boolean;
}

/**
 * Core event data structure
 * @property id - Unique event identifier
 * @property title - Event title/name
 * @property description - Optional event description
 * @property start_date - Event start date and time
 * @property end_date - Event end date and time
 * @property location - Event location (physical or virtual)
 * @property platform - Source platform for the event
 * @property external_id - Platform-specific identifier
 * @property metadata - Additional event properties
 * @property participants - List of participant member IDs
 * @property created_at - Event creation timestamp
 * @property updated_at - Latest update timestamp
 */
export interface Event {
  id: string;
  title: string;
  description?: string;
  start_date: Date;
  end_date: Date;
  location: string;
  platform: EventPlatform;
  external_id?: string;
  metadata: EventMetadata;
  participants: string[];
  created_at: Date;
  updated_at: Date;
}

/**
 * Input type for event creation
 * Omits system-generated fields like id, timestamps
 */
export type CreateEventInput = Omit<
  Event,
  'id' | 'platform' | 'external_id' | 'participants' | 'created_at' | 'updated_at'
>;

/**
 * Configuration for event platform import
 * @property platform - Target platform to import from
 * @property api_key - Authentication key for the platform
 * @property start_date - Import range start date
 * @property end_date - Import range end date
 */
export interface ImportEventsInput {
  platform: EventPlatform;
  api_key: string;
  start_date: Date;
  end_date: Date;
}

/**
 * Event participation record linking members to events
 * @property event_id - Associated event identifier
 * @property member_id - Participating member identifier
 * @property role - Participation role (e.g., attendee, organizer)
 * @property joined_at - Participation timestamp
 */
export interface EventParticipation {
  event_id: string;
  member_id: string;
  role: string;
  joined_at: Date;
}

/**
 * Props interface for event card component
 * @property event - Event data to display
 * @property onClick - Click handler for the card
 * @property isSelected - Selection state of the card
 */
export interface EventCardProps {
  event: Event;
  onClick: (event: Event) => void;
  isSelected: boolean;
}

/**
 * Props interface for event list component
 * @property events - Array of events to display
 * @property onEventSelect - Selection handler
 * @property selectedEventId - Currently selected event ID
 */
export interface EventListProps {
  events: Event[];
  onEventSelect: (event: Event) => void;
  selectedEventId: string | null;
}

/**
 * Props interface for event import panel component
 * @property onImport - Import handler function
 * @property isLoading - Loading state indicator
 * @property error - Error message if import fails
 */
export interface ImportPanelProps {
  onImport: (input: ImportEventsInput) => Promise<void>;
  isLoading: boolean;
  error: string | null;
}