-- Secure RLS and Revoke API privileges for sensitive tables

REVOKE ALL PRIVILEGES ON TABLE public."AdminSession" FROM anon, authenticated;
ALTER TABLE public."AdminSession" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."ClientSession" FROM anon, authenticated;
ALTER TABLE public."ClientSession" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."TrackingSession" FROM anon, authenticated;
ALTER TABLE public."TrackingSession" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."RateLimitWindow" FROM anon, authenticated;
ALTER TABLE public."RateLimitWindow" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."DossierDocument" FROM anon, authenticated;
ALTER TABLE public."DossierDocument" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."PasswordResetChallenge" FROM anon, authenticated;
ALTER TABLE public."PasswordResetChallenge" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."PushSubscription" FROM anon, authenticated;
ALTER TABLE public."PushSubscription" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."WhatsAppConversation" FROM anon, authenticated;
ALTER TABLE public."WhatsAppConversation" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."WhatsAppMessage" FROM anon, authenticated;
ALTER TABLE public."WhatsAppMessage" ENABLE ROW LEVEL SECURITY;

REVOKE ALL PRIVILEGES ON TABLE public."_prisma_migrations" FROM anon, authenticated;
ALTER TABLE public."_prisma_migrations" ENABLE ROW LEVEL SECURITY;
