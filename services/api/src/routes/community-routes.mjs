import crypto from "node:crypto";
import {
  EditorialContentError,
  validateEditorialContent,
} from "../editorial-content.mjs";

export const communityCategories = Object.freeze([
  { id: "general", label: { en: "General", "zh-CN": "综合讨论", ja: "総合" } },
  { id: "algorithms", label: { en: "Algorithms", "zh-CN": "算法交流", ja: "アルゴリズム" } },
  { id: "help", label: { en: "Help", "zh-CN": "求助答疑", ja: "質問・相談" } },
  { id: "showcase", label: { en: "Showcase", "zh-CN": "作品展示", ja: "作品紹介" } },
]);

const categoryIds = new Set(communityCategories.map((category) => category.id));

function validatedPost(body, boundedText, ApiError) {
  const title = boundedText(body.title, 160);
  if (title.length < 3) throw new ApiError(400, "EDITORIAL_CONTENT_REQUIRED");
  try {
    return {
      title,
      document: validateEditorialContent(body.content, body.contentFormat),
    };
  } catch (error) {
    if (error instanceof EditorialContentError) {
      throw new ApiError(400, error.code);
    }
    throw error;
  }
}

export async function handlePublicCommunityRoutes(context) {
  const {
    request, response, url, database, json, ApiError, boundedText, authenticate,
  } = context;

  if (request.method === "GET" && url.pathname === "/v1/community/categories") {
    json(response, 200, { categories: communityCategories });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/community/users") {
    const page = Math.max(1, Math.round(Number(url.searchParams.get("page")) || 1));
    const limit = Math.min(60, Math.max(1, Math.round(Number(url.searchParams.get("limit")) || 24)));
    const result = await database.searchPublicPlayers({
      query: boundedText(url.searchParams.get("query"), 120),
      limit,
      offset: (page - 1) * limit,
    });
    json(response, 200, { ...result, page, limit });
    return true;
  }

  if (request.method === "GET" && url.pathname === "/v1/community/posts") {
    const requestedCategory = boundedText(url.searchParams.get("category"), 32);
    const category = categoryIds.has(requestedCategory) ? requestedCategory : undefined;
    const page = Math.max(1, Math.round(Number(url.searchParams.get("page")) || 1));
    const limit = Math.min(50, Math.max(1, Math.round(Number(url.searchParams.get("limit")) || 20)));
    const player = await authenticate(request);
    const feed = await database.listEditorialFeed({
      questId: category,
      scope: "community",
      query: boundedText(url.searchParams.get("query"), 160),
      viewerId: player?.id,
      includeModeration: ["admin", "owner"].includes(player?.role),
      limit,
      offset: (page - 1) * limit,
    });
    json(response, 200, { ...feed, page, limit, categories: communityCategories });
    return true;
  }

  const ojEditorial = url.pathname.match(/^\/v1\/oj\/problems\/(\d{1,12})\/editorial$/);
  if (request.method === "GET" && ojEditorial) {
    const problem = await database.getPublishedOjProblem(Number(ojEditorial[1]));
    if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_FOUND");
    const player = await authenticate(request);
    const moderator = ["admin", "owner"].includes(player?.role);
    const eligibility = player
      ? await database.editorialEligibility(player.id, `oj-${problem.publicId}`)
      : { hasSubmission: false, hasAccepted: false };
    const posts = await database.listEditorialPosts({
      questId: String(problem.publicId),
      scope: "oj",
      viewerId: player?.id,
      includeModeration: moderator,
      limit: 200,
    });
    json(response, 200, {
      posts,
      eligibility: {
        discussion: moderator || eligibility.hasSubmission,
        solution: moderator || eligibility.hasAccepted,
        directPublish: moderator,
      },
    });
    return true;
  }

  return false;
}

export async function handlePlayerCommunityRoutes(context) {
  const {
    request, response, url, database, player, json, ApiError, boundedText,
    readJson, requirePlayableAccount,
  } = context;

  if (request.method === "POST" && url.pathname === "/v1/community/posts") {
    requirePlayableAccount(player);
    const allowed = await database.consumeRateLimit("community_post:user", player.id, 30, 60 * 60);
    if (!allowed) throw new ApiError(429, "COMMUNITY_POST_RATE_LIMITED", { retryAfterMs: 60 * 60 * 1000 });
    const body = await readJson(request, 160 * 1024);
    const category = boundedText(body.category, 32);
    if (!categoryIds.has(category)) throw new ApiError(400, "INVALID_COMMUNITY_CATEGORY");
    const { title, document } = validatedPost(body, boundedText, ApiError);
    const post = await database.createEditorialPost({
      id: crypto.randomUUID(),
      questId: category,
      scope: "community",
      authorId: player.id,
      kind: "discussion",
      title,
      content: document.content,
      contentFormat: document.contentFormat,
      status: "published",
    });
    json(response, 201, { post });
    return true;
  }

  const ojEditorial = url.pathname.match(/^\/v1\/oj\/problems\/(\d{1,12})\/editorial$/);
  if (request.method === "POST" && ojEditorial) {
    requirePlayableAccount(player);
    const problem = await database.getPublishedOjProblem(Number(ojEditorial[1]));
    if (!problem) throw new ApiError(404, "OJ_PROBLEM_NOT_FOUND");
    const body = await readJson(request, 160 * 1024);
    if (body.kind !== "discussion" && body.kind !== "solution") {
      throw new ApiError(400, "INVALID_EDITORIAL_KIND");
    }
    const moderator = ["admin", "owner"].includes(player.role);
    const eligibility = await database.editorialEligibility(player.id, `oj-${problem.publicId}`);
    if (!moderator && body.kind === "discussion" && !eligibility.hasSubmission) {
      throw new ApiError(403, "OJ_SUBMISSION_REQUIRED");
    }
    if (!moderator && body.kind === "solution" && !eligibility.hasAccepted) {
      throw new ApiError(403, "OJ_ACCEPTED_REQUIRED");
    }
    const { title, document } = validatedPost(body, boundedText, ApiError);
    const post = await database.createEditorialPost({
      id: crypto.randomUUID(),
      questId: String(problem.publicId),
      scope: "oj",
      authorId: player.id,
      kind: body.kind,
      title,
      content: document.content,
      contentFormat: document.contentFormat,
      status: body.kind === "discussion" || moderator ? "published" : "pending",
    });
    json(response, 201, { post });
    return true;
  }

  return false;
}
