-- Enforce the event time format server-side, not just client-side. Free-text
-- events.time could previously hold anything ("TBD", "7-9 PM"), which
-- lib/dateUtils.ts's parseEventStartMinutes/parseEventEndMinutes already
-- refused to guess at (returns null rather than silently defaulting to
-- midnight) but the ics/Google Calendar export would then fall back to a
-- default duration or midnight without any warning to the admin. This
-- constraint matches lib/dateUtils.ts's EVENT_TIME_PATTERN exactly, so
-- anything that saves is guaranteed to parse correctly downstream. No
-- existing rows to grandfather (events table is currently empty), so this
-- validates immediately rather than NOT VALID.
ALTER TABLE events
ADD CONSTRAINT events_time_format_check
CHECK (time ~ '^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm)(\s*-\s*(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm))?$');
