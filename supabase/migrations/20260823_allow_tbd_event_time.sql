-- Allow "TBD" (any case) as a deliberate literal value for events.time,
-- alongside the existing "7:00 PM" / "7:00 PM - 9:00 PM" pattern. Mirrors
-- lib/dateUtils.ts's isValidEventTimeFormat(), which now accepts the same
-- two shapes. The calendar export code (lib/calendarExport.ts) checks for
-- "TBD" specifically and renders those events as all-day entries instead
-- of parsing a (nonexistent) time out of the string.
ALTER TABLE events DROP CONSTRAINT events_time_format_check;
ALTER TABLE events
ADD CONSTRAINT events_time_format_check
CHECK (
  upper(trim(time)) = 'TBD'
  OR time ~ '^(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm)(\s*-\s*(1[0-2]|[1-9]):[0-5][0-9]\s?(AM|PM|am|pm))?$'
);
