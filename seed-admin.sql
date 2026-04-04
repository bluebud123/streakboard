UPDATE "User" SET "isAdmin" = true WHERE username = 'bluebud';
INSERT INTO "SiteSetting" (key, value) VALUES ('anonymousGraphs', 'false') ON CONFLICT (key) DO NOTHING;
