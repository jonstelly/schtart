CREATE TABLE "dashboard_server_default" (
	"id" integer PRIMARY KEY NOT NULL,
	"yaml" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "dashboard_server_default_singleton_check" CHECK ("dashboard_server_default"."id" = 1)
);
--> statement-breakpoint
CREATE TABLE "dashboard_user_configuration" (
	"user_id" text PRIMARY KEY NOT NULL,
	"yaml" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "dashboard_user_configuration" ADD CONSTRAINT "dashboard_user_configuration_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;