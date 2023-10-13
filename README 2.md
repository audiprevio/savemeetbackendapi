
BIZ REQUIREMENTS:
Need to create the following APIs

[Creating the events in the first place]
EVENTS = POST
EVENT BODY REQ: EVENT TITLE - EVENT ATTENDEES (EMAIL ARRAY) - DURATION - HOURLY RATE - START & END TIME

[Changing Event details]
EVENT PUT: TITLE
-->EVENT ATTENDEES
-->EVENT DURATION
-->EVENT STARTS

[See Event Created]
EVENT GET
-->EVENT Employee can only their event
-->EVENT director and admin can see all event


NEED TO MOVE THESE BUILT IN FUNCTIONS LATER ON BACK TO CONTROLLER
-------------------------------------------------------------------

Note: each event need to be able to list all the attendees when get, do we even need different attendee model?
