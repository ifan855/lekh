CREATE TABLE "editor_presence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chapter_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"block_id" uuid,
	"offset" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "editor_presence" ADD CONSTRAINT "editor_presence_chapter_id_chapters_id_fk" FOREIGN KEY ("chapter_id") REFERENCES "public"."chapters"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "editor_presence" ADD CONSTRAINT "editor_presence_user_id_profiles_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "editor_presence_chapter_idx" ON "editor_presence" USING btree ("chapter_id");--> statement-breakpoint
CREATE UNIQUE INDEX "editor_presence_user_chapter_idx" ON "editor_presence" USING btree ("chapter_id","user_id");