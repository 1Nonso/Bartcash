-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "first_name" VARCHAR(100) NOT NULL,
    "last_name" VARCHAR(100) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password" VARCHAR(255) NOT NULL,
    "profile_photo" VARCHAR(500),
    "bio" TEXT,
    "location" VARCHAR(255),
    "average_rating" DECIMAL(3,2) NOT NULL DEFAULT 0.00,
    "total_trades" INTEGER NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "email_verified_at" TIMESTAMP(6),
    "push_token" TEXT,
    "taste_updated_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "revoked" BOOLEAN NOT NULL DEFAULT false,
    "revoked_at" TIMESTAMP(6),
    "ip_address" VARCHAR(45),
    "user_agent" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "password_reset_tokens" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "token" VARCHAR(500) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "password_reset_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_codes" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "code_hash" VARCHAR(255) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_codes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_attempts" (
    "id" UUID NOT NULL,
    "key" VARCHAR(255) NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "window_start" TIMESTAMP(6) NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "rate_limit_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "categories" (
    "id" UUID NOT NULL,
    "name" VARCHAR(100) NOT NULL,
    "slug" VARCHAR(100) NOT NULL,
    "icon" VARCHAR(100),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "items" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "description" TEXT NOT NULL,
    "condition" VARCHAR(20) NOT NULL,
    "desired_trade" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'available',
    "is_service" BOOLEAN NOT NULL DEFAULT false,
    "location" VARCHAR(255),
    "user_declared_value" DECIMAL(10,2),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_images" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "url" VARCHAR(500) NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "display_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "item_images_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_valuations" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "value_min" DECIMAL(10,2),
    "value_max" DECIMAL(10,2),
    "currency" VARCHAR(3) NOT NULL DEFAULT 'USD',
    "confidence" VARCHAR(20),
    "raw_response" JSONB,
    "api_model" VARCHAR(100),
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "failed_reason" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "item_valuations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" UUID NOT NULL,
    "proposer_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "trade_type" VARCHAR(20) NOT NULL,
    "status" VARCHAR(20) NOT NULL,
    "current_offer_by" UUID,
    "awaiting_response_from" UUID,
    "round_started_at" TIMESTAMP(6),
    "completion_method" VARCHAR(20),
    "meetup_details" TEXT,
    "delivery_details" TEXT,
    "proposer_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "receiver_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "completed_at" TIMESTAMP(6),
    "cancelled_at" TIMESTAMP(6),
    "cancelled_by" UUID,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_items" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "offered_by" UUID NOT NULL,
    "side" VARCHAR(20) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "trade_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trade_offers" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "offered_by" UUID NOT NULL,
    "trade_type" VARCHAR(50) NOT NULL,
    "cash_amount" DECIMAL(10,2),
    "top_up_amount" DECIMAL(10,2),
    "offered_item_ids" JSONB NOT NULL,
    "is_current" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trade_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "trade_type" VARCHAR(50) NOT NULL,
    "proposer_id" UUID NOT NULL,
    "receiver_id" UUID NOT NULL,
    "receiver_item_id" UUID,
    "offered_item_ids" JSONB NOT NULL,
    "agreed_cash_amount" DECIMAL(10,2),
    "agreed_top_up_amount" DECIMAL(10,2),
    "status" VARCHAR(30) NOT NULL,
    "agreed_at" TIMESTAMP(6),
    "completed_at" TIMESTAMP(6),

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "messages" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "sender_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "comments" (
    "id" UUID NOT NULL,
    "listing_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "body" TEXT NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ratings" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "rater_id" UUID NOT NULL,
    "rated_id" UUID NOT NULL,
    "score" SMALLINT NOT NULL,
    "review" TEXT,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,
    "deleted_at" TIMESTAMP(6),

    CONSTRAINT "ratings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "disputes" (
    "id" UUID NOT NULL,
    "trade_id" UUID NOT NULL,
    "raised_by" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'open',
    "resolution_notes" TEXT,
    "resolved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "disputes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "type" VARCHAR(30) NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "body" TEXT NOT NULL,
    "reference_id" UUID,
    "reference_type" VARCHAR(50),
    "read_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_tastes" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'pending',
    "qloo_entity_id" VARCHAR(100),
    "qloo_entity_name" VARCHAR(255),
    "qloo_entity_type" VARCHAR(20),
    "resolution_source" VARCHAR(30),
    "confidence" DECIMAL(3,2),
    "tags" JSONB,
    "related_entities" JSONB,
    "want_suggestions" JSONB,
    "suggestion_source" VARCHAR(20),
    "failed_reason" TEXT,
    "resolved_at" TIMESTAMP(6),
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "item_tastes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "item_wants" (
    "id" UUID NOT NULL,
    "item_id" UUID NOT NULL,
    "category_id" UUID NOT NULL,
    "rank" SMALLINT NOT NULL,
    "was_suggested" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "item_wants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_taste_entities" (
    "id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "qloo_entity_id" VARCHAR(100) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "entity_type" VARCHAR(20) NOT NULL,
    "image_url" VARCHAR(500),
    "tags" JSONB,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "user_taste_entities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "taste_compatibilities" (
    "id" UUID NOT NULL,
    "user_a_id" UUID NOT NULL,
    "user_b_id" UUID NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "method" VARCHAR(30) NOT NULL,
    "shared_entities" JSONB NOT NULL,
    "shared_tags" JSONB,
    "stale" BOOLEAN NOT NULL DEFAULT false,
    "computed_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "taste_compatibilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_results" (
    "id" UUID NOT NULL,
    "source_item_id" UUID NOT NULL,
    "candidate_item_id" UUID NOT NULL,
    "rank" INTEGER NOT NULL,
    "score" DECIMAL(4,3) NOT NULL,
    "wants_fit" DECIMAL(4,3),
    "taste_affinity" DECIMAL(4,3),
    "reciprocal_fit" DECIMAL(4,3),
    "owner_compatibility" DECIMAL(4,3),
    "pool_tier" SMALLINT NOT NULL,
    "source" VARCHAR(20) NOT NULL,
    "reason" VARCHAR(255),
    "explanation" JSONB,
    "computed_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "match_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qloo_cache" (
    "id" UUID NOT NULL,
    "cache_key" VARCHAR(255) NOT NULL,
    "endpoint" VARCHAR(40) NOT NULL,
    "response" JSONB NOT NULL,
    "expires_at" TIMESTAMP(6) NOT NULL,
    "created_at" TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "qloo_cache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "qloo_usage" (
    "id" UUID NOT NULL,
    "calls_since_start" INTEGER NOT NULL DEFAULT 0,
    "remaining_reported" INTEGER,
    "limit_reported" INTEGER,
    "updated_at" TIMESTAMP(6) NOT NULL,

    CONSTRAINT "qloo_usage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_key" ON "refresh_tokens"("token");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_user_id" ON "refresh_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_token_revoked" ON "refresh_tokens"("token", "revoked");

-- CreateIndex
CREATE INDEX "idx_password_reset_tokens_user_id" ON "password_reset_tokens"("user_id");

-- CreateIndex
CREATE INDEX "idx_otp_codes_email" ON "otp_codes"("email");

-- CreateIndex
CREATE UNIQUE INDEX "rate_limit_attempts_key_key" ON "rate_limit_attempts"("key");

-- CreateIndex
CREATE UNIQUE INDEX "categories_name_key" ON "categories"("name");

-- CreateIndex
CREATE UNIQUE INDEX "categories_slug_key" ON "categories"("slug");

-- CreateIndex
CREATE INDEX "idx_items_user_id" ON "items"("user_id");

-- CreateIndex
CREATE INDEX "idx_items_category_id" ON "items"("category_id");

-- CreateIndex
CREATE INDEX "idx_item_images_item_id" ON "item_images"("item_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_valuations_item_id_key" ON "item_valuations"("item_id");

-- CreateIndex
CREATE INDEX "idx_item_valuations_item_id" ON "item_valuations"("item_id");

-- CreateIndex
CREATE INDEX "trades_awaiting_response_from_idx" ON "trades"("awaiting_response_from");

-- CreateIndex
CREATE INDEX "idx_trades_proposer_id" ON "trades"("proposer_id");

-- CreateIndex
CREATE INDEX "idx_trades_receiver_id" ON "trades"("receiver_id");

-- CreateIndex
CREATE INDEX "idx_trades_cancelled_by" ON "trades"("cancelled_by");

-- CreateIndex
CREATE INDEX "idx_trade_items_trade_id" ON "trade_items"("trade_id");

-- CreateIndex
CREATE INDEX "idx_trade_items_item_id" ON "trade_items"("item_id");

-- CreateIndex
CREATE INDEX "trade_offers_trade_id_idx" ON "trade_offers"("trade_id");

-- CreateIndex
CREATE INDEX "trade_offers_offered_by_idx" ON "trade_offers"("offered_by");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_trade_id_key" ON "transactions"("trade_id");

-- CreateIndex
CREATE INDEX "transactions_proposer_id_idx" ON "transactions"("proposer_id");

-- CreateIndex
CREATE INDEX "transactions_receiver_id_idx" ON "transactions"("receiver_id");

-- CreateIndex
CREATE INDEX "transactions_receiver_item_id_idx" ON "transactions"("receiver_item_id");

-- CreateIndex
CREATE INDEX "idx_messages_trade_id" ON "messages"("trade_id");

-- CreateIndex
CREATE INDEX "idx_messages_sender_id" ON "messages"("sender_id");

-- CreateIndex
CREATE INDEX "comments_listing_id_idx" ON "comments"("listing_id");

-- CreateIndex
CREATE INDEX "comments_user_id_idx" ON "comments"("user_id");

-- CreateIndex
CREATE INDEX "idx_ratings_trade_id" ON "ratings"("trade_id");

-- CreateIndex
CREATE INDEX "idx_ratings_rater_id" ON "ratings"("rater_id");

-- CreateIndex
CREATE INDEX "idx_ratings_rated_id" ON "ratings"("rated_id");

-- CreateIndex
CREATE UNIQUE INDEX "ratings_trade_id_rater_id_key" ON "ratings"("trade_id", "rater_id");

-- CreateIndex
CREATE UNIQUE INDEX "disputes_trade_id_key" ON "disputes"("trade_id");

-- CreateIndex
CREATE INDEX "idx_disputes_trade_id" ON "disputes"("trade_id");

-- CreateIndex
CREATE INDEX "idx_disputes_raised_by" ON "disputes"("raised_by");

-- CreateIndex
CREATE INDEX "idx_notifications_user_id" ON "notifications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_tastes_item_id_key" ON "item_tastes"("item_id");

-- CreateIndex
CREATE INDEX "idx_item_wants_item_id" ON "item_wants"("item_id");

-- CreateIndex
CREATE INDEX "idx_item_wants_category_id" ON "item_wants"("category_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_wants_item_id_category_id_key" ON "item_wants"("item_id", "category_id");

-- CreateIndex
CREATE UNIQUE INDEX "item_wants_item_id_rank_key" ON "item_wants"("item_id", "rank");

-- CreateIndex
CREATE INDEX "idx_user_taste_user_id" ON "user_taste_entities"("user_id");

-- CreateIndex
CREATE INDEX "idx_user_taste_entity_id" ON "user_taste_entities"("qloo_entity_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_taste_entities_user_id_qloo_entity_id_key" ON "user_taste_entities"("user_id", "qloo_entity_id");

-- CreateIndex
CREATE INDEX "idx_taste_compat_user_a" ON "taste_compatibilities"("user_a_id");

-- CreateIndex
CREATE INDEX "idx_taste_compat_user_b" ON "taste_compatibilities"("user_b_id");

-- CreateIndex
CREATE UNIQUE INDEX "taste_compatibilities_user_a_id_user_b_id_key" ON "taste_compatibilities"("user_a_id", "user_b_id");

-- CreateIndex
CREATE INDEX "idx_match_results_source_rank" ON "match_results"("source_item_id", "rank");

-- CreateIndex
CREATE INDEX "idx_match_results_candidate" ON "match_results"("candidate_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "match_results_source_item_id_candidate_item_id_key" ON "match_results"("source_item_id", "candidate_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "qloo_cache_cache_key_key" ON "qloo_cache"("cache_key");

-- CreateIndex
CREATE INDEX "idx_qloo_cache_expires_at" ON "qloo_cache"("expires_at");

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "items" ADD CONSTRAINT "items_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_images" ADD CONSTRAINT "item_images_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_valuations" ADD CONSTRAINT "item_valuations_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_cancelled_by_fkey" FOREIGN KEY ("cancelled_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_current_offer_by_fkey" FOREIGN KEY ("current_offer_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trades" ADD CONSTRAINT "trades_awaiting_response_from_fkey" FOREIGN KEY ("awaiting_response_from") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_items" ADD CONSTRAINT "trade_items_offered_by_fkey" FOREIGN KEY ("offered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trade_offers" ADD CONSTRAINT "trade_offers_offered_by_fkey" FOREIGN KEY ("offered_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_proposer_id_fkey" FOREIGN KEY ("proposer_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_receiver_item_id_fkey" FOREIGN KEY ("receiver_item_id") REFERENCES "items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_listing_id_fkey" FOREIGN KEY ("listing_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "comments" ADD CONSTRAINT "comments_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rater_id_fkey" FOREIGN KEY ("rater_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ratings" ADD CONSTRAINT "ratings_rated_id_fkey" FOREIGN KEY ("rated_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "disputes" ADD CONSTRAINT "disputes_raised_by_fkey" FOREIGN KEY ("raised_by") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_tastes" ADD CONSTRAINT "item_tastes_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_wants" ADD CONSTRAINT "item_wants_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "item_wants" ADD CONSTRAINT "item_wants_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_taste_entities" ADD CONSTRAINT "user_taste_entities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_compatibilities" ADD CONSTRAINT "taste_compatibilities_user_a_id_fkey" FOREIGN KEY ("user_a_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "taste_compatibilities" ADD CONSTRAINT "taste_compatibilities_user_b_id_fkey" FOREIGN KEY ("user_b_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_source_item_id_fkey" FOREIGN KEY ("source_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_results" ADD CONSTRAINT "match_results_candidate_item_id_fkey" FOREIGN KEY ("candidate_item_id") REFERENCES "items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

