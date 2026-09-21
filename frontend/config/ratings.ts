/**
 * Bartcash — Ratings Service
 *
 * Endpoints covered:
 *   POST /ratings
 *   GET  /users/{id}/ratings
 */

import api from "./api";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RatingSubmitter {
  id: string;
  first_name: string;
  last_name: string;
  profile_photo: string | null;
}

export interface Rating {
  id: string;
  score: number;
  review: string | null;
  rater: RatingSubmitter;
  created_at: string;
}

export interface SubmitRatingPayload {
  trade_id: string;
  score: number;
  review?: string;
}

export interface UserRatingsResponse {
  ratings: Rating[];
  average_rating: string;
  total_ratings: number;
  next_cursor: string | null;
}

// ─── API Functions ────────────────────────────────────────────────────────────

/**
 * Submit a rating for a trading partner after a completed trade.
 * POST /ratings
 */
export async function submitRating(
  payload: SubmitRatingPayload,
): Promise<Rating> {
  const response = await api.post("/ratings", payload);
  return response.data.data.rating;
}

/**
 * Get all ratings received by a user.
 * GET /users/{id}/ratings
 */
export async function getUserRatings(
  userId: string,
  params: { cursor?: string; limit?: number } = {},
): Promise<UserRatingsResponse> {
  const response = await api.get(`/users/${userId}/ratings`, { params });
  return response.data.data;
}
